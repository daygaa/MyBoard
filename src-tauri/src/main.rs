// En version finale, pas de fenêtre console noire à côté de l'application (NE PAS RETIRER).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    myboard_lib::run()
}
