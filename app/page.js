"use client"; // must be first line

import { useState } from "react";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Home() {
  // Auth session
  const { data: session } = useSession();

  // CSV/Text parsing state
  const [input, setInput] = useState("");
  const [rows, setRows] = useState([]);
  const [order, setOrder] = useState("artist-song");

  // Parse pasted text → rows
  const parseText = () => {
    const out = input.split("\n").map((line) => {
      line = line.trim();
      if (!line) return null;
      let song = "", artist = "";
      if (line.includes("-")) {
        const [left, right] = line.split("-").map((x) => x.trim());
        if (order === "artist-song") { artist = left; song = right; }
        else { song = left; artist = right; }
      } else if (/by/i.test(line)) {
        const [left, right] = line.split(/by/i).map((x) => x.trim());
        song = left; artist = right || "";
      } else {
        song = line; artist = "";
      }
      return { song, artist };
    }).filter(Boolean);
    setRows(out);
  };

  // Parse uploaded CSV → rows
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase(),
      complete: (res) => {
        const cleaned = res.data
          .map(rec => ({ song: (rec.song || "").trim(), artist: (rec.artist || "").trim() }))
          .filter(r => r.song || r.artist);
        setRows(cleaned);
      }
    });
  };

  // Download normalized CSV
  const downloadCSV = () => {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "playlist.csv");
  };

  return (
    <div className="container my-5">
      {/* Auth controls */}
      {!session ? (
        <button className="btn btn-success mb-4" onClick={() => signIn("spotify")}>
          Login with Spotify
        </button>
      ) : (
        <div className="mb-4 d-flex align-items-center gap-2">
          <span>✅ Logged in as {session.user?.name}</span>
          <button className="btn btn-outline-danger btn-sm" onClick={() => signOut()}>
            Logout
          </button>
        </div>
      )}

      <h3 className="mb-3">🎶 Step 2: CSV Upload (or paste text)</h3>

      {/* Upload CSV */}
      <div className="mb-4">
        <label className="form-label">Upload CSV (columns: song, artist)</label>
        <input className="form-control" type="file" accept=".csv" onChange={onFile} />
      </div>

      <div className="text-muted mb-3">— OR —</div>

      {/* Paste text → parse */}
      <div className="mb-2">
        <label className="form-label">Paste songs (one per line)</label>
        <select
          className="form-select mb-2"
          style={{ maxWidth: 240 }}
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        >
          <option value="artist-song">Artist - Song</option>
          <option value="song-artist">Song - Artist</option>
        </select>
        <textarea
          className="form-control mb-2"
          rows={6}
          placeholder="Post Malone - Circles\nBlinding Lights by The Weeknd"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={parseText}>
          Parse Text
        </button>
      </div>

      {/* Preview */}
      <div className="mt-4">
        <div className="d-flex align-items-center gap-3 mb-2">
          <strong>Parsed rows:</strong> {rows.length}
          <button
            className="btn btn-primary btn-sm"
            disabled={!rows.length}
            onClick={downloadCSV}
          >
            Download normalized CSV
          </button>
        </div>

        {rows.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm table-striped">
              <thead>
                <tr><th>#</th><th>Song</th><th>Artist</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i}><td>{i + 1}</td><td>{r.song}</td><td>{r.artist}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="text-muted">Showing first 10 of {rows.length}.</div>
          </div>
        )}
      </div>
    </div>
  );
}
