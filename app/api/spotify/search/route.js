// // app/api/search/route.js
// import { NextResponse } from "next/server";
// import { getToken } from "next-auth/jwt";
// import { withCORS, preflight } from "../../_utils/cors";;

// // CORS preflight for browsers (OPTIONS)
// export const OPTIONS = preflight;

// /* --------------- Spotify helpers --------------- */

// async function spFetch(path, accessToken) {
//   const res = await fetch(`https://api.spotify.com/v1${path}`, {
//     headers: { Authorization: `Bearer ${accessToken}` },
//   });
//   const json = await res.json().catch(() => ({}));
//   if (!res.ok) {
//     throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(json)}`);
//   }
//   return json;
// }

// function pickBest(items, wantedSong, wantedArtist) {
//   if (!items?.length) return null;
//   const norm = (s = "") => s.toLowerCase().trim();
//   const ws = norm(wantedSong);
//   const wa = norm(wantedArtist);

//   // 1) Exact title + exact artist
//   const exact = items.find(
//     (t) => norm(t.name) === ws && t.artists.some((a) => norm(a.name) === wa)
//   );
//   if (exact) return exact;

//   // 2) Title contains + (optional) artist contains
//   const loose = items.find(
//     (t) =>
//       norm(t.name).includes(ws) &&
//       (wa ? t.artists.some((a) => norm(a.name).includes(wa)) : true)
//   );
//   if (loose) return loose;

//   // 3) First result fallback
//   return items[0];
// }

// /* ------------------ Route: POST ----------------- */
// /** Wrapped with withCORS so the response gets correct CORS headers. */
// export const POST = withCORS(async (req) => {
//   try {
//     // 1) Ensure user is authenticated via NextAuth (cookie)
//     const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
//     if (!token?.accessToken) {
//       return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
//     }

//     // 2) Parse incoming rows
//     const { rows } = await req.json();
//     if (!Array.isArray(rows)) {
//       return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
//     }

//     const seenISRC = new Set();
//     const results = [];

//     // 3) Search Spotify for each row
//     for (const row of rows) {
//       const song = (row.song || "").trim();
//       const artist = (row.artist || "").trim();

//       let q;
//       if (song && artist) {
//         q = `q=track:${encodeURIComponent(song)}%20artist:${encodeURIComponent(
//           artist
//         )}&type=track&limit=5`;
//       } else {
//         const qLine = song || artist;
//         q = `q=${encodeURIComponent(qLine)}&type=track&limit=5`;
//       }

//       try {
//         const data = await spFetch(`/search?${q}`, token.accessToken);
//         const best = pickBest(data.tracks?.items || [], song, artist);

//         if (best) {
//           const isrc = best.external_ids?.isrc || null;
//           const duplicate = isrc ? seenISRC.has(isrc) : false;
//           if (isrc && !duplicate) seenISRC.add(isrc);

//           results.push({
//             input_song: song,
//             input_artist: artist,
//             found: 1,
//             duplicate,
//             uri: best.uri,
//             matched_song: best.name,
//             matched_artist: best.artists.map((a) => a.name).join(", "),
//             isrc,
//             id: best.id,
//           });
//         } else {
//           results.push({
//             input_song: song,
//             input_artist: artist,
//             found: 0,
//             duplicate: false,
//             uri: null,
//             matched_song: null,
//             matched_artist: null,
//             isrc: null,
//             id: null,
//           });
//         }
//       } catch (e) {
//         results.push({
//           input_song: song,
//           input_artist: artist,
//           found: 0,
//           duplicate: false,
//           uri: null,
//           matched_song: null,
//           matched_artist: null,
//           isrc: null,
//           id: null,
//           error: String(e.message || e),
//         });
//       }
//     }

//     // 4) Summary
//     const summary = {
//       total: results.length,
//       found: results.filter((r) => r.found).length,
//       notFound: results.filter((r) => !r.found).length,
//       duplicates: results.filter((r) => r.duplicate).length,
//     };

//     // Return a plain object; withCORS will JSON-ify and add headers.
//     return { results, summary };
//   } catch (err) {
//     return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
//   }
// });

// app/api/spotify/search/route.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withCORS, preflight } from "../../_utils/cors"; // <-- correct relative path

// CORS preflight
export const OPTIONS = preflight;

/* --------------- Spotify helpers --------------- */
async function spFetch(path, accessToken) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(json)}`);
  }
  return json;
}

function pickBest(items, wantedSong, wantedArtist) {
  if (!items?.length) return null;
  const norm = (s = "") => s.toLowerCase().trim();
  const ws = norm(wantedSong);
  const wa = norm(wantedArtist);

  // 1) Exact title + exact artist
  const exact = items.find(
    (t) => norm(t.name) === ws && t.artists.some((a) => norm(a.name) === wa)
  );
  if (exact) return exact;

  // 2) Title contains + (optional) artist contains
  const loose = items.find(
    (t) =>
      norm(t.name).includes(ws) &&
      (wa ? t.artists.some((a) => norm(a.name).includes(wa)) : true)
  );
  if (loose) return loose;

  // 3) First result fallback
  return items[0];
}

/* ------------------ Route: POST ----------------- */
// Return a POJO; withCORS will JSON-ify and add headers.
export const POST = withCORS(async (req) => {
  try {
    // 1) Ensure user is authenticated via NextAuth (cookie)
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Parse incoming rows
    const { rows } = await req.json();
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
    }

    const seenISRC = new Set();
    const results = [];

    // 3) Search Spotify for each row
    for (const row of rows) {
      const song = (row.song || "").trim();
      const artist = (row.artist || "").trim();

      let q;
      if (song && artist) {
        q = `q=track:${encodeURIComponent(song)}%20artist:${encodeURIComponent(
          artist
        )}&type=track&limit=5`;
      } else {
        const qLine = song || artist;
        q = `q=${encodeURIComponent(qLine)}&type=track&limit=5`;
      }

      try {
        const data = await spFetch(`/search?${q}`, token.accessToken);
        const best = pickBest(data.tracks?.items || [], song, artist);

        if (best) {
          const isrc = best.external_ids?.isrc || null;
          const duplicate = isrc ? seenISRC.has(isrc) : false;
          if (isrc && !duplicate) seenISRC.add(isrc);

          results.push({
            input_song: song,
            input_artist: artist,
            found: 1,
            duplicate,
            uri: best.uri,
            matched_song: best.name,
            matched_artist: best.artists.map((a) => a.name).join(", "),
            isrc,
            id: best.id,
          });
        } else {
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

    // 4) Summary
    const summary = {
      total: results.length,
      found: results.filter((r) => r.found).length,
      notFound: results.filter((r) => !r.found).length,
      duplicates: results.filter((r) => r.duplicate).length,
    };

    return { results, summary };
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
});
