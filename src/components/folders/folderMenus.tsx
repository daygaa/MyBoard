// Menus des dossiers (apparence CTX-01, sans icônes ; pastille de la couleur du dossier) :
// - menu ⋮ et clic droit d'un dossier du menu burger (FOLD-02, FOLD-07) : Renommer… · Couleur ▸ ·
//   Masquer (« Ne plus masquer » pour un dossier masqué) ‖ Supprimer… (rouge, confirmation) ;
// - liste à cocher « Ajouter à un dossier » (FOLD-09) : menu d'une vignette (sous-menu) et bouton
//   Dossier de la visionneuse (touche D) : coche = le média y est déjà, clic = ajouter ou retirer,
//   « Créer un dossier… » en bas (le média y est rangé aussitôt). Les dossiers masqués n'y sont pas ;
// - même liste pour une sélection (SEL-08) : coche = tous les médias y sont (un clic les en retire),
//   sinon un clic y range les autres ; un badge dit combien ont réellement été ajoutés ou retirés.

import type { Folder } from "@/lib/api";
import type { MenuEntry } from "@/lib/contextMenu";
import { cachedFolders, deleteFolder, FOLDER_COLORS, setFolderColor, setFolderHidden, setFolderMedia } from "@/lib/folders";
import { formatNumber, plural } from "@/lib/format";
import { showGridBadge } from "@/stores/badge";
import { FolderNameDialog } from "./FolderNameDialog";

function keepMessage(count: number): string {
  if (count === 0) return "Il ne contient aucun média.";
  if (count === 1) return "Son média restera disponible dans la bibliothèque.";
  return `Ses ${formatNumber(count)} médias resteront disponibles dans la bibliothèque.`;
}

export function folderMenu(folder: Folder): MenuEntry[] {
  return [
    {
      label: "Renommer…",
      dialog: ({ onCancel, onDone }) => <FolderNameDialog folder={folder} onCancel={onCancel} onDone={onDone} />,
    },
    {
      label: "Couleur",
      submenu: FOLDER_COLORS.map((c) => ({
        label: c.label,
        color: c.color,
        checked: c.color === folder.color,
        run: () => void setFolderColor(folder.id, c.color),
      })),
    },
    { label: folder.hidden ? "Ne plus masquer" : "Masquer", run: () => void setFolderHidden(folder.id, !folder.hidden) },
    "separator",
    {
      label: "Supprimer…",
      danger: true,
      confirm: { title: `Supprimer le dossier « ${folder.name} » ?`, message: keepMessage(folder.mediaCount), danger: true },
      run: () => void deleteFolder(folder.id),
    },
  ];
}

/** « Créer un dossier… » : pop-in du nom, les médias y sont rangés aussitôt. */
export function createFolderEntry(mediaIds: number[], onCreated?: (folder: Folder) => void): MenuEntry {
  return {
    label: "Créer un dossier…",
    dialog: ({ onCancel, onDone }) => <FolderNameDialog mediaIds={mediaIds} onCancel={onCancel} onDone={onDone} onCreated={onCreated} />,
  };
}

/** Badge « 3 ajoutés au dossier « Vacances » » / « 3 retirés du dossier… » (SEL-08). */
export function folderBadge(count: number, added: boolean, name: string) {
  const verb = plural(count, added ? "ajouté" : "retiré");
  showGridBadge(`${formatNumber(count)} ${verb} ${added ? "au" : "du"} dossier « ${name} »`);
}

/** Liste à cocher d'une sélection (`inFolders` : nombre de ses médias dans chaque dossier). */
export function folderPickManyEntries(mediaIds: number[], inFolders: { id: number; count: number }[]): MenuEntry[] {
  const folders = cachedFolders().filter((f) => !f.hidden);
  const create = createFolderEntry(mediaIds, (f) => folderBadge(f.mediaCount, true, f.name));
  if (folders.length === 0) return [create];
  return [
    ...folders.map((f): MenuEntry => {
      const all = mediaIds.length > 0 && inFolders.find((c) => c.id === f.id)?.count === mediaIds.length;
      return {
        label: f.name,
        color: f.color,
        checked: all,
        run: () => void setFolderMedia(f.id, mediaIds, !all).then((n) => n !== undefined && folderBadge(n, !all, f.name)),
      };
    }),
    "separator",
    create,
  ];
}

/** Liste à cocher d'un média (`inFolders` : dossiers qui le contiennent déjà). */
export function folderPickEntries(mediaId: number, inFolders: number[]): MenuEntry[] {
  const folders = cachedFolders().filter((f) => !f.hidden);
  const create = createFolderEntry([mediaId]);
  if (folders.length === 0) return [create];
  return [
    ...folders.map((f): MenuEntry => {
      const on = inFolders.includes(f.id);
      return { label: f.name, color: f.color, checked: on, run: () => void setFolderMedia(f.id, [mediaId], !on) };
    }),
    "separator",
    create,
  ];
}
