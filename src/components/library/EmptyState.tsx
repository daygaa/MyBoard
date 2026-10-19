// Messages quand la grille est vide (GRID-01) : bibliothèque vide ≠ aucun résultat.

import { navigate } from "@/lib/router";
import { useSearch } from "@/stores/search";

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

/** Vue Favoris sans aucun favori (FAV-02). */
export function NoFavorites() {
  return (
    <div data-zone="grille.vide" className={BOX}>
      <p className="text-lg font-medium text-foreground">Aucun favori pour le moment</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Ajoutez un média aux favoris avec l'étoile de sa vignette, ou dans la visionneuse (touche S).
      </p>
    </div>
  );
}

/** Page d'un dossier vide (FOLD-04). */
export function EmptyFolder() {
  return (
    <div data-zone="grille.vide" className={BOX}>
      <p className="text-lg font-medium text-foreground">Ce dossier est vide</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Ajoutez-y des médias avec « Ajouter à un dossier » (clic droit sur une vignette, ou touche D dans la visionneuse).
      </p>
    </div>
  );
}

/** Aucun résultat : message distinct pour une recherche par tags (GRID-01, texte de la v8). */
export function NoResults() {
  const searching = useSearch((s) => s.terms.length > 0);
  const setTerms = useSearch((s) => s.setTerms);
  return (
    <div data-zone="grille.vide" className={BOX}>
      <p className="text-lg font-medium text-foreground">Aucun média trouvé</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {searching
          ? "Aucun média ne correspond à votre recherche. Essayez de retirer des tags."
          : "Aucun média de ce type dans la bibliothèque."}
      </p>
      {searching && (
        <button
          type="button"
          onClick={() => setTerms([])}
          className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
        >
          Réinitialiser la recherche
        </button>
      )}
    </div>
  );
}

/** Recherche d'un nom de fichier sans résultat (SRCH-26, texte proposé par Claude). `where` : « dans
 *  la bibliothèque », « dans les favoris », « dans ce dossier ». */
export function NoFileMatch({ file, where, typed }: { file: string; where: string; typed: boolean }) {
  const withTags = useSearch((s) => s.terms.length > 0);
  const setFile = useSearch((s) => s.setFile);
  return (
    <div data-zone="grille.vide" className={BOX}>
      <p className="text-lg font-medium text-foreground">Aucun fichier trouvé</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Aucun fichier {typed ? "de ce type " : ""}dont le nom contient « {file} » {where}
        {withTags ? ", avec ces tags" : ""}.
      </p>
      <button
        type="button"
        onClick={() => setFile(null)}
        className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
      >
        Retirer le nom de fichier
      </button>
    </div>
  );
}
