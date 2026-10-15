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
// - Sous la barre de titre MyBoard (NAV-04), qui reste visible ; en plein écran, la mise en page
//   ne bascule qu'une fois la fenêtre à la taille de l'écran (VIEW-34, stores/viewer).
// - Flèches précédent / suivant ancrées à leur place « barre du bas d'une ligne de tags »
//   (VIEW-38) ; barre du bas dépliée par-dessus le média : flèches, bouton plein écran et barre
//   de lecture glissent avec elle s'ils sont atteints (VIEW-39, BottomPanel).
// - Ouverture : fond noir, barre du bas et boutons tout de suite ; seul le média apparaît en
//   fondu (VIEW-41).

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { MediaItem } from "@/lib/api";
import { hasModalLayer, useEscape } from "@/lib/escape";
import { scroller } from "@/lib/scroller";
import { cn } from "@/lib/utils";
import { useSearch } from "@/stores/search";
import { useViewer, type ListBase } from "@/stores/viewer";
import { BottomPanel, type PanelMetrics } from "./BottomPanel";
import { FullscreenButton } from "./FullscreenButton";
import { MediaStage } from "./MediaStage";
import { NotesButton } from "./NotesButton";
import { isTyping, itemAt, usePageAt, usePreload } from "./navigation";
import { removePrintHolder } from "./printMedia";
import { useBottomBarVisible, useHeight, useIdle, useTypingIn } from "./useBottomBar";
import { idleClass, ViewerChrome } from "./viewerChrome";

const NAV_BUTTON =
  "absolute z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-md bg-black/60 text-white transition hover:bg-black/85";
const ROUND_BUTTON = "absolute z-20 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/85";
/** Écart entre le bas de la scène (ou le haut de la barre du bas, en plein écran) et le bouton
 *  plein écran des images ; aussi l'écart gardé entre les flèches et la barre dépliée. */
const FLOAT_GAP = 16;
/** Demi-hauteur des flèches (h-12) et du bouton rond (h-10). */
const ARROW_HALF = 24;
const ROUND_HALF = 20;
/** Écart minimal entre le bouton plein écran qui monte et la flèche droite : en deçà, le bouton
 *  se range à gauche de la flèche (VIEW-39). */
const DOCK_GAP = 8;
/** Glissement des boutons, au même rythme que le dépliage de la barre (BottomPanel) ; garde les
 *  fondus habituels (survol, masquage VIEW-33). */
const SLIDE = "transform 200ms ease-out, opacity 150ms ease, background-color 150ms ease";

function ViewerOverlay({ base }: { base: ListBase }) {
  const index = useViewer((s) => s.index);
  const item = useViewer((s) => s.item);
  const total = useViewer((s) => s.total);
  // Demandé (touche F, bouton, Échap) / appliqué à la fenêtre (mise en page, VIEW-34).
  const fullscreen = useViewer((s) => s.fullscreen);
  const shown = useViewer((s) => s.fullscreenShown);
  const screenGap = useViewer((s) => s.screenGap);
  const hasError = useViewer((s) => s.error !== null);
  const copied = useViewer((s) => s.copied !== null);
  const { show, close, forward, canForward, setFullscreen, closeForSearch } = useViewer.getState();
  const pageAt = usePageAt();
  const preload = usePreload();
  const rootRef = useRef<HTMLDivElement>(null);
  const viewerHeight = useHeight(rootRef);
  const barRef = useRef<HTMLDivElement>(null);
  const barVisible = useBottomBarVisible(barRef, shown);
  const [panel, setPanel] = useState<PanelMetrics>({ rise: 0, oneLine: 0, anchor: 0, height: 0 });
  const barHeight = panel.height;
  const idle = useIdle(shown && item?.kind === "video");
  // Plein écran : barre du bas affichée (souris proche, message d'erreur, « Copié » d'un
  // raccourci VIEW-35, ou saisie d'un tag ; un bouton cliqué ne compte pas, VIEW-43).
  const typing = useTypingIn(barRef);
  const barShown = barVisible || hasError || copied || typing;
  // Barre dépliée (VIEW-39) : de combien elle monte au-dessus de sa place, si elle est visible.
  const rise = !shown || barShown ? panel.rise : 0;
  // Commandes flottantes (barre de lecture, bouton plein écran des images) : posées comme si la
  // barre du bas repliée était la plus épaisse (3 lignes de tags + « Afficher plus ») : elles ne
  // bougent plus d'un média à l'autre (VIEW-42). En plein écran, la barre du bas passe par-dessus
  // la scène et la barre des tâches disparaît : elles remontent d'autant pour ne pas bouger à
  // l'écran (VIEW-32).
  const anchorBar = Math.max(panel.anchor, barHeight);
  const bottomInset = shown ? anchorBar + screenGap : anchorBar - barHeight;
  // Elles glissent si la barre dépliée les atteint, au-delà de l'avance qu'elles ont déjà sur le
  // bord haut de la barre repliée.
  const lift = Math.max(0, rise - (bottomInset - (shown ? barHeight : 0)));
  const chrome = { bottomInset, idle, lift };
  // Flèches (VIEW-38) : centrées comme si la barre du bas n'avait qu'une ligne de tags (plein
  // écran : centre de l'écran) ; elles montent si la barre dépliée arrive à leur hauteur. Arrondi
  // au pixel : à un demi-pixel, la flèche est calée sur un pixel entier mais le bouton rond rangé à
  // côté non, d'où 3 px d'écart en haut et 4 en bas (mesuré, VIEW-39).
  const arrowCenter = Math.round(shown || !panel.oneLine ? (viewerHeight - (shown ? 0 : barHeight)) / 2 : (viewerHeight - panel.oneLine) / 2);
  const arrowLift = Math.max(0, arrowCenter + ARROW_HALF + FLOAT_GAP - (viewerHeight - barHeight - rise));
  const arrowStyle = { top: arrowCenter, transform: `translateY(${-arrowLift}px)`, transition: SLIDE };
  // Bouton plein écran des images : s'il monterait à moins de DOCK_GAP de la flèche droite, il se
  // range à sa gauche, à sa hauteur, et la suit si elle monte (VIEW-39). Les deux ont le même
  // centre horizontal : le décalage vaut demi-flèche + écart + demi-bouton.
  const roundCenter = viewerHeight - (shown ? 0 : barHeight) - chrome.bottomInset - FLOAT_GAP - ROUND_HALF;
  const arrowY = arrowCenter - arrowLift;
  const docked = viewerHeight > 0 && index < total - 1 && roundCenter - lift - ROUND_HALF < arrowY + ARROW_HALF + DOCK_GAP;
  const roundShift = docked
    ? `translate(${-(ARROW_HALF + FLOAT_GAP + ROUND_HALF)}px, ${arrowY - roundCenter}px)`
    : `translateY(${-lift}px)`;
  // Dernière position demandée : un appui rapide sur → enchaîne sans attendre l'affichage.
  const target = useRef(index);

  useEscape(true, close, { onForward: forward, canForward });
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
    // `pageAt` et `preload` sont recréées à chaque affichage mais ne dépendent que du cache partagé.
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

  // La page derrière ne défile plus (VIEW-06), même au clavier. La zone qui défile (NAV-04) est
  // sous la visionneuse : sa barre de défilement est recouverte, la place reste réservée et la
  // grille derrière ne bouge pas.
  useEffect(() => {
    const area = scroller();
    const previous = area.style.overflow;
    area.style.overflow = "hidden";
    return () => {
      area.style.overflow = previous;
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
      ref={rootRef}
      data-zone="visionneuse"
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse"
      // Sous la barre de titre MyBoard (NAV-04), sauf en plein écran où elle est cachée.
      className={cn(
        "fixed inset-x-0 bottom-0 z-[100] flex flex-col bg-black/95",
        shown ? "top-0" : "top-[var(--titlebar-h)]",
        idle && "cursor-none",
      )}
    >
      <div data-zone="visionneuse.scene" className="relative min-h-0 flex-1 overflow-hidden bg-(--viewer-bg)">
        <ViewerChrome.Provider value={chrome}>
          {/* Ouverture (VIEW-41) : seul le média apparaît en fondu avec un léger zoom ; le fond
              noir, la barre du bas et les boutons sont là dès la première image (la galerie ne
              se voit plus derrière). Ce cadre n'est pas recréé d'un média à l'autre : l'effet ne
              joue qu'à l'ouverture. */}
          <div className="mb-zoom-in absolute inset-0">
            <MediaStage key={item.id} item={item} onClose={close} />
          </div>
          <NotesButton key={`note-${item.id}`} mediaId={item.id} />
        </ViewerChrome.Provider>
        {/* Médias sans barre de lecture : bouton rond en bas à droite, toujours au même endroit
            (en plein écran, juste au-dessus de la barre du bas qui ne le recouvre jamais). */}
        {item.kind !== "video" && (
          <FullscreenButton
            ring
            className={cn(ROUND_BUTTON, "right-4")}
            style={{ bottom: chrome.bottomInset + FLOAT_GAP, transform: roundShift, transition: SLIDE }}
          />
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
            style={arrowStyle}
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
            style={arrowStyle}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
      {/* Plein écran : la barre passe par-dessus le média, visible selon `barShown`. */}
      <BottomPanel
        item={item}
        onSearch={searchTag}
        barRef={barRef}
        onMetrics={setPanel}
        className={cn(
          shown && "absolute inset-x-0 bottom-0 z-30 transition-opacity duration-200",
          shown && !barShown && "pointer-events-none opacity-0",
        )}
      />
    </div>
  );
}

export function Viewer() {
  const open = useViewer((s) => s.open);
  const base = useViewer((s) => s.base);
  if (!open || !base) return null;
  return <ViewerOverlay base={base} />;
}
