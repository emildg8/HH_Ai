#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, RunEvent, State};

struct DashboardSidecar(Mutex<Option<Child>>);

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
        .join("bundled")
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DashboardSidecar(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            check_dashboard,
            open_dashboard,
            start_dashboard_sidecar,
            check_chromium,
            install_chromium,
            hh_ai_root_path
        ])
        .setup(|app| {
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
                if let Some(sidecar) = app.try_state::<DashboardSidecar>() {
                    stop_dashboard(&sidecar);
                }
            }
        });
}

fn main() {
    run();
}
