//! HTTP client for the Python sidecar (`codeci-backend`, FastAPI + musicdl).
//! Desktop spawns it on 127.0.0.1 with a random port; mobile-external profiles
//! can point at a LAN/Termux instance. The frontend never talks to it directly.

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::models::{SearchResults, SourceKind, Track};

#[derive(Clone)]
pub struct SidecarClient {
    http: Client,
    base: String,
    token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Health {
    pub ok: bool,
    pub version: String,
}

#[derive(Debug, Deserialize)]
pub struct BackendSearchResponse {
    pub tracks: Vec<BackendTrack>,
}

#[derive(Debug, Deserialize)]
pub struct BackendTrack {
    pub source: String,
    pub source_id: String,
    pub title: String,
    pub artist: String,
    #[serde(default)]
    pub album: Option<String>,
    #[serde(default)]
    pub duration_s: Option<f64>,
    #[serde(default)]
    pub ext: Option<String>,
    #[serde(default)]
    pub file_size_bytes: Option<u64>,
    #[serde(default)]
    pub cover_url: Option<String>,
    #[serde(default)]
    pub stream_url: Option<String>,
    #[serde(default)]
    pub download_url: Option<String>,
    #[serde(default)]
    pub popularity: Option<f64>,
    #[serde(default)]
    pub genres: Vec<String>,
    #[serde(default)]
    pub is_vip: bool,
    #[serde(default)]
    pub lyric_lrc: Option<String>,
    pub with_valid_download_url: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct DownloadRequest<'a> {
    pub source: &'a str,
    pub source_id: &'a str,
    pub keyword_dir: &'a str,
    pub work_dir: &'a str,
}

impl SidecarClient {
    pub fn new(base: impl Into<String>, token: Option<String>) -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .user_agent("codeci-core/0.1")
                .build()
                .expect("sidecar http client"),
            base: base.into().trim_end_matches('/').to_string(),
            token,
        }
    }

    pub fn base_url(&self) -> &str {
        &self.base
    }

    fn auth(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        match &self.token {
            Some(t) => req.header("X-Codeci-Token", t),
            None => req,
        }
    }

    pub async fn health(&self) -> Result<Health> {
        let req = self.http.get(format!("{}/health", self.base));
        let resp = self.auth(req).send().await?;
        if !resp.status().is_success() {
            return Err(Error::Sidecar(format!("health check failed: {}", resp.status())));
        }
        Ok(resp.json().await?)
    }

    pub async fn search(&self, query: &str, sources: &[String], limit_per_source: u32) -> Result<SearchResults> {
        let req = self.http.get(format!(
            "{}/search?q={}&sources={}&limit={}",
            self.base,
            urlencoding::encode(query),
            urlencoding::encode(&sources.join(",")),
            limit_per_source
        ));
        let resp = self.auth(req).send().await?;
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(Error::Sidecar(format!("search failed: {body}")));
        }
        let parsed: BackendSearchResponse = resp.json().await?;
        let tracks = parsed
            .tracks
            .into_iter()
            .filter(|t| t.with_valid_download_url.unwrap_or(true) || t.stream_url.is_some())
            .map(|t| Track {
                id: format!("{}:{}", t.source.to_lowercase(), t.source_id),
                source: source_kind_from(&t.source),
                source_id: t.source_id,
                title: t.title,
                artist: t.artist,
                album: t.album,
                duration_s: t.duration_s,
                ext: t.ext,
                file_size_bytes: t.file_size_bytes,
                cover_url: t.cover_url,
                stream_url: t.stream_url.map(|u| self.absolutize(&u)),
                download_url: t.download_url,
                popularity: t.popularity,
                genres: t.genres,
                is_vip: t.is_vip,
                lyric_lrc: t.lyric_lrc,
                license: None,
            })
            .collect();
        Ok(SearchResults {
            query: query.to_string(),
            tracks,
            sources_queried: sources.to_vec(),
        })
    }

    pub async fn lyrics(&self, source: &str, source_id: &str) -> Result<Option<String>> {
        let req = self.http.get(format!(
            "{}/lyrics?source={}&source_id={}",
            self.base,
            urlencoding::encode(source),
            urlencoding::encode(source_id)
        ));
        let resp = self.auth(req).send().await?;
        if resp.status().as_u16() == 404 {
            return Ok(None);
        }
        if !resp.status().is_success() {
            return Err(Error::Sidecar(format!("lyrics failed: {}", resp.status())));
        }
        #[derive(Deserialize)]
        struct LyricsResp {
            lyric_lrc: Option<String>,
        }
        Ok(resp.json::<LyricsResp>().await?.lyric_lrc)
    }

    pub async fn parse_playlist(&self, url: &str, source: &str) -> Result<Vec<Track>> {
        let req = self.http.get(format!(
            "{}/playlist/parse?url={}&source={}",
            self.base,
            urlencoding::encode(url),
            urlencoding::encode(source)
        ));
        let resp = self.auth(req).send().await?;
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(Error::Sidecar(format!("playlist parse failed: {body}")));
        }
        let parsed: BackendSearchResponse = resp.json().await?;
        Ok(parsed
            .tracks
            .into_iter()
            .map(|t| Track {
                id: format!("{}:{}", t.source.to_lowercase(), t.source_id),
                source: source_kind_from(&t.source),
                source_id: t.source_id,
                title: t.title,
                artist: t.artist,
                album: t.album,
                duration_s: t.duration_s,
                ext: t.ext,
                file_size_bytes: t.file_size_bytes,
                cover_url: t.cover_url,
                stream_url: t.stream_url.map(|u| self.absolutize(&u)),
                download_url: t.download_url,
                popularity: t.popularity,
                genres: t.genres,
                is_vip: t.is_vip,
                lyric_lrc: t.lyric_lrc,
                license: None,
            })
            .collect())
    }

    fn absolutize(&self, u: &str) -> String {
        if u.starts_with("http://") || u.starts_with("https://") {
            u.to_string()
        } else {
            format!("{}{}", self.base, u)
        }
    }
}

fn source_kind_from(s: &str) -> SourceKind {
    match s.to_ascii_lowercase().as_str() {
        "neteasemusicclient" | "netease" => SourceKind::Netease,
        "qqmusicclient" | "qq" => SourceKind::Qq,
        "kuwomusicclient" | "kuwo" => SourceKind::Kuwo,
        "migumusicclient" | "migu" => SourceKind::Migu,
        "youtubemusicclient" | "youtube" => SourceKind::YouTube,
        "jamendamusicclient" | "jamendo" => SourceKind::Jamendo,
        "audiusmusicclient" | "audius" => SourceKind::Audius,
        other => SourceKind::Other(other.to_string()),
    }
}
