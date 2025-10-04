// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

const SPA_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  process.env.VITE_CALLBACK_URL ||
  "http://127.0.0.1:5173";

/** 🔒 Treat Vercel/production as cross-site and issue Secure/None cookies */
const isCrossSite =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL === "1" ||
  process.env.VERCEL_ENV === "production";

const scopes = [
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-email",
].join(" ");

export const authOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      authorization: `https://accounts.spotify.com/authorize?scope=${scopes}`,
      profile(profile) {
        return {
          id: profile.id,
          name:
            profile.display_name ||
            (profile.email ? profile.email.split("@")[0] : "Spotify user"),
          email: profile.email ?? null,
          image: Array.isArray(profile.images) && profile.images[0]?.url
            ? profile.images[0].url
            : null,
        };
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,

  /** 👇 Force third-party friendly cookies on Vercel/production */
  cookies: isCrossSite
    ? {
        sessionToken: {
          name: "__Secure-next-auth.session-token",
          options: { httpOnly: true, sameSite: "none", secure: true, path: "/" },
        },
        callbackUrl: {
          name: "__Secure-next-auth.callback-url",
          options: { sameSite: "none", secure: true, path: "/" },
        },
        csrfToken: {
          name: "__Host-next-auth.csrf-token",
          options: { sameSite: "none", secure: true, path: "/" },
        },
      }
    : undefined, // local dev stays with default Lax

  callbacks: {
    async jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token;
        token.accessTokenExpires = Date.now() + account.expires_in * 1000;
        token.refreshToken = account.refresh_token ?? token.refreshToken;
      }
      if (user) {
        token.user = {
          id: user.id ?? token.user?.id ?? null,
          name: user.name ?? token.user?.name ?? null,
          email: user.email ?? token.user?.email ?? null,
          image: user.image ?? token.user?.image ?? null,
        };
      }
      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken ?? null;
      session.user = token.user ?? null; // make sure client can see name/email
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("http")) return url;
      return SPA_ORIGIN || baseUrl;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
