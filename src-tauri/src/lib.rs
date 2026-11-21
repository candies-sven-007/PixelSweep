mod cleaner;
mod models;
mod music;
mod safety;
mod scanner;

use models::{CleanReport, FullScanResult, MusicTrack, ScanCategoryResult, SystemStatus};
use tauri::{AppHandle, Manager, WebviewWindow};

fn apply_native_glass(window: &WebviewWindow, dark: bool) {
    #[cfg(target_os = "macos")]
    {
        let _ = dark;
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
        let _ = apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, None, None);
    }

    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::{apply_acrylic, apply_mica};
        if apply_mica(window, Some(dark)).is_err() {
            let tint = if dark {
                Some((18, 22, 34, 200))
            } else {
                Some((246, 249, 255, 195))
            };
            let _ = apply_acrylic(window, tint);
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (window, dark);
    }
}

#[tauri::command]
fn set_window_theme(app: AppHandle, dark: bool) {
    if let Some(window) = app.get_webview_window("main") {
        apply_native_glass(&window, dark);
    }
}

#[tauri::command]
fn get_system_status() -> SystemStatus {
    scanner::collect_system_status()
}

#[tauri::command]
async fn start_full_scan(app: AppHandle) -> Result<FullScanResult, String> {
    tauri::async_runtime::spawn_blocking(move || scanner::run_full_scan(&app))
        .await
        .map_err(|e| format!("扫描线程异常: {}", e))
}

#[tauri::command]
async fn scan_custom_folder(
    app: AppHandle,
    target_dir: String,
    min_size_mb: u64,
) -> Result<ScanCategoryResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        scanner::scan_custom_directory(&app, &target_dir, min_size_mb)
    })
    .await
    .map_err(|e| format!("自定义扫描线程异常: {}", e))?
}

#[tauri::command]
async fn execute_cleanup(
    app: AppHandle,
    paths: Vec<String>,
    mode: String,
) -> Result<CleanReport, String> {
    let clean_mode = if mode == "permanent" {
        "permanent".to_string()
    } else {
        "recycle".to_string()
    };
    tauri::async_runtime::spawn_blocking(move || cleaner::execute_clean(&app, paths, &clean_mode))
        .await
        .map_err(|e| format!("清理线程异常: {}", e))
}

#[tauri::command]
async fn empty_trash() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(cleaner::empty_system_trash)
        .await
        .map_err(|e| format!("清空回收站线程异常: {}", e))?
}

#[tauri::command]
fn load_local_music(folder: Option<String>) -> Result<(String, Vec<MusicTrack>), String> {
    music::scan_music_directory(folder)
}

#[tauri::command]
fn open_permission_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
            .spawn()
            .map_err(|e| format!("打开系统设置失败: {}", e))?;
        Ok(())
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "ms-settings:privacy"])
            .spawn()
            .map_err(|e| format!("打开 Windows 设置失败: {}", e))?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(())
    }
}

#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("打开资源管理器失败: {}", e))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("打开访达失败: {}", e))?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = path;
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "windows")]
                {
                    let _ = window.set_decorations(false);
                }
                apply_native_glass(&window, false);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_window_theme,
            get_system_status,
            start_full_scan,
            scan_custom_folder,
            execute_cleanup,
            empty_trash,
            load_local_music,
            open_permission_settings,
            reveal_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while running PixelSweep");
}
