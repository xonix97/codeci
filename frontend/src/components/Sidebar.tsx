import {
  Download,
  Home,
  Library,
  ListMusic,
  Music2,
  Search,
  Settings,
} from "lucide-react";
import type { NavTarget } from "../navigation";

const ITEMS: { id: NavTarget; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "search", label: "Search", icon: Search },
  { id: "library", label: "Library", icon: Library },
  { id: "playlists", label: "Playlists", icon: ListMusic },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ active, onNavigate }: { active: NavTarget; onNavigate: (t: NavTarget) => void }) {
  return (
    <aside className="sidebar">
      <div className="flex items-center gap-2 px-2 pb-5 pt-1">
        <div
          className="grid place-items-center rounded-2xl"
          style={{ width: 40, height: 40, background: "linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent-2) 70%, transparent))", color: "var(--on-accent)", boxShadow: "var(--shadow-glow)" }}
        >
          <Music2 size={20} strokeWidth={2.2} />
        </div>
        <div className="nav-label leading-tight">
          <div className="font-extrabold text-[17px] tracking-tight">codeci</div>
          <div className="text-[9.5px] uppercase tracking-[0.14em]" style={{ color: "var(--text-dim)" }}>music, codec'd</div>
        </div>
      </div>
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className="nav-item"
          data-active={active === id}
          onClick={() => onNavigate(id)}
        >
          <Icon size={18} strokeWidth={2} />
          <span className="nav-label">{label}</span>
        </button>
      ))}
      <div className="mt-auto nav-label px-3 pt-4 text-[10.5px] leading-snug" style={{ color: "var(--text-dim)" }}>
        Noncommercial build · musicdl + open sources.
        Personal use only.
      </div>
    </aside>
  );
}
