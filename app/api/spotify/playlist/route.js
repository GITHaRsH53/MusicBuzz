// // app/api/spotify/playlist/route.js
// // Purpose: create a Spotify playlist for the logged-in user and add tracks in batches of 100.

// import { NextResponse } from "next/server";
// import { getToken } from "next-auth/jwt";

// // Helper: call Spotify API with bearer token
// async function spFetch(path, accessToken, options = {}) {
//   const res = await fetch(`https://api.spotify.com/v1${path}`, {
//     ...options,
//     headers: {
//       Authorization: `Bearer ${accessToken}`,
//       "Content-Type": "application/json",
//       ...(options.headers || {}),
//     },
//   });
//   const json = await res.json().catch(() => ({}));
//   if (!res.ok) {
//     throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(json)}`);
//   }
//   return json;
// }

// // Chunk array into arrays of size n
// const chunk = (arr, n = 100) => {
//   const out = [];
//   for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
//   return out;
// };

// export async function POST(req) {
//   try {
//     // 1) Ensure user is authenticated (token from NextAuth JWT cookie)
//     const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
//     if (!token?.accessToken) {
//       return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
//     }

//     // 2) Read request body
//     const { name, uris, isPublic = false, description = "Created by MusicBuzz" } = await req.json() || {};
//     if (!name || !Array.isArray(uris) || uris.length === 0) {
//       return NextResponse.json({ error: "name and non-empty uris[] are required" }, { status: 400 });
//     }

//     // 3) Get current user ID
//     const me = await spFetch("/me", token.accessToken);

//     // 4) Create playlist
//     const playlist = await spFetch(`/users/${me.id}/playlists`, token.accessToken, {
//       method: "POST",
//       body: JSON.stringify({ name, public: isPublic, description }),
//     });

//     // 5) Add tracks in batches of 100
//     const batches = chunk(uris, 100);
//     for (const batch of batches) {
//       await spFetch(`/playlists/${playlist.id}/tracks`, token.accessToken, {
//         method: "POST",
//         body: JSON.stringify({ uris: batch }),
//       });
//     }

//     // 6) Done
//     return NextResponse.json({
//       id: playlist.id,
//       url: playlist.external_urls?.spotify,
//       name: playlist.name,
//       added: uris.length,
//       batches: batches.length,
//     });
//   } catch (err) {
//     return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
//   }
// }

// app/api/spotify/search/route.js
// Purpose: receive [{song, artist}] rows, search Spotify for each,
// pick the best match, mark duplicates by ISRC, and return a report.
// ---- UPDATED: adds CORS so Lovable frontend can call this cross-origin.



// app/api/spotify/playlist/route.js
// Purpose: create a Spotify playlist for the logged-in user and add tracks in batches of 100.
// ---- UPDATED: adds CORS so Lovable frontend can call this cross-origin.

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/** Build CORS headers for a given request origin (Lovable SPA). */
function corsHeaders(req) {
  const allowed = (process.env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim());
  const origin = req.headers.get("origin") || "";
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

function jsonWithCORS(req, body, init = {}) {
  const res = NextResponse.json(body, init);
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export function OPTIONS(req) {
  const res = new NextResponse(null, { status: 204 });
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

// Helper: call Spotify API with bearer token
async function spFetch(path, accessToken, options = {}) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(json)}`);
  }
  return json;
}

// Chunk array into arrays of size n
const chunk = (arr, n = 100) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/** Handle POST /api/spotify/playlist (called by Lovable via fetch(..., { credentials:'include' })) */
export async function POST(req) {
  try {
    // 1) Ensure user is authenticated (NextAuth JWT cookie)
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.accessToken) {
      return jsonWithCORS(req, { error: "Not authenticated" }, { status: 401 });
    }

    // 2) Read request body
    const { name, uris, isPublic = false, description = "Created by MusicBuzz" } =
      (await req.json()) || {};
    if (!name || !Array.isArray(uris) || uris.length === 0) {
      return jsonWithCORS(req, { error: "name and non-empty uris[] are required" }, { status: 400 });
    }

    // 3) Get current user ID
    const me = await spFetch("/me", token.accessToken);

    // 4) Create playlist
    const playlist = await spFetch(`/users/${me.id}/playlists`, token.accessToken, {
      method: "POST",
      body: JSON.stringify({ name, public: isPublic, description }),
    });

    // 5) Add tracks in batches of 100
    const batches = chunk(uris, 100);
    for (const batch of batches) {
      await spFetch(`/playlists/${playlist.id}/tracks`, token.accessToken, {
        method: "POST",
        body: JSON.stringify({ uris: batch }),
      });
    }

    // 6) Done
    return jsonWithCORS(req, {
      id: playlist.id,
      url: playlist.external_urls?.spotify,
      name: playlist.name,
      added: uris.length,
      batches: batches.length,
    });
  } catch (err) {
    return jsonWithCORS(req, { error: String(err?.message || err) }, { status: 500 });
  }
}
