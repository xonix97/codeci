import { Download, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { formatBytes } from "../api";

export function DownloadsPage() {
  const [dir, setDir] = useState<string>("downloads");
  const [used, setUsed] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/core").then(({ invoke }) =>
        invoke<{ dir: string; used_bytes: number }>("downloads_info").then((info) => {
          setDir(info.dir);
          setUsed(info.used_bytes);
        }),
      ).catch(() => setUsed(null));
    }
  }, []);

  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-tight mb-4">Downloads</h1>
      <div className="glass p-6 max-w-[620px]">
        <div className="flex items-center gap-4 mb-4">
          <div className="grid place-items-center rounded-2xl" style={{ width: 56, height: 56, background: "var(--panel-2)", color: "var(--accent)" }}>
            <Download size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              <FolderOpen size={13} /> Download folder
            </div>
            <div className="text-[13px] font-mono truncate mt-0.5">{dir}</div>
            {used != null && <div className="text-[11.5px] mt-1" style={{ color: "var(--text-dim)" }}>{formatBytes(used)} used</div>}
          </div>
        </div>
        <p className="text-[12.5px] leading-6" style={{ color: "var(--text-dim)" }}>
          Downloads are saved through musicdl into the folder above. Change it in
          Settings → Downloads. Tracks are tagged and ready for any player.
        </p>
      </div>
    </div>
  );
}
