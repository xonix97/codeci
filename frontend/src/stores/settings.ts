import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "liquid" | "pixelos";

interface SettingsState {
  theme: Theme;
  accent: string;
  glass: "low" | "medium" | "high";
  pixelosDark: boolean;
  onboardingDone: boolean;
  // sources
  enabledSources: string[];
  jamendoClientId: string;
  downloadDir: string;
  backendUrl: string;
  backendToken: string;
  cookies: Record<string, string>;
  // playback
  autoplayDownload: boolean;
  proxyPlayback: boolean;
  set: (patch: Partial<SettingsState>) => void;
  toggleSource: (slug: string) => void;
  setCookie: (slug: string, value: string) => void;
  clearRecs: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: "liquid",
      accent: "violet",
      glass: "medium",
      pixelosDark: false,
      onboardingDone: false,
      enabledSources: ["NeteaseMusicClient"],
      jamendoClientId: "",
      downloadDir: "",
      backendUrl: "http://127.0.0.1:8787",
      backendToken: "",
      cookies: {},
      autoplayDownload: true,
      proxyPlayback: true,
      set: (patch) => set(patch),
      toggleSource: (slug) =>
        set({
          enabledSources: get().enabledSources.includes(slug)
            ? get().enabledSources.filter((s) => s !== slug)
            : [...get().enabledSources, slug],
        }),
      setCookie: (slug, value) => set({ cookies: { ...get().cookies, [slug]: value } }),
      clearRecs: () => {
        /* Tauri command wired in desktop build */
        localStorage.removeItem("codeci-recs-seed");
      },
    }),
    {
      name: "codeci-settings",
      version: 2,
      migrate: (persisted) => {
        // v2: NetEase-only default (Migu is unreachable/slow on intl networks).
        // Factory-default sessions migrate to the fast default; custom source
        // selections are kept untouched.
        const state = (persisted ?? {}) as Record<string, unknown>;
        const factoryV1 = ["NeteaseMusicClient", "MiguMusicClient", "QQMusicClient", "KuwoMusicClient"];
        const cur = state.enabledSources;
        if (!Array.isArray(cur) || (cur.length === factoryV1.length && factoryV1.every((s) => (cur as string[]).includes(s)))) {
          state.enabledSources = ["NeteaseMusicClient"];
        }
        return state as unknown as SettingsState;
      },
    },
  ),
);

export const ACCENTS_LIQUID = ["violet", "sunset", "mint", "crimson"] as const;
export const ACCENTS_PIXELOS = ["violet", "peach", "teal", "green"] as const;
