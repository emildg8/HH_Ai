#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

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

#[tauri::command]
fn check_dashboard() -> bool {
    dashboard_up(dashboard_port())
}

#[tauri::command]
fn open_dashboard(app: tauri::AppHandle) -> bool {
    let port = dashboard_port();
    if !dashboard_up(port) {
        return false;
    }
    let Some(win) = app.get_webview_window("main") else {
        return false;
    };
    let url = format!("http://127.0.0.1:{}/", port);
    win.navigate(url.parse().expect("dashboard url")).is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![check_dashboard, open_dashboard])
        .setup(|app| {
            let port = dashboard_port();
            if dashboard_up(port) {
                if let Some(win) = app.get_webview_window("main") {
                    let url = format!("http://127.0.0.1:{}/", port);
                    let _ = win.navigate(url.parse().expect("dashboard url"));
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("HH Ai desktop: ошибка запуска Tauri");
}

fn main() {
    run();
}
