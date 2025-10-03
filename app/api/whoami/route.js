// app/api/whoami/route.js
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { withCORS, preflight } from "../_utils/cors";

// OPTIONS (CORS preflight)
export const OPTIONS = preflight;

// GET /api/whoami
export const GET = withCORS(async (req) => {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Always return a Response in every branch
  if (!token) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        name: token.user?.name || null,
        email: token.user?.email || null,
      },
    },
    { status: 200 }
  );
});
