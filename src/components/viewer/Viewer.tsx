// Visionneuse plein écran (VIEW-01 à VIEW-07), apparence v8.
// - Fermer : Échap, bouton 4 de la souris, croix, clic sur le fond (VIEW-02, VIEW-03) ; le
//   bouton 5 fait l'inverse du bouton 4 (VIEW-30, chemin tenu par stores/viewer.ts).
// - Précédent / suivant (flèches écran et clavier) sans couture entre les pages (VIEW-04).
// - En fermant, la grille montre la page du média regardé (VIEW-05).
// - La page derrière ne défile pas (VIEW-06).
// - Plein écran total (VIEW-18) : la fenêtre couvre tout l'écran ; la barre du bas apparaît à
//   l'approche de la souris ; touche F ou bouton (barre de lecture flottante des vidéos, ou
//   bouton rond en bas à droite) ; Échap et le bouton 4 quittent d'abord le plein écran, la
//   croix ferme tout. Vidéo : souris immobile 3 s = commandes et curseur cachés (VIEW-33).
// - Note du média (VIEW-19), message d'erreur des ouvertures externes (VIEW-28).

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { MediaItem } from "@/lib/api";
import { hasModalLayer, useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";
import { useSearch } from "@/stores/search";
import { useViewer, type ListBase } from "@/stores/viewer";
import { ErrorBanner } from "./ErrorBanner";
import { FullscreenButton } from "./FullscreenButton";
import { InfoBar } from "./InfoBar";
import { MediaStage } from "./MediaStage";
import { NotesButton } from "./NotesButton";
import { isTyping, itemAt, preload, usePageAt } from "./navigation";
import { removePrintHolder } from "./printMedia";
import { useBottomBarVisible, useHeight, useIdle } from "./useBottomBar";
import { idleClass, ViewerChrome } from "./viewerChrome";

const NAV_BUTTON =
  "absolute top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-md bg-black/60 text-white transition hover:bg-black/85";
const ROUND_BUTTON = "absolute z-20 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/85";
/** Écart entre le bas de la scène (ou le haut de la barre du bas, en plein écran) et le bouton
 *  plein écran des images. */
const FLOAT_GAP = 16;

function ViewerOverlay({ base }: { base: ListBase }) {
  const index = useViewer((s) => s.index);
  const item = useViewer((s) => s.item);
  const total = useViewer((s) => s.total);
  const fullscreen = useViewer((s) => s.fullscreen);
  const hasError = useViewer((s) => s.error !== null);
  const { show, close, forward, setFullscreen, closeForSearch } = useViewer.getState();
  const pageAt = usePageAt();
  const barRef = useRef<HTMLDivElement>(null);
  const barVisible = useBottomBarVisible(barRef, fullscreen);
  const barHeight = useHeight(barRef);
  const idle = useIdle(fullscreen && item?.kind === "video");
  const chrome = { bottomInset: fullscreen ? barHeight : 0, idle };
  // Dernière position demandée : un appui rapide sur → enchaîne sans attendre l'affichage.
  const target = useRef(index);

  useEscape(true, close, { onForward: forward });
  // Inscrit après la visionneuse : en plein écran, Échap et le bouton 4 le quittent d'abord.
  useEscape(fullscreen, () => setFullscreen(false));
  useEffect(() => {
    target.current = index;
  }, [index]);

  const go = async (delta: number) => {
    const next = target.current + delta;
    if (next < 0 || next >= total) return;
    target.current = next;
    const page = await pageAt(base, next);
    const found = itemAt(page, next);
    if (target.current === next && found) show(next, found, page.total);
  };

  // Nombre total de résultats, puis préchargement des voisins à chaque changement de média.
  useEffect(() => {
    let cancelled = false;
    void pageAt(base, index).then(async (page) => {
      if (cancelled) return;
      if (page.total !== useViewer.getState().total) useViewer.setState({ total: page.total });
      const neighbors = await Promise.all(
        [index - 1, index + 1]
          .filter((i) => i >= 0 && i < page.total)
          .map(async (i) => itemAt(await pageAt(base, i), i)),
      );
      if (!cancelled) preload(neighbors.filter((n): n is MediaItem => n !== undefined));
    });
    return () => {
      cancelled = true;
    };
    // `pageAt` est recréée à chaque affichage mais ne dépend que du cache partagé.
  }, [base, index]);

  // Flèches et touche F (plein écran), sauf pendant une saisie ou si une pop-in est ouverte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || hasModalLayer() || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "ArrowLeft") void go(-1);
      else if (e.key === "ArrowRight") void go(1);
      else if (e.key === "f" || e.key === "F") setFullscreen(!useViewer.getState().fullscreen);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // La page derrière ne défile plus (VIEW-06). La place réservée à la barre de défilement
  // (index.css) est libérée : aucun élément ne peut la recouvrir, elle formerait une bande
  // de 10 px à droite de la visionneuse. La page, cachée derrière, s'élargit sans se voir.
  useEffect(() => {
    const html = document.documentElement;
    const previous = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter };
    html.style.overflow = "hidden";
    html.style.scrollbarGutter = "auto";
    return () => {
      html.style.overflow = previous.overflow;
      html.style.scrollbarGutter = previous.gutter;
      removePrintHolder();
    };
  }, []);

  if (!item) return null;
  const searchTag = (name: string) => {
    useSearch.getState().setTerms([name]);
    closeForSearch(); // nouvelle recherche : page 1
  };

  return (
    <div
      data-zone="visionneuse"
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse"
      className={cn("mb-zoom-in fixed inset-0 z-[100] flex flex-col bg-black/95", idle && "cursor-none")}
    >
      <div data-zone="visionneuse.scene" className="checker relative min-h-0 flex-1 overflow-hidden">
        <ViewerChrome.Provider value={chrome}>
          <MediaStage key={item.id} item={item} onClose={close} />
          <NotesButton key={`note-${item.id}`} mediaId={item.id} />
        </ViewerChrome.Provider>
        {/* Médias sans barre de lecture : bouton rond en bas à droite, toujours au même endroit
            (en plein écran, juste au-dessus de la barre du bas qui ne le recouvre jamais). */}
        {item.kind !== "video" && (
          <FullscreenButton className={cn(ROUND_BUTTON, "right-4")} style={{ bottom: chrome.bottomInset + FLOAT_GAP }} />
        )}
        <button
          type="button"
          data-zone="visionneuse.fermer"
          onClick={close}
          aria-label={fullscreen ? "Quitter le plein écran et la visionneuse" : "Fermer (Échap)"}
          title={fullscreen ? "Quitter le plein écran et la visionneuse" : "Fermer (Échap)"}
          className={cn(ROUND_BUTTON, "top-4 right-4", idleClass(idle))}
        >
          <X className="h-5 w-5" />
        </button>
        {index > 0 && (
          <button
            type="button"
            data-zone="visionneuse.precedent"
            onClick={() => void go(-1)}
            aria-label="Précédent (←)"
            className={cn(NAV_BUTTON, "left-3", idleClass(idle))}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {index < total - 1 && (
          <button
            type="button"
            data-zone="visionneuse.suivant"
            onClick={() => void go(1)}
            aria-label="Suivant (→)"
            className={cn(NAV_BUTTON, "right-3", idleClass(idle))}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
      {/* Plein écran : la barre passe par-dessus le média, visible quand la souris s'en approche
          (ou pendant une saisie, ou s'il y a un message d'erreur). */}
      <div
        ref={barRef}
        data-zone="visionneuse.bas"
        className={cn(
          fullscreen && "absolute inset-x-0 bottom-0 z-30 transition-opacity duration-200 focus-within:opacity-100",
          fullscreen && !barVisible && !hasError && "pointer-events-none opacity-0 focus-within:pointer-events-auto",
        )}
      >
        <ErrorBanner />
        <InfoBar item={item} onSearch={searchTag} />
      </div>
    </div>
  );
}

export function Viewer() {
  const open = useViewer((s) => s.open);
  const base = useViewer((s) => s.base);
  if (!open || !base) return null;
  return <ViewerOverlay base={base} />;
}
