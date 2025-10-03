// app/api/_utils/cors.js

import { NextResponse } from "next/server";

/** Build CORS headers for a specific origin */
function buildCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, X-CSRF-Token",
    Vary: "Origin",
  };
}

/** Pick an allowed origin based on env + request */
export function resolveAllowedOrigin(req) {
  const allowedFromEnv = process.env.ALLOWED_ORIGIN; // e.g. "http://127.0.0.1:5173,http://localhost:5173"
  const fallback = "http://127.0.0.1:5173";

  // Force to string before split()
  const list = String(allowedFromEnv || fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const requestOrigin = req.headers.get("origin") || "";

  if (list.includes("*")) return requestOrigin || list[0] || fallback;
  return list.includes(requestOrigin) ? requestOrigin : list[0] || fallback;
}

/** OPTIONS preflight handler */
export function preflight(req) {
  const origin = resolveAllowedOrigin(req);
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

/** Wrap a route handler and add CORS headers to its response */
export function withCORS(handler) {
  return async (req) => {
    const origin = resolveAllowedOrigin(req);

    // Run the actual handler
    const result = await handler(req, origin);

    // If the handler already returned a Response, just add headers
    if (result instanceof Response) {
      const headers = buildCorsHeaders(origin);
      Object.entries(headers).forEach(([k, v]) => result.headers.set(k, v));
      return result;
    }

    // Otherwise, JSON-ify the result
    return NextResponse.json(result, {
      headers: buildCorsHeaders(origin),
    });
  };
}
