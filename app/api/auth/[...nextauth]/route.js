// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

// ─────────────────────────────────────────────────────────────────────────────
// OAuth scopes (lets us create playlists and read email)
const scopes = [
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-email",
].join(" ");

// Helper: refresh an expired Spotify access token using the refresh token
async function refreshAccessToken(token) {
  try {
    const url = "https://accounts.spotify.com/api/token";
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000, // ~1h
      // Some providers don’t always return a new refresh token
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (err) {
    console.error("Error refreshing access token", err);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

// Detect prod (HTTPS) so we can set cookie security appropriately
const isProd =
  process.env.VERCEL === "1" ||
  (process.env.NEXTAUTH_URL || "").startsWith("https://");

// If you want to set the exact frontend to return to after auth:
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  process.env.VITE_CALLBACK_URL ||      // let you reuse the same env as the SPA
  "http://127.0.0.1:5173";

const handler = NextAuth({
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      authorization: `https://accounts.spotify.com/authorize?scope=${scopes}`,
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  /**
   * IMPORTANT for cross-origin auth (backend <> Lovable UI):
   * In production we must use SameSite=None; Secure so the browser will
   * include the session cookie in XHR/fetch requests from a *different* origin.
   * Locally, HTTPS isn’t used, so we fall back to Lax/!secure.
   */
  cookies: {
    // Only this cookie is necessary for JWT sessions
    sessionToken: {
      // Prefix __Secure- when cookie is Secure (best practice)
      name: isProd
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: isProd ? "none" : "lax",
        secure: isProd, // must be true for SameSite=None to be accepted
        path: "/",
      },
    },
  },

  callbacks: {
    // Put (and keep) access tokens in the JWT
    async jwt({ token, account }) {
      if (account) {
        return {
          accessToken: account.access_token,
          accessTokenExpires: Date.now() + account.expires_in * 1000,
          refreshToken: account.refresh_token,
          user: token.user,
        };
      }
      if (Date.now() < (token.accessTokenExpires || 0)) return token;
      return await refreshAccessToken(token);
    },

    // Expose the access token to the client if you ever use useSession()
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error || null;
      return session;
    },

    // Always send the user back to the Lovable frontend after login/signout
    async redirect({ url, baseUrl }) {
      // If NextAuth gives us a full URL (callbackUrl), honor it
      if (url?.startsWith("http://") || url?.startsWith("https://")) return url;
      // Otherwise use your configured frontend origin
      return FRONTEND_ORIGIN;
    },
  },
});

// App Router export (both GET and POST)
export { handler as GET, handler as POST };
