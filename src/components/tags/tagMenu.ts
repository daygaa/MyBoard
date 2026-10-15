// Menus du clic droit des tags (ordre et libellés de l'utilisateur) :
// - pastilles de la visionneuse et lignes de tags de la barre latérale (CTX-04) ;
// - termes de la recherche, sous le champ de la barre latérale (CTX-12).
// Renommer, changer de catégorie, masquer et supprimer : grisés jusqu'au gestionnaire de tags
// (TAGM-04, TAGM-05). « Copier le tag » copie la forme enregistrée (« long_hair ») : elle se colle
// telle quelle dans une recherche.

import { api, type Category, type MediaKind, type TagInfo } from "@/lib/api";
import type { MenuEntry } from "@/lib/contextMenu";
import { splitTerm } from "@/lib/tags";
import { useSearch } from "@/stores/search";

/** « Retirer de cette image / vidéo / ce document / ce fichier audio » (un GIF est une image). */
const REMOVE_FROM: Record<MediaKind, string> = {
  image: "Retirer de cette image",
  video: "Retirer de cette vidéo",
  document: "Retirer de ce document",
  audio: "Retirer de ce fichier audio",
};

const copyTag = (name: string): MenuEntry => ({ label: "Copier le tag", run: () => void api.writeClipboardText(name) });

/** Catégories avec leur couleur, l'actuelle cochée (grisé jusqu'au gestionnaire de tags). */
const categoryEntry = (categories: Category[], current: number | null): MenuEntry => ({
  label: "Changer de catégorie",
  disabled: true,
  submenu: categories.map((c) => ({ label: c.name, color: c.color, checked: c.id === current })),
});

/** Tag de la visionneuse (`removeFrom` : retirer du média affiché) ou de la barre latérale. */
export function tagMenu(tag: TagInfo, categories: Category[], removeFrom?: { kind: MediaKind; run: () => void }): MenuEntry[] {
  return [
    copyTag(tag.name),
    { label: "Renommer…" },
    categoryEntry(categories, tag.categoryId),
    ...(removeFrom ? [{ label: REMOVE_FROM[removeFrom.kind], run: removeFrom.run }] : []),
    "separator",
    { label: "Masquer de la recherche" },
    "separator",
    { label: "Supprimer le tag…", danger: true },
  ];
}

/** Terme de la recherche (`tag`, `-tag` exclu, `tag*` joker) ; `tag` : le tag s'il existe. */
export function termMenu(term: string, tag: TagInfo | null | undefined, categories: Category[]): MenuEntry[] {
  const { exclude, name, prefix } = splitTerm(term);
  const { invertTerm, setTerms } = useSearch.getState();
  return [
    { label: exclude ? "Inclure dans la recherche" : "Exclure de la recherche", run: () => invertTerm(term) },
    "separator",
    copyTag(prefix ? `${name}*` : name),
    { label: "Renommer…" },
    categoryEntry(categories, tag?.categoryId ?? null),
    "separator",
    { label: "Masquer de la recherche" },
    "separator",
    { label: "Tout effacer", run: () => setTerms([]) },
  ];
}
