//! Audius (https://audius.co) — no API key required.
//! Search returns mainstream-adjacent indie/underground releases; artwork and
//! play counts included, making it the best keyless "famous-ish on-device" catalog.

use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;

use super::{SearchContext, SourceClient};
use crate::error::Result;
use crate::models::{SourceKind, Track};

pub struct AudiusClient {
    http: Client,
    base: String,
}

fn string_or_seq<'de, D>(deserializer: D) -> std::result::Result<Option<Vec<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde_json::Value;
    let opt = Option::<Value>::deserialize(deserializer)?;
    Ok(opt.map(|v| match v {
        Value::String(s) => s.split(',').map(|t| t.trim().to_string()).filter(|t| !t.is_empty()).collect(),
        Value::Array(items) => items
            .into_iter()
            .filter_map(|i| i.as_str().map(|s| s.to_string()))
            .collect(),
        _ => vec![],
    }))
}

#[derive(Deserialize)]
struct AudiusSearchResponse {
    data: Vec<AudiusTrack>,
}

#[derive(Deserialize)]
struct AudiusTrack {
    id: String,
    title: String,
    #[serde(default)]
    genre: String,
    duration: f64,
    #[serde(default)]
    play_count: u64,
    user: AudiusUser,
    #[serde(default)]
    artwork: Option<AudiusArtwork>,
    #[serde(default)]
    license: Option<String>,
    #[serde(default, deserialize_with = "string_or_seq")]
    tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct AudiusUser {
    name: String,
}

#[derive(Deserialize)]
struct AudiusArtwork {
    #[serde(rename = "480x480")]
    big: Option<String>,
}

impl Default for AudiusClient {
    fn default() -> Self {
        Self::new()
    }
}

impl AudiusClient {
    pub fn new() -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .user_agent("codeci/0.1 (noncommercial)")
                .build()
                .expect("audius http client"),
            base: "https://api.audius.co/v1".to_string(),
        }
    }

    /// Trending this week (used by the Home rail) — https://api.audius.co/v1/tracks/trending
    pub async fn trending(&self, limit: u32) -> Result<Vec<Track>> {
        let url = format!(
            "{}/tracks/trending?app_name=codeci&limit={}&time=week",
            self.base,
            limit.min(50).max(1)
        );
        let resp = self.http.get(&url).send().await?.error_for_status()?;
        let parsed: AudiusSearchResponse = resp.json().await?;
        Ok(parsed
            .data
            .into_iter()
            .map(|t| {
                let mut genres = vec![t.genre.clone()];
                genres.extend(t.tags.unwrap_or_default());
                Track {
                    id: format!("audius:{}", t.id),
                    source: SourceKind::Audius,
                    source_id: t.id.clone(),
                    title: t.title,
                    artist: t.user.name,
                    album: None,
                    duration_s: Some(t.duration),
                    ext: Some("mp3".to_string()),
                    file_size_bytes: None,
                    cover_url: t.artwork.and_then(|a| a.big),
                    stream_url: Some(format!(
                        "{}/tracks/{}/stream?app_name=codeci",
                        self.base, t.id
                    )),
                    download_url: None,
                    popularity: Some(t.play_count as f64),
                    genres,
                    is_vip: false,
                    lyric_lrc: None,
                    license: t.license,
                }
            })
            .collect())
    }
}

#[async_trait]
impl SourceClient for AudiusClient {
    fn name(&self) -> &'static str {
        "audius"
    }

    async fn search(&self, query: &str, ctx: &SearchContext) -> Result<Vec<Track>> {
        let limit = ctx.limit.min(100).max(1);
        let url = format!(
            "{}/tracks/search?query={}&app_name=codeci&limit={}",
            self.base,
            urlencoding::encode(query),
            limit
        );
        let resp = self.http.get(&url).send().await?.error_for_status()?;
        let parsed: AudiusSearchResponse = resp.json().await?;
        Ok(parsed
            .data
            .into_iter()
            .map(|t| {
                let mut genres = vec![t.genre];
                genres.extend(t.tags.unwrap_or_default());
                Track {
                    id: format!("audius:{}", t.id),
                    source: SourceKind::Audius,
                    source_id: t.id.clone(),
                    title: t.title,
                    artist: t.user.name,
                    album: None,
                    duration_s: Some(t.duration),
                    ext: Some("mp3".to_string()),
                    file_size_bytes: None,
                    cover_url: t.artwork.and_then(|a| a.big),
                    stream_url: Some(format!(
                        "{}/tracks/{}/stream?app_name=codeci",
                        self.base, t.id
                    )),
                    download_url: None,
                    popularity: Some(t.play_count as f64),
                    genres,
                    is_vip: false,
                    lyric_lrc: None,
                    license: t.license,
                }
            })
            .collect())
    }

    async fn stream_url(&self, track: &Track) -> Result<Option<String>> {
        Ok(track.stream_url.clone())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn fixture_parse() {
        let fixture = include_str!("../../fixtures/audius_search.json");
        let resp: super::AudiusSearchResponse = serde_json::from_str(fixture).unwrap();
        assert_eq!(resp.data.len(), 1);
        assert_eq!(resp.data[0].title, "Kanye Loves Halo [Wukileak]");
        assert_eq!(resp.data[0].user.name, "wuki");
        assert!(resp.data[0].artwork.is_some());
    }
}
