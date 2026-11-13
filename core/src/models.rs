use serde::{Deserialize, Serialize};

/// A track from an external source (not necessarily in the local library).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Track {
    /// codeci-internal id for library items; for search results this is the
    /// provider identifier (`source_id`) prefixed, e.g. `audius:TRACKID`.
    pub id: String,
    pub source: SourceKind,
    /// Provider id (e.g. Netease song id, Audius track id).
    pub source_id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_s: Option<f64>,
    pub ext: Option<String>,
    pub file_size_bytes: Option<u64>,
    pub cover_url: Option<String>,
    /// Directly playable stream URL (may expire).
    pub stream_url: Option<String>,
    /// Resolved download URL (may expire; Netease ~30 min TTL).
    pub download_url: Option<String>,
    /// 0..100 popularity reported by the source, when available.
    pub popularity: Option<f64>,
    pub genres: Vec<String>,
    pub is_vip: bool,
    pub lyric_lrc: Option<String>,
    pub license: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
    Audius,
    Jamendo,
    Wikimedia,
    CcMixter,
    Fma,
    /// Python sidecar source (musicdl), e.g. NeteaseMusicClient.
    Netease,
    Qq,
    Kuwo,
    Migu,
    YouTube,
    Other(String),
}

impl SourceKind {
    pub fn as_str(&self) -> &str {
        match self {
            SourceKind::Audius => "audius",
            SourceKind::Jamendo => "jamendo",
            SourceKind::Wikimedia => "wikimedia",
            SourceKind::CcMixter => "ccmixter",
            SourceKind::Fma => "fma",
            SourceKind::Netease => "netease",
            SourceKind::Qq => "qq",
            SourceKind::Kuwo => "kuwo",
            SourceKind::Migu => "migu",
            SourceKind::YouTube => "youtube",
            SourceKind::Other(s) => s.as_str(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResults {
    pub query: String,
    pub tracks: Vec<Track>,
    /// Tracks that could not be resolved/are unavailable were dropped.
    pub sources_queried: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryTrack {
    pub id: i64,
    pub source: String,
    pub source_id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_s: Option<f64>,
    pub cover_url: Option<String>,
    pub local_path: Option<String>,
    pub added_at: String,
    pub play_count: i64,
    pub skip_count: i64,
    pub completions: i64,
    pub liked: bool,
    pub genres: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationRail {
    pub id: String,
    pub title: String,
    pub tracks: Vec<Track>,
}
