//! SQLite-backed library: tracks, playlists, queue, history, likes, cache.
//! Used on desktop (in Tauri) and in the Termux backend profile.
//! Android uses the same schema via rusqlite bundled.

use chrono::Utc;
use rusqlite::{params, Connection};

use crate::error::{Error, Result};
use crate::models::{LibraryTrack, Playlist};

const MIGRATIONS: &[&str] = &[
    "CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        duration_s REAL,
        cover_url TEXT,
        local_path TEXT,
        genres TEXT NOT NULL DEFAULT '[]',
        play_count INTEGER NOT NULL DEFAULT 0,
        skip_count INTEGER NOT NULL DEFAULT 0,
        completions INTEGER NOT NULL DEFAULT 0,
        liked INTEGER NOT NULL DEFAULT 0,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(source, source_id)
    )",
    "CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )",
    "CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, track_id, position)
    )",
    "CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY,
        track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        played_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed INTEGER NOT NULL DEFAULT 0,
        ms_played INTEGER NOT NULL DEFAULT 0
    )",
    "CREATE TABLE IF NOT EXISTS coplay (
        track_a INTEGER NOT NULL,
        track_b INTEGER NOT NULL,
        score REAL NOT NULL DEFAULT 1.0,
        PRIMARY KEY (track_a, track_b)
    )",
    "CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )",
    "CREATE TABLE IF NOT EXISTS lyrics_cache (
        cache_key TEXT PRIMARY KEY,
        lyric_lrc TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    )",
    "CREATE INDEX IF NOT EXISTS idx_history_track ON history(track_id)",
    "CREATE INDEX IF NOT EXISTS idx_history_played ON history(played_at)",
];

pub struct Library {
    conn: Connection,
}

fn row_to_library_track(row: &rusqlite::Row) -> rusqlite::Result<LibraryTrack> {
    let genres: String = row.get(8)?;
    Ok(LibraryTrack {
        id: row.get(0)?,
        source: row.get(1)?,
        source_id: row.get(2)?,
        title: row.get(3)?,
        artist: row.get(4)?,
        album: row.get(5)?,
        duration_s: row.get(6)?,
        cover_url: row.get(7)?,
        local_path: row.get(9)?,
        added_at: row.get(10)?,
        play_count: row.get(11)?,
        skip_count: row.get(12)?,
        completions: row.get(13)?,
        liked: row.get::<_, i64>(14)? != 0,
        genres: serde_json::from_str(&genres).unwrap_or_default(),
    })
}

const TRACK_COLS: &str = "id, source, source_id, title, artist, album, duration_s, cover_url, genres, local_path, added_at, play_count, skip_count, completions, liked";

impl Library {
    pub fn open(path: &std::path::Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        for m in MIGRATIONS {
            conn.execute(m, [])?;
        }
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        for m in MIGRATIONS {
            conn.execute(m, [])?;
        }
        Ok(Self { conn })
    }

    /// Insert or update a track from an external source; returns the library id.
    pub fn upsert_track(
        &self,
        source: &str,
        source_id: &str,
        title: &str,
        artist: &str,
        album: Option<&str>,
        duration_s: Option<f64>,
        cover_url: Option<&str>,
        genres: &[String],
    ) -> Result<i64> {
        let genres_json = serde_json::to_string(genres)?;
        self.conn.execute(
            "INSERT INTO tracks (source, source_id, title, artist, album, duration_s, cover_url, genres)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(source, source_id) DO UPDATE SET
                title=excluded.title, artist=excluded.artist, album=excluded.album,
                duration_s=excluded.duration_s, cover_url=excluded.cover_url, genres=excluded.genres",
            params![source, source_id, title, artist, album, duration_s, cover_url, genres_json],
        )?;
        let id: i64 = self.conn.query_row(
            "SELECT id FROM tracks WHERE source=?1 AND source_id=?2",
            params![source, source_id],
            |r| r.get(0),
        )?;
        Ok(id)
    }

    pub fn get_track(&self, id: i64) -> Result<LibraryTrack> {
        self.conn
            .query_row(
                &format!("SELECT {TRACK_COLS} FROM tracks WHERE id=?1"),
                params![id],
                row_to_library_track,
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Error::NotFound(format!("track {id}")),
                other => Error::Db(other),
            })
    }

    pub fn list_tracks(&self, limit: i64, offset: i64) -> Result<Vec<LibraryTrack>> {
        let mut stmt = self.conn.prepare(&format!(
            "SELECT {TRACK_COLS} FROM tracks ORDER BY added_at DESC LIMIT ?1 OFFSET ?2"
        ))?;
        let rows = stmt.query_map(params![limit, offset], row_to_library_track)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn search_tracks(&self, query: &str, limit: i64) -> Result<Vec<LibraryTrack>> {
        let like = format!("%{query}%");
        let mut stmt = self.conn.prepare(&format!(
            "SELECT {TRACK_COLS} FROM tracks
             WHERE title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1
             ORDER BY play_count DESC, title LIMIT ?2"
        ))?;
        let rows = stmt.query_map(params![like, limit], row_to_library_track)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn set_local_path(&self, id: i64, path: Option<&str>) -> Result<()> {
        self.conn.execute(
            "UPDATE tracks SET local_path=?2 WHERE id=?1",
            params![id, path],
        )?;
        Ok(())
    }

    pub fn set_liked(&self, id: i64, liked: bool) -> Result<()> {
        self.conn.execute(
            "UPDATE tracks SET liked=?2 WHERE id=?1",
            params![id, liked as i64],
        )?;
        Ok(())
    }

    pub fn like_count(&self) -> Result<i64> {
        Ok(self.conn.query_row("SELECT COUNT(*) FROM tracks WHERE liked=1", [], |r| r.get(0))?)
    }

    /// Record a play event (queue id or library id).
    pub fn record_play(&self, track_id: i64, ms_played: i64, completed: bool) -> Result<()> {
        self.conn.execute(
            "INSERT INTO history (track_id, ms_played, completed) VALUES (?1, ?2, ?3)",
            params![track_id, ms_played, completed as i64],
        )?;
        self.conn.execute(
            "UPDATE tracks SET play_count = play_count + 1,
                completions = completions + ?2,
                skip_count = skip_count + ?3
             WHERE id=?1",
            params![track_id, completed as i64, (!completed) as i64],
        )?;
        // Update co-play with the previous history entry's track.
        if let Ok(prev) = self.conn.query_row(
            "SELECT track_id FROM history WHERE id != last_insert_rowid() ORDER BY id DESC LIMIT 1",
            [],
            |r| r.get::<_, i64>(0),
        ) {
            if prev != track_id {
                let (a, b) = (prev.min(track_id), prev.max(track_id));
                self.conn.execute(
                    "INSERT INTO coplay (track_a, track_b, score) VALUES (?1, ?2, 1.0)
                     ON CONFLICT(track_a, track_b) DO UPDATE SET score = score + 1.0",
                    params![a, b],
                )?;
            }
        }
        Ok(())
    }

    pub fn coplay_neighbors(&self, track_id: i64, limit: i64) -> Result<Vec<(i64, f64)>> {
        let mut stmt = self.conn.prepare(
            "SELECT CASE WHEN track_a=?1 THEN track_b ELSE track_a END AS other, score
             FROM coplay WHERE track_a=?1 OR track_b=?1
             ORDER BY score DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![track_id, limit], |r| {
            Ok((r.get::<_, i64>(0)?, r.get::<_, f64>(1)?))
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn play_stats(&self) -> Result<Vec<(i64, i64, i64, i64, i64)>> {
        // (id, play_count, skip_count, completions, liked)
        let mut stmt = self.conn.prepare(
            "SELECT id, play_count, skip_count, completions, liked FROM tracks",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get::<_, i64>(4)?))
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// Decayed event weight: half-life 30 days. w = 2^(-days/30).
    pub fn weighted_history_events(&self, limit: i64) -> Result<Vec<(i64, f64, bool)>> {
        let mut stmt = self.conn.prepare(
            "SELECT track_id, played_at, completed FROM history ORDER BY played_at DESC LIMIT ?1",
        )?;
        let now = Utc::now();
        let rows = stmt.query_map(params![limit], |r| {
            Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)?))
        })?;
        let mut out = Vec::new();
        for row in rows {
            let (tid, played_at, completed) = row?;
            let days = chrono::DateTime::parse_from_rfc3339(&played_at)
                .or_else(|_| chrono::DateTime::parse_from_str(&played_at, "%Y-%m-%d %H:%M:%S"))
                .map(|dt| (now - dt.with_timezone(&Utc)).num_days() as f64)
                .unwrap_or(0.0);
            out.push((tid, (-days / 30.0).exp2(), completed != 0));
        }
        Ok(out)
    }

    // ---- Playlists ----

    pub fn create_playlist(&self, name: &str, description: Option<&str>) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO playlists (name, description) VALUES (?1, ?2)",
            params![name, description],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn rename_playlist(&self, id: i64, name: &str) -> Result<()> {
        self.conn
            .execute("UPDATE playlists SET name=?2 WHERE id=?1", params![id, name])?;
        Ok(())
    }

    pub fn delete_playlist(&self, id: i64) -> Result<()> {
        self.conn
            .execute("DELETE FROM playlists WHERE id=?1", params![id])?;
        Ok(())
    }

    pub fn list_playlists(&self) -> Result<Vec<Playlist>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_at, sort_order FROM playlists ORDER BY sort_order, id",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(Playlist {
                id: r.get(0)?,
                name: r.get(1)?,
                description: r.get(2)?,
                created_at: r.get(3)?,
                sort_order: r.get(4)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn playlist_tracks(&self, playlist_id: i64) -> Result<Vec<LibraryTrack>> {
        let mut stmt = self.conn.prepare(&format!(
            "SELECT {TRACK_COLS} FROM tracks JOIN playlist_tracks pt ON pt.track_id = tracks.id
             WHERE pt.playlist_id=?1 ORDER BY pt.position"
        ))?;
        let rows = stmt.query_map(params![playlist_id], row_to_library_track)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn add_to_playlist(&self, playlist_id: i64, track_id: i64) -> Result<()> {
        let pos: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id=?1",
            params![playlist_id],
            |r| r.get(0),
        )?;
        self.conn.execute(
            "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3)",
            params![playlist_id, track_id, pos],
        )?;
        Ok(())
    }

    pub fn remove_from_playlist(&self, playlist_id: i64, track_id: i64) -> Result<()> {
        self.conn.execute(
            "DELETE FROM playlist_tracks WHERE playlist_id=?1 AND track_id=?2",
            params![playlist_id, track_id],
        )?;
        Ok(())
    }

    // ---- Settings ----

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        match self.conn.query_row(
            "SELECT value FROM settings WHERE key=?1",
            params![key],
            |r| r.get(0),
        ) {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Error::Db(e)),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    // ---- Lyrics cache ----

    pub fn get_lyrics(&self, cache_key: &str) -> Result<Option<String>> {
        match self.conn.query_row(
            "SELECT lyric_lrc FROM lyrics_cache WHERE cache_key=?1",
            params![cache_key],
            |r| r.get(0),
        ) {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Error::Db(e)),
        }
    }

    pub fn set_lyrics(&self, cache_key: &str, lyric_lrc: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO lyrics_cache (cache_key, lyric_lrc) VALUES (?1, ?2)
             ON CONFLICT(cache_key) DO UPDATE SET lyric_lrc=excluded.lyric_lrc, fetched_at=datetime('now')",
            params![cache_key, lyric_lrc],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn library_crud_roundtrip() {
        let lib = Library::open_in_memory().unwrap();
        let id = lib
            .upsert_track("audius", "abc", "Runaway", "Kanye West", Some("MBDTF"), Some(361.0), Some("cover"), &["hip-hop".into()])
            .unwrap();
        let t = lib.get_track(id).unwrap();
        assert_eq!(t.title, "Runaway");
        assert_eq!(t.genres, vec!["hip-hop".to_string()]);
        lib.record_play(id, 300_000, true).unwrap();
        lib.record_play(id, 20_000, false).unwrap();
        let t2 = lib.get_track(id).unwrap();
        assert_eq!(t2.play_count, 2);
        assert_eq!(t2.completions, 1);
        assert_eq!(t2.skip_count, 1);
    }

    #[test]
    fn coplay_matrix_counts() {
        let lib = Library::open_in_memory().unwrap();
        let a = lib.upsert_track("audius", "a", "A", "X", None, None, None, &[]).unwrap();
        let b = lib.upsert_track("audius", "b", "B", "X", None, None, None, &[]).unwrap();
        lib.record_play(a, 100_000, true).unwrap();
        lib.record_play(b, 100_000, true).unwrap();
        lib.record_play(a, 100_000, true).unwrap();
        lib.record_play(b, 100_000, true).unwrap();
        let n = lib.coplay_neighbors(a, 10).unwrap();
        assert_eq!(n.len(), 1);
        assert_eq!(n[0].0, b);
        assert!(n[0].1 >= 2.0);
    }

    #[test]
    fn playlist_add_remove() {
        let lib = Library::open_in_memory().unwrap();
        let id = lib.upsert_track("audius", "x", "Song", "Artist", None, None, None, &[]).unwrap();
        let pid = lib.create_playlist("test mix", None).unwrap();
        lib.add_to_playlist(pid, id).unwrap();
        assert_eq!(lib.playlist_tracks(pid).unwrap().len(), 1);
        lib.remove_from_playlist(pid, id).unwrap();
        assert_eq!(lib.playlist_tracks(pid).unwrap().len(), 0);
        assert_eq!(lib.list_playlists().unwrap().len(), 1);
        lib.delete_playlist(pid).unwrap();
        assert!(lib.list_playlists().unwrap().is_empty());
    }
}
