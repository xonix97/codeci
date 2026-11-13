"""codeci-backend: FastAPI wrapper around musicdl for the codeci app.

Endpoints:
  GET  /health              -> liveness + version
  GET  /sources             -> registered musicdl source slugs
  GET  /search?q=&sources=&limit=   -> unified track list (JSON; 10-min TTL cache)
  GET  /lyrics?source=&source_id=   -> cached LRC from last search (404 if none)
  GET  /playlist/parse?url=&source= -> tracks from a playlist URL (sidecar mode)
  POST /download            -> download a track via musicdl (body: track dict + work_dir + cookies)
  GET  /proxy?url=          -> streaming proxy for <audio> playback (Range supported)

Auth: when CODECI_BACKEND_TOKEN is set, every request must send X-Codeci-Token.
When unset, the server binds to 127.0.0.1 and CORS allows localhost/tauri origins only.

Search strategy: sources run in PARALLEL with per-source isolation — one slow/broken
source (e.g. YouTubeMusicClient, ~3 min for 5 results) can't take down the rest.
Overall wall-clock cap: 45 s per source — a slow/unreachable source (e.g.
MiguMusicClient on non-CN networks) is dropped rather than blocking search.
Warm repeats are served from an in-process TTL cache.
"""
from __future__ import annotations

import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, wait
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from .musicdl_service import song_info_to_track

# Optional fallback for Windows Application Control blocking pycryptodomeX DLLs.
def _cryptodome_shim() -> None:
    try:
        import Cryptodome.Cipher  # noqa: F401
        return
    except Exception:
        pass
    import Crypto
    import Crypto.Cipher
    import Crypto.Util

    mods = sys.modules
    crypto_names = [n for n in list(mods) if n == "Crypto" or n.startswith("Crypto.")]
    for name in crypto_names:
        mods["Cryptodome" + name[6:]] = mods[name]
    import Crypto.Util._raw_api  # noqa: F401

    for name in [n for n in list(mods) if n.startswith("Crypto.")]:
        mods.setdefault("Cryptodome" + name[6:], mods[name])
    mods.setdefault("Cryptodome", Crypto)


if os.environ.get("CODECI_CRYPTODOME_SHIM", "auto") == "auto":
    try:
        _cryptodome_shim()
    except Exception:
        pass  # musicdl will surface the real import error later

from musicdl import musicdl  # noqa: E402  (after optional shim)

VERSION = "0.1.0"
TOKEN = os.environ.get("CODECI_BACKEND_TOKEN")

app = FastAPI(title="codeci-backend", version=VERSION)

if TOKEN:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_headers=["*"],
        allow_methods=["*"],
    )

    @app.middleware("http")
    async def check_token(request: Request, call_next):
        if request.headers.get("x-codeci-token") != TOKEN:
            return JSONResponse({"detail": "invalid or missing X-Codeci-Token"}, status_code=401)
        return await call_next(request)
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:1420",
            "http://localhost:5173",
            "http://127.0.0.1:1420",
            "http://127.0.0.1:5173",
            "tauri://localhost",
            "https://tauri.localhost",
            "http://tauri.localhost",
        ],
        allow_headers=["*"],
        allow_methods=["*"],
    )

# Musically heavy calls (search/download) are blocking; run in a worker pool.
_pool = ThreadPoolExecutor(max_workers=4)

# In-process caches shared across requests within this backend's lifetime.
_song_info_cache: dict[tuple[str, str], object] = {}
_artist_lock = threading.Lock()
_search_cache: dict[tuple[str, tuple[str, ...], int], tuple[float, list[dict]]] = {}

DEFAULT_SOURCES = ["NeteaseMusicClient"]
SOURCE_TIMEOUT_S = 45  # per-source cap; slower sources (e.g. Migu on intl networks) get dropped
CACHE_TTL_S = 600
CACHE_MAX = 128


@app.get("/health")
def health():
    return {"ok": True, "version": VERSION}


@app.get("/sources")
def sources():
    from musicdl.modules import MusicClientBuilder
    return {"sources": sorted(MusicClientBuilder.REGISTERED_MODULES)}


def _make_client(source_slugs: list[str], work_dir: Optional[str] = None, search_size: int = 20):
    slugs = [s.strip() for s in source_slugs if s.strip()]
    cfg = {}
    if work_dir:
        for s in slugs:
            cfg[s] = {"work_dir": work_dir, "search_size_per_source": search_size}
    else:
        cfg = {s: {"search_size_per_source": search_size} for s in slugs}
    return musicdl.MusicClient(music_sources=slugs, init_music_clients_cfg=cfg)


def _search_one(source: str, query: str, limit: int) -> list[dict]:
    """Search a single source in isolation; failures return [] and log."""
    try:
        client = _make_client([source], search_size=limit)
        raw = client.search(keyword=query)
    except Exception as e:
        print(f"[codeci-backend] source {source} failed: {e!r}")
        return []
    out = []
    for src, infos in raw.items():
        for info in infos:
            with _artist_lock:
                _song_info_cache[(src, str(info.identifier))] = info
            out.append(song_info_to_track(info, src))
    return out


def _search_sync(query: str, slugs: list[str], limit: int) -> list[dict]:
    cache_key = (query.strip().lower(), tuple(sorted(slugs)), limit)
    with _artist_lock:
        hit = _search_cache.get(cache_key)
        if hit and (__import__("time").time() - hit[0]) < CACHE_TTL_S:
            return hit[1]

    results: list[dict] = []
    pool = ThreadPoolExecutor(max_workers=max(1, len(slugs)))
    try:
        futures = {pool.submit(_search_one, s, query, limit): s for s in slugs}
        done, not_done = wait(futures, timeout=SOURCE_TIMEOUT_S)
        for fut in done:
            try:
                results.extend(fut.result())
            except Exception as e:
                print(f"[codeci-backend] source {futures[fut]} raised: {e!r}")
        for fut in not_done:
            print(f"[codeci-backend] source {futures[fut]} timed out after {SOURCE_TIMEOUT_S}s — dropped")
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    with _artist_lock:
        if len(_search_cache) >= CACHE_MAX:
            _search_cache.clear()
        _search_cache[cache_key] = (__import__("time").time(), results)
    return results


@app.get("/search")
async def search(q: str, sources: Optional[str] = None, limit: int = 20):
    slugs = [s for s in (sources.split(",") if sources else DEFAULT_SOURCES) if s]
    limit = max(1, min(limit, 100))
    if not q.strip():
        raise HTTPException(status_code=400, detail="q is required")
    try:
        results = await _run(lambda: _search_sync(q, slugs, limit))
    except Exception as e:  # musicdl surfaces provider errors as plain exceptions
        raise HTTPException(status_code=502, detail=str(e))
    return {"tracks": results, "sources": slugs}


@app.get("/lyrics")
async def lyrics(source: str, source_id: str):
    key = (source, source_id)
    with _artist_lock:
        info = _song_info_cache.get(key)
    if info is None:
        raise HTTPException(status_code=404, detail="not in cache; run /search first")
    lyric = getattr(info, "lyric", None)
    if not lyric:
        raise HTTPException(status_code=404, detail="no lyric for this track")
    return {"lyric_lrc": lyric}


def _parse_playlist_sync(url: str, source: str) -> list[dict]:
    client = _make_client([source])
    infos = client.parseplaylist(url)
    out = []
    for info in infos:
        with _artist_lock:
            _song_info_cache[(source, str(info.identifier))] = info
        out.append(song_info_to_track(info, source))
    return out


@app.get("/playlist/parse")
async def parse_playlist(url: str, source: str = "NeteaseMusicClient"):
    try:
        results = await _run(lambda: _parse_playlist_sync(url, source))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"tracks": results, "sources": [source]}


class DownloadBody(BaseModel):
    track: dict
    work_dir: str = "downloads"
    cookies: Optional[str] = None


def _download_sync(body: DownloadBody) -> dict:
    from musicdl.modules.utils.data import SongInfo

    source = body.track.get("source")
    identifier = body.track.get("source_id") or body.track.get("identifier")
    if not source or not identifier:
        raise ValueError("track.source and track.source_id are required")

    info = None
    with _artist_lock:
        info = _song_info_cache.get((source, str(identifier)))
    if info is None:
        # Rebuild from the serialized track dict (accepts /search round-trip).
        allowed = SongInfo.fieldnames() if hasattr(SongInfo, "fieldnames") else set()
        candidate = dict(body.track)
        candidate.setdefault("identifier", identifier)
        candidate.setdefault("source", source)
        data = {k: v for k, v in candidate.items() if k in allowed} if allowed else candidate
        info = SongInfo.fromdict(data)

    slugs = [source]
    init_cfg = {source: {"work_dir": body.work_dir}}
    if body.cookies:
        init_cfg[source]["default_download_cookies"] = body.cookies
        init_cfg[source]["default_search_cookies"] = body.cookies
    client = musicdl.MusicClient(music_sources=slugs, init_music_clients_cfg=init_cfg)
    client.download(song_infos=[info])
    return {"ok": True, "work_dir": body.work_dir}


@app.post("/download")
async def download(body: DownloadBody):
    try:
        return await _run(lambda: _download_sync(body))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/proxy")
async def proxy(request: Request, url: str):
    """Stream a remote media URL through the backend (handles signed URLs, CORS, hotlink rules)."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    if range_header := request.headers.get("range"):
        headers["Range"] = range_header
    client = httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(600.0, connect=30.0))
    req = client.build_request("GET", url, headers=headers)
    resp = await client.send(req, stream=True)
    media_type = resp.headers.get("content-type", "application/octet-stream")
    response_headers = {"Cache-Control": "public, max-age=86400"}
    for h in ("accept-ranges", "content-range", "content-length", "etag"):
        if resp.headers.get(h):
            response_headers[h] = resp.headers[h]

    async def body():
        try:
            async for chunk in resp.aiter_bytes(1 << 17):  # 128 KiB
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    return StreamingResponse(body(), media_type=media_type, headers=response_headers, status_code=resp.status_code)


async def _run(fn):
    import asyncio

    return await asyncio.get_event_loop().run_in_executor(_pool, fn)


def main() -> None:
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="codeci-backend")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()
    uvicorn.run("app.main:app", host=args.host, port=args.port, log_level=os.environ.get("CODECI_BACKEND_LOG", "info"))


if __name__ == "__main__":
    main()
