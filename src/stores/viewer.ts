// État de la visionneuse : média affiché et sa position dans TOUS les résultats de la vue
// courante (filtres, recherche, tri), pour passer d'une page à l'autre sans couture (VIEW-04)
// et rouvrir la grille sur la page du média regardé (VIEW-05).
// Aussi : plein écran total (VIEW-18), message d'erreur d'une ouverture externe (VIEW-28),
// confirmation « Copié » (VIEW-35).
// Historique (retour T3, points AUT.6 et AUT.17, choix du 25/10) : ouvrir un média est une étape du retour
// arrière / avant, une seule quelle que soit l'image affichée ensuite (elle garde la dernière vue). Le
// bouton 4 y fait un vrai retour (la grille) ; la croix, Échap ou un clic sur le fond la ferment en
// ajoutant une étape « grille » (le bouton 4 rouvre alors l'image) ; revenir sur l'étape la rouvre.

import { currentMonitor } from "@tauri-apps/api/window";
import { create } from "zustand";

import { api, type ListQuery, type MediaItem } from "@/lib/api";
import { stepState, VIEWER } from "@/lib/historySteps";
import { scopeOf } from "@/lib/router";
import { useLibrary } from "./library";
import { useSearch } from "./search";

export type ListBase = Omit<ListQuery, "page">;

/** Échec d'une ouverture externe (VIEW-28) : action, code d'erreur Windows, message. */
export type ExternalError = { action: string; code: number | null; message: string };

type Shown = { index: number; item: MediaItem; base: ListBase };

type ViewerState = {
  open: boolean;
  /** Position du média dans tous les résultats (0 = le premier). */
  index: number;
  item: MediaItem | null;
  /** Requête figée à l'ouverture (même découpage en pages que la grille). */
  base: ListBase | null;
  total: number;
  /** Plein écran demandé (bouton, touche F) : icône, Échap, bouton 4. */
  fullscreen: boolean;
  /** Plein écran réellement appliqué à la fenêtre : la mise en page (barre de titre cachée,
   *  barre du bas par-dessus le média) ne bascule qu'au changement de taille de la fenêtre,
   *  jamais avant ni après : aucune image intermédiaire (VIEW-34). */
  fullscreenShown: boolean;
  /** Hauteur de la barre des tâches sous la fenêtre agrandie, en px (voir `taskbarGap`). */
  screenGap: number;
  error: ExternalError | null;
  /** Média dont le fichier vient d'être copié : « Copié » s'affiche ~1,5 s (VIEW-35). */
  copied: number | null;
  /** Défilement rapide en cours (flèche maintenue, appuis rapprochés) : affichage allégé (VIEW-53,
   *  components/viewer/burst.ts). */
  burst: boolean;
  openAt: (index: number, item: MediaItem, pageSize: number) => void;
  show: (index: number, item: MediaItem, total: number) => void;
  /** Fermeture (Échap, croix, clic sur le fond) : nouvelle étape « grille » ; `replace` : l'étape de la
   *  visionneuse est remplacée (plus aucun média à montrer). */
  close: (options?: { replace?: boolean }) => void;
  /** Fermeture pour lancer une recherche (clic sur une pastille) : nouvelle vue, page 1. */
  closeForSearch: () => void;
  setFullscreen: (on: boolean) => void;
  setError: (error: ExternalError | null) => void;
  markCopied: (id: number) => void;
};

/** Durée de la confirmation « Copié » (VIEW-35). */
const COPIED_MS = 1500;
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

/** Délai au-delà duquel la mise en page suit la demande de plein écran même si la fenêtre n'a
 *  pas changé de taille (déjà à la bonne taille). */
const FULLSCREEN_SETTLE_MS = 700;
let settleTimer: ReturnType<typeof setTimeout> | undefined;

/** La fenêtre couvre-t-elle tout l'écran ? (à un pixel près : arrondis de la mise à l'échelle) */
function coversScreen(): boolean {
  return window.innerWidth >= screen.width - 1 && window.innerHeight >= screen.height - 1;
}

/** Espace entre le bas de la zone de travail de l'écran (au-dessus de la barre des tâches) et le
 *  bas de l'écran, en px. En plein écran, les commandes flottantes remontent d'autant pour rester
 *  au même endroit qu'avec la fenêtre agrandie (VIEW-32). */
async function taskbarGap(): Promise<number> {
  const monitor = await currentMonitor().catch(() => null);
  if (!monitor) return 0;
  const bottom = monitor.position.y + monitor.size.height;
  const workBottom = monitor.workArea.position.y + monitor.workArea.size.height;
  return Math.max(0, Math.round((bottom - workBottom) / monitor.scaleFactor));
}

export const useViewer = create<ViewerState>()((set, get) => {
  /** Ferme la visionneuse sans toucher à l'historique ; la grille s'ouvre sur la page du média regardé
   *  (VIEW-05). */
  const hide = () => {
    const { base, index } = get();
    if (base) useLibrary.getState().setPage(Math.floor(index / base.pageSize) + 1);
    get().setFullscreen(false);
    set({ open: false, item: null, base: null, error: null });
  };
  /** Ouvre (ou rouvre) un média, tel que noté dans une étape de l'historique. */
  const reveal = ({ index, item, base }: Shown) => {
    set({ open: true, index, item, base, error: null });
    refreshGap();
  };
  // Retour ou avance dans l'historique : l'étape d'arrivée dit si un média y était ouvert. Après la
  // recherche (stores/search.ts, inscrit avant) : la recherche de l'étape est déjà revenue.
  window.addEventListener("popstate", (e) => {
    const shown = (e.state as Record<string, unknown> | null)?.[VIEWER] as Shown | undefined;
    if (shown) reveal(shown);
    else if (get().open) hide();
  });
  // Démarrage (ou rechargement) : la visionneuse est fermée, l'étape en cours aussi.
  if ((window.history.state as Record<string, unknown> | null)?.[VIEWER]) window.history.replaceState(stepState(), "");
  /** Relu à chaque ouverture et à chaque plein écran (la fenêtre a pu changer d'écran). */
  const refreshGap = () => void taskbarGap().then((screenGap) => set({ screenGap }));
  /** Mise en page du plein écran alignée sur la fenêtre : appelé à chaque changement de taille
   *  (avant que l'image suivante soit dessinée), ou de force après FULLSCREEN_SETTLE_MS. */
  const syncShown = (force: boolean) => {
    const { fullscreen, fullscreenShown } = get();
    const next = force ? fullscreen : fullscreen ? coversScreen() : fullscreenShown && coversScreen();
    if (next !== fullscreenShown) set({ fullscreenShown: next });
  };
  window.addEventListener("resize", () => syncShown(false));

  return {
    open: false,
    index: 0,
    item: null,
    base: null,
    total: 0,
    fullscreen: false,
    fullscreenShown: false,
    screenGap: 0,
    error: null,
    copied: null,
    burst: false,
    openAt: (index, item, pageSize) => {
      const { kinds, sort, seed } = useLibrary.getState();
      const { terms, file } = useSearch.getState();
      // Même vue que la grille (favoris, dossier, nom de fichier cherché, SRCH-26) : précédent /
      // suivant restent dans ces résultats.
      const base = { kinds, terms, file, sort, seed, pageSize, ...scopeOf(location.hash) };
      // Nouvelle étape de l'historique : ce média ouvert (avec la recherche du moment).
      window.history.pushState({ ...stepState(), [VIEWER]: { index, item, base } }, "");
      reveal({ index, item, base });
    },
    show: (index, item, total) => {
      set({ index, item, total, error: null });
      // L'étape de la visionneuse garde la dernière image vue (une seule étape, choix du 25/10).
      const base = get().base;
      if (base && (window.history.state as Record<string, unknown> | null)?.[VIEWER]) {
        window.history.replaceState({ ...window.history.state, [VIEWER]: { index, item, base } }, "");
      }
    },
    close: (options) => {
      hide();
      const grid = stepState();
      if (options?.replace) window.history.replaceState(grid, "");
      else window.history.pushState(grid, "");
    },
    closeForSearch: () => {
      get().setFullscreen(false);
      set({ open: false, item: null, base: null, error: null });
    },
    setFullscreen: (on) => {
      if (get().fullscreen === on) return;
      set({ fullscreen: on });
      // Commande MyBoard (NAV-04) : couvre tout l'écran sans que le haut de la fenêtre bouge.
      void api.setViewerFullscreen(on);
      if (on) refreshGap();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => syncShown(true), FULLSCREEN_SETTLE_MS);
    },
    setError: (error) => set({ error }),
    markCopied: (id) => {
      clearTimeout(copiedTimer);
      set({ copied: id });
      copiedTimer = setTimeout(() => set({ copied: null }), COPIED_MS);
    },
  };
});
