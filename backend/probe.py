"""Phase 0 probe: dump musicdl song_infos schema for codeci backend design."""
import json
import sys

from musicdl import musicdl

OUT = sys_stdout = None

lines = []

def emit(s=""):
    lines.append(s)

def dump_song_info(label, s):
    emit(f"### {label}")
    emit("raw_data keys: %s" % sorted(getattr(s, "raw_data", {}).keys()))
    emit(f"type(s): {type(s).__name__}")
    fields = [a for a in dir(s) if not a.startswith("_")]
    emit(f"fields: {fields}")
    for a in fields:
        try:
            v = getattr(s, a)
            if callable(v):
                continue
            v = str(v)
            if len(v) > 300:
                v = v[:300] + "…"
            emit(f"  - {a} = {v!r}")
        except Exception as e:
            emit(f"  - {a} = <error: {e}>")
    emit(f"raw_data: {json.dumps(getattr(s, 'raw_data', {}), ensure_ascii=False, default=str)[:2000]}")
    emit("")

def main():
    emit("# musicdl probe output\n")
    for source in ["JamendoMusicClient", "NeteaseMusicClient"]:
        emit(f"## {source}")
        try:
            client = musicdl.MusicClient(music_sources=[source])
            res = client.search(keyword="kanye west")
            for k, v in res.items():
                emit(f"search('kanye west') -> {k}: {len(v)} results")
                for i, s in enumerate(v[:2]):
                    dump_song_info(f"{k}[{i}]", s)
        except Exception as e:
            emit(f"ERROR: {e!r}\n")
    text = "\n".join(lines)
    with open(sys.argv[1] if len(sys.argv) > 1 else "probe-out.md", "w", encoding="utf-8") as f:
        f.write(text)

if __name__ == "__main__":
    main()
