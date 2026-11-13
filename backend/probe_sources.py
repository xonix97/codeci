"""Time search across all candidate sources: 'kanye west', 30s budget each."""
import sys, time, json

sys.stdout.reconfigure(encoding="utf-8")

from musicdl import musicdl

SOURCES = [
    "QQMusicClient",
    "KuwoMusicClient",
    "QianqianMusicClient",
    "KugouMusicClient",
    "JamendoMusicClient",
    "SpotifyMusicClient",
    "DeezerMusicClient",
    "AudiusMusicClient",
    "WikimediaCommonsMusicClient",
    "FMAMusicClient",
    "WikimediaCommonsMusicClient",
    "GDStudioMusicClient",
    "FMAMusicClient",
    "NeteaseMusicClient",
]

def probe(source):
    t0 = time.time()
    try:
        client = musicdl.MusicClient(music_sources=[source])
        res = client.search(keyword="kanye west")
        dt = time.time() - t0
        total = sum(len(v) for v in res.values())
        names = []
        for v in res.values():
            for s in v[:3]:
                names.append(f"{s.song_name} — {s.singers}")
        return (source, dt, total, names)
    except Exception as e:
        return (source, time.time() - t0, -1, [f"ERROR: {type(e).__name__}: {str(e)[:120]}"])

for s in dict.fromkeys(SOURCES):  # dedupe, keep order
    src, dt, total, names = probe(s)
    print(f"{src}: {dt:.1f}s, {total} results")
    for n in names:
        print(f"    {n}")
