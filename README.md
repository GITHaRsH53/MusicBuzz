# MusicBuzz – Spotify Playlist Generator

Turn long song lists into Spotify playlists in seconds.  
Paste text or upload a CSV (`song, artist`), we search Spotify, dedupe by **ISRC**, and create a playlist in your account.

> **Important policy note (May 15, 2025):**  
> Spotify now requires apps to be owned by an **organization** for full public approval. Individual developers can still build/test, but **only allow-listed users** (testers) can authenticate.  
> This project supports that model: the site is public, but only users you allow in the Spotify Dashboard can sign in.

---

## Features

- 🔐 **Spotify OAuth** via NextAuth (OAuth 2.0) with session persistence  
- 🎯 **Track matching** using Spotify Search with **ISRC-based duplicate detection**  
- 📦 **CSV** upload (PapaParse) + **Paste text** (e.g., “Artist – Song” or “Song by Artist”)  
- 📜 **Match report CSV** export  
- 🎵 **Playlist creation** with user-provided name  
- 🌐 **Single-domain** deployment (frontend + API under one origin) using **Vercel rewrites** → no 3P-cookie / CORS pain

---

## Architecture

- **Next.js (App Router)**: UI + API routes (`/api/...`)
- **NextAuth**: Spotify provider
- **Vercel**: hosting + edge/CDN
- **Client deps**: `papaparse`, `file-saver`, `lucide-react`

**Why single domain?**  
All browser requests hit the same origin (e.g., `https://musicbuzzfrontend.vercel.app`) because we proxy `/api/*` to the backend with a Vercel rewrite.  
Cookies stay first-party → no SameSite=None / 3P cookie issues.

`vercel.json`
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://musicbuzz-sigma.vercel.app/api/:path*" }
  ]
}
