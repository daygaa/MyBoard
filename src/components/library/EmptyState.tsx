// Messages quand la grille est vide (GRID-01) : bibliothèque vide ≠ aucun résultat. Avec un filtre de
// type, le texte nomme les types et la page (GRID-12) : « Aucune vidéo dans ce dossier. ».

import type { MediaKind } from "@/lib/api";
import { KIND_FILTERS } from "@/lib/grid";
import { navigate } from "@/lib/router";
import { useSearch } from "@/stores/search";

/** Nom de chaque type, et s'il est féminin (« Aucune image », « Aucun document »). */
const NOUNS: Record<MediaKind, [string, boolean]> = {
  image: ["image", true],
  video: ["vidéo", true],
  audio: ["fichier audio", false],
  document: ["document", false],
};

/** « Aucune image », « Aucune image ni vidéo », « Aucune image, vidéo ni document » (ordre des
 *  filtres ; le genre suit le premier type) ; aucun filtre : `null`. */
function noneOf(kinds: MediaKind[]): string | null {
  const names = KIND_FILTERS.filter((k) => kinds.includes(k.value)).map((k) => NOUNS[k.value]);
  if (names.length === 0) return null;
  const words = names.map(([word]) => word);
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} ni ${words[words.length - 1]}`;
  return `${names[0][1] ? "Aucune" : "Aucun"} ${list}`;
}

/** Où cherche la page : « dans la bibliothèque », « dans les favoris », « dans ce dossier ». */
type Where = { kinds: MediaKind[]; where: string };

const BOX = "grid select-text place-items-center rounded-2xl border border-dashed border-border py-24 text-center";

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
export function NoResults({ kinds, where }: Where) {
  const searching = useSearch((s) => s.terms.length > 0);
  const setTerms = useSearch((s) => s.setTerms);
  return (
    <div data-zone="grille.vide" className={BOX}>
      <p className="text-lg font-medium text-foreground">Aucun média trouvé</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {searching
          ? "Aucun média ne correspond à votre recherche. Essayez de retirer des tags."
          : `${noneOf(kinds) ?? "Aucun média"} ${where}.`}
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

/** Recherche d'un nom de fichier sans résultat (SRCH-26, texte proposé par Claude) ; avec un filtre de
 *  type : « Aucune image dont le nom contient… » (GRID-12). */
export function NoFileMatch({ file, kinds, where }: Where & { file: string }) {
  const withTags = useSearch((s) => s.terms.length > 0);
  const setFile = useSearch((s) => s.setFile);
  return (
    <div data-zone="grille.vide" className={BOX}>
      <p className="text-lg font-medium text-foreground">Aucun fichier trouvé</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {noneOf(kinds) ?? "Aucun fichier"} dont le nom contient « {file} » {where}
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
