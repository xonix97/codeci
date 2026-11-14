import { ArrowLeft, Loader2, Play, Shuffle, UserPlus, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getArtistDetail, searchBackendAlbums } from "../api";
import { Cover } from "../components/Cover";
import { TrackRow } from "../components/TrackRow";
import { usePlayer } from "../stores/player";
import type { Album, Artist } from "../types";

const FOLLOWS_KEY = "codeci-followed-artists";

function loadFollows(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FOLLOWS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function ArtistPage({ artist, onBack }: { artist: Artist; onBack: () => void }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getArtistDetail>> | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<boolean>(() => loadFollows().has(`${artist.source}:${artist.id}`));
  const playNow = usePlayer((s) => s.playNow);

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    setAlbums([]);
    getArtistDetail(artist.id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
    searchBackendAlbums(artist.name, 10).then(setAlbums).catch(() => setAlbums([]));
  }, [artist.id, artist.name, artist.source]);

  const tracks = useMemo(() => detail?.tracks ?? [], [detail]);
  const topPopular = tracks.slice(0, 10);
  const playAll = () => tracks.length && playNow(tracks[0], tracks.slice(1));
  const shuffleAll = () => playNow(tracks[0], [...tracks.slice(1)].sort(() => Math.random() - 0.5));
  const toggleFollow = () => {
    const set = loadFollows();
    const key = `${artist.source}:${artist.id}`;
    const now = !set.has(key);
    now ? set.add(key) : set.delete(key);
    localStorage.setItem(FOLLOWS_KEY, JSON.stringify([...set]));
    setFollowing(now);
  };

  const followers = artist.followers ?? null;

  return (
    <div className="max-w-[1180px]">
      {/* Header */}
      <button className="icon-btn mb-3 -ml-2" onClick={onBack} aria-label="Back"><ArrowLeft size={19} /></button>
      <div className="flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-8">
        <div className="relative shrink-0">
          <Cover url={artist.cover_url} title={artist.name} size={216} radius="18px" />
        </div>
        <div className="min-w-0 pb-1">
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>Artist</div>
          <h1 className="font-extrabold tracking-tight leading-none mt-1" style={{ fontSize: "clamp(42px, 7vw, 88px)" }}>{artist.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--text-dim)" }}>
            {followers != null && <span>{formatCount(followers)} followers</span>}
            {detail?.artist?.music_size != null && <span>· {detail.artist.music_size.toLocaleString()} songs</span>}
            {detail?.artist?.album_size != null && <span>· {detail.artist.album_size} albums</span>}
            {detail?.artist?.alias?.length ? <span>· aka {detail.artist.alias.slice(0, 2).join(", ")}</span> : null}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-6 mb-8">
        <button
          className="grid place-items-center rounded-full"
          style={{ width: 64, height: 64, background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--shadow-glow)" }}
          onClick={playAll}
          aria-label="Play popular"
        >
          <Play size={28} fill="currentColor" style={{ marginLeft: 2 }} />
        </button>
        <button
          className="grid place-items-center rounded-full border"
          style={{ width: 48, height: 48, borderColor: "var(--stroke-strong)", color: "var(--text)" }}
          onClick={shuffleAll}
          aria-label="Shuffle popular"
        >
          <Shuffle size={20} />
        </button>
        <button
          className="px-5 h-11 rounded-full border font-bold text-[13px] inline-flex items-center gap-2"
          style={{ borderColor: following ? "var(--accent)" : "var(--stroke-strong)", color: following ? "var(--accent)" : "var(--text)" }}
          onClick={toggleFollow}
        >
          {following ? <UserCheck size={16} /> : <UserPlus size={16} />} {following ? "Following" : "Follow"}
        </button>
      </div>

      {/* Popular */}
      <section className="mb-9">
        <h2 className="text-[17px] font-extrabold tracking-tight px-1 mb-2">Popular</h2>
        {loading && topPopular.length === 0 ? (
          <div className="flex items-center gap-2 px-2 py-6" style={{ color: "var(--text-dim)" }}><Loader2 size={16} className="animate-spin" /> Loading top songs…</div>
        ) : topPopular.length === 0 ? (
          <div className="glass p-8 text-center text-[13px]" style={{ color: "var(--text-dim)" }}>Top-songs unavailable for this artist (NetEase-only in v1).</div>
        ) : (
          <div className="glass p-2">
            {topPopular.map((t, i) => (
              <div key={`${t.id}-${i}`} className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 tabular-nums text-[11px] w-5 text-right z-10" style={{ color: "var(--text-dim)" }}>{i + 1}</span>
                <div style={{ paddingLeft: 18 }}>
                  <TrackRow track={t} siblings={tracks} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Discography (albums by same artist) */}
      {albums.length > 0 && (
        <section>
          <h2 className="text-[17px] font-extrabold tracking-tight px-1 mb-2">Discography</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {albums.map((a) => (
              <div key={`${a.source}:${a.id}`} className="rail-card">
                <Cover url={a.cover_url} title={a.name} size={172} radius="12px" />
                <div className="truncate text-[12.5px] font-semibold mt-2">{a.name}</div>
                <div className="text-[11px]" style={{ color: "var(--text-dim)" }}>{a.size ? `${a.size} tracks` : ""}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
