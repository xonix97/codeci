import {
  Heart,
  ListMusic,
  Mic2,
  MonitorSpeaker,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState } from "react";
import { formatDuration, getLyrics, sourceLabel } from "../api";
import { selectCurrent, usePlayer } from "../stores/player";
import { Cover } from "./Cover";
import type { NavTarget } from "../navigation";

export function PlayerBar({ onNavigate }: { onNavigate?: (t: NavTarget) => void }) {
  const current = usePlayer(selectCurrent);
  const { isPlaying, position, duration, volume, shuffle, repeat } = usePlayer();
  const { toggle, next, prev, setVolume, toggleShuffle, cycleRepeat } = usePlayer();
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);

  if (!current) {
    return (
      <div className="player-bar" style={{ justifyContent: "center", color: "var(--text-dim)", fontSize: 13 }}>
        Nothing playing — press play on any track.
      </div>
    );
  }

  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;

  return (
    <div className="player-bar">
      {/* Cover + meta */}
      <div className="flex items-center gap-3 min-w-0 w-[30%]">
        <Cover url={current.cover_url} title={current.title} size={54} radius="12px" />
        <div className="min-w-0">
          <button
            className="block max-w-full truncate font-semibold text-[13.5px] leading-tight text-left hover:underline"
            onClick={() => onNavigate?.("nowplaying")}
          >
            {current.title}
          </button>
          <div className="truncate text-[11.5px]" style={{ color: "var(--text-dim)" }}>
            {current.artist} · {sourceLabel(current.source)}
          </div>
        </div>
        <button className="icon-btn" aria-label="Like" title="Like">
          <Heart size={17} />
        </button>
      </div>

      {/* Transport */}
      <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <button className="icon-btn" data-active={shuffle} onClick={toggleShuffle} aria-label="Shuffle">
            <Shuffle size={16} />
          </button>
          <button className="icon-btn" onClick={prev} aria-label="Previous">
            <SkipBack size={19} fill="currentColor" />
          </button>
          <button
            className="grid place-items-center rounded-full"
            style={{ width: 42, height: 42, background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--shadow-glow)" }}
            onClick={toggle}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
          <button className="icon-btn" onClick={next} aria-label="Next">
            <SkipForward size={19} fill="currentColor" />
          </button>
          <button className="icon-btn" data-active={repeat !== "off"} onClick={cycleRepeat} aria-label="Repeat">
            <RepeatIcon size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 w-full max-w-[520px] text-[10.5px] tabular-nums" style={{ color: "var(--text-dim)" }}>
          <span>{formatDuration(position)}</span>
          <div className="progress flex-1" role="progressbar" aria-valuenow={Math.round(pct)}>
            <div style={{ transform: `scaleX(${Math.min(1, Math.max(0, pct / 100))})` }} />
          </div>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center justify-end gap-1 w-[30%]">
        <button
          className="icon-btn"
          aria-label="Lyrics"
          title="Lyrics"
          data-active={showLyrics}
          onClick={async () => {
            const next = !showLyrics;
            setShowLyrics(next);
            if (next && lyrics == null) {
              setLyrics((await getLyrics(current.source, current.source_id)) ?? "");
            }
          }}
        >
          <Mic2 size={17} />
        </button>
        <button className="icon-btn" aria-label="Queue" title="Queue" onClick={() => onNavigate?.("nowplaying")}>
          <ListMusic size={17} />
        </button>
        <button className="icon-btn" aria-label="Cast/Devices" title="Devices">
          <MonitorSpeaker size={17} />
        </button>
        <button className="icon-btn" onClick={() => setVolume(volume === 0 ? 0.8 : 0)} aria-label="Mute">
          {volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        <input
          className="w-24 accent-[var(--accent)]"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>

      {showLyrics && lyrics != null && (
        <div className="glass-strong absolute right-4 bottom-[96px] w-[380px] max-h-64 overflow-y-auto p-4 text-[13px] leading-6 whitespace-pre-line">
          {lyrics || "No lyrics for this track."}
        </div>
      )}
    </div>
  );
}
