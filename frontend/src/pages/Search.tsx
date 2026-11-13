import { Link2, Loader2, Search as SearchIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { backendSearch, DEFAULT_SOURCES, parsePlaylist, searchAudiusDirect, sourceLabel } from "../api";
import { TrackRow } from "../components/TrackRow";
import { useSettings } from "../stores/settings";
import type { Track } from "../types";

const SOURCE_CHIPS = [...DEFAULT_SOURCES, "QianqianMusicClient", "JamendoMusicClient", "KugouMusicClient"];

export function SearchPage() {
  const [q, setQ] = useState("");
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [results, setResults] = useState<Track[]>([]);
  const [fastResults, setFastResults] = useState<Track[]>([]);
  const [sideLoading, setSideLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistMode, setPlaylistMode] = useState(false);
  const enabled = useSettings((s) => s.enabledSources);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!q.trim() || playlistMode) {
      setResults([]);
      setFastResults([]);
      setLoading(false);
      setSideLoading(false);
      return;
    }
    timer.current = window.setTimeout(() => {
      setLoading(true);
      setSideLoading(true);
      setError(null);
      setFastResults([]);
      // Instant rail — direct-from-webview Audius (~2-4 s, no sidecar)
      searchAudiusDirect(q.trim(), 8)
        .then(setFastResults)
        .catch(() => setFastResults([]));
      // Official catalog via sidecar (~20-45 s) — NetEase / Kuwo
      const sources = filterSource ? [filterSource] : enabled.length ? enabled : DEFAULT_SOURCES;
      backendSearch(q.trim(), sources, 12)
        .then(setResults)
        .catch((e) => {
          setError(e instanceof Error ? e.message : String(e));
          setResults([]);
        })
        .finally(() => {
          setLoading(false);
          setSideLoading(false);
        });
    }, 450);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [q, filterSource, enabled, playlistMode]);

  const normKey = (s: string) =>
    s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
  const merged = useMemo(() => {
    const seen = new Set(results.map((t) => normKey(`${t.title}|${t.artist}`)));
    const extra = fastResults.filter((t) => !seen.has(normKey(`${t.title}|${t.artist}`)));
    return [...results, ...extra];
  }, [results, fastResults]);
  const visible = useMemo(
    () => (filterSource ? merged.filter((t) => t.source === filterSource) : merged),
    [merged, filterSource],
  );

  const emptyHint = q.trim()
    ? error
      ? error
      : loading
        ? ""
        : "No results. Try another source or spelling."
    : playlistMode
      ? "Paste a playlist URL and choose its source to import every track."
      : "Search Netease, QQ, Kuwo, Migu and more — the famous stuff lives here.";

  return (
    <div className="max-w-[1060px]">
      {/* Mode switch */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight">Search</h1>
        <button className="chip" data-active={playlistMode} onClick={() => setPlaylistMode((v) => !v)}>
          <span className="inline-flex items-center gap-1.5"><Link2 size={13} /> Import playlist</span>
        </button>
      </div>

      {playlistMode ? (
        <PlaylistImport onDone={(tracks) => { setResults(tracks); setPlaylistMode(false); setQ(""); }} />
      ) : (
        <>
          {/* Search box */}
          <div className="relative mb-3">
            <SearchIcon size={19} className="absolute left-5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-dim)" }} />
            <input
              autoFocus
              className="input"
              style={{ paddingLeft: 48, paddingRight: 48, height: 52, fontSize: 16 }}
              placeholder="Artists, songs, albums — try “Kanye West”"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search music"
            />
            {q && (
              <button className="icon-btn absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setQ("")} aria-label="Clear">
                <X size={18} />
              </button>
            )}
          </div>

          {/* Source chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button className="chip" data-active={filterSource === null} onClick={() => setFilterSource(null)}>All sources</button>
            {SOURCE_CHIPS.map((s) => (
              <button key={s} className="chip" data-active={filterSource === s} onClick={() => setFilterSource(s === filterSource ? null : s)}>
                {sourceLabel(s)}
              </button>
            ))}
          </div>

          {/* Slow-source warning */}
          {enabled.includes("YouTubeMusicClient") && (
            <div className="mb-3 px-4 py-2 rounded-xl text-[12px] font-semibold" style={{ background: "color-mix(in srgb, var(--danger) 16%, transparent)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)" }}>
              YouTube search takes ~3 minutes and usually returns 0 results on this network. Disable it in Settings → Music sources, or expect a long wait.
            </div>
          )}

          {/* Status line */}
          <div className="h-5 mb-1 px-1 text-[12px]" style={{ color: "var(--text-dim)" }}>
            {sideLoading ? (
              fastResults.length > 0 ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> {fastResults.length} instant matches (Audius) · official catalog from NetEase/Kuwo still loading (~30 s)…</span>
              ) : (
                <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Searching {enabled.map(sourceLabel).join(", ") || "sources"}… (Audius rail usually lands first)</span>
              )
            ) : visible.length > 0 ? `${visible.length} results · ${results.length} official + ${visible.length - results.length} Audius` : emptyHint}
          </div>
        </>
      )}

      {/* Results */}
      {!playlistMode && (
        <div className="glass p-2">
          {loading && results.length === 0 && fastResults.length === 0
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="track-row">
                  <div className="skeleton h-8" /><div className="skeleton h-11" />
                  <div className="space-y-1.5"><div className="skeleton h-3.5 w-2/3" /><div className="skeleton h-3 w-1/3" /></div>
                  <div /><div /><div /><div />
                </div>
              ))
            : visible.map((t) => <TrackRow key={t.id} track={t} siblings={visible} />)}
        </div>
      )}
    </div>
  );
}

function PlaylistImport({ onDone }: { onDone: (tracks: Track[]) => void }) {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("NeteaseMusicClient");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const tracks = await parsePlaylist(url.trim(), source);
      onDone(tracks);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass p-6 max-w-[620px]">
      <h2 className="font-bold mb-1">Import a playlist</h2>
      <p className="text-[12.5px] mb-4" style={{ color: "var(--text-dim)" }}>
        Paste a NetEase, QQ, Kuwo, Spotify… playlist URL. All matched tracks land in the results list — then hit play or download.
      </p>
      <input className="input mb-3" placeholder="https://music.163.com/#/playlist?id=7583298906" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <div className="flex gap-2">
        <select className="select" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Playlist source">
          <option value="NeteaseMusicClient">NetEase</option>
          <option value="QQMusicClient">QQ Music</option>
          <option value="KuwoMusicClient">Kuwo</option>
          <option value="KugouMusicClient">KuGou</option>
          <option value="MiguMusicClient">Migu</option>
          <option value="JamendoMusicClient">Jamendo</option>
          <option value="SpotifyMusicClient">Spotify</option>
        </select>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Import
        </button>
      </div>
      {error && <p className="text-[12px] mt-3" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
