# musicdl schema probe (phase 0)

Date: 2026-11-13 · musicdl **2.14.2** · Python 3.11.9 · Windows 11

## Machine quirks discovered

1. **Application Control policy** (Smart App Control) initially blocked `pycryptodomex`'s native DLLs (`Cryptodome.Cipher._raw_des`) with *"An Application Control policy has blocked this file."* → user disabled SAC, `Cryptodome.Cipher.DES` imports fine afterwards.
2. **Belt-and-braces:** backend wrapper imports `musicdl` only after an optional shim — if `import Cryptodome` fails, alias `Cryptodome* → Crypto*` in `sys.modules` (same library, `pycryptodome` namespace). Implemented behind env flag `CODECI_CRYPTODOME_SHIM=auto`.
3. Console encoding `cp1252` crashes on Chinese track titles — always `PYTHONIOENCODING=utf-8` / `PYTHONUTF8=1`, and probe output is written to files, not printed.
4. `musicdl` logs to stderr with colorama — not an error.

## Results

| Source | Search "kanye west" | Notes |
|---|---|---|
| JamendoMusicClient | 5 results (CC "type beats") | works; mainstream superstars NOT in CC catalog — expected |
| NeteaseMusicClient | 5 results (**real** Kanye West: "Runaway", "Bound 2", FLAC) | works; lossless "jymaster" level resolved via HTTP URL |

Netease caveat: results are **Korean/CN-licensed mainstream** — quality covers are lossless and come with inline LRC lyrics. `download_url_status.ok=True` after HEAD probe. File size for lossless Kanye track ≈ 338 MB.

## `SongInfo` object layout

`SongInfo` is **not** a dict (`dict(s)` raises `KeyError: 0`; `s[0]` raises `KeyError`; it supports `s.get("field")` / `s.todict()`).

Important attributes (observed):

```
song_name, singers, album, identifier
duration          # "00:06:01"
duration_s        # "361.016" (str)
ext               # "flac" / "mp3"
file_size         # "338.45 MB"
file_size_bytes   # str int
cover_url         # https image
download_url      # provider-specific HTTP(S) URL (Netease: m701.music.126.net?...flac?vuutv=...)
download_url_status  # dict-ish: {'ok': True, 'ctype': 'audio/mpeg', 'ext': 'flac',
                   #             'original_download_url': ..., 'file_size': '…', 'file_size_bytes': 354892223, ...}
with_valid_download_url  # 'True' / 'False' (str)
lyric             # LRC string "[mm:ss.xx] line …" (often present, incl. Chinese translations), or None/''
source            # 'NeteaseMusicClient'
protocol          # 'HTTP'
save_path / work_dir
raw_data          # dict with keys: 'search' (provider payload, huge), 'download' (post-resolution), 'lyric', 'quality'
```

`raw_data['search']` for Netease exposes: `id`, `pop` (popularity 0–100), `fee` (1=VIP), `privilege.maxBrLevel: 'lossless'`, `ar`/`al` names, `picUrl`, `dt` (ms), `mark`. Useful for sorting by popularity and showing VIP badges.

Jamendo `raw_data['search']` exposes: `id`, `score`, `stream.mp3` (direct stream URL!), `cover.small/big`, `artist`, `album`. The **stream** URL is directly playable — good for mobile on-device client.

## Notes for backend design

- Use `SongInfo.get(...)`/`todict()` — never `dict(s)`.
- Map to codeci `Track { id, source, source_track_id, title, artist, album, duration_s, ext, file_size_bytes, cover_url, download_url, stream_url, lyric_lrc, is_vip }`.
- For Netease, `stream_url` = `download_url` (HTTP FLAC) or the provider stream endpoint; backend `/stream` proxies with proper headers (`time ttl ~30 min` because of signed URLs).
- Lyrics: pass through LRC verbatim; frontend parses timestamps.
- Threading/limits: `search_size_per_source` default 5 in probe; make configurable.
- musicdl is noisy on stderr; set logging level and redirect if needed.
- `MusicClient(music_sources=[...])` construction is heavy-ish (imports entire sources package tree incl. Node wrapper) — construct once per worker, reuse.
- Download output path default: `./musicdl_outputs/<source>/<datetime keyword>/`; override per-source `work_dir` in `init_music_clients_cfg`.

Probe raw output: `docs-probe.md` (git-ignored? no — delete it; keep this file as source of truth).
