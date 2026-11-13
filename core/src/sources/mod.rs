//! Open/CC music sources for the on-device (Android) and desktop builds.
//! All three are keyless except Jamendo, which takes an optional client_id.

pub mod audius;
pub mod jamendo;
pub mod wikimedia;

use async_trait::async_trait;

use crate::error::Result;
use crate::models::Track;

#[derive(Debug, Clone, Default)]
pub struct SearchContext {
    /// Max results per source.
    pub limit: u32,
}

#[async_trait]
pub trait SourceClient: Send + Sync {
    fn name(&self) -> &'static str;
    async fn search(&self, query: &str, ctx: &SearchContext) -> Result<Vec<Track>>;
    /// Direct audio stream URL when the source exposes one (Audius, Jamendo).
    async fn stream_url(&self, track: &Track) -> Result<Option<String>>;
}

pub use audius::AudiusClient;
pub use jamendo::JamendoClient;
pub use wikimedia::WikimediaClient;
