// // app/api/playlist/route.js
// import { NextResponse } from "next/server";
// import { getToken } from "next-auth/jwt";
// import { withCORS, preflight } from "../../_utils/cors";

// /* -------------- CORS preflight (OPTIONS) --------------- */
// export const OPTIONS = preflight;

// /* ---------------- Spotify helpers --------------- */
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

// const chunk = (arr, n = 100) => {
//   const out = [];
//   for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
//   return out;
// };

// /* ------------------ Route: POST ----------------- */
// /** Wrapped with withCORS so proper CORS headers are added per request. */
// export const POST = withCORS(async (req) => {
//   try {
//     // 1) Ensure user is authenticated (NextAuth JWT cookie)
//     const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
//     if (!token?.accessToken) {
//       return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
//     }

//     // 2) Validate input
//     const {
//       name,
//       uris,
//       isPublic = false,
//       description = "Created by MusicBuzz",
//     } = (await req.json()) || {};

//     if (!name || !Array.isArray(uris) || uris.length === 0) {
//       return NextResponse.json(
//         { error: "name and non-empty uris[] are required" },
//         { status: 400 }
//       );
//     }

//     // 3) Get current user
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

//     // 6) Respond (withCORS will attach CORS headers)
//     return {
//       id: playlist.id,
//       url: playlist.external_urls?.spotify,
//       name: playlist.name,
//       added: uris.length,
//       batches: batches.length,
//     };
//   } catch (err) {
//     return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
//   }
// });



// app/api/spotify/playlist/route.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withCORS, preflight } from "../../_utils/cors"; // <-- correct relative path

// CORS preflight
export const OPTIONS = preflight;

/* ---------------- Spotify helpers --------------- */
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

const chunk = (arr, n = 100) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/* ------------------ Route: POST ----------------- */
// Return a POJO; withCORS will JSON-ify and add headers.
export const POST = withCORS(async (req) => {
  try {
    // 1) Ensure user is authenticated (NextAuth JWT cookie)
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Validate input
    const {
      name,
      uris,
      isPublic = false,
      description = "Created by MusicBuzz",
    } = (await req.json()) || {};

    if (!name || !Array.isArray(uris) || uris.length === 0) {
      return NextResponse.json(
        { error: "name and non-empty uris[] are required" },
        { status: 400 }
      );
    }

    // 3) Get current user
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

    // 6) Respond
    return {
      id: playlist.id,
      url: playlist.external_urls?.spotify,
      name: playlist.name,
      added: uris.length,
      batches: batches.length,
    };
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
});
