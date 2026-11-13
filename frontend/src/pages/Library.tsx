import { Heart, History, Music2 } from "lucide-react";
import { useState } from "react";

export function LibraryPage() {
  const [tab, setTab] = useState<"songs" | "liked" | "recent">("songs");
  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-tight mb-4">Your library</h1>
      <div className="flex gap-2 mb-5">
        <button className="chip" data-active={tab === "songs"} onClick={() => setTab("songs")}>Songs</button>
        <button className="chip" data-active={tab === "liked"} onClick={() => setTab("liked")}>Liked</button>
        <button className="chip" data-active={tab === "recent"} onClick={() => setTab("recent")}>Recently played</button>
      </div>
      <div className="glass p-10 text-center">
        <div className="mx-auto mb-4 grid place-items-center rounded-3xl" style={{ width: 84, height: 84, background: "var(--panel-2)", color: "var(--accent)" }}>
          {tab === "liked" ? <Heart size={34} /> : tab === "recent" ? <History size={34} /> : <Music2 size={34} />}
        </div>
        <h2 className="font-bold text-[17px]">Your library is empty — for now</h2>
        <p className="text-[13px] mt-2 max-w-[420px] mx-auto" style={{ color: "var(--text-dim)" }}>
          Tracks you play, like or download show up here. Favorite anything during Search —
          codeci keeps it on this device.
        </p>
      </div>
    </div>
  );
}
