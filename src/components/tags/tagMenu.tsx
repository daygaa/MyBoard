// Menus du clic droit des tags (ordre et libellés de l'utilisateur) :
// - pastilles de la visionneuse et lignes de tags de la barre latérale (CTX-04) ;
// - termes de la recherche, sous le champ de la barre latérale (CTX-12) ;
// - lignes du gestionnaire de tags (TAGM-04 : sans « Retirer de… » ; « Renommer… » y modifie le nom
//   dans la ligne).
// « Copier le tag » copie la forme enregistrée (« long_hair ») : elle se colle telle quelle dans une
// recherche. Renommer : pop-in, et fusion proposée si le nom existe déjà ; Masquer (TAGM-05) : plus
// proposé dans les recherches ni dans la barre latérale, toujours sur les médias ; Supprimer : retiré
// de tous ses médias, après confirmation (qui dit aussi ses synonymes et règles de parents, qui partent
// avec lui : TAGM-15, TAGM-16).

import { useQuery } from "@tanstack/react-query";

import { api, type Category, type MediaKind, type TagInfo } from "@/lib/api";
import type { MenuEntry, MenuItem } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import { rulesApi } from "@/lib/rulesApi";
import { displayTag, splitTerm } from "@/lib/tags";
import { deleteTags, setTagsCategory, setTagsHidden } from "@/lib/tagManager";
import { useSearch } from "@/stores/search";
import { RenameTagDialog } from "./RenameTagDialog";

/** « Retirer de cette image / vidéo / ce document / ce fichier audio » (un GIF est une image). */
const REMOVE_FROM: Record<MediaKind, string> = {
  image: "Retirer de cette image",
  video: "Retirer de cette vidéo",
  document: "Retirer de ce document",
  audio: "Retirer de ce fichier audio",
};

const copyTag = (name: string): MenuEntry => ({ label: "Copier le tag", run: () => void api.writeClipboardText(name) });

/** « Renommer… » : pop-in, ou `inline` (gestionnaire : le nom devient modifiable dans sa ligne). */
function renameEntry(tag: TagInfo | null | undefined, inline?: () => void): MenuItem {
  if (!tag) return { label: "Renommer…", disabled: true };
  if (inline) return { label: "Renommer…", run: inline };
  return { label: "Renommer…", dialog: ({ onCancel, onDone }) => <RenameTagDialog tag={tag} onCancel={onCancel} onDone={onDone} /> };
}

/** Catégories avec leur couleur, l'actuelle cochée. */
function categoryEntry(tag: TagInfo | null | undefined, categories: Category[]): MenuItem {
  return {
    label: "Changer de catégorie",
    disabled: !tag,
    submenu: categories.map((c) => ({
      label: c.name,
      color: c.color,
      checked: c.id === tag?.categoryId,
      run: tag ? () => void setTagsCategory([tag.id], c.id) : undefined,
    })),
  };
}

function hideEntry(tag: TagInfo | null | undefined): MenuItem {
  if (!tag) return { label: "Masquer de la recherche", disabled: true };
  return {
    label: tag.hidden ? "Ne plus masquer de la recherche" : "Masquer de la recherche",
    run: () => void setTagsHidden([tag.id], !tag.hidden),
  };
}

/** « Il sera retiré de N médias. » */
function removedFrom(count: number): string {
  if (count === 0) return "Il n'est sur aucun média.";
  return `Il sera retiré de ${formatNumber(count)} ${plural(count, "média")}.`;
}

/** Texte de la confirmation « Supprimer le tag… » : ses médias, puis ce qui part avec lui. */
export function TagDeleteMessage({ tag }: { tag: Pick<TagInfo, "id" | "mediaCount"> }) {
  const { data } = useQuery({ queryKey: ["tag-links", tag.id], queryFn: () => rulesApi.tagLinks(tag.id) });
  const parts = [
    data?.aliases ? `${formatNumber(data.aliases)} ${plural(data.aliases, "synonyme")}` : "",
    data?.parents ? `${formatNumber(data.parents)} ${plural(data.parents, "règle de parent", "règles de parents")}` : "",
  ].filter(Boolean);
  return (
    <div className="space-y-4">
      <p>{removedFrom(tag.mediaCount)}</p>
      {parts.length > 0 && <p>Partiront avec lui : {parts.join(", ")}.</p>}
    </div>
  );
}

function deleteEntry(tag: TagInfo): MenuItem {
  return {
    label: "Supprimer le tag…",
    danger: true,
    confirm: { title: `Supprimer « ${displayTag(tag.name)} » ?`, message: <TagDeleteMessage tag={tag} />, danger: true },
    run: () => void deleteTags([tag.id]),
  };
}

type Options = {
  /** Visionneuse : retirer du média affiché. */
  removeFrom?: { kind: MediaKind; run: () => void };
  /** Gestionnaire : renommer dans la ligne. */
  renameInline?: () => void;
};

/** Tag de la visionneuse, de la barre latérale ou du gestionnaire. */
export function tagMenu(tag: TagInfo, categories: Category[], { removeFrom, renameInline }: Options = {}): MenuEntry[] {
  return [
    copyTag(tag.name),
    renameEntry(tag, renameInline),
    categoryEntry(tag, categories),
    ...(removeFrom ? [{ label: REMOVE_FROM[removeFrom.kind], run: removeFrom.run }] : []),
    "separator",
    hideEntry(tag),
    "separator",
    deleteEntry(tag),
  ];
}

/** Terme de la recherche (`tag`, `-tag` exclu, `tag*` joker) ; `tag` : le tag s'il existe (sinon
 *  renommer, changer de catégorie et masquer sont grisés). */
export function termMenu(term: string, tag: TagInfo | null | undefined, categories: Category[]): MenuEntry[] {
  const { exclude, name, prefix } = splitTerm(term);
  const { invertTerm, setTerms } = useSearch.getState();
  const exact = prefix ? null : tag;
  return [
    { label: exclude ? "Inclure dans la recherche" : "Exclure de la recherche", run: () => invertTerm(term) },
    "separator",
    copyTag(prefix ? `${name}*` : name),
    renameEntry(exact),
    categoryEntry(exact, categories),
    "separator",
    hideEntry(exact),
    "separator",
    { label: "Tout effacer", run: () => setTerms([]) },
  ];
}
