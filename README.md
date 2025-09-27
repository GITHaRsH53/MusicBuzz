# 🎵 MusicBuzz – Spotify Playlist Generator  

MusicBuzz is a **Next.js web app** that lets users create Spotify playlists instantly from a simple text list or CSV upload.  
No more adding songs one by one — just upload or paste, log in with Spotify, and generate your playlist in one click.  

---

## ✨ Features  
- 🔑 **Spotify OAuth Login** using **NextAuth.js** (secure login, token refresh).  
- 📄 **Text / CSV Input** – paste songs or upload CSV files (`song, artist`).  
- 🧠 **Fuzzy Matching** with **Spotify Search API** to handle messy input.  
- 🏷️ **ISRC Deduplication** – stores matched ISRCs in memory to reduce API calls and avoid duplicates.  
- 📊 **Preview & Edit** – view parsed tracks before creating playlists.  
- 📥 **Download Reports** – export CSV with `found / not found / duplicates`.  
- 🚀 **Deployed on Vercel** – accessible instantly, no installation required.  

---

## 🛠️ Tech Stack  
- **Frontend:** Next.js, React, Bootstrap 
- **Auth:** NextAuth.js (Spotify Provider, JWT, refresh tokens)  
- **Parsing:** PapaParse (CSV), FileSaver.js (downloads)  
- **Backend:** Next.js API Routes, Spotify Web API  
- **Deployment:** Vercel  

---

## 🚀 Getting Started  

### 1. Clone the repo  
```bash
git clone https://github.com/GITHaRsH53/MusicBuzz.git
cd MusicBuzz
