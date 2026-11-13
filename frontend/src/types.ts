export type SourceSlug = string;

export interface Track {
  /** stable-ish id: `${source}:${source_id}` */
  id: string;
  source: SourceSlug;
  source_id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration_s?: number | null;
  ext?: string | null;
  file_size_bytes?: number | null;
  cover_url?: string | null;
  stream_url?: string | null;
  download_url?: string | null;
  popularity?: number | null;
  genres: string[];
  is_vip: boolean;
  lyric_lrc?: string | null;
  license?: string | null;
}

export interface LibraryTrack extends Track {
  library_id: number;
  play_count: number;
  liked: boolean;
  local_path?: string | null;
}

export interface Playlist {
  id: number;
  name: string;
  description?: string | null;
  created_at: string;
  sort_order: number;
}

export interface HomeRails {
  forYou: Track[];
  trending: Track[];
  seedTitle?: string | null;
  becauseYouPlayed: Track[];
}
