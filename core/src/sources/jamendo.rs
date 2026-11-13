//! Jamendo (https://www.jamendo.com) — CC-licensed catalog, needs a free client_id
//! (register at https://devportal.jamendo.com). Optional; absence degrades gracefully.
//! Offers direct MP3/OGG stream URLs and a popularity ordering used by the trending rail.

use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;

use super::{SearchContext, SourceClient};
use crate::error::{Error, Result};
use crate::models::{SourceKind, Track};

pub struct JamendoClient {
    http: Client,
    client_id: Option<String>,
}

#[derive(Deserialize)]
struct JamendoResponse {
    results: Vec<JamendoTrack>,
}

#[derive(Deserialize)]
struct JamendoTrack {
    id: String,
    name: String,
    artist_name: String,
    duration: u64,
    #[serde(default)]
    image: Option<String>,
    #[serde(default)]
    audio: Option<String>,
    #[serde(default)]
    shareurl: Option<String>,
    #[serde(default)]
    license_ccurl: Option<String>,
    #[serde(default)]
    tags: Option<String>,
}

impl JamendoClient {
    pub fn new(client_id: Option<String>) -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .user_agent("codeci/0.1 (noncommercial)")
                .build()
                .expect("jamendo http client"),
            client_id,
        }
    }

    /// Search with a server-side sort order, e.g. `popularity_total` (trending rail).
    pub async fn search_ordered(
        &self,
        query: &str,
        order: &str,
        ctx: &SearchContext,
    ) -> Result<Vec<Track>> {
        let Some(client_id) = self.client_id.as_deref() else {
            return Err(Error::SourceUnavailable(
                "jamendo requires a free client_id (settings → sources → jamendo)".into(),
            ));
        };
        let limit = ctx.limit.min(50).max(1);
        let url = format!(
            "https://api.jamendo.com/v3.0/tracks/?client_id={}&format=json&limit={}&search={}&order={}&include=musicinfo",
            urlencoding::encode(client_id),
            limit,
            urlencoding::encode(query),
            order
        );
        let resp = self.http.get(&url).send().await?.error_for_status()?;
        let parsed: JamendoResponse = resp.json().await?;
        Ok(parsed.results.into_iter().map(map_track).collect())
    }
}

fn map_track(t: JamendoTrack) -> Track {
    let genres = t
        .tags
        .as_deref()
        .map(|s| s.split(',').map(|g| g.trim().to_string()).filter(|g| !g.is_empty()).collect())
        .unwrap_or_default();
    Track {
        id: format!("jamendo:{}", t.id),
        source: SourceKind::Jamendo,
        source_id: t.id,
        title: t.name,
        artist: t.artist_name,
        album: None,
        duration_s: Some(t.duration as f64),
        ext: Some("mp3".to_string()),
        file_size_bytes: None,
        cover_url: t.image,
        stream_url: t.audio.or(t.shareurl),
        download_url: None,
        popularity: None,
        genres,
        is_vip: false,
        lyric_lrc: None,
        license: t.license_ccurl,
    }
}

#[async_trait]
impl SourceClient for JamendoClient {
    fn name(&self) -> &'static str {
        "jamendo"
    }

    async fn search(&self, query: &str, ctx: &SearchContext) -> Result<Vec<Track>> {
        self.search_ordered(query, "popularity_total", ctx).await
    }

    async fn stream_url(&self, track: &Track) -> Result<Option<String>> {
        Ok(track.stream_url.clone())
    }
}
