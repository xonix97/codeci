import { Music2 } from "lucide-react";
import { useState } from "react";

export function Cover({
  url,
  title,
  size,
  radius = "inherit",
}: {
  url?: string | null;
  title: string;
  size?: number | string;
  radius?: string;
}) {
  const [err, setErr] = useState(false);
  const style = { width: size ?? "100%", height: size ?? "100%", borderRadius: radius };
  const initials = title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="cover" style={style}>
      {url && !err ? (
        <img src={url} alt={title} loading="lazy" onError={() => setErr(true)} />
      ) : (
        <div className="cover-fallback" aria-hidden>
          {initials || <Music2 size={Math.max(18, ((typeof size === "number" ? size : 88) * 0.34))} />}
        </div>
      )}
    </div>
  );
}
