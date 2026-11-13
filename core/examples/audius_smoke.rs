//! Live smoke: cargo run -p codeci-core --example audius_smoke -- "kanye west"
//! Requires network access. Prints top results to stdout (UTF-8).

use codeci_core::sources::{AudiusClient, SearchContext, SourceClient};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let query = std::env::args().nth(1).unwrap_or_else(|| "kanye west".to_string());
    let client = AudiusClient::new();
    let results = client.search(&query, &SearchContext { limit: 10 }).await?;
    println!("Audius results for {query:?}: {} tracks", results.len());
    for t in &results {
        println!(
            "  [{}] {} — {} ({}s, plays={}, {:?})",
            t.source.as_str(),
            t.title,
            t.artist,
            t.duration_s.map(|d| d as u64).unwrap_or(0),
            t.popularity.unwrap_or(0.0) as u64,
            t.genres
        );
        println!("      stream: {}", t.stream_url.as_deref().unwrap_or("-"));
    }
    Ok(())
}
