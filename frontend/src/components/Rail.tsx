import { Play } from "lucide-react";
import type { Track } from "../types";
import { usePlayer } from "../stores/player";
import { Cover } from "./Cover";
import { sourceLabel } from "../api";

export function Rail({ title, tracks, onMore }: { title: string; tracks: Track[]; onMore?: () => void }) {
  const { playNow } = usePlayer();
  if (tracks.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
        {onMore && (
          <button className="text-[12px] font-semibold" style={{ color: "var(--accent)" }} onClick={onMore}>
            Show all
          </button>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {tracks.map((t) => (
          <button
            key={t.id}
            className="rail-card text-left group"
            onClick={() => playNow(t, tracks.filter((x) => x.id !== t.id))}
            title={`${t.title} — ${t.artist}`}
          >
            <div className="relative mb-2">
              <Cover url={t.cover_url} title={t.title} size={172} radius="16px" />
              <span className="badge">{sourceLabel(t.source)}</span>
              <span
                className="absolute bottom-2 right-2 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0"
                style={{ background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--shadow-glow)" }}
              >
                <Play size={15} fill="currentColor" />
              </span>
            </div>
            <div className="truncate text-[13px] font-semibold leading-tight">{t.title}</div>
            <div className="truncate text-[11.5px]" style={{ color: "var(--text-dim)" }}>{t.artist}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
