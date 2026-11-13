// Typed API layer.
// Inside Tauri → calls `invoke(...)` (Rust core). In a plain browser (vite dev / screenshots)
// → falls back to fetch() against VITE_API_BASE (default http://127.0.0.1:8787, the backend).
import type { Album, Artist, HomeRails, Playlist, Track } from "./types";

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || (window as unknown as { isTauri?: boolean }).isTauri);

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:8787";

// Audius public endpoint (no key) for browser-dev trending; in Tauri, prefer core.
const AUDIUS_TRENDING =
  "https://api.audius.co/v1/tracks/trending?app_name=codeci&limit=15&time=week";
const AUDIUS_SEARCH = (q: string, limit: number) =>
  `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=codeci&limit=${limit}`;

async function invokeCmd<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/* ---------------- sources / search ---------------- */

export const DEFAULT_SOURCES = ["NeteaseMusicClient", "KuwoMusicClient"];

export const SOURCE_LABEL: Record<string, string> = {
  NeteaseMusicClient: "NetEase",
  QQMusicClient: "QQ",
  KuwoMusicClient: "Kuwo",
  MiguMusicClient: "Migu",
  QianqianMusicClient: "QianQian",
  JamendoMusicClient: "Jamendo",
  KugouMusicClient: "KuGou",
  YouTubeMusicClient: "YouTube",
  audiusmusicclient: "Audius",
  audius: "Audius",
  jamendo: "Jamendo",
  wikimedia: "Commons",
};

export function sourceLabel(source: string): string {
  const lower = source.toLowerCase();
  for (const key of Object.keys(SOURCE_LABEL)) {
    if (key.toLowerCase() === lower) return SOURCE_LABEL[key];
  }
  return source.replace(/MusicClient$/, "");
}

export async function backendSearch(
  q: string,
  sources: string[],
  limit = 20,
): Promise<Track[]> {
  if (isTauri) {
    const tracks = await invokeCmd<Track[]>("search", { query: q, sources, limit });
    return normalizeTracks(tracks);
  }
  const url = `${API_BASE}/search?q=${encodeURIComponent(q)}&sources=${encodeURIComponent(
    sources.join(","),
  )}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`search failed: ${r.status} ${await r.text()}`);
  const data = (await r.json()) as { tracks: Track[] };
  return normalizeTracks(data.tracks);
}

export async function getLyrics(source: string, source_id: string): Promise<string | null> {
  if (isTauri) {
    return invokeCmd<string | null>("get_lyrics", { source, sourceId: source_id });
  }
  const r = await fetch(
    `${API_BASE}/lyrics?source=${encodeURIComponent(source)}&source_id=${encodeURIComponent(source_id)}`,
  );
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`lyrics failed: ${r.status}`);
  return ((await r.json()) as { lyric_lrc: string }).lyric_lrc;
}

export async function parsePlaylist(url: string, source: string): Promise<Track[]> {
  if (isTauri) {
    return normalizeTracks(
      await invokeCmd<Track[]>("parse_playlist", { url, source }),
    );
  }
  const r = await fetch(
    `${API_BASE}/playlist/parse?url=${encodeURIComponent(url)}&source=${encodeURIComponent(source)}`,
  );
  if (!r.ok) throw new Error(`playlist parse failed: ${r.status} ${await r.text()}`);
  return normalizeTracks(((await r.json()) as { tracks: Track[] }).tracks);
}

export function proxyStreamUrl(url: string): string {
  if (isTauri) return url; // desktop: webview can stream direct (or use local file)
  return `${API_BASE}/proxy?url=${encodeURIComponent(url)}`;
}

export async function downloadTrack(track: Track, workDir: string, cookies?: string): Promise<void> {
  if (isTauri) {
    await invokeCmd("download_track", { track, workDir, cookies: cookies ?? null });
    return;
  }
  const r = await fetch(`${API_BASE}/download`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ track, work_dir: workDir, cookies }),
  });
  if (!r.ok) throw new Error(`download failed: ${r.status} ${await r.text()}`);
}

/* ---------------- home / recommendations ---------------- */

/** Direct-from-webview Audius user/artist search — instant, keyless. */
export async function searchAudiusArtists(q: string, limit = 12): Promise<Artist[]> {
  try {
    const r = await fetch(
      `https://api.audius.co/v1/users/search?query=${encodeURIComponent(q)}&app_name=codeci&limit=${limit}`,
    );
    if (!r.ok) return [];
    const json = (await r.json()) as { data?: { id: string; name: string; handle?: string; follower_count?: number; is_verified?: boolean; profile_picture?: { ["150x150"]?: string } }[] };
    return (json.data ?? []).map((u) => ({
      id: String(u.id),
      name: u.name,
      cover_url: u.profile_picture?.["150x150"] ?? null,
      followers: u.follower_count ?? null,
      verified: u.is_verified ?? false,
      handle: u.handle ?? null,
      source: "audius",
    }));
  } catch {
    return [];
  }
}

/** Direct-from-webview Audius album search (is_album playlists). */
export async function searchAudiusAlbums(q: string, limit = 12): Promise<Album[]> {
  try {
    const r = await fetch(
      `https://api.audius.co/v1/playlists/search?query=${encodeURIComponent(q)}&app_name=codeci&limit=${limit * 2}`,
    );
    if (!r.ok) return [];
    const json = (await r.json()) as { data?: { id: string; playlist_name?: string; name?: string; is_album: boolean; artist?: { name?: string }; user?: { name?: string }; cover_art_sizes?: string; track_count?: number; upc?: string }[] };
    return (json.data ?? [])
      .filter((p) => p.is_album)
      .slice(0, limit)
      .map((p) => ({
        id: String(p.id),
        name: p.playlist_name ?? p.name ?? "Untitled album",
        artist: p.artist?.name ?? p.user?.name ?? "Unknown",
        cover_url: p.cover_art_sizes ? `https://audius.co/image-url?id=${p.cover_art_sizes}&strategy=coverartcustom` : null,
        size: p.track_count ?? null,
        source: "audius",
        is_album: true,
      }));
  } catch {
    return [];
  }
}

/** Official NetEase artist discovery (raw web API via sidecar — instant). */
export async function searchBackendArtists(q: string, limit = 12): Promise<Artist[]> {
  try {
    if (isTauri) {
      const json = await invokeCmd<{ artists: Artist[] }>("search_artists", { query: q, limit });
      return json.artists;
    }
    const r = await fetch(`${API_BASE}/search/artists?q=${encodeURIComponent(q)}&limit=${limit}`);
    if (!r.ok) return [];
    const json = (await r.json()) as { artists: Artist[] };
    return json.artists;
  } catch {
    return [];
  }
}

/** Official NetEase album discovery (raw web API via sidecar — instant). */
export async function searchBackendAlbums(q: string, limit = 12): Promise<Album[]> {
  try {
    if (isTauri) {
      const json = await invokeCmd<{ albums: Album[] }>("search_albums", { query: q, limit });
      return json.albums;
    }
    const r = await fetch(`${API_BASE}/search/albums?q=${encodeURIComponent(q)}&limit=${limit}`);
    if (!r.ok) return [];
    const json = (await r.json()) as { albums: Album[] };
    return json.albums;
  } catch {
    return [];
  }
}

/** Direct-from-webview Audius search — no sidecar, lands in ~2-4 s.
 *  Used for progressive rendering: instant results, official catalogs merged later. */
export async function searchAudiusDirect(q: string, limit = 12): Promise<Track[]> {
  const r = await fetch(AUDIUS_SEARCH(q, limit));
  if (!r.ok) throw new Error(`audius direct search failed: ${r.status}`);
  const json = (await r.json()) as { data?: AudiusTrackRaw[] };
  return (json.data ?? []).slice(0, limit).map(audiusToTrack);
}

export async function getTrending(): Promise<Track[]> {
  try {
    if (isTauri) {
      return normalizeTracks(await invokeCmd<Track[]>("audius_trending_tracks", { limit: 15 }));
    }
    const r = await fetch(AUDIUS_TRENDING);
    const json = (await r.json()) as { data: AudiusTrackRaw[] };
    return json.data.slice(0, 15).map(audiusToTrack);
  } catch {
    return [];
  }
}

interface AudiusTrackRaw {
  id: string;
  title: string;
  genre?: string;
  duration?: number;
  play_count?: number;
  user?: { name?: string };
  artwork?: { "480x480"?: string };
  tags?: string | string[] | null;
}

function audiusToTrack(t: AudiusTrackRaw): Track {
  const tags: string[] = Array.isArray(t.tags)
    ? t.tags
    : t.tags
      ? String(t.tags).split(",").map((x) => x.trim()).filter(Boolean)
      : [];
  return {
    id: `audius:${t.id}`,
    source: "audius",
    source_id: t.id,
    title: t.title,
    artist: t.user?.name ?? "Unknown",
    duration_s: t.duration ?? null,
    cover_url: t.artwork?.["480x480"] ?? null,
    stream_url: `https://api.audius.co/v1/tracks/${t.id}/stream?app_name=codeci`,
    popularity: t.play_count ?? null,
    genres: [t.genre ?? "", ...tags].filter(Boolean),
    is_vip: false,
  };
}

export async function getHomeRails(): Promise<HomeRails> {
  const trending = await getTrending();
  if (isTauri) {
    try {
      return await invokeCmd<HomeRails>("home_rails");
    } catch {
      /* fall back below */
    }
  }
  return { forYou: [], trending, becauseYouPlayed: [], seedTitle: null };
}

export async function recordPlay(track: Track, completed: boolean): Promise<void> {
  if (!isTauri) return;
  try {
    await invokeCmd("record_play", { track, completed });
  } catch {
    /* non-fatal */
  }
}

export async function toggleLikeLibrary(track: Track): Promise<void> {
  if (isTauri) {
    await invokeCmd("toggle_like_track", { track });
  }
}

/* ---------------- library (Tauri-only in v1) ---------------- */

export async function getLibraryPlaylists(): Promise<Playlist[]> {
  if (!isTauri) return [];
  return invokeCmd<Playlist[]>("list_playlists");
}

export async function createPlaylist(name: string): Promise<void> {
  if (isTauri) await invokeCmd("create_playlist", { name });
}

/* ---------------- helpers ---------------- */

function normalizeTracks(tracks: Track[]): Track[] {
  return tracks.map((t) => ({
    ...t,
    genres: t.genres ?? [],
    id: t.id ?? `${t.source}:${t.source_id}`,
  }));
}

export function formatDuration(s?: number | null): string {
  if (!s) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function formatBytes(b?: number | null): string {
  if (!b) return "";
  if (b >= 1 << 30) return `${(b / (1 << 30)).toFixed(2)} GB`;
  if (b >= 1 << 20) return `${(b / (1 << 20)).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}
