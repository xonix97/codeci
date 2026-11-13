import { BadgeCheck } from "lucide-react";
import type { Artist } from "../types";
import { Cover } from "./Cover";

export function ArtistCard({ artist, onOpen }: { artist: Artist; onOpen: (a: Artist) => void }) {
  const meta = artist.followers != null
    ? `${formatCount(artist.followers)} followers`
    : artist.music_size != null
      ? `${artist.music_size.toLocaleString()} tracks · ${artist.album_size ?? 0} albums`
      : "Open artist";
  return (
    <button
      className="flex flex-col items-center text-center gap-2.5 p-4 rounded-2xl transition-all hover:scale-[1.03]"
      style={{ background: "var(--panel)", border: "1px solid var(--stroke)" }}
      onClick={() => onOpen(artist)}
      title={artist.name}
    >
      <div className="relative">
        <Cover url={artist.cover_url} title={artist.name} size={132} radius="999px" />
        {artist.verified && (
          <span className="absolute bottom-1 right-1 rounded-full" style={{ color: "#fff", background: "var(--accent)" }}>
            <BadgeCheck size={22} fill="var(--accent)" strokeWidth={2.4} />
          </span>
        )}
      </div>
      <div className="min-w-0 w-full">
        <div className="truncate font-bold text-[13px] leading-tight">{artist.name}</div>
        <div className="truncate text-[10.5px] mt-1" style={{ color: "var(--text-dim)" }}>{meta}</div>
        <div className="text-[9px] uppercase tracking-[0.14em] mt-1.5 inline-block px-2 py-0.5 rounded-md" style={{ background: "var(--panel-2)", color: "var(--text-dim)" }}>
          {artist.source}
        </div>
      </div>
    </button>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
