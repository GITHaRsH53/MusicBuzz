import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/* ---------------- CORS helpers ---------------- */

function resolveAllowedOrigin(req) {
  const list = String(process.env.ALLOWED_ORIGIN || "http://127.0.0.1:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const reqOrigin = req.headers.get("origin") || "";
  if (list.includes("*")) return reqOrigin || list[0];
  return list.includes(reqOrigin) ? reqOrigin : list[0];
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  };
}

function jsonWithCORS(req, body, init = {}) {
  const origin = resolveAllowedOrigin(req);
  const res = NextResponse.json(body, init);
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export function OPTIONS(req) {
  const origin = resolveAllowedOrigin(req);
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      "Content-Length": "0",
    },
  });
}

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

export async function POST(req) {
  try {
    // 1) Ensure user is authenticated
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.accessToken) {
      return jsonWithCORS(req, { error: "Not authenticated" }, { status: 401 });
    }

    // 2) Validate input
    const {
      name,
      uris,
      isPublic = false,
      description = "Created by MusicBuzz",
    } = (await req.json()) || {};

    if (!name || !Array.isArray(uris) || uris.length === 0) {
      return jsonWithCORS(
        req,
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
