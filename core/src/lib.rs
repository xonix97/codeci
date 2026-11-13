//! codeci-core: library DB, downloads, open music sources, local recommendation engine.
//!
//! Noncommercial use only (PolyForm Noncommercial 1.0.0).

pub mod db;
pub mod download;
pub mod error;
pub mod models;
pub mod recs;
pub mod sidecar;
pub mod sources;

pub use error::{Error, Result};
pub use models::{LibraryTrack, Playlist, RecommendationRail, SearchResults, SourceKind, Track};
