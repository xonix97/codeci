import { Disc3 } from "lucide-react";
import type { Album } from "../types";
import { Cover } from "./Cover";

export function AlbumCard({ album, onOpen }: { album: Album; onOpen: (a: Album) => void }) {
  return (
    <button
      className="flex flex-col text-left gap-2.5 p-4 rounded-2xl transition-all hover:scale-[1.03]"
      style={{ background: "var(--panel)", border: "1px solid var(--stroke)" }}
      onClick={() => onOpen(album)}
      title={`${album.name} — ${album.artist}`}
    >
      <div className="relative w-full aspect-square">
        <Cover url={album.cover_url} title={album.name} size="100%" radius="14px" />
        <Disc3 size={22} className="absolute bottom-2 left-2 opacity-90" style={{ color: "#fff", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }} />
      </div>
      <div className="min-w-0 w-full">
        <div className="truncate font-bold text-[13px] leading-tight">{album.name}</div>
        <div className="truncate text-[11.5px] mt-0.5" style={{ color: "var(--text-dim)" }}>{album.artist}</div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-md" style={{ background: "var(--panel-2)", color: "var(--text-dim)" }}>
            {album.source}
          </span>
          {album.size != null && (
            <span className="text-[10.5px] tabular-nums" style={{ color: "var(--text-dim)" }}>{album.size} tracks</span>
          )}
        </div>
      </div>
    </button>
  );
}
