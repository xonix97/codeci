import io
import sys
import time
import json

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from musicdl import musicdl

for src in ["JioSaavnMusicClient", "SpotifyMusicClient"]:
    t0 = time.time()
    try:
        client = musicdl.MusicClient(music_sources=[src])
        print(f"== {src}: init {time.time()-t0:.1f}s")
        res = client.search(keyword="kanye west")
        total = sum(len(v) for v in res.values())
        print(f"   search {time.time()-t0:.1f}s -> {total} results")
        for k, v in res.items():
            for s in v[:6]:
                d = s.todict()
                keys = ("song_name", "singers", "album", "duration_s", "ext", "with_valid_download_url")
                print("    ", json.dumps({kk: str(d.get(kk))[:55] for kk in keys}, ensure_ascii=False))
    except Exception as e:
        print(f"== {src}: FAILED after {time.time()-t0:.1f}s — {type(e).__name__}: {str(e)[:150]}")
