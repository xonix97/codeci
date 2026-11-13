import { ListMusic, Plus } from "lucide-react";
import { useState } from "react";
import { createPlaylist, getLibraryPlaylists } from "../api";
import { useEffect } from "react";
import type { Playlist } from "../types";

export function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => getLibraryPlaylists().then(setPlaylists).catch(() => setPlaylists([]));
  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createPlaylist(name.trim());
      setName("");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight">Playlists</h1>
      </div>

      <div className="glass p-4 mb-6 flex gap-2 max-w-[560px]">
        <input className="input" style={{ borderRadius: "var(--radius-sm)", height: 42 }} placeholder="New playlist name…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} aria-label="New playlist name" />
        <button className="btn btn-primary" onClick={create} disabled={busy}>
          <Plus size={15} /> Create
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="glass p-10 text-center">
          <ListMusic className="mx-auto mb-3" size={40} style={{ color: "var(--accent)" }} />
          <h2 className="font-bold text-[16px]">No playlists yet</h2>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>Create one above — then add tracks from Search or Now Playing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {playlists.map((p) => (
            <div key={p.id} className="glass p-4">
              <div className="grid place-items-center rounded-2xl mb-3" style={{ height: 96, background: "var(--panel-2)", color: "var(--accent)" }}>
                <ListMusic size={34} />
              </div>
              <div className="font-bold text-[14px] truncate">{p.name}</div>
              <div className="text-[11.5px]" style={{ color: "var(--text-dim)" }}>{p.created_at.slice(0, 10)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
