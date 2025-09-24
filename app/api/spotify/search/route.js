// app/api/spotify/search/route.js
// Purpose: receive [{song, artist}] rows, search Spotify for each,
// pick the best match, mark duplicates by ISRC, and return a report.

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/** Call Spotify Web API with the user's access token (from NextAuth JWT). */
async function spFetch(path, accessToken) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Bubble up a helpful error for debugging
    throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(json)}`);
  }
  return json;
}

/** Pick a “best” track from Spotify results with simple heuristics. */
function pickBest(items, wantedSong, wantedArtist) {
  if (!items?.length) return null;

  const norm = (s = "") => s.toLowerCase().trim();
  const ws = norm(wantedSong);
  const wa = norm(wantedArtist);

  // 1) Exact title + exact artist
  const exact = items.find(
    t => norm(t.name) === ws && t.artists.some(a => norm(a.name) === wa)
  );
  if (exact) return exact;

  // 2) Title contains + (optional) artist contains
  const loose = items.find(
    t => norm(t.name).includes(ws) && (wa ? t.artists.some(a => norm(a.name).includes(wa)) : true)
  );
  if (loose) return loose;

  // 3) Fallback: first result
  return items[0];
}

/** Handle POST /api/spotify/search */
export async function POST(req) {
  try {
    // 1) Verify user is logged in and get Spotify accessToken from JWT cookie
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Parse input rows
    const { rows } = await req.json();
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
    }

    // We'll mark duplicates using ISRC (industry code for a recording)
    const seenISRC = new Set();
    const results = [];

    // 3) For each row, search Spotify and record best match
    for (const row of rows) {
      const song = (row.song || "").trim();
      const artist = (row.artist || "").trim();

      // Build a good Spotify query
      let q;
      if (song && artist) {
        // “track:… artist:…” narrows results a lot
        q = `q=track:${encodeURIComponent(song)}%20artist:${encodeURIComponent(artist)}&type=track&limit=5`;
      } else {
        // If we only have song *or* artist, just send whatever we have
        const qLine = song || artist;
        q = `q=${encodeURIComponent(qLine)}&type=track&limit=5`;
      }

      try {
        // Call Spotify Search API
        const data = await spFetch(`/search?${q}`, token.accessToken);

        // Decide which returned track is “best”
        const best = pickBest(data.tracks?.items || [], song, artist);

        if (best) {
          const isrc = best.external_ids?.isrc || null;
          const duplicate = isrc ? seenISRC.has(isrc) : false;
          if (isrc && !duplicate) seenISRC.add(isrc);

          // Push a success record
          results.push({
            input_song: song,
            input_artist: artist,
            found: 1,
            duplicate,
            uri: best.uri, // we will use this later to add tracks to a playlist
            matched_song: best.name,
            matched_artist: best.artists.map(a => a.name).join(", "),
            isrc,
            id: best.id,
          });
        } else {
          // Push a not-found record
          results.push({
            input_song: song,
            input_artist: artist,
            found: 0,
            duplicate: false,
            uri: null,
            matched_song: null,
            matched_artist: null,
            isrc: null,
            id: null,
          });
        }
      } catch (e) {
        // On API errors, still return a row so the UI is transparent
        results.push({
          input_song: song,
          input_artist: artist,
          found: 0,
          duplicate: false,
          uri: null,
          matched_song: null,
          matched_artist: null,
          isrc: null,
          id: null,
          error: String(e.message || e),
        });
      }
    }

    // 4) Build a quick summary
    const summary = {
      total: results.length,
      found: results.filter(r => r.found).length,
      notFound: results.filter(r => !r.found).length,
      duplicates: results.filter(r => r.duplicate).length,
    };

    // 5) Return everything to the frontend
    return NextResponse.json({ results, summary });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
