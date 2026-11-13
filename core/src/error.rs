use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("source unavailable: {0}")]
    SourceUnavailable(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("sidecar error: {0}")]
    Sidecar(String),
    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;
