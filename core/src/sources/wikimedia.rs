//! Wikimedia Commons audio — keyless, great for famous public-domain/CC recordings
//! (classical, jazz, speech) but not mainstream commercial hits.
//! Two-step: search file titles → imageinfo for URLs and sizes.

use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;

use super::{SearchContext, SourceClient};
use crate::error::Result;
use crate::models::{SourceKind, Track};

const API: &str = "https://commons.wikimedia.org/w/api.php";

pub struct WikimediaClient {
    http: Client,
}

#[derive(Deserialize)]
struct WmSearchResponse {
    query: Option<WmQuery>,
}

#[derive(Deserialize)]
struct WmQuery {
    search: Vec<WmSearchHit>,
}

#[derive(Deserialize)]
struct WmSearchHit {
    title: String,
}

#[derive(Deserialize)]
struct WmInfoResponse {
    query: Option<WmInfoQuery>,
}

#[derive(Deserialize)]
struct WmInfoQuery {
    pages: std::collections::HashMap<String, WmPage>,
}

#[derive(Deserialize)]
struct WmPage {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    imageinfo: Option<Vec<WmImageInfo>>,
}

#[derive(Deserialize)]
struct WmImageInfo {
    url: String,
    #[serde(default)]
    mime: Option<String>,
    #[serde(default)]
    size: Option<u64>,
    #[serde(default)]
    extmetadata: Option<WmExtMetadata>,
}

#[derive(Deserialize, Default)]
struct WmExtMetadata {
    #[serde(rename = "LicenseShortName")]
    license: Option<WmValue>,
    #[serde(rename = "Artist")]
    artist: Option<WmValue>,
}

#[derive(Deserialize, Default)]
struct WmValue {
    #[serde(rename = "value")]
    value: String,
}

impl Default for WikimediaClient {
    fn default() -> Self {
        Self::new()
    }
}

impl WikimediaClient {
    pub fn new() -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .user_agent("codeci/0.1 (noncommercial; +https://github.com/xonix97/codeci)")
                .build()
                .expect("wikimedia http client"),
        }
    }

    fn title_to_track(title: &str, info: &WmImageInfo) -> Track {
        let raw = title.trim_start_matches("File:").to_string();
        let artist = info
            .extmetadata
            .as_ref()
            .and_then(|m| m.artist.as_ref())
            .map(|a| strip_html(&a.value))
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Wikimedia Commons".to_string());
        let title_clean = raw
            .rsplit_once('.')
            .map(|(base, _)| base)
            .unwrap_or(&raw)
            .replace('_', " ");
        let license = info
            .extmetadata
            .as_ref()
            .and_then(|m| m.license.as_ref())
            .map(|l| l.value.clone());
        let ext = info.url.rsplit('.').next().map(|e| e.to_string());
        Track {
            id: format!("wikimedia:{}", urlencoding::encode(&raw)),
            source: SourceKind::Wikimedia,
            source_id: raw,
            title: title_clean,
            artist,
            album: None,
            duration_s: None,
            ext,
            file_size_bytes: info.size,
            cover_url: None,
            stream_url: Some(info.url.clone()),
            download_url: Some(info.url.clone()),
            popularity: None,
            genres: vec!["public-domain".to_string()],
            is_vip: false,
            lyric_lrc: None,
            license,
        }
    }
}

fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            c => {
                if !in_tag {
                    out.push(c);
                }
            }
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[async_trait]
impl SourceClient for WikimediaClient {
    fn name(&self) -> &'static str {
        "wikimedia"
    }

    async fn search(&self, query: &str, ctx: &SearchContext) -> Result<Vec<Track>> {
        let limit = ctx.limit.min(25).max(1);
        let search_url = format!(
            "{API}?action=query&list=search&srsearch={}%20filetype:audio&srnamespace=6&srlimit={}&format=json",
            urlencoding::encode(query),
            limit
        );
        let resp: WmSearchResponse = self.http.get(&search_url).send().await?.json().await?;
        let hits = resp.query.map(|q| q.search).unwrap_or_default();
        if hits.is_empty() {
            return Ok(vec![]);
        }
        let titles = hits
            .iter()
            .map(|h| h.title.as_str())
            .collect::<Vec<_>>()
            .join("|");
        let info_url = format!(
            "{API}?action=query&titles={}&prop=imageinfo&iiprop=url|mime|size|extmetadata&format=json",
            urlencoding::encode(&titles)
        );
        let info: WmInfoResponse = self.http.get(&info_url).send().await?.json().await?;
        let mut out = Vec::new();
        if let Some(q) = info.query {
            for hit in &hits {
                let page = q.pages.values().find(|p| {
                    p.title.as_deref() == Some(hit.title.as_str())
                });
                if let Some(page) = page {
                    if let Some(ii) = page.imageinfo.as_ref().and_then(|v| v.first()) {
                        if ii.mime.as_deref().map(|m| m.starts_with("audio/")).unwrap_or(true) {
                            out.push(Self::title_to_track(&hit.title, ii));
                        }
                    }
                }
            }
        }
        Ok(out)
    }

    async fn stream_url(&self, track: &Track) -> Result<Option<String>> {
        Ok(track.stream_url.clone())
    }
}
