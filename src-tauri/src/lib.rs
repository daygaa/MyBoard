//! MyBoard — partie Rust : base de données, import, miniatures, tags, recherche, visionneuse.
//! L'interface (React) appelle les commandes déclarées ici via `invoke`.

pub mod audio_session;
pub mod chain_removal;
pub mod clipboard_text;
pub mod db;
pub mod deletion;
pub mod display;
pub mod favorites;
pub mod folders;
pub mod group_create;
pub mod group_list;
pub mod groups;
pub mod ffmpeg;
pub mod formats;
pub mod fullscreen;
pub mod import;
pub mod import_groups;
pub mod library;
pub mod media;
pub mod parents;
pub mod paths;
pub mod reserve;
pub mod rule_moves;
pub mod rule_preview;
pub mod scope;
pub mod search;
pub mod selection;
pub mod similar;
pub mod system_menu;
pub mod tag_delete;
pub mod tag_import;
pub mod tag_manager;
pub mod tag_trash;
pub mod tag_rules;
pub mod tagging;
pub mod trash_journal;
pub mod trash_restore;
pub mod tags;
mod test_screen;
pub mod thumbs;
pub mod webview_settings;
pub mod window_border;

use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

use deletion::DeletionService;
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
    /// Suppression en arrière-plan (DEL-02, DEL-03).
    pub deletion: DeletionService,
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
            // Vidéos des GIF d'une session précédente (fermeture forcée…) : effacées (VIEW-54).
            media::gif::clear_cache(&paths.root);
            let db = db::open_and_migrate(&paths.db)?;
            // Disques des médias, confiés à la fenêtre avant le chargement de la page (VIEW-53, D-053).
            let drives = media::direct::media_drives(&db);
            let search = SearchIndex::open(&paths.db)?;
            let thumbs = ThumbService::start(handle.clone(), &paths.db, &paths.thumbs_db)?;
            let previews = PreviewService::start(handle.clone(), thumbs.clone(), &paths.db, &paths.thumbs_db)?;
            let deletion = DeletionService::start(handle.clone(), &paths.db, &paths.thumbs_db, previews.clone())?;
            app.manage(AppState {
                paths,
                db: Mutex::new(db),
                thumbs,
                previews,
                import: ImportManager::new(handle),
                search,
                deletion,
            });
            if let Some(window) = app.get_webview_window("main") {
                fullscreen::install(&window)?;
                window_border::install(&window)?;
                webview_settings::install(&window)?;
                media::direct::install(&window, drives);
                system_menu::install(app.handle(), &window)?;
                test_screen::place(&window)?;
            }
            // Le son de MyBoard s'appelle « MyBoard » dans le mélangeur de volume de Windows (AUD-02).
            audio_session::start();
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
            import::list::scan_files,
            import::list::remove_scan_file,
            import::list::clear_scan,
            import::list::reveal_scan_file,
            import::list::count_compressible_existing,
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
            media::picture::copy_gif_frame,
            media::gif::prepare_gif,
            media::subtitles::video_subtitles,
            media::keyframes::video_keyframes,
            media::subtitles::subtitle_cues,
            media::subtitles::import_subtitle,
            media::subtitles::remove_imported_subtitle,
            system_menu::window_command,
            favorites::set_favorite,
            deletion::delete_media,
            reserve::restore_media_data,
            folders::list_folders,
            folders::create_folder,
            folders::rename_folder,
            folders::set_folder_hidden,
            folders::set_folder_color,
            folders::delete_folder,
            folders::set_folder_media,
            folders::mark_folder_opened,
            selection::result_ids,
            selection::selection_info,
            selection::selection_tags,
            selection::selection_common_tags,
            selection::edit_selection_tags,
            tag_manager::list_managed_tags,
            tag_manager::rename_tag,
            tag_manager::set_tags_category,
            tag_manager::set_tags_hidden,
            tag_manager::delete_tags,
            tag_manager::delete_preview,
            tag_manager::set_tag_description,
            tag_import::preview_tag_import,
            tag_import::import_tags,
            tag_import::undo_tag_import,
            chain_removal::chain_parents,
            chain_removal::remove_chain_parents,
            tag_trash::trash_list,
            tag_trash::trash_find,
            tag_trash::trash_restore,
            tag_trash::trash_delete,
            similar::ignore_similar,
            similar::unignore_similar,
            similar::create_similar_groups,
            tag_rules::list_tag_rules,
            tag_rules::group_preview,
            tag_rules::create_group,
            tag_rules::set_name_merged,
            tag_rules::set_group_merged,
            tag_rules::remove_group_name,
            tag_rules::delete_group,
            tag_rules::rules_preview,
            tag_rules::principal_check,
            tag_rules::set_group_principal,
            tag_rules::parent_check,
            tag_rules::create_parent,
            tag_rules::parent_delete_check,
            tag_rules::set_parent_enabled,
            tag_rules::delete_parent,
            tag_rules::create_tag,
        ])
        .build(tauri::generate_context!())
        .expect("erreur au lancement de MyBoard")
        .run(|app, event| {
            // Fermeture : vidéos des GIF effacées (VIEW-54).
            if let tauri::RunEvent::Exit = event
                && let Some(state) = app.try_state::<AppState>()
            {
                media::gif::clear_cache(&state.paths.root);
            }
        });
}
