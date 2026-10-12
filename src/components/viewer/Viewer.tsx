// Visionneuse plein écran (VIEW-01 à VIEW-07), apparence v8.
// - Fermer : Échap, bouton 4 de la souris, croix, clic sur le fond (VIEW-02, VIEW-03).
// - Précédent / suivant (flèches écran et clavier) sans couture entre les pages (VIEW-04) :
//   la position du média est comptée sur TOUS les résultats, les pages voisines sont lues
//   avec la même requête que la grille (même cache).
// - En fermant, la grille montre la page du média regardé (VIEW-05).
// - La page derrière ne défile pas (VIEW-06).

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { api, mediaUrl, type ListPage, type MediaItem } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { useSearch } from "@/stores/search";
import { useViewer, type ListBase } from "@/stores/viewer";
import { InfoBar } from "./InfoBar";
import { MediaStage } from "./MediaStage";

const NAV_BUTTON =
  "absolute top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-md bg-black/60 text-white transition hover:bg-black/85";

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
}

/** Page de résultats contenant la position `index` (lue en cache si déjà chargée). */
function usePageAt() {
  const queryClient = useQueryClient();
  return (base: ListBase, index: number): Promise<ListPage> => {
    const query = { ...base, page: Math.floor(index / base.pageSize) + 1 };
    return queryClient.ensureQueryData({ queryKey: ["media", query], queryFn: () => api.listMedia(query) });
  };
}

function itemAt(page: ListPage, index: number): MediaItem | undefined {
  return page.items[index - (page.page - 1) * page.pageSize];
}

/** Garde en mémoire les images voisines déjà décodées : passer à la suivante est immédiat. */
const preloaded = new Map<number, HTMLImageElement>();
function preload(items: MediaItem[]) {
  const keep = new Set(items.map((i) => i.id));
  for (const id of preloaded.keys()) if (!keep.has(id)) preloaded.delete(id);
  for (const item of items) {
    if (item.kind !== "image" || preloaded.has(item.id)) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = mediaUrl(item);
    preloaded.set(item.id, img);
  }
}

function ViewerOverlay({ base }: { base: ListBase }) {
  const index = useViewer((s) => s.index);
  const item = useViewer((s) => s.item);
  const total = useViewer((s) => s.total);
  const show = useViewer((s) => s.show);
  const close = useViewer((s) => s.close);
  const pageAt = usePageAt();
  // Dernière position demandée : un appui rapide sur → enchaîne sans attendre l'affichage.
  const target = useRef(index);

  const isTop = useEscape(true, close);
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

  // Flèches du clavier, sauf pendant la saisie d'un tag ou si une pop-in est ouverte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || !isTop()) return;
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
    };
  }, []);

  if (!item) return null;
  const searchTag = (name: string) => {
    useSearch.getState().setTerms([name]);
    useViewer.setState({ open: false, item: null, base: null }); // nouvelle recherche : page 1
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
        <MediaStage key={item.id} item={item} onClose={close} />
        <button
          type="button"
          data-zone="visionneuse.fermer"
          onClick={close}
          aria-label="Fermer (Échap)"
          className="absolute top-4 right-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/85"
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
      <InfoBar item={item} onSearch={searchTag} />
    </div>
  );
}

export function Viewer() {
  const open = useViewer((s) => s.open);
  const base = useViewer((s) => s.base);
  if (!open || !base) return null;
  return <ViewerOverlay base={base} />;
}
