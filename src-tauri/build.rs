fn main() {
    // L'icône est intégrée au .exe à la compilation (ressource Windows). Sans cette ligne,
    // remplacer les images de `icons/` ne régénère pas la ressource : l'ancienne icône reste.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
