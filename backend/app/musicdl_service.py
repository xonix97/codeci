"""Shared helpers: SongInfo -> JSON-safe dict for the codeci API contract."""
from __future__ import annotations

from typing import Any

from musicdl.modules.utils.data import SongInfo

_SOURCE_CLIENT_NAMES = {}


def _client_name_for(source: str) -> str:
    if not _SOURCE_CLIENT_NAMES:
        from musicdl.modules import MusicClientBuilder
        _SOURCE_CLIENT_NAMES.update(
            {slug.lower(): slug for slug in MusicClientBuilder.REGISTERED_MODULES}
        )
    return _SOURCE_CLIENT_NAMES.get(source.lower(), source)


def song_info_to_track(info: SongInfo, source: str) -> dict[str, Any]:
    raw = getattr(info, "raw_data", {}) or {}
    search = raw.get("search", {}) if isinstance(raw, dict) else {}
    popularity = None
    if isinstance(search, dict):
        popularity = search.get("pop") or search.get("score") or search.get("weight")
        if popularity is not None:
            try:
                popularity = float(popularity)
            except (TypeError, ValueError):
                popularity = None
    lyric = info.lyric if isinstance(info.lyric, str) else None
    album = info.album if isinstance(info.album, str) else None
    duration_s = None
    try:
        if info.duration_s not in (None, ""):
            duration_s = float(str(info.duration_s))
    except (TypeError, ValueError):
        duration_s = None
    file_size_bytes = None
    try:
        if info.file_size_bytes not in (None, ""):
            file_size_bytes = int(str(info.file_size_bytes))
    except (TypeError, ValueError):
        file_size_bytes = None
    ext = info.ext if isinstance(info.ext, str) else None
    return {
        "source": source,
        "source_id": str(info.identifier),
        "title": str(info.song_name or ""),
        "artist": str(info.singers or ""),
        "album": album,
        "duration_s": duration_s,
        "ext": ext,
        "file_size_bytes": file_size_bytes,
        "cover_url": str(info.cover_url) if info.cover_url else None,
        "stream_url": str(info.download_url) if info.download_url else None,
        "download_url": str(info.download_url) if info.download_url else None,
        "popularity": popularity,
        "genres": [],
        "is_vip": bool(isinstance(search, dict) and search.get("fee", 0) == 1),
        "lyric_lrc": lyric or None,
        "with_valid_download_url": str(info.with_valid_download_url).lower() == "true",
    }
