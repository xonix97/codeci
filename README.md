# codeci

> A music desktop & Android app built on [musicdl](https://github.com/CharlesPikachu/musicdl) — search, stream, download, and manage music from dozens of sources.

**Status:** early development — see [`plan.md`](plan.md) for the full build plan.

## Features (planned / in progress)

- Search across dozens of music sources (full catalog via the bundled Python sidecar on desktop; built-in open/CC sources on Android)
- Stream and play with a queue, shuffle/repeat, and an offline library
- Download songs & entire playlists to disk
- Playlist import from URLs (NetEase, QQ, Spotify, and more)
- Library, playlists, favorites, history (SQLite)
- Lyrics where available, local files embedded
- Two themes: **Liquid Glass** (frosted translucency) and **PixelOS Material** (Material You dynamic color)
- Windows, CachyOS Linux, Android

## Legal

codeci is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) and is intended for **personal, noncommercial use only**. It builds on [CharlesPikachu/musicdl](https://github.com/CharlesPikachu/musicdl), also PolyForm Noncommercial. It does not host, mirror, or distribute any copyrighted content. See `plan.md` §5.

## Development

See `plan.md`. Quick start:

```bash
git clone https://github.com/xonix97/codeci.git
cd codeci
# Rust core
cargo test -p codeci-core
# Frontend
cd frontend && npm install && npm run dev
# Desktop app
cd src-tauri && cargo tauri dev
```
