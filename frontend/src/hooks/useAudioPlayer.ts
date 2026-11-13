// Wires a singleton HTMLAudioElement to the player store.
import { useEffect } from "react";
import { selectCurrent, usePlayer } from "../stores/player";
import { proxyStreamUrl, recordPlay } from "../api";

const audio = new Audio();
audio.preload = "auto";

export function useAudioPlayer() {
  const current = usePlayer(selectCurrent);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const volume = usePlayer((s) => s.volume);
  const next = usePlayer((s) => s.next);
  const setPosition = usePlayer((s) => s.setPosition);
  const setDuration = usePlayer((s) => s.setDuration);
  const position = usePlayer((s) => s.position);

  // Track change → load
  useEffect(() => {
    if (!current) return;
    const raw = current.stream_url ?? current.download_url ?? "";
    if (!raw) return;
    const url = /^file:/.test(raw) || (typeof window !== "undefined" && raw.startsWith("asset:"))
      ? raw
      : /^https?:\/\//.test(raw) && raw.includes("127.0.0.1")
        ? raw
        : proxyStreamUrl(raw);
    if (audio.src !== url) {
      audio.src = url;
      audio.play().catch(() => {
        /* autoplay policies; user gesture already happened for queue plays */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    if (isPlaying) audio.play().catch(() => {});
    else audio.pause();
  }, [isPlaying]);

  useEffect(() => {
    audio.volume = volume;
  }, [volume]);

  // Seek when store position diverges from element (user scrubbed)
  useEffect(() => {
    if (Math.abs(audio.currentTime - position) > 1.5) {
      audio.currentTime = position;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  useEffect(() => {
    const onTime = () => setPosition(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      const state = usePlayer.getState();
      const cur = selectCurrent(state);
      if (cur) recordPlay(cur, true);
      state.next();
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, [next, setPosition, setDuration]);
}
