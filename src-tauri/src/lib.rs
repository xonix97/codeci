use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;

use codeci_core::db::Library;
use codeci_core::models::Track;
use codeci_core::recs;
use codeci_core::sidecar::SidecarClient;
use codeci_core::sources::AudiusClient;
use serde::Serialize;
use tauri::{Manager, State};

struct AppState {
    sidecar: Mutex<SidecarClient>,
    library: Mutex<Library>,
    download_dir: Mutex<String>,
    data_dir: PathBuf,
    #[allow(dead_code)]
    sidecar_child: Mutex<Option<Child>>,
}

#[derive(Serialize)]
struct DownloadsInfo {
    dir: String,
    used_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HomeRailsPayload {
    for_you: Vec<Track>,
    trending: Vec<Track>,
    because_you_played: Vec<Track>,
    seed_title: Option<String>,
}

fn sidecar_port_probe() -> Option<u16> {
    TcpListener::bind(("127.0.0.1", 0))
        .ok()
        .map(|l| l.local_addr().map(|a| a.port()).unwrap_or(8787))
}

fn spawn_sidecar(data_dir: &Path) -> (Option<u16>, Option<Child>) {
    let Some(port) = sidecar_port_probe() else {
        eprintln!("[codeci] could not allocate a local port for sidecar");
        return (None, None);
    };
    let exe_name = if cfg!(windows) { "codeci-backend.exe" } else { "codeci-backend" };

    // 1) Bundled binary next to the app executable (PyInstaller onefile).
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let bundled = dir.join(exe_name);
            if bundled.is_file() {
                let log = std::fs::File::create(data_dir.join("sidecar.log")).ok();
                let mut cmd = Command::new(bundled);
                cmd.arg("--port").arg(port.to_string());
                if let Some(log) = log {
                    cmd.stdout(log.try_clone().unwrap()).stderr(log);
                }
                if let Ok(child) = cmd.spawn() {
                    return (Some(port), Some(child));
                }
            }
        }
    }

    // 2) Repo dev layout: backend/.venv with `python -m app.main`.
    let repo_backend = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("backend"))
        .unwrap_or_else(|| PathBuf::from("backend"));
    let venv_py = if cfg!(windows) {
        repo_backend.join(".venv").join("Scripts").join("python.exe")
    } else {
        repo_backend.join(".venv").join("bin").join("python")
    };
    let candidates: Vec<(PathBuf, Option<PathBuf>)> = vec![
        (venv_py, Some(repo_backend.clone())),
        (PathBuf::from(if cfg!(windows) { "python" } else { "python3" }), Some(repo_backend.clone())),
    ];
    for (python, cwd) in candidates {
        let mut cmd = Command::new(&python);
        cmd.args(["-m", "app.main", "--port", &port.to_string()])
            .envs([("PYTHONIOENCODING", "utf-8"), ("PYTHONUTF8", "1")])
            .current_dir(cwd.unwrap_or_else(|| PathBuf::from(".")));
        let log = std::fs::File::create(data_dir.join("sidecar.log")).ok();
        if let Some(log) = log {
            cmd.stdout(log.try_clone().unwrap()).stderr(log);
        }
        match cmd.spawn() {
            Ok(child) => return (Some(port), Some(child)),
            Err(e) => eprintln!("[codeci] sidecar attempt with {} failed: {e}", python.display()),
        }
    }
    (None, None)
}

fn dir_size(path: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                total += dir_size(&p);
            } else if let Ok(meta) = entry.metadata() {
                total += meta.len();
            }
        }
    }
    total
}

#[tauri::command]
async fn search(
    query: String,
    sources: Vec<String>,
    limit: u32,
    state: State<'_, AppState>,
) -> Result<Vec<Track>, String> {
    let client = state.sidecar.lock().map_err(|e| e.to_string())?.clone();
    client
        .search(&query, &sources, limit)
        .await
        .map(|r| r.tracks)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_lyrics(
    source: String,
    source_id: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let client = state.sidecar.lock().map_err(|e| e.to_string())?.clone();
    client.lyrics(&source, &source_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_artists(
    query: String,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let client = state.sidecar.lock().map_err(|e| e.to_string())?.clone();
    client.search_artists(&query, limit.unwrap_or(12)).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_albums(
    query: String,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let client = state.sidecar.lock().map_err(|e| e.to_string())?.clone();
    client.search_albums(&query, limit.unwrap_or(12)).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn parse_playlist(
    url: String,
    source: String,
    state: State<'_, AppState>,
) -> Result<Vec<Track>, String> {
    let client = state.sidecar.lock().map_err(|e| e.to_string())?.clone();
    client.parse_playlist(&url, &source).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn download_track(
    track: serde_json::Value,
    work_dir: String,
    cookies: Option<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let client = state.sidecar.lock().map_err(|e| e.to_string())?.clone();
    let target = if work_dir.trim().is_empty() {
        state.data_dir.join("downloads").to_string_lossy().to_string()
    } else {
        work_dir
    };
    client
        .download_track(&track, &target, cookies.as_deref())
        .await
        .map_err(|e| e.to_string())
}

fn upsert_from_json(lib: &Library, track: &serde_json::Value) -> Result<i64, String> {
    let genres: Vec<String> = track
        .get("genres")
        .and_then(|g| g.as_array())
        .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();
    lib.upsert_track(
        track.get("source").and_then(|v| v.as_str()).unwrap_or("unknown"),
        track.get("source_id").and_then(|v| v.as_str()).unwrap_or_default(),
        track.get("title").and_then(|v| v.as_str()).unwrap_or("untitled"),
        track.get("artist").and_then(|v| v.as_str()).unwrap_or("unknown"),
        track.get("album").and_then(|v| v.as_str()),
        track.get("duration_s").and_then(|v| v.as_f64()),
        track.get("cover_url").and_then(|v| v.as_str()),
        &genres,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_like_track(track: serde_json::Value, state: State<'_, AppState>) -> Result<bool, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    let id = upsert_from_json(&lib, &track)?;
    let cur = lib.get_track(id).map_err(|e| e.to_string())?;
    let new_state = !cur.liked;
    lib.set_liked(id, new_state).map_err(|e| e.to_string())?;
    Ok(new_state)
}

#[tauri::command]
fn record_play(track: serde_json::Value, completed: bool, state: State<'_, AppState>) -> Result<(), String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    let id = upsert_from_json(&lib, &track)?;
    lib.record_play(id, 0, completed).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_playlists(state: State<'_, AppState>) -> Result<Vec<codeci_core::models::Playlist>, String> {
    state.library.lock().map_err(|e| e.to_string())?.list_playlists().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_playlist(name: String, state: State<'_, AppState>) -> Result<i64, String> {
    state
        .library
        .lock()
        .map_err(|e| e.to_string())?
        .create_playlist(name.trim(), None)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn audius_trending_tracks(limit: Option<u32>) -> Result<Vec<Track>, String> {
    AudiusClient::new()
        .trending(limit.unwrap_or(15))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn home_rails(state: State<'_, AppState>) -> Result<HomeRailsPayload, String> {
    let trending = AudiusClient::new().trending(15).await.unwrap_or_default();
    let (for_you, because, seed_title) = {
        let lib = state.library.lock().map_err(|e| e.to_string())?;
        let focused = lib.latest_history_track_id().map_err(|e| e.to_string())?;
        let rails = recs::build_rails(&lib, trending.clone(), focused, 24).map_err(|e| e.to_string())?;
        let find = |id: &str| rails.iter().find(|r| r.id == id).map(|r| r.tracks.clone()).unwrap_or_default();
        let seed_title = focused
            .and_then(|id| lib.get_track(id).ok())
            .map(|t| format!("Because you played {}", t.title));
        (find("for-you"), find("because-you-played"), seed_title)
    };
    Ok(HomeRailsPayload {
        for_you,
        trending,
        because_you_played: because,
        seed_title,
    })
}

#[tauri::command]
fn downloads_info(state: State<'_, AppState>) -> Result<DownloadsInfo, String> {
    let dir = state.download_dir.lock().map_err(|e| e.to_string())?.clone();
    let path = if Path::new(&dir).is_absolute() {
        PathBuf::from(&dir)
    } else {
        state.data_dir.join(&dir)
    };
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(DownloadsInfo {
        dir: path.to_string_lossy().to_string(),
        used_bytes: dir_size(&path),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from(".codeci-data"));
            std::fs::create_dir_all(&data_dir)?;
            let lib_path = data_dir.join("library.db");
            let library = Library::open(&lib_path).map_err(|e| Box::<dyn std::error::Error>::from(e.to_string()))?;

            let (port, child) = spawn_sidecar(&data_dir);
            let base = port.map(|p| format!("http://127.0.0.1:{p}")).unwrap_or_else(|| "http://127.0.0.1:8787".to_string());
            let token = std::env::var("CODECI_BACKEND_TOKEN").ok().filter(|s| !s.is_empty());
            let sidecar = SidecarClient::new(base, token);

            app.manage(AppState {
                sidecar: Mutex::new(sidecar),
                library: Mutex::new(library),
                download_dir: Mutex::new("downloads".to_string()),
                data_dir,
                sidecar_child: Mutex::new(child),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search,
            search_artists,
            search_albums,
            get_lyrics,
            parse_playlist,
            download_track,
            toggle_like_track,
            record_play,
            list_playlists,
            create_playlist,
            audius_trending_tracks,
            home_rails,
            downloads_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running codeci");
}

// touch: respawn dev app with new IPC commands
