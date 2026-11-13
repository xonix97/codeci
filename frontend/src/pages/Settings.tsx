import {
  FolderOpen,
  Trash2,
  Palette,
  Music2,
  Cookie,
  Radio,
  ChevronRight,
} from "lucide-react";
import { ACCENTS_LIQUID, ACCENTS_PIXELOS, useSettings } from "../stores/settings";

const SOURCE_OPTIONS: { slug: string; label: string; note?: string }[] = [
  { slug: "NeteaseMusicClient", label: "NetEase (China)" },
  { slug: "QQMusicClient", label: "QQ Music (China)" },
  { slug: "KuwoMusicClient", label: "Kuwo (China)" },
  { slug: "MiguMusicClient", label: "Migu (China)" },
  { slug: "QianqianMusicClient", label: "QianQian (China)" },
  { slug: "KugouMusicClient", label: "KuGou (China)" },
  { slug: "YouTubeMusicClient", label: "YouTube Music", note: "~3 min per search (ytmusicapi) — leave off for everyday use" },
  { slug: "JamendoMusicClient", label: "Jamendo (CC, needs free client_id)" },
  { slug: "FMAMusicClient", label: "Free Music Archive (CC)" },
  { slug: "AudiusMusicClient", label: "Audius (no key)" },
];

export function SettingsPage() {
  const s = useSettings();
  const isLiquid = s.theme === "liquid";
  const accents = isLiquid ? ACCENTS_LIQUID : ACCENTS_PIXELOS;

  return (
    <div className="max-w-[860px]">
      <h1 className="text-[22px] font-extrabold tracking-tight mb-5">Settings</h1>

      {/* Theme */}
      <SettingsGroup title="Appearance" icon={<Palette size={16} />}>
        <div className="grid grid-cols-2 gap-3 mb-1">
          <button className="theme-tile" data-active={isLiquid} onClick={() => s.set({ theme: "liquid" })}>
            <div className="h-24 p-2.5" style={{ background: "#0d0f18" }}>
              <div className="h-9 rounded-xl p-2" style={{ background: "#161828" }}>
                <div className="h-3 w-14 rounded-full" style={{ background: "#8f7bff" }} />
                <div className="mt-1.5 h-2 w-24 rounded-full" style={{ background: "#2b2e44" }} />
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {[0, 1, 2].map((i) => <div key={i} className="h-5 flex-1 rounded-md" style={{ background: "#161828" }} />)}
              </div>
            </div>
            <div className="px-3 py-2 text-[12px] font-bold text-left" style={{ background: "var(--panel-solid)" }}>Liquid Glass</div>
          </button>
          <button className="theme-tile" data-active={!isLiquid} onClick={() => s.set({ theme: "pixelos" })}>
            <div className="h-24 p-2.5" style={{ background: "#f3edf7" }}>
              <div className="h-9 rounded-2xl p-2" style={{ background: "#e6e0e9" }}>
                <div className="h-3 w-14 rounded-full" style={{ background: "#6750a4" }} />
                <div className="mt-1.5 h-2 w-24 rounded-full" style={{ background: "#c9c3d0" }} />
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {[0, 1, 2].map((i) => <div key={i} className="h-5 flex-1 rounded-xl" style={{ background: "#e6e0e9" }} />)}
              </div>
            </div>
            <div className="px-3 py-2 text-[12px] font-bold text-left" style={{ background: "var(--panel-solid)" }}>PixelOS Material</div>
          </button>
        </div>
        <SettingRow label="Accent" hint="Applied instantly">
          <div className="flex gap-2">
            {accents.map((a) => (
              <button key={a} className="h-7 w-7 rounded-full border-2 transition-all" data-active={s.accent === a} aria-label={a} style={{ background: ACCENT_HEX[a], borderColor: s.accent === a ? "var(--text)" : "transparent", transform: s.accent === a ? "scale(1.15)" : "none" }} onClick={() => s.set({ accent: a })} />
            ))}
          </div>
        </SettingRow>
        {isLiquid && (
          <SettingRow label="Glass intensity" hint="Blur behind panels">
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((g) => (
                <button key={g} className="chip capitalize" data-active={s.glass === g} onClick={() => s.set({ glass: g })}>{g}</button>
              ))}
            </div>
          </SettingRow>
        )}
        {!isLiquid && (
          <SettingRow label="Dark tonal" hint="PixelOS dark surface">
            <Toggle on={s.pixelosDark} onChange={(v) => s.set({ pixelosDark: v })} />
          </SettingRow>
        )}
      </SettingsGroup>

      {/* Sources */}
      <SettingsGroup title="Music sources" icon={<Radio size={16} />}>
        <p className="text-[12px] px-1 pb-2" style={{ color: "var(--text-dim)" }}>Enabled sources are queried in parallel. Fewer sources = faster, more reliable search.</p>
        {SOURCE_OPTIONS.map(({ slug, label, note }) => (
          <SettingRow key={slug} label={label} hint={note ?? slug.replace(/MusicClient$/, "")}>
            <Toggle on={s.enabledSources.includes(slug)} onChange={() => s.toggleSource(slug)} />
          </SettingRow>
        ))}
        <SettingRow label="Jamendo client_id" hint="Free at devportal.jamendo.com — needed for CC Jamendo catalog">
          <input className="select w-56" placeholder="e.g. 3a4b5c6d7e" value={s.jamendoClientId} onChange={(e) => s.set({ jamendoClientId: e.target.value })} aria-label="Jamendo client id" />
        </SettingRow>
      </SettingsGroup>

      {/* Downloads / backend */}
      <SettingsGroup title="Downloads & backend" icon={<FolderOpen size={16} />}>
        <SettingRow label="Download folder" hint="Where musicdl saves tracks">
          <input className="select w-64" placeholder="e.g. C:\\Music or ~/Music" value={s.downloadDir} onChange={(e) => s.set({ downloadDir: e.target.value })} aria-label="Download folder" />
        </SettingRow>
        <SettingRow label="Backend URL (mobile / LAN)" hint="Desktop spawns the sidecar automatically; set this only to use a remote instance (e.g. Termux)">
          <input className="select w-64 font-mono" placeholder="http://127.0.0.1:8787" value={s.backendUrl} onChange={(e) => s.set({ backendUrl: e.target.value })} aria-label="Backend URL" />
        </SettingRow>
        <SettingRow label="Backend token" hint="Only if the remote backend sets X-Codeci-Token">
          <input className="select w-64 font-mono" type="password" placeholder="••••••••" value={s.backendToken} onChange={(e) => s.set({ backendToken: e.target.value })} aria-label="Backend token" />
        </SettingRow>
      </SettingsGroup>

      {/* Cookies */}
      <SettingsGroup title="VIP / login cookies" icon={<Cookie size={16} />}>
        {["QQMusicClient", "NeteaseMusicClient"].map((slug) => (
          <SettingRow key={slug} label={slug === "QQMusicClient" ? "QQ Music" : "NetEase"} hint="Paste browser cookies for lossless VIP playback">
            <input className="select w-64 font-mono" type="password" placeholder="vip_cookies (optional)" value={s.cookies[slug] ?? ""} onChange={(e) => s.setCookie(slug, e.target.value)} aria-label={`${slug} cookies`} />
          </SettingRow>
        ))}
      </SettingsGroup>

      {/* Recs */}
      <SettingsGroup title="Recommendations" icon={<Music2 size={16} />}>
        <SettingRow label="Taste profile & co-play data" hint="All computed locally. Reset any time.">
          <button className="btn btn-ghost" style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)" }} onClick={() => { if (confirm("Reset recommendation profile? Your playlists and library stay.")) s.clearRecs(); }}>
            <Trash2 size={15} /> Reset taste profile
          </button>
        </SettingRow>
      </SettingsGroup>

      <p className="mt-6 text-[11px] text-center" style={{ color: "var(--text-dim)" }}>
        codeci is noncommercial (PolyForm Noncommercial 1.0.0), built on musicdl. Personal use only.
      </p>
    </div>
  );
}

const ACCENT_HEX: Record<string, string> = {
  violet: "#8f7bff",
  sunset: "#ff8f6b",
  mint: "#5ee0a0",
  crimson: "#ff5d73",
  peach: "#8a5450",
  teal: "#006a6a",
  green: "#386a20",
};

function SettingsGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass p-4 mb-4">
      <div className="flex items-center gap-2 px-1 pb-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-dim)" }}>
        {icon}{title}<ChevronRight size={12} className="opacity-60" />
      </div>
      {children}
    </section>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{label}</div>
        {hint && <div className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>{hint}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className="toggle" data-on={on} role="switch" aria-checked={on} onClick={() => onChange(!on)} aria-label="Toggle" />;
}
