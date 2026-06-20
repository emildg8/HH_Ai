#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use serde::Deserialize;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, RunEvent, State, WebviewUrl, WebviewWindowBuilder};
struct DashboardSidecar(Mutex<Option<Child>>);
struct CopilotCapture(Mutex<Option<Child>>);

fn dashboard_port() -> u16 {
    std::env::var("DASHBOARD_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(3849)
}

fn dashboard_up(port: u16) -> bool {
    let addr: SocketAddr = format!("127.0.0.1:{}", port).parse().expect("loopback addr");
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_secs(2)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let req = format!(
        "GET / HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
        port
    );
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let mut buf = [0u8; 512];
    let Ok(n) = stream.read(&mut buf) else {
        return false;
    };
    let resp = String::from_utf8_lossy(&buf[..n]);
    resp.contains(" 200 ")
}

fn dev_repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
}

fn hh_ai_root(app: &AppHandle) -> PathBuf {
    if let Ok(p) = std::env::var("HH_AI_ROOT") {
        let path = PathBuf::from(p);
        if path.join("scripts/dashboard-server.mjs").exists() {
            return path;
        }
    }
    if let Ok(dir) = app.path().resolve("hh-ai", BaseDirectory::Resource) {
        if dir.join("scripts/dashboard-server.mjs").exists() {
            return dir;
        }
    }
    let bundled = dev_repo_root()
        .join("desktop")
        .join("hh-ai-desktop")
        .join("src-tauri")
        .join("resources")
        .join("hh-ai");
    if bundled.join("scripts/dashboard-server.mjs").exists() {
        return bundled;
    }
    dev_repo_root()
}

fn node_program(app: &AppHandle) -> PathBuf {
    if let Ok(exe) = app.path().resolve("node/node.exe", BaseDirectory::Resource) {
        if exe.exists() {
            return exe;
        }
    }
    PathBuf::from("node")
}

fn spawn_dashboard_child(app: &AppHandle) -> Result<Child, String> {
    let root = hh_ai_root(app);
    let script = root.join("scripts").join("dashboard-server.mjs");
    if !script.exists() {
        return Err(format!(
            "нет scripts/dashboard-server.mjs (root={})",
            root.display()
        ));
    }
    let node = node_program(app);
    Command::new(node)
        .arg(script)
        .current_dir(&root)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("node spawn: {e}"))
}

fn wait_dashboard(port: u16, secs: u64) -> bool {
    for _ in 0..(secs * 2) {
        if dashboard_up(port) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    false
}

fn ensure_dashboard_running(app: &AppHandle, sidecar: &DashboardSidecar) -> bool {
    let port = dashboard_port();
    if dashboard_up(port) {
        return true;
    }
    {
        let mut guard = sidecar.0.lock().expect("sidecar lock");
        if guard.is_none() {
            match spawn_dashboard_child(app) {
                Ok(child) => *guard = Some(child),
                Err(e) => {
                    eprintln!("[hh-ai-desktop] {e}");
                    return false;
                }
            }
        }
    }
    wait_dashboard(port, 30)
}

fn stop_dashboard(sidecar: &DashboardSidecar) {
    if let Ok(mut guard) = sidecar.0.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }
    }
}

fn navigate_dashboard(app: &AppHandle) -> bool {
    let port = dashboard_port();
    let Some(win) = app.get_webview_window("main") else {
        return false;
    };
    let url = format!("http://127.0.0.1:{}/", port);
    win.navigate(url.parse().expect("dashboard url")).is_ok()
}

fn run_node_script(app: &AppHandle, args: &[&str]) -> Result<String, String> {
    let root = hh_ai_root(app);
    let script = root.join("scripts").join("desktop-chromium.mjs");
    if !script.exists() {
        return Err(format!("нет {}", script.display()));
    }
    let node = node_program(app);
    let output = Command::new(node)
        .arg(script)
        .args(args)
        .current_dir(&root)
        .output()
        .map_err(|e| format!("node: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok(if stdout.is_empty() { "ok".into() } else { stdout })
    } else {
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

#[tauri::command]
fn check_chromium(app: AppHandle) -> bool {
    run_node_script(&app, &["--check"])
        .map(|s| s.starts_with("installed"))
        .unwrap_or(false)
}

#[tauri::command]
fn install_chromium(app: AppHandle) -> Result<String, String> {
    if check_chromium(app.clone()) {
        return Ok("installed".into());
    }
    run_node_script(&app, &["--install"])
}

#[tauri::command]
fn check_dashboard() -> bool {
    dashboard_up(dashboard_port())
}

#[tauri::command]
fn open_dashboard(app: AppHandle, sidecar: State<'_, DashboardSidecar>) -> bool {
    if !ensure_dashboard_running(&app, &sidecar) {
        return false;
    }
    navigate_dashboard(&app)
}

#[tauri::command]
fn start_dashboard_sidecar(app: AppHandle, sidecar: State<'_, DashboardSidecar>) -> bool {
    ensure_dashboard_running(&app, &sidecar)
}

#[tauri::command]
fn hh_ai_root_path(app: AppHandle) -> String {
    hh_ai_root(&app).display().to_string()
}

fn teleprompter_url(port: u16) -> String {
    format!("http://127.0.0.1:{}/teleprompter.html?overlay=1", port)
}

fn teleprompter_prep_url(port: u16) -> String {
    format!("http://127.0.0.1:{}/teleprompter-prep.html?overlay=1", port)
}

fn apply_overlay_protect(win: &tauri::WebviewWindow) {
    let _ = win.set_content_protected(true);
}

#[derive(Deserialize)]
struct MeetingRect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    #[serde(default)]
    title: Option<String>,
}

fn meeting_window_rect(root: &Path) -> Option<MeetingRect> {
    let script = root.join("scripts").join("meeting-window-rect.mjs");
    if !script.exists() {
        return None;
    }
    let output = Command::new("node")
        .arg(&script)
        .current_dir(root)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if s.is_empty() || s == "{}" {
        return None;
    }
    serde_json::from_str(&s).ok()
}

#[tauri::command]
fn dock_teleprompter(app: AppHandle) -> Result<(), String> {
    let root = hh_ai_root(&app);
    let rect = meeting_window_rect(&root).ok_or_else(|| "окно встречи не найдено".to_string())?;
    let win = app
        .get_webview_window("teleprompter")
        .ok_or_else(|| "суфлёр не открыт".to_string())?;
    apply_overlay_protect(&win);
    let bar_h = 100.0;
    let gap = 8.0;
    let width = (rect.w * 0.85).max(280.0);
    let x = rect.x + (rect.w - width) / 2.0;
    let y = (rect.y - bar_h - gap).max(0.0);
    win
        .set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))
        .map_err(|e| e.to_string())?;
    win
        .set_size(PhysicalSize::new(width.round() as u32, bar_h as u32))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn panic_hide_overlays(app: AppHandle) -> Result<(), String> {
    let _ = hide_teleprompter(app.clone());
    let _ = hide_teleprompter_prep(app);
    Ok(())
}

#[tauri::command]
fn show_teleprompter(app: AppHandle, sidecar: State<'_, DashboardSidecar>) -> Result<(), String> {
    if !ensure_dashboard_running(&app, &sidecar) {
        return Err("дашборд не запущен".into());
    }
    let port = dashboard_port();
    let url = teleprompter_url(port);
    if let Some(win) = app.get_webview_window("teleprompter") {
        apply_overlay_protect(&win);
        win.show().map_err(|e| e.to_string())?;
        let _ = win.set_focus();
        return Ok(());
    }
    let win = WebviewWindowBuilder::new(
        &app,
        "teleprompter",
        WebviewUrl::External(url.parse().expect("teleprompter url")),
    )
    .title("HH Ai — суфлёр")
    .inner_size(440.0, 120.0)
    .min_inner_size(280.0, 72.0)
    .always_on_top(true)
    .decorations(false)
    .transparent(true)
    .resizable(true)
    .skip_taskbar(true)
    .build()
    .map_err(|e| e.to_string())?;
    apply_overlay_protect(&win);
    Ok(())
}

#[tauri::command]
fn show_teleprompter_prep(app: AppHandle, sidecar: State<'_, DashboardSidecar>) -> Result<(), String> {
    if !ensure_dashboard_running(&app, &sidecar) {
        return Err("дашборд не запущен".into());
    }
    let port = dashboard_port();
    let url = teleprompter_prep_url(port);
    if let Some(win) = app.get_webview_window("teleprompter-prep") {
        apply_overlay_protect(&win);
        win.show().map_err(|e| e.to_string())?;
        return Ok(());
    }
    let win = WebviewWindowBuilder::new(
        &app,
        "teleprompter-prep",
        WebviewUrl::External(url.parse().expect("teleprompter prep url")),
    )
    .title("HH Ai — сценарий")
    .inner_size(480.0, 320.0)
    .always_on_top(true)
    .decorations(false)
    .transparent(true)
    .resizable(true)
    .skip_taskbar(true)
    .build()
    .map_err(|e| e.to_string())?;
    apply_overlay_protect(&win);
    Ok(())
}

#[tauri::command]
fn hide_teleprompter_prep(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("teleprompter-prep") {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_teleprompter(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("teleprompter") {
        win.hide().map_err(|e| e.to_string())?;
    }
    if let Some(win) = app.get_webview_window("teleprompter-prep") {
        let _ = win.hide();
    }
    Ok(())
}

#[tauri::command]
fn toggle_teleprompter(app: AppHandle, sidecar: State<'_, DashboardSidecar>) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("teleprompter") {
        if win.is_visible().unwrap_or(false) {
            return hide_teleprompter(app);
        }
    }
    show_teleprompter(app, sidecar)
}

#[tauri::command]
fn start_copilot(
    app: AppHandle,
    sidecar: State<'_, DashboardSidecar>,
    copilot: State<'_, CopilotCapture>,
    title: Option<String>,
    company: Option<String>,
    vacancy_id: Option<String>,
    record_id: Option<String>,
    interview_stage: Option<String>,
    prep_context: Option<String>,
    script_only: Option<bool>,
    listen_mic: Option<bool>,
    wasapi_device: Option<String>,
    mic_device: Option<String>,
) -> Result<(), String> {
    if !ensure_dashboard_running(&app, &sidecar) {
        return Err("дашборд не запущен".into());
    }
    let mut guard = copilot.0.lock().map_err(|e| e.to_string())?;
    if let Some(child) = guard.as_mut() {
        let _ = child.kill();
    }
    let root = hh_ai_root(&app);
    let script = root.join("scripts").join("copilot-loopback-capture.mjs");
    if !script.exists() {
        return Err(format!("нет скрипта: {}", script.display()));
    }
    let port = dashboard_port();
    let log_path = root.join("data").join("copilot-capture.log");
    let _ = std::fs::create_dir_all(root.join("data"));
    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("лог capture: {e}"))?;
    let script_only_env = if script_only.unwrap_or(true) { "1" } else { "0" };
    let mic_env = if listen_mic.unwrap_or(false) { "1" } else { "0" };
    let wasapi = wasapi_device
        .filter(|s| !s.is_empty())
        .or_else(|| std::env::var("COPILOT_WASAPI_DEVICE").ok())
        .unwrap_or_else(|| "default".into());
    let mic_dev = mic_device
        .filter(|s| !s.is_empty())
        .or_else(|| std::env::var("COPILOT_MIC_DEVICE").ok())
        .unwrap_or_default();
    let child = Command::new("node")
        .arg(&script)
        .current_dir(&root)
        .env("DASHBOARD_PORT", port.to_string())
        .env("COPILOT_STT", std::env::var("COPILOT_STT").unwrap_or_else(|_| "fast".into()))
        .env("COPILOT_CHUNK_SEC", std::env::var("COPILOT_CHUNK_SEC").unwrap_or_else(|_| "2".into()))
        .env("COPILOT_MIC", mic_env)
        .env("COPILOT_WASAPI_DEVICE", wasapi)
        .env("COPILOT_MIC_DEVICE", mic_dev)
        .env("COPILOT_TITLE", title.unwrap_or_else(|| "Собеседование".into()))
        .env("COPILOT_COMPANY", company.unwrap_or_default())
        .env("COPILOT_VACANCY_ID", vacancy_id.unwrap_or_default())
        .env("COPILOT_RECORD_ID", record_id.unwrap_or_default())
        .env("COPILOT_INTERVIEW_STAGE", interview_stage.unwrap_or_else(|| "tech".into()))
        .env("COPILOT_PREP_CONTEXT", prep_context.unwrap_or_default())
        .env("COPILOT_SCRIPT_ONLY", script_only_env)
        .stdout(Stdio::null())
        .stderr(log_file)
        .spawn()
        .map_err(|e| format!("не удалось запустить захват звука: {e}"))?;
    *guard = Some(child);
    Ok(())
}

#[tauri::command]
fn stop_copilot(copilot: State<'_, CopilotCapture>) -> Result<(), String> {
    let mut guard = copilot.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(DashboardSidecar(Mutex::new(None)))
        .manage(CopilotCapture(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            check_dashboard,
            open_dashboard,
            start_dashboard_sidecar,
            check_chromium,
            install_chromium,
            hh_ai_root_path,
            show_teleprompter,
            hide_teleprompter,
            show_teleprompter_prep,
            hide_teleprompter_prep,
            toggle_teleprompter,
            dock_teleprompter,
            panic_hide_overlays,
            start_copilot,
            stop_copilot
        ])
        .setup(|app| {
            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
            let handle = app.handle().clone();
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyH);
            if let Err(e) = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    let _ = hide_teleprompter(handle.clone());
                    let _ = hide_teleprompter_prep(handle.clone());
                }
            }) {
                eprintln!("[hh-ai-desktop] global shortcut: {e}");
            }
            let handle = app.handle().clone();
            let sidecar = app.state::<DashboardSidecar>();
            if ensure_dashboard_running(&handle, &sidecar) {
                let _ = navigate_dashboard(&handle);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("HH Ai desktop: ошибка сборки Tauri")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(copilot) = app.try_state::<CopilotCapture>() {
                    if let Ok(mut guard) = copilot.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
                if let Some(sidecar) = app.try_state::<DashboardSidecar>() {
                    stop_dashboard(&sidecar);
                }
            }
        });
}

fn main() {
    run();
}
