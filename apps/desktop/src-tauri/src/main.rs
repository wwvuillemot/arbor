// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{Manager, State};

struct ServiceManager {
    docker_process: Mutex<Option<Child>>,
}

impl ServiceManager {
    fn new() -> Self {
        Self {
            docker_process: Mutex::new(None),
        }
    }
}

#[tauri::command]
async fn start_services(service_manager: State<'_, ServiceManager>) -> Result<String, String> {
    println!("🚀 Starting Arbor services...");
    
    // Get the project root (2 levels up from src-tauri)
    let project_root = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?
        .parent()
        .and_then(|p| p.parent())
        .ok_or("Failed to find project root")?
        .to_path_buf();
    
    println!("📁 Project root: {:?}", project_root);
    
    // Start Docker services using make
    let child = Command::new("make")
        .arg("up")
        .current_dir(&project_root)
        .spawn()
        .map_err(|e| format!("Failed to start services: {}", e))?;
    
    // Store the process handle
    let mut process = service_manager.docker_process.lock().unwrap();
    *process = Some(child);
    
    println!("✅ Services started successfully");
    Ok("Services started successfully".to_string())
}

#[tauri::command]
async fn stop_services(service_manager: State<'_, ServiceManager>) -> Result<String, String> {
    println!("🛑 Stopping Arbor services...");
    
    // Get the project root
    let project_root = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?
        .parent()
        .and_then(|p| p.parent())
        .ok_or("Failed to find project root")?
        .to_path_buf();
    
    // Stop Docker services using make
    let output = Command::new("make")
        .arg("down")
        .current_dir(&project_root)
        .output()
        .map_err(|e| format!("Failed to stop services: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("Failed to stop services: {:?}", String::from_utf8_lossy(&output.stderr)));
    }
    
    // Clear the stored process
    let mut process = service_manager.docker_process.lock().unwrap();
    *process = None;
    
    println!("✅ Services stopped successfully");
    Ok("Services stopped successfully".to_string())
}

#[tauri::command]
async fn check_services_status() -> Result<String, String> {
    // Check if Docker containers are running
    let output = Command::new("docker")
        .args(&["ps", "--filter", "name=arbor", "--format", "{{.Names}}"])
        .output()
        .map_err(|e| format!("Failed to check service status: {}", e))?;
    
    let containers = String::from_utf8_lossy(&output.stdout);
    let container_count = containers.lines().count();
    
    if container_count > 0 {
        Ok(format!("Running ({} containers)", container_count))
    } else {
        Ok("Stopped".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_keyring::init())
        .manage(ServiceManager::new())
        .invoke_handler(tauri::generate_handler![
            start_services,
            stop_services,
            check_services_status
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            // Start services on app launch
            tauri::async_runtime::spawn(async move {
                println!("🌳 Arbor starting up...");
                
                // Wait a moment for the window to be ready
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                
                // Start services
                let service_manager = app_handle.state::<ServiceManager>();
                match start_services(service_manager).await {
                    Ok(msg) => println!("{}", msg),
                    Err(e) => eprintln!("❌ Failed to start services: {}", e),
                }
                
                // Wait for services to be ready
                println!("⏳ Waiting for services to be ready...");
                tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                
                println!("✅ Arbor is ready!");
            });
            
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app_handle = window.app_handle().clone();
                
                // Stop services on app quit
                tauri::async_runtime::spawn(async move {
                    let service_manager = app_handle.state::<ServiceManager>();
                    match stop_services(service_manager).await {
                        Ok(msg) => println!("{}", msg),
                        Err(e) => eprintln!("❌ Failed to stop services: {}", e),
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

