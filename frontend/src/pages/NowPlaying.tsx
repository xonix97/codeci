import { ArrowDown, ArrowUp, ListMusic, Pause, Play, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration, getLyrics, sourceLabel } from "../api";
import { Cover } from "../components/Cover";
import { selectCurrent, usePlayer } from "../stores/player";

export function NowPlayingPage({ onClose }: { onClose: () => void }) {
  const current = usePlayer(selectCurrent);
  const { queue, index, isPlaying, toggle, reorder, removeAt, playAt } = usePlayer();
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [tab, setTab] = useState<"queue" | "lyrics">("queue");

  useEffect(() => {
    if (!current) return;
    setLyrics(null);
    getLyrics(current.source, current.source_id).then(setLyrics).catch(() => setLyrics(""));
  }, [current?.id]);

  if (!current) {
    return (
      <div className="glass p-12 text-center">
        <ListMusic className="mx-auto mb-3" size={44} style={{ color: "var(--accent)" }} />
        <p className="font-bold">Queue is empty. Play something first.</p>
        <button className="btn btn-primary mt-4" onClick={onClose}><X size={15} /> Close</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(340px,480px)_1fr] gap-6">
      {/* Left: art */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-[460px]">
          <Cover url={current.cover_url} title={current.title} size="100%" radius="22px" />
          <div className="mt-4 text-center">
            <h1 className="text-[24px] font-extrabold tracking-tight leading-snug">{current.title}</h1>
            <p className="text-[14px] mt-1" style={{ color: "var(--text-dim)" }}>{current.artist}</p>
            <p className="text-[10.5px] uppercase tracking-[0.16em] mt-2 inline-block px-2.5 py-1 rounded-full" style={{ background: "var(--panel-2)", color: "var(--text-dim)" }}>
              {sourceLabel(current.source)}{current.is_vip ? " · VIP" : ""} · {current.ext?.toUpperCase() ?? ""}
            </p>
            <button
              className="btn btn-primary mx-auto mt-4"
              onClick={toggle}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />} {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
        </div>
      </div>

      {/* Right: queue / lyrics */}
      <div className="glass flex flex-col min-h-[420px]">
        <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: "var(--stroke)" }}>
          <button className="chip" data-active={tab === "queue"} onClick={() => setTab("queue")}>Queue · {queue.length}</button>
          <button className="chip" data-active={tab === "lyrics"} onClick={() => setTab("lyrics")}>Lyrics</button>
          <button className="icon-btn ml-auto" onClick={onClose} aria-label="Back"><X size={19} /></button>
        </div>
        {tab === "queue" ? (
          <div className="overflow-y-auto flex-1 p-2">
            {queue.map((t, i) => {
              const playing = i === index;
              return (
                <div key={`${t.id}-${i}`} className="track-row" data-playing={playing} style={{ gridTemplateColumns: "26px 44px 1fr auto auto auto" }}>
                  <button className="tabular-nums text-[12px]" style={{ color: playing ? "var(--playing)" : "var(--text-dim)" }} onClick={() => playAt(i)} aria-label="Play track">
                    {playing ? <span className="eq" aria-hidden><span /><span /><span /></span> : i + 1}
                  </button>
                  <div className="h-11"><Cover url={t.cover_url} title={t.title} size={44} radius="8px" /></div>
                  <div className="min-w-0">
                    <div className="track-title truncate text-[13px] font-semibold">{t.title}</div>
                    <div className="truncate text-[11.5px]" style={{ color: "var(--text-dim)" }}>{t.artist}</div>
                  </div>
                  <span className="tabular-nums text-[11px]" style={{ color: "var(--text-dim)" }}>{formatDuration(t.duration_s)}</span>
                  <span className="flex flex-col">
                    <button className="icon-btn" style={{ padding: 2 }} onClick={() => reorder(i, Math.max(0, i - 1))} aria-label="Move up"><ArrowUp size={13} /></button>
                    <button className="icon-btn" style={{ padding: 2 }} onClick={() => reorder(i, Math.min(queue.length - 1, i + 1))} aria-label="Move down"><ArrowDown size={13} /></button>
                  </span>
                  <button className="icon-btn" onClick={() => removeAt(i)} aria-label="Remove from queue"><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-6 text-[14.5px] leading-7 whitespace-pre-line">
            {lyrics == null ? "Loading lyrics…" : lyrics || "No lyrics for this track."}
          </div>
        )}
      </div>
    </div>
  );
}
