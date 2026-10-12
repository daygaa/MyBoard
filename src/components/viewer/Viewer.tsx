// Visionneuse plein écran (VIEW-01 à VIEW-07), apparence v8.
// - Fermer : Échap, bouton 4 de la souris, croix, clic sur le fond (VIEW-02, VIEW-03).
// - Précédent / suivant (flèches écran et clavier) sans couture entre les pages (VIEW-04).
// - En fermant, la grille montre la page du média regardé (VIEW-05).
// - La page derrière ne défile pas (VIEW-06).
// - Plein écran total (VIEW-18) : la fenêtre couvre tout l'écran ; la barre du bas apparaît au
//   survol ; la croix, Échap et le bouton 4 quittent d'abord le plein écran.
// - Note du média (VIEW-19), message d'erreur des ouvertures externes (VIEW-28).

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

import type { MediaItem } from "@/lib/api";
import { hasModalLayer, useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";
import { useSearch } from "@/stores/search";
import { useViewer, type ListBase } from "@/stores/viewer";
import { ControlsSlot } from "./controlsSlot";
import { ErrorBanner } from "./ErrorBanner";
import { InfoBar } from "./InfoBar";
import { MediaStage } from "./MediaStage";
import { NotesButton } from "./NotesButton";
import { isTyping, itemAt, preload, usePageAt } from "./navigation";
import { removePrintHolder } from "./printMedia";

const NAV_BUTTON =
  "absolute top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-md bg-black/60 text-white transition hover:bg-black/85";
const ROUND_BUTTON = "absolute top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/85";

function ViewerOverlay({ base }: { base: ListBase }) {
  const index = useViewer((s) => s.index);
  const item = useViewer((s) => s.item);
  const total = useViewer((s) => s.total);
  const fullscreen = useViewer((s) => s.fullscreen);
  const hasError = useViewer((s) => s.error !== null);
  const { show, close, setFullscreen, closeForSearch } = useViewer.getState();
  const pageAt = usePageAt();
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  // Dernière position demandée : un appui rapide sur → enchaîne sans attendre l'affichage.
  const target = useRef(index);

  useEscape(true, close);
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

  // Flèches du clavier, sauf pendant une saisie ou si une pop-in est ouverte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || hasModalLayer()) return;
      if (e.key === "ArrowLeft") void go(-1);
      else if (e.key === "ArrowRight") void go(1);
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
      className="mb-zoom-in fixed inset-0 z-[100] flex flex-col bg-black/95"
    >
      <div data-zone="visionneuse.scene" className="checker relative min-h-0 flex-1 overflow-hidden">
        <ControlsSlot.Provider value={slot}>
          <MediaStage key={item.id} item={item} onClose={close} />
        </ControlsSlot.Provider>
        <NotesButton key={`note-${item.id}`} mediaId={item.id} />
        {!fullscreen && (
          <button
            type="button"
            data-zone="visionneuse.plein-ecran"
            onClick={() => setFullscreen(true)}
            aria-label="Plein écran"
            title="Plein écran"
            className={cn(ROUND_BUTTON, "right-16")}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          data-zone="visionneuse.fermer"
          onClick={fullscreen ? () => setFullscreen(false) : close}
          aria-label={fullscreen ? "Quitter le plein écran (Échap)" : "Fermer (Échap)"}
          title={fullscreen ? "Quitter le plein écran (Échap)" : "Fermer (Échap)"}
          className={cn(ROUND_BUTTON, "right-4")}
        >
          <X className="h-5 w-5" />
        </button>
        {index > 0 && (
          <button type="button" data-zone="visionneuse.precedent" onClick={() => void go(-1)} aria-label="Précédent (←)" className={`${NAV_BUTTON} left-3`}>
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {index < total - 1 && (
          <button type="button" data-zone="visionneuse.suivant" onClick={() => void go(1)} aria-label="Suivant (→)" className={`${NAV_BUTTON} right-3`}>
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
      {/* Plein écran : la barre passe par-dessus le média, visible seulement au survol (ou pendant
          une saisie, ou s'il y a un message d'erreur). */}
      <div
        data-zone="visionneuse.bas"
        className={cn(
          fullscreen &&
            "absolute inset-x-0 bottom-0 z-30 opacity-0 transition-opacity duration-200 focus-within:opacity-100 hover:opacity-100",
          fullscreen && hasError && "opacity-100",
        )}
      >
        <div ref={setSlot} />
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
