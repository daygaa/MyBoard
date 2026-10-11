// Messages quand la grille est vide (GRID-01) : bibliothèque vide ≠ aucun résultat.

import { navigate } from "@/lib/router";

const BOX = "grid place-items-center rounded-2xl border border-dashed border-border py-24 text-center";

export function EmptyLibrary() {
  return (
    <div data-zone="grille.vide" className={BOX}>
      <p className="text-lg font-medium text-foreground">Bienvenue sur MyBoard</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Votre bibliothèque est vide. Commencez par importer vos premiers médias.
      </p>
      <button
        type="button"
        onClick={() => navigate("import")}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#d9a94e] px-4 py-2 text-sm font-medium text-[#1a1408] transition hover:bg-[#e3b75f]"
      >
        Importer des médias
      </button>
    </div>
  );
}

export function NoResults() {
  return (
    <div data-zone="grille.vide" className={BOX}>
      <p className="text-lg font-medium text-foreground">Aucun média trouvé</p>
      <p className="mt-1 text-sm text-muted-foreground">Aucun média de ce type dans la bibliothèque.</p>
    </div>
  );
}
