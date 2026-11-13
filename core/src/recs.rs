//! Local Spotify-style recommender for a single user.
//!
//! Pipeline: decayed play history → taste profile (artist + genre weights) →
//! candidate generation (same-artist / genre-neighbors / co-play) → rank with
//! popularity prior, novelty bonus and ε-greedy exploration.
//!
//! Single-user, fully local; no collaborative filtering across users, no
//! audio-feature DSP. Resettable from settings ("reset taste profile").

use std::collections::HashMap;

use rand::Rng;
use serde::Serialize;

use crate::db::Library;
use crate::error::Result;
use crate::models::{LibraryTrack, RecommendationRail, Track};

/// Half-life of one week for old events (30d → 0.5 weight).
const HALF_LIFE_DAYS: f64 = 30.0;
/// Exploration rate for ε-greedy ranking.
const EPSILON: f64 = 0.2;

#[derive(Debug, Clone, Default, Serialize)]
pub struct TasteProfile {
    pub artist_weights: HashMap<String, f64>,
    pub genre_weights: HashMap<String, f64>,
    pub total_signals: f64,
}

impl TasteProfile {
    pub fn affinity(&self, artist: &str) -> f64 {
        self.artist_weights.get(artist).copied().unwrap_or(0.0)
    }

    pub fn genre_cosine(&self, genres: &[String]) -> f64 {
        if genres.is_empty() {
            return 0.0;
        }
        let mut dot = 0.0;
        let mut norm_query = 0.0;
        let mut norm_profile = 0.0;
        for g in genres {
            let w = self.genre_weights.get(g).copied().unwrap_or(0.0);
            dot += w * w;
            norm_query += w * w;
        }
        for v in self.genre_weights.values() {
            norm_profile += v * v;
        }
        if norm_query == 0.0 || norm_profile == 0.0 {
            return 0.0;
        }
        dot / (norm_query.sqrt() * norm_profile.sqrt())
    }
}

/// Normalize weights so they sum to 1 (for scoring across very different histories).
fn normalize(map: &mut HashMap<String, f64>) {
    let sum: f64 = map.values().sum();
    if sum > 0.0 {
        for v in map.values_mut() {
            *v /= sum;
        }
    }
}

/// Build a taste profile from a library's decayed play history.
pub fn build_taste_profile(lib: &Library) -> Result<TasteProfile> {
    let events = lib.weighted_history_events(5000)?;
    let mut profile = TasteProfile::default();
    for (track_id, weight, completed) in events {
        let Ok(track) = lib.get_track(track_id) else { continue };
        let skip_penalty = if completed { 1.0 } else { 0.35 };
        let w = weight * skip_penalty;
        *profile.artist_weights.entry(track.artist.clone()).or_insert(0.0) += w;
        for g in &track.genres {
            *profile.genre_weights.entry(g.clone()).or_insert(0.0) += w;
        }
        profile.total_signals += w;
    }
    normalize(&mut profile.artist_weights);
    normalize(&mut profile.genre_weights);
    Ok(profile)
}

/// Score one candidate track for the user.
pub fn score_candidate(
    profile: &TasteProfile,
    cand: &Track,
    coplay_score: f64,
    skip_ratio: f64,
) -> f64 {
    let genre = profile.genre_cosine(&cand.genres);
    let artist = profile.affinity(&cand.artist).min(1.0);
    // Popularity prior: log-scaled to keep huge-artist plays from dominating.
    let pop = cand.popularity.unwrap_or(0.0).max(0.0);
    let pop_prior = (pop + 1.0).ln() / 20.0_f64.ln().max(1.0);
    let pop_prior = pop_prior.min(1.0);
    // Mild co-play nudge (already reflects "fans also played").
    let coplay = (coplay_score / 10.0).min(1.0);
    let explored = rand::thread_rng().gen_bool(EPSILON);
    let novelty = if explored { 0.15 } else { 0.0 };
    let skip_pen = skip_ratio.clamp(0.0, 1.0) * 0.35;
    0.45 * genre + 0.25 * artist + 0.20 * pop_prior + 0.10 * novelty + 0.10 * coplay - skip_pen
}

/// Produce recommendation rails for the Home page.
/// `candidate_pool` is supplied by the caller (e.g. sidecar/trending/search results);
/// on Android, Trending comes from source charts.
pub fn build_rails(
    lib: &Library,
    candidate_pool: Vec<Track>,
    focused_track_id: Option<i64>,
    pool_limit: usize,
) -> Result<Vec<RecommendationRail>> {
    let profile = build_taste_profile(lib)?;
    let mut rails = Vec::new();

    // Rail 1 — "For You": top-scoring pool candidates.
    let mut scored: Vec<(f64, Track)> = candidate_pool
        .into_iter()
        .map(|t| {
            let s = score_candidate(&profile, &t, 0.0, 0.0);
            (s, t)
        })
        .collect();
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    let for_you: Vec<Track> = scored.into_iter().take((pool_limit / 2).max(8)).map(|(_, t)| t).collect();
    if !for_you.is_empty() {
        rails.push(RecommendationRail {
            id: "for-you".into(),
            title: "For You".into(),
            tracks: for_you,
        });
    }

    // Rail 2 — "Because you played X" using co-play graph.
    if let Some(seed) = focused_track_id {
        let neighbors = lib.coplay_neighbors(seed, 12)?;
        let mut tracks = Vec::new();
        for (tid, _) in neighbors {
            if let Ok(lib_track) = lib.get_track(tid) {
                tracks.push(lib_track_to_track(&lib_track));
            }
        }
        if !tracks.is_empty() {
            let title = lib
                .get_track(seed)
                .map(|t| format!("Because you played {}", t.title))
                .unwrap_or_else(|_| "Because you played this".into());
            rails.push(RecommendationRail {
                id: "because-you-played".into(),
                title,
                tracks,
            });
        }
    }

    Ok(rails)
}

fn lib_track_to_track(t: &LibraryTrack) -> Track {
    Track {
        id: format!("{}:{}", t.source, t.source_id),
        source: crate::models::SourceKind::Other(t.source.clone()),
        source_id: t.source_id.clone(),
        title: t.title.clone(),
        artist: t.artist.clone(),
        album: t.album.clone(),
        duration_s: t.duration_s,
        ext: None,
        file_size_bytes: None,
        cover_url: t.cover_url.clone(),
        stream_url: None,
        download_url: None,
        popularity: Some(t.play_count as f64),
        genres: t.genres.clone(),
        is_vip: false,
        lyric_lrc: None,
        license: None,
    }
}

/// Decay helper exposed for tests: weight = 2^(-days / HALF_LIFE_DAYS).
pub fn decay_weight(days_ago: f64) -> f64 {
    (-days_ago / HALF_LIFE_DAYS).exp2()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decay_halves_every_30_days() {
        assert!((decay_weight(0.0) - 1.0).abs() < 1e-9);
        assert!((decay_weight(30.0) - 0.5).abs() < 1e-9);
        assert!((decay_weight(60.0) - 0.25).abs() < 1e-9);
    }

    #[test]
    fn cosine_of_full_overlap_is_one() {
        let mut p = TasteProfile::default();
        p.genre_weights = [("hip-hop".to_string(), 2.0), ("trap".to_string(), 1.0)]
            .into_iter()
            .collect();
        let sim = p.genre_cosine(&["hip-hop".to_string(), "trap".to_string()]);
        assert!(sim > 0.99);
    }

    #[test]
    fn cosine_of_disjoint_is_zero() {
        let mut p = TasteProfile::default();
        p.genre_weights = [("hip-hop".to_string(), 1.0)].into_iter().collect();
        assert_eq!(p.genre_cosine(&["classical".to_string()]), 0.0);
    }

    #[test]
    fn score_prefers_genre_match() {
        let mut p = TasteProfile::default();
        p.genre_weights = [("hip-hop".to_string(), 1.0)].into_iter().collect();
        p.artist_weights = [("Kanye West".to_string(), 1.0)].into_iter().collect();
        let mk = |title: &str, genre: &str| Track {
            id: title.into(),
            source: crate::models::SourceKind::Audius,
            source_id: title.into(),
            title: title.into(),
            artist: "someone".into(),
            album: None,
            duration_s: None,
            ext: None,
            file_size_bytes: None,
            cover_url: None,
            stream_url: None,
            download_url: None,
            popularity: Some(1000.0),
            genres: vec![genre.to_string()],
            is_vip: false,
            lyric_lrc: None,
            license: None,
        };
        let s_hit = score_candidate(&p, &mk("hit", "hip-hop"), 0.0, 0.0);
        let s_miss = score_candidate(&p, &mk("miss", "classical"), 0.0, 0.0);
        assert!(s_hit > s_miss);
    }
}
