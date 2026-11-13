import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { PlayerBar } from "./components/PlayerBar";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import type { NavTarget } from "./navigation";
import { HomePage } from "./pages/Home";
import { SearchPage } from "./pages/Search";
import { LibraryPage } from "./pages/Library";
import { PlaylistsPage } from "./pages/Playlists";
import { DownloadsPage } from "./pages/Downloads";
import { SettingsPage } from "./pages/Settings";
import { NowPlayingPage } from "./pages/NowPlaying";
import { useSettings } from "./stores/settings";

export default function App() {
  useAudioPlayer();
  const [nav, setNav] = useState<NavTarget>("home");
  const theme = useSettings((s) => s.theme);
  const accent = useSettings((s) => s.accent);
  const glass = useSettings((s) => s.glass);
  const pixelosDark = useSettings((s) => s.pixelosDark);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.accent = accent;
    root.dataset.glass = glass;
    root.dataset.dark = String(pixelosDark);
  }, [theme, accent, glass, pixelosDark]);

  const content = useMemo(() => {
    switch (nav) {
      case "home":
        return <HomePage onGoSearch={() => setNav("search")} />;
      case "search":
        return <SearchPage />;
      case "library":
        return <LibraryPage />;
      case "playlists":
        return <PlaylistsPage />;
      case "downloads":
        return <DownloadsPage />;
      case "settings":
        return <SettingsPage />;
      case "nowplaying":
        return <NowPlayingPage onClose={() => setNav("home")} />;
    }
  }, [nav]);

  return (
    <div className="app-frame">
      <div className="aurora" aria-hidden />
      <Sidebar active={nav} onNavigate={setNav} />
      <main className="main-scroll">{content}</main>
      <PlayerBar onNavigate={setNav} />
    </div>
  );
}
