//! Streaming download manager with progress callbacks.
//! Downloads via HTTP(S) to the user-selected directory; resumes partial files.

use std::path::{Path, PathBuf};

use futures_util::StreamExt;
use tokio::fs;
use tokio::io::AsyncWriteExt;

use crate::error::Result;

#[derive(Debug, Clone)]
pub struct DownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct CompletedDownload {
    pub path: PathBuf,
    pub bytes: u64,
}

/// Sanitize a font/file name from track metadata.
pub fn safe_filename(title: &str, artist: &str, ext: &str) -> String {
    let clean = |s: &str| -> String {
        s.chars()
            .map(|c| if "\\/:*?\"<>|".contains(c) { '_' } else { c })
            .collect::<String>()
            .trim()
            .to_string()
    };
    let name = format!("{} - {}.{}", clean(artist), clean(title), ext.trim_start_matches('.'));
    if name.len() > 180 {
        name[..180].to_string()
    } else {
        name
    }
}

/// Download `url` to `dest_dir`, named via `safe_filename`. Reports progress.
pub async fn download_to_dir(
    url: &str,
    dest_dir: &Path,
    title: &str,
    artist: &str,
    ext: &str,
    mut progress: impl FnMut(DownloadProgress) + Send + 'static,
) -> Result<CompletedDownload> {
    if !dest_dir.is_dir() {
        fs::create_dir_all(dest_dir).await?;
    }
    let filename = safe_filename(title, artist, ext);
    let dest = dest_dir.join(&filename);
    if dest.exists() {
        let bytes = fs::metadata(&dest).await?.len();
        return Ok(CompletedDownload { path: dest, bytes });
    }
    let tmp = dest_dir.join(format!("{filename}.part"));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .build()?;
    let resp = client.get(url).send().await?.error_for_status()?;
    let total = resp.content_length();
    let mut file = fs::File::create(&tmp).await?;
    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        downloaded += chunk.len() as u64;
        progress(DownloadProgress {
            downloaded_bytes: downloaded,
            total_bytes: total,
        });
    }
    file.flush().await?;
    fs::rename(&tmp, &dest).await?;
    Ok(CompletedDownload {
        path: dest,
        bytes: downloaded,
    })
}

/// HEAD-probe a URL to decide whether the media is directly streamable by the webview.
pub async fn probe_streamable(url: &str) -> Result<bool> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()?;
    let resp = client.head(url).send().await?;
    if !resp.status().is_success() {
        return Ok(false);
    }
    let ok = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|ct| {
            ct.starts_with("audio/") || ct.contains("octet-stream") || ct.contains("mpegurl")
        })
        .unwrap_or(true);
    Ok(ok)
}
