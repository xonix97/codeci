import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "spotify" | "liquid" | "pixelos";

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
      theme: "spotify",
      accent: "violet",
      glass: "medium",
      pixelosDark: false,
      onboardingDone: false,
      enabledSources: ["JioSaavnMusicClient", "NeteaseMusicClient"],
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
      version: 6,
      migrate: (persisted) => {
        // v2: NetEase-only default (Migu is unreachable/slow on intl networks).
        // Factory-default sessions migrate to the fast default; custom source
        // selections are kept untouched.
        // v6: theme default -> Spotify; sources -> JioSaavn + NetEase (the two measured
        // fastest famous-catalog sources on intl networks). Everything else = Settings add-ons.
        // v5: JioSaavn (~8s famous catalog incl. English tracks) added to factory defaults.
        // v4: NetEase-only defaults upgraded to NetEase + Kuwo.
        // v3: dropped YouTubeMusicClient from persisted enabled lists.
        const state = (persisted ?? {}) as Record<string, unknown>;
        const NE = "NeteaseMusicClient", KU = "KuwoMusicClient", JIO = "JioSaavnMusicClient";
        const TWO = [JIO, NE];
        const knownDefaults = [
          ["MiguMusicClient"],
          [NE],
          [NE, KU],
          [NE, "MiguMusicClient", "QQMusicClient", KU],
          [JIO, KU, NE],
        ];
        const cur = Array.isArray(state.enabledSources) ? (state.enabledSources as string[]) : null;
        const matchesKnown = cur && knownDefaults.some((k) => k.length === cur.length && k.every((s) => cur.includes(s)));
        if (!cur || matchesKnown) {
          state.enabledSources = TWO;
        } else {
          const filtered = cur.filter((s) => s !== "YouTubeMusicClient");
          state.enabledSources = filtered.length ? filtered : TWO;
        }
        // factory theme picks (never customized) -> spotify
        if (state.theme === "liquid" || state.theme === "pixelos") {
          const v5Theme = state.theme; // only switch untouched defaults
          if (v5Theme === "liquid") state.theme = "spotify";
        }
        return state as unknown as SettingsState;
      },
    },
  ),
);

export const ACCENTS_LIQUID = ["violet", "sunset", "mint", "crimson"] as const;
export const ACCENTS_PIXELOS = ["violet", "peach", "teal", "green"] as const;
export const ACCENTS_SPOTIFY = ["green", "white", "crimson"] as const;
