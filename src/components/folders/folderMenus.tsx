// Menus des dossiers (apparence CTX-01, sans icônes ; pastille de la couleur du dossier) :
// - menu ⋮ et clic droit d'un dossier du menu burger (FOLD-02, FOLD-07) : Renommer… · Couleur ▸ ·
//   Masquer (« Ne plus masquer » pour un dossier masqué) ‖ Supprimer… (rouge, confirmation) ;
// - liste à cocher « Ajouter à un dossier » (FOLD-09) : menu d'une vignette (sous-menu) et bouton
//   Dossier de la visionneuse (touche D) : coche = le média y est déjà, clic = ajouter ou retirer,
//   « Créer un dossier… » en bas (le média y est rangé aussitôt). Les dossiers masqués n'y sont pas.

import type { Folder } from "@/lib/api";
import type { MenuEntry } from "@/lib/contextMenu";
import { cachedFolders, deleteFolder, FOLDER_COLORS, setFolderColor, setFolderHidden, setFolderMedia } from "@/lib/folders";
import { formatNumber } from "@/lib/format";
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
export function createFolderEntry(mediaIds: number[]): MenuEntry {
  return {
    label: "Créer un dossier…",
    dialog: ({ onCancel, onDone }) => <FolderNameDialog mediaIds={mediaIds} onCancel={onCancel} onDone={onDone} />,
  };
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
