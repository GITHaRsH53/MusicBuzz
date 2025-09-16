// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

// Scopes we ask the user to approve (lets us create playlists)
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

    // Return a new token object with updated fields
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

// Main NextAuth handler
const handler = NextAuth({
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      // Ask for the scopes above during the OAuth redirect
      authorization: `https://accounts.spotify.com/authorize?scope=${scopes}`,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET, // used to encrypt the JWT/cookies

  // Callbacks let us customize what’s stored in the JWT and session
  callbacks: {
    // Runs on first sign-in and on every request
    async jwt({ token, account }) {
      // First login: put the tokens into our JWT
      if (account) {
        return {
          accessToken: account.access_token,
          accessTokenExpires: Date.now() + account.expires_in * 1000,
          refreshToken: account.refresh_token,
          user: token.user,
        };
      }

      // If the access token is still valid, use it
      if (Date.now() < (token.accessTokenExpires || 0)) {
        return token;
      }

      // Otherwise, refresh it
      return await refreshAccessToken(token);
    },

    // Make the access token available to the client via useSession()
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error; // e.g., "RefreshAccessTokenError"
      return session;
    },
  },
});

// App Router export (both GET and POST)
export { handler as GET, handler as POST };
