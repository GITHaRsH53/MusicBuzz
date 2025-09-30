"use client"; // must be the first line so this component can use hooks

// React + libs
import { useState } from "react";
import Papa from "papaparse";                 // CSV parse/unparse
import { saveAs } from "file-saver";          // download files from browser
import { useSession, signIn, signOut } from "next-auth/react"; // NextAuth client hooks

export default function Home() {
  // -------- Auth session (are we logged in?) --------
  const { data: session } = useSession();

  // -------- Step 2: CSV/Text parsing state --------
  const [input, setInput] = useState("");               // textarea contents
  const [rows, setRows] = useState([]);                 // [{ song, artist }]
  const [order, setOrder] = useState("artist-song");    // how to interpret "Artist - Song"

  // -------- Step 4: Matching state --------
  const [matching, setMatching] = useState(false);      // show "Matching..." while API runs
  const [matchResults, setMatchResults] = useState(null); // { results, summary } from backend

  // -------- Step 5: Editable preview --------
  const [includeMap, setIncludeMap] = useState({});     // { index: true/false } for each row
  const [playlistName, setPlaylistName] = useState("My MusicBuzz Playlist");

  // Build default includeMap when new results come in
  const initIncludeMap = (mr) => {
    if (!mr) return;
    const map = {};
    mr.results.forEach((r, i) => {
      map[i] = !!(r.found && !r.duplicate); // default: only include valid, non-duplicate tracks
    });
    setIncludeMap(map);
  };

  // Toggle include/exclude for a given row
  const toggleInclude = (idx) => {
    setIncludeMap((m) => ({ ...m, [idx]: !m[idx] }));
  };

  // Collect selected Spotify URIs
  const selectedUris = () => {
    if (!matchResults) return [];
    return matchResults.results
      .map((r, i) => (includeMap[i] && r.uri ? r.uri : null))
      .filter(Boolean);
  };

  // -------- Parse pasted text -> rows --------
  const parseText = () => {
    const out = input
      .split("\n")
      .map((line) => {
        line = line.trim();
        if (!line) return null;

        let song = "", artist = "";

        // Case 1: "A - B"
        if (line.includes("-")) {
          const [left, right] = line.split("-").map((x) => x.trim());
          if (order === "artist-song") { artist = left; song = right; }
          else { song = left; artist = right; }
        }
        // Case 2: "A by B"
        else if (/by/i.test(line)) {
          const [left, right] = line.split(/by/i).map((x) => x.trim());
          song = left;
          artist = right || "";
        }
        // Case 3: fallback -> everything as song
        else {
          song = line;
          artist = "";
        }
        return { song, artist };
      })
      .filter(Boolean);

    setRows(out);
    setMatchResults(null); // clear old results if user re-parses
  };

  // -------- Parse uploaded CSV -> rows --------
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,                 
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const cleaned = res.data
          .map((rec) => ({
            song: (rec.song || "").trim(),
            artist: (rec.artist || "").trim(),
          }))
          .filter((r) => r.song || r.artist);

        setRows(cleaned);
        setMatchResults(null); 
      },
    });
  };

  // -------- Download the normalized CSV --------
  const downloadCSV = () => {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "playlist.csv");
  };

  // -------- Step 4: call backend to match rows on Spotify --------
  const matchOnSpotify = async () => {
    try {
      setMatching(true);
      const res = await fetch("/api/spotify/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");

      setMatchResults(data);
      initIncludeMap(data); // <-- build default includeMap
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setMatching(false);
    }
  };

  // -------- Step 4: download the match report CSV --------
  const downloadReport = () => {
    if (!matchResults) return;
    const csv = Papa.unparse(
      matchResults.results.map((r) => ({
        song: r.input_song,
        artist: r.input_artist,
        found: r.found ? 1 : 0,
        duplicate: r.duplicate ? 1 : 0,
        matched_song: r.matched_song || "",
        matched_artist: r.matched_artist || "",
        uri: r.uri || "",
        isrc: r.isrc || "",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "spotify_match_report.csv");
  };

  // -------- Step 6: create playlist --------
  const createPlaylist = async () => {
    try {
      const uris = selectedUris();
      if (!uris.length) {
        alert("No tracks selected to add.");
        return;
      }
      if (!playlistName.trim()) {
        alert("Please enter a playlist name.");
        return;
      }

      const res = await fetch("/api/spotify/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playlistName.trim(),
          uris,
          isPublic: false,
          description: "Created with MusicBuzz",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Playlist creation failed");

      alert(`✅ Playlist created!\nName: ${data.name}\nTracks: ${data.added}\nOpen: ${data.url}`);
    } catch (e) {
      alert(e.message || String(e));
    }
  };

  // ===================== UI =====================
  return (
    <div className="container my-5">

      {/* -------- Login / Logout -------- */}
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

      {/* -------- Step 2: CSV upload or paste text -------- */}
      <h3 className="mb-3">🎶 CSV Upload (or paste text)</h3>

      <div className="mb-4">
        <label className="form-label">Upload CSV (columns: song, artist)</label>
        <input className="form-control" type="file" accept=".csv" onChange={onFile} />
      </div>

      <div className="text-muted mb-3">— OR —</div>

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
          placeholder={"Post Malone - Circles\nBlinding Lights by The Weeknd"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={parseText}>
          Parse Text
        </button>
      </div>

      {/* -------- Preview rows -------- */}
      <div className="mt-4">
        <div className="d-flex align-items-center gap-3 mb-2">
          <strong>Parsed rows:</strong> {rows.length}
          <button className="btn btn-primary btn-sm" disabled={!rows.length} onClick={downloadCSV}>
            Download normalized CSV
          </button>
        </div>
      </div>

      {/* -------- Step 4 actions -------- */}
      <div className="mt-4 d-flex gap-2">
        <button
          className="btn btn-success"
          disabled={!rows.length || matching || !session}
          onClick={matchOnSpotify}
        >
          {matching ? "Matching…" : "Match on Spotify"}
        </button>

        <button
          className="btn btn-outline-primary"
          disabled={!matchResults}
          onClick={downloadReport}
        >
          Download match report CSV
        </button>
      </div>

      {/* -------- Step 4 results -------- */}
      {matchResults && (
        <>
          <div className="mt-3">
            <strong>Match Summary:</strong>{" "}
            {matchResults.summary.found}/{matchResults.summary.total} found •{" "}
            {matchResults.summary.notFound} not found •{" "}
            {matchResults.summary.duplicates} duplicates
          </div>

          {/* Editable preview (Step 5) */}
          <div className="table-responsive mt-2">
            <table className="table table-sm table-striped align-middle">
              <thead>
                <tr>
                  <th>Include</th>
                  <th>#</th>
                  <th>Input</th>
                  <th>Matched</th>
                  <th>Found</th>
                  <th>Duplicate</th>
                </tr>
              </thead>
              <tbody>
                {matchResults.results.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={!!includeMap[i]}
                        onChange={() => toggleInclude(i)}
                        disabled={!r.found}
                      />
                    </td>
                    <td>{i + 1}</td>
                    <td>{r.input_song} — {r.input_artist}</td>
                    <td>{r.matched_song ? `${r.matched_song} — ${r.matched_artist}` : ""}</td>
                    <td>{r.found ? "✅" : "—"}</td>
                    <td>{r.duplicate ? "🟡" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Step 6: Playlist controls */}
          <div className="mt-3 d-flex flex-wrap align-items-center gap-2">
            <input
              className="form-control"
              style={{ maxWidth: 360 }}
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="Playlist name"
            />
            <button
              className="btn btn-dark"
              disabled={!session || selectedUris().length === 0}
              onClick={createPlaylist}
            >
              Create playlist ({selectedUris().length} tracks)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
