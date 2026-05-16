// Library entry point for the desktop app. Keeping logic in lib.rs (rather
// than main.rs) is the Tauri 2 convention — it lets us build mobile
// variants later without restructuring.
//
// The shell is intentionally minimal for the scaffold. All real work lives
// in the React front-end; Rust is only here to host the WebView and any
// future native plugins we need (secure token storage, deep links, etc.).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running The Pupper Club Community app");
}
