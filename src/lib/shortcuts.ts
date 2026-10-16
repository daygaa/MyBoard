// Raccourcis clavier des boutons de la barre du bas de la visionneuse (VIEW-36) et du lecteur vidéo
// (VIEW-47). Réunis ici, en un seul endroit, pour devenir personnalisables plus tard (Paramètres >
// Raccourcis, SET-10). Lettres des mots anglais, en vue de la traduction (FUT-08) : S pour les
// favoris (« Star », l'icône est une étoile ; convention de Gmail), L pour la boucle (« Loop »).

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
  favorite: { key: "s", label: "S" },
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

/** Lecteur vidéo (VIEW-47) : son, vitesse d'un palier (convention de YouTube), boucle. */
export type VideoAction = "mute" | "slower" | "faster" | "loop";

export const VIDEO_SHORTCUTS: Record<VideoAction, Shortcut> = {
  mute: { key: "m", label: "M" },
  slower: { key: "<", label: "<" },
  faster: { key: ">", label: ">" },
  loop: { key: "l", label: "L" },
};

/** Action du lecteur dont le raccourci correspond à la touche pressée (Maj et Verr. Maj ignorés :
 *  sur AZERTY, « > » est Maj + « < »). */
export function videoActionFor(e: KeyboardEvent): VideoAction | null {
  if (e.altKey || e.metaKey || e.ctrlKey) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  for (const [action, s] of Object.entries(VIDEO_SHORTCUTS) as [VideoAction, Shortcut][]) if (s.key === key) return action;
  return null;
}
