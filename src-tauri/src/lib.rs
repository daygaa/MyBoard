//! MyBoard — partie Rust : base de données, import, miniatures, tags, recherche, visionneuse.
//! L'interface (React) appelle les commandes déclarées ici via `invoke`.

pub mod clipboard_text;
pub mod db;
pub mod display;
pub mod ffmpeg;
pub mod formats;
pub mod fullscreen;
pub mod import;
pub mod library;
pub mod media;
pub mod paths;
pub mod search;
pub mod system_menu;
pub mod tags;
mod test_screen;
pub mod thumbs;
pub mod webview_settings;
pub mod window_border;

use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

use import::ImportManager;
use paths::DataPaths;
use search::SearchIndex;
use thumbs::ThumbService;
use thumbs::preview::PreviewService;

/// État partagé par toutes les commandes.
pub struct AppState {
    pub paths: DataPaths,
    /// Connexion de l'interface : lectures, et petites modifications (tags d'un média).
    pub db: Mutex<Connection>,
    pub thumbs: ThumbService,
    pub previews: PreviewService,
    pub import: ImportManager,
    /// Index de la recherche par tags (SRCH-17).
    pub search: SearchIndex,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .register_asynchronous_uri_scheme_protocol("thumb", |ctx, request, responder| {
            thumbs::protocol::handle(ctx.app_handle(), request, responder)
        })
        .register_asynchronous_uri_scheme_protocol("media", |ctx, request, responder| {
            media::protocol::handle(ctx.app_handle(), request, responder)
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let paths = DataPaths::resolve(app.path().local_data_dir()?)?;
            let db = db::open_and_migrate(&paths.db)?;
            let search = SearchIndex::open(&paths.db)?;
            let thumbs = ThumbService::start(handle.clone(), &paths.db, &paths.thumbs_db)?;
            let previews = PreviewService::start(handle.clone(), thumbs.clone(), &paths.db, &paths.thumbs_db)?;
            app.manage(AppState {
                paths,
                db: Mutex::new(db),
                thumbs,
                previews,
                import: ImportManager::new(handle),
                search,
            });
            if let Some(window) = app.get_webview_window("main") {
                fullscreen::install(&window)?;
                window_border::install(&window)?;
                webview_settings::install(&window)?;
                system_menu::install(app.handle(), &window)?;
                test_screen::place(&window)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            library::list_media,
            library::library_stats,
            library::prioritize_thumbs,
            library::request_previews,
            library::ffmpeg_status,
            import::import_snapshot,
            import::scan_paths,
            formats::supported_extensions,
            import::start_import,
            import::cancel_import,
            tags::tag_categories,
            tags::autocomplete_tags,
            tags::find_tag,
            tags::page_tags,
            tags::add_media_tag,
            tags::remove_media_tag,
            media::media_detail,
            media::reveal_media,
            media::open_media,
            media::copy_media,
            display::screen_dpi,
            fullscreen::set_viewer_fullscreen,
            media::set_media_notes,
            media::open_url,
            clipboard_text::read_clipboard_text,
            clipboard_text::write_clipboard_text,
            media::picture::copy_image,
            media::picture::set_wallpaper,
            media::picture::save_video_frame,
            system_menu::window_command,
        ])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de MyBoard");
}
