import { Flame, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { getHomeRails } from "../api";
import { Rail } from "../components/Rail";
import type { HomeRails } from "../types";
import { useSettings } from "../stores/settings";

export function HomePage({ onGoSearch }: { onGoSearch: () => void }) {
  const [rails, setRails] = useState<HomeRails | null>(null);
  const theme = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);

  useEffect(() => {
    getHomeRails().then(setRails).catch(() => setRails({ forYou: [], trending: [], becauseYouPlayed: [] }));
  }, []);

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>Good evening</div>
          <h1 className="text-[34px] font-extrabold tracking-tight leading-tight">Sound, sorted.</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="chip" data-active={theme === "liquid"} onClick={() => set({ theme: "liquid" })}>Liquid Glass</button>
          <button className="chip" data-active={theme === "pixelos"} onClick={() => set({ theme: "pixelos" })}>PixelOS Material</button>
        </div>
      </header>

      {/* Trending rail — real data from Audius trending (in dev) / core (in app) */}
      {rails?.trending?.length ? (
        <Rail title="Trending this week" tracks={rails.trending} />
      ) : (
        <SkeletonRail label="Trending this week" />
      )}

      {rails?.forYou?.length ? (
        <Rail title="For you" tracks={rails.forYou} />
      ) : (
        <section className="glass p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="grid place-items-center rounded-2xl" style={{ width: 64, height: 64, background: "var(--panel-2)" }}>
            <Sparkles size={26} style={{ color: "var(--accent)" }} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-[15px]">Your recommendations are warming up</h3>
            <p className="text-[12.5px] mt-1" style={{ color: "var(--text-dim)" }}>
              Play a few tracks — codeci learns your taste locally and builds a For You rail.
              No account, nothing leaves this device.
            </p>
          </div>
          <button className="btn btn-primary sm:ml-auto" onClick={onGoSearch}>
            <Flame size={15} /> Find famous music
          </button>
        </section>
      )}

      {rails?.becauseYouPlayed && rails.becauseYouPlayed.length > 0 && (
        <Rail title={rails.seedTitle ?? "Because you played"} tracks={rails.becauseYouPlayed} />
      )}
    </div>
  );
}

function SkeletonRail({ label }: { label: string }) {
  return (
    <section className="mb-8">
      <h2 className="text-[17px] font-bold tracking-tight px-1 mb-3 flex items-center gap-2">
        <Loader2 size={15} className="animate-spin" style={{ color: "var(--accent)" }} /> {label}
      </h2>
      <div className="flex gap-4 px-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rail-card">
            <div className="skeleton" style={{ height: 172 }} />
            <div className="skeleton mt-2" style={{ height: 14, width: "85%" }} />
            <div className="skeleton mt-1" style={{ height: 11, width: "60%" }} />
          </div>
        ))}
      </div>
    </section>
  );
}
