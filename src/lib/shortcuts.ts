// Raccourcis clavier des boutons de la barre du bas de la visionneuse (VIEW-36). Réunis ici,
// en un seul endroit, pour devenir personnalisables plus tard (Paramètres > Raccourcis, SET-10).
// Le plein écran reste sur F (VIEW-18) : d'où L pour les favoris (« like », comme l'app Photos).

export type ViewerAction = "copy" | "favorite" | "folder" | "reveal" | "open" | "print" | "delete";

type Shortcut = {
  /** Valeur de `KeyboardEvent.key` (en minuscules pour une lettre). */
  key: string;
  ctrl?: boolean;
  /** Affichage dans les bulles d'aide. */
  label: string;
};

export const VIEWER_SHORTCUTS: Record<ViewerAction, Shortcut> = {
  copy: { key: "c", ctrl: true, label: "Ctrl+C" },
  favorite: { key: "l", label: "L" },
  folder: { key: "d", label: "D" },
  reveal: { key: "e", label: "E" },
  open: { key: "o", label: "O" },
  print: { key: "i", label: "I" },
  delete: { key: "Delete", label: "Suppr" },
};

/** Action dont le raccourci correspond à la touche pressée (Maj et Verr. Maj ignorés). */
export function viewerActionFor(e: KeyboardEvent): ViewerAction | null {
  if (e.altKey || e.metaKey) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  for (const [action, s] of Object.entries(VIEWER_SHORTCUTS) as [ViewerAction, Shortcut][]) {
    if (s.key === key && Boolean(s.ctrl) === e.ctrlKey) return action;
  }
  return null;
}

/** Texte d'une bulle d'aide avec son raccourci : « Explorer (E) ». */
export function withShortcut(title: string, action: ViewerAction): string {
  return `${title} (${VIEWER_SHORTCUTS[action].label})`;
}
