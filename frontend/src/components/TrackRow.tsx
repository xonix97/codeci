import {
  Download,
  ListPlus,
  Pause,
  Play,
  Plus,
} from "lucide-react";
import { downloadTrack, formatDuration, sourceLabel } from "../api";
import { usePlayer } from "../stores/player";
import { useSettings } from "../stores/settings";
import type { Track } from "../types";
import { Cover } from "./Cover";

export function TrackRow({ track, siblings }: { track: Track; siblings?: Track[] }) {
  const { playNow, enqueue } = usePlayer();
  const currentId = usePlayer((s) => (s.index >= 0 ? s.queue[s.index]?.id : null));
  const isPlaying = usePlayer((s) => s.isPlaying);
  const downloadDir = useSettings((s) => s.downloadDir);
  const cookies = useSettings((s) => s.cookies);
  const playing = currentId === track.id;

  const onPlay = () => playNow(track, (siblings ?? []).filter((t) => t.id !== track.id));

  return (
    <div className="track-row" data-playing={playing}>
      <button className="icon-btn" aria-label={playing ? "Pause/Play" : "Play"} onClick={onPlay}>
        {playing && isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
      </button>
      <div className="w-11 h-11"><Cover url={track.cover_url} title={track.title} size={44} radius="10px" /></div>
      <div className="min-w-0">
        <div className="track-title truncate font-semibold text-[13.5px] leading-tight">
          {track.title}
          {track.is_vip && (
            <span className="ml-1.5 align-middle text-[9px] font-extrabold px-1.5 py-[1px] rounded" style={{ background: "#ffb454", color: "#3a2500" }}>VIP</span>
          )}
        </div>
        <div className="truncate text-[12px]" style={{ color: "var(--text-dim)" }}>{track.artist}</div>
      </div>
      <span className="hide-sm text-[10.5px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md" style={{ background: "var(--panel-2)", color: "var(--text-dim)" }}>
        {sourceLabel(track.source)}
      </span>
      <div className="hide-sm tabular-nums text-[12px] w-12 text-right" style={{ color: "var(--text-dim)" }}>
        {formatDuration(track.duration_s)}
      </div>
      <button
        className="icon-btn"
        title="Add to queue"
        onClick={() => enqueue([track])}
        aria-label="Add to queue"
      >
        <ListPlus size={17} />
      </button>
      <button
        className="icon-btn"
        title="Download"
        aria-label="Download"
        onClick={() => downloadTrack(track, downloadDir || "downloads", cookies[track.source]).catch((e) => alert(`Download failed: ${e.message ?? e}`))}
      >
        <Download size={17} />
      </button>
      <button
        className="icon-btn hide-sm"
        title="Add to playlist (coming soon)"
        aria-label="Add to playlist"
        disabled
        style={{ opacity: 0.45 }}
      >
        <Plus size={17} />
      </button>
    </div>
  );
}
