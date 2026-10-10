"use client";

// MyBoard — Visionneuse plein écran (Lightbox) — Phase 3 + P2 (refonte zoom wikifeet).
//
// Reproduction fidèle du système AnchorZoom de wikifeet (wfc.js) :
//
// ÉTAT GLOBAL (mirroir des useState via *Ref pour accès synchrone dans rAF) :
//   zoom    = gscale (échelle absolue ; 1 = taille réelle 1:1, minScale = fit)
//   tx/ty   = gpos[0..1] (translation px par rapport au centre du stage)
//   minScale = calculé dynamiquement (recalc sur img.onLoad + window.resize)
//
// CALCUL MINSCALE (wikifeet) :
//   wscale = min(stageW/naturalW, stageH/naturalH)
//   minscale = wscale > 1 ? 1 : wscale
//   (si image plus petite que le stage → minscale=1 = taille réelle)
//
// MAXSCALE = 2 (maxscale par défaut wikifeet ; mode comparaison = 5, hors périmètre).
//
// ZOOM MOLETTE (wikifeet) :
//   nextscale = currentScale + wheelDeltaY/600   (wheelDeltaY > 0 = zoom in)
//   clamp [minscale, 2]
//   Anchor au curseur :  ax = (cx - tx)/scale ;  tx_new = cx - ax*nextscale
//     où cx = clientX - stage.center.x  (curseur relatif au centre du stage)
//   rAF batch : accumulation des wheelDelta + position curseur tant qu'un frame
//   est en attente, pour éviter le lag quand l'utilisateur scroll vite.
//
// CLIC SUR IMAGE (sans drag < 3px) — toggle minscale <-> 1 (taille réelle) :
//   minscale → 1   : nextscale=1, tx = -cx/minscale, ty = -cy/minscale
//                    (recentre l'image sur le point cliqué : le pixel image
//                     sous le curseur devient le centre du viewport)
//   zoomé → minscale : tx=0, ty=0 (recentré)
//
// CLIC SUR FOND GRIS (hors image) :
//   |cx| > 0.5*pw*minscale || |cy| > 0.5*ph*minscale → closeAndSync()
//
// PAN (drag bouton gauche, uniquement si scale > minscale) :
//   wikifeet: tx = old_tx + movementX, ty = old_ty + movementY
//   (movementX/Y = delta depuis le dernier pointermove — équivalent à
//    baseTx + (currentX - startX) mais reflète exactement le code wfc.js)
//
// CLAMP PARTIAL-AXIS (point 5.5) :
//   - Image plus petite que le viewport sur un axe (rendered ≤ viewport) →
//     tx/ty = 0 sur cet axe (image centrée, pas de pan possible).
//   - Image plus grande sur un axe (rendered > viewport) → tx/ty clampeé à
//     [-max, +max] où max = (rendered - viewport)/2. Le zoom/pan suit le
//     curseur sur cet axe, mais empêche de sortir de l'image (point 10).
//   - Au dézoom, l'axe qui « rentre » dans le viewport se recentre en premier.
//
// DÉZOOM AU MINSCALE : tx=0, ty=0 (recentrer), gzoom=null.
//
// ANIMATION : transition CSS 200ms UNIQUEMENT pour le toggle click (pas pour
// wheel/pan, sinon lag). Fade-in opacity 150ms au chargement de l'image.
// - Navigation cross-page :
//     * v-13 : goPrev/goNext fetchent le média voisin via /api/media/:id si
//             l'id n'est pas dans lightbox.items (page courante) et l'ajoutent
//             à items. Permet de naviguer image par image à travers toutes les
//             pages sans fermer la lightbox.
//     * v-14 : à la fermeture, si l'offset du média courant indique qu'il est
//             sur une page différente de la page d'origine, router.push vers
//             /?tags=...&page=N. Calcul via /api/media/:id/neighbors qui
//             renvoie désormais {prev, next, offset, total}.
// - Récupère prev/next/offset/total via /api/media/:id/neighbors?tags=...
// - Barre d'actions :
//     * v-16 : input d'ajout de tag déplacé en ligne 1 (à droite, avant les
//             boutons Favori/Explorer/Supprimer). Ligne 2 = pills de tags
//             existants (cliquables → recherche).
//     * v-12 : dropdown de l'autocomplétion au-dessus de l'input (prop
//             dropdownPosition="top") pour ne pas sortir de l'écran.
//     * v-11 : si le tag tapé n'existe pas en DB, ouverture d'un Dialog
//             shadcn proposant de choisir une catégorie avant de créer.
//     * v-10 : suppression via AlertDialog shadcn (au lieu de confirm() natif).
// - Échap + bouton 4 souris ferment la lightbox (Phase 1).
// - v-15 : scroll du body verrouillé pendant l'ouverture (Phase 1).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Star,
  FolderOpen,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBoardUI } from "./store";
import { TagAutocomplete } from "./TagAutocomplete";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_PILL,
  CATEGORY_TEXT,
  PAGE_SIZE,
  displayTag,
  formatBytes,
  formatDuration,
  normalizeTagName,
  pageSizeForDensity,
  searchHref,
} from "@/lib/shared";
import type { TagCategory } from "@/lib/shared";
import type { MediaDetail, MediaListItem, TagDTO } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

// P2 (refonte zoom wikifeet) — constantes.
// - MIN_WHEEL_DIVISOR : wikifeet utilise `nextscale = currentScale + wheelDeltaY/600`.
//   Avec un deltaY standard ~100 par notch, ça fait ~0.17 par tick (wikifeet
//   utilisait wheelDeltaY ~120 → ~0.2 par tick, équivalent).
// - MAX_ZOOM = 4 (modifUIUX3.txt : augmenté de 2 à 4 pour permettre plus de zoom).
// - CLICK_DRAG_THRESHOLD_PX : seuil pour distinguer clic vs drag (3px comme wikifeet).
// - ANIM_DURATION_MS : durée de la transition CSS pour le toggle click (pas pour wheel/pan).
const MIN_WHEEL_DIVISOR = 600;
const MAX_ZOOM = 4;
const CLICK_DRAG_THRESHOLD_PX = 3;
const ANIM_DURATION_MS = 200;

// Calcule minScale selon wikifeet : `wscale = min(vw/pw, vh/ph); minscale = wscale > 1 ? 1 : wscale`.
// Si l'image est plus petite que le viewport → minScale = 1 (taille réelle).
// Sinon → minScale = wscale (fit).
function computeMinScale(pw: number, ph: number, vw: number, vh: number): number {
  if (!pw || !ph || !vw || !vh) return 1;
  const wscale = Math.min(vw / pw, vh / ph);
  return wscale > 1 ? 1 : wscale;
}

// Clamp partial-axis (5.5) : si l'image dépasse le viewport sur cet axe
// (rendered > viewport), on clamp tx dans [-max, +max] où max = (rendered - viewport)/2.
// Sinon (image plus petite que le viewport sur cet axe) → on force tx = 0 (centré).
function clampPartialAxis(tx: number, rendered: number, viewport: number): number {
  if (rendered <= viewport) return 0;
  const max = (rendered - viewport) / 2;
  return Math.max(-max, Math.min(max, tx));
}

export function LightboxViewer() {
  const router = useRouter();
  const { toast } = useToast();
  const lightbox = useBoardUI((s) => s.lightbox);
  const closeLightbox = useBoardUI((s) => s.closeLightbox);
  const setLightboxIndex = useBoardUI((s) => s.setLightboxIndex);
  const openLightbox = useBoardUI((s) => s.openLightbox);

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [neighbors, setNeighbors] = useState<{
    prev: number | null;
    next: number | null;
    offset: number | null;
    total: number | null;
  }>({ prev: null, next: null, offset: null, total: null });

  const [newTag, setNewTag] = useState("");
  const [tagBusy, setTagBusy] = useState(false);

  // v-11 : pop-in création de tag
  const [createTagDialog, setCreateTagDialog] = useState<{ tag: string } | null>(
    null
  );
  const [newTagCategory, setNewTagCategory] = useState<TagCategory>("general");
  const [createTagBusy, setCreateTagBusy] = useState(false);

  // v-10 : pop-in suppression (AlertDialog)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [keepFiles, setKeepFiles] = useState(false); // P3.3 : conserver fichiers

  // Zoom/pan (image uniquement) — système wikifeet (P2).
  // `zoom` est le gscale (échelle absolue, 1 = taille réelle 1:1, minScale = fit).
  // `tx`/`ty` sont la translation en px par rapport au centre du stage.
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  // `minScale` = scale minimum calculé pour fitter l'image dans le stage.
  // Recalculé sur img.onLoad et window.resize.
  const [minScale, setMinScale] = useState(1);
  // `imgLoaded` : passe à true sur img.onLoad (évite le flash de l'image non-zoomée).
  const [imgLoaded, setImgLoaded] = useState(false);
  // `animateTransform` : active la transition CSS pour le toggle click (pas pour wheel/pan).
  const [animateTransform, setAnimateTransform] = useState(false);

  // Refs miroir pour les lire synchroniquement dans les callbacks rAF
  // (sinon stale closures sur les wheel events).
  const zoomRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const minScaleRef = useRef(1);
  // Dimensions naturelles de l'image + taille courante du stage.
  const imgNaturalRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const stageSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // État drag : pour distinguer clic vs drag (seuil 3px) et capturer le pointer.
  // Pas besoin de baseTx/baseTy : le pan utilise movementX/Y cumulés sur txRef.
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  // rAF id pour lisser le zoom molette. Accumule aussi wheelDelta et position
  // curseur pour batcher plusieurs wheel events dans le même frame.
  const zoomRafRef = useRef<number | null>(null);
  const wheelAccumRef = useRef(0);
  const cursorAccumRef = useRef<{ cx: number; cy: number }>({ cx: 0, cy: 0 });
  // Timeout pour désactiver `animateTransform` après le toggle click.
  const animTimeoutRef = useRef<number | null>(null);

  // v-14 : pour sync page à la fermeture. Mémorise l'URL d'ouverture + l'offset
  // courant du média visionné.
  const originalUrlRef = useRef<string>("");
  const currentOffsetRef = useRef<number | null>(null);

  const item: MediaListItem | null = lightbox
    ? lightbox.items[lightbox.index] ?? null
    : null;

  // Charge le détail du média courant + calcule les voisins
  const loadCurrent = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    setDetail(null);
    setZoom(1);
    setTx(0);
    setTy(0);
    setMinScale(1);
    setImgLoaded(false);
    setAnimateTransform(false);
    zoomRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    minScaleRef.current = 1;
    imgNaturalRef.current = { w: 0, h: 0 };
    stageSizeRef.current = { w: 0, h: 0 };
    wheelAccumRef.current = 0;
    cursorAccumRef.current = { cx: 0, cy: 0 };
    // Annule tout rAF de zoom en attente (changement d'image)
    if (zoomRafRef.current !== null) {
      cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = null;
    }
    // Annule le timeout d'animation du toggle click
    if (animTimeoutRef.current !== null) {
      clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = null;
    }
    try {
      const [dRes, nRes] = await Promise.all([
        fetch(`/api/media/${item.id}`),
        fetch(
          `/api/media/${item.id}/neighbors?tags=${encodeURIComponent(
            lightbox?.query ?? ""
          )}`
        ),
      ]);
      if (dRes.ok) setDetail((await dRes.json()) as MediaDetail);
      if (nRes.ok) {
        const nj = (await nRes.json()) as {
          prev: number | null;
          next: number | null;
          offset: number | null;
          total: number | null;
        };
        setNeighbors(nj);
        currentOffsetRef.current = nj.offset;
      } else {
        setNeighbors({ prev: null, next: null, offset: null, total: null });
        currentOffsetRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  }, [item, lightbox?.query]);

  useEffect(() => {
    if (lightbox?.open) {
      // v-14 : capture l'URL d'origine à l'ouverture (une seule fois)
      if (!originalUrlRef.current) {
        originalUrlRef.current =
          window.location.pathname + window.location.search;
      }
      loadCurrent();
    } else {
      // Reset à la fermeture (au cas où le nettoyage n'a pas tourné)
      originalUrlRef.current = "";
      currentOffsetRef.current = null;
    }
  }, [lightbox?.open, loadCurrent]);

  // v-14 : ferme la lightbox et navigue vers la page du média courant si elle
  // diffère de la page d'origine. Utilisé par Échap/X/bouton 4 souris.
  const closeAndSync = useCallback(() => {
    const origUrl = originalUrlRef.current;
    const offset = currentOffsetRef.current;
    originalUrlRef.current = "";
    currentOffsetRef.current = null;
    closeLightbox();
    if (origUrl && offset !== null && offset >= 0) {
      try {
        const origPage = parsePageFromUrl(origUrl);
        // P1.5 fix : utilise le pageSize DYNAMIQUE (selon densité dans l'URL)
        // au lieu du PAGE_SIZE constant. Sinon le calcul de page est faux
        // quand la densité ≠ 7.
        const density = parseDensityFromUrl(origUrl);
        const pageSize = pageSizeForDensity(density);
        const currentPage = Math.floor(offset / pageSize) + 1;
        if (origPage !== currentPage) {
          const tags = parseTagsFromUrl(origUrl);
          // Préserve la densité dans l'URL de navigation
          const href = density !== 7
            ? searchHref(tags, currentPage) + (searchHref(tags, currentPage).includes("?") ? "&" : "?") + "density=" + density
            : searchHref(tags, currentPage);
          router.push(href);
        }
      } catch {
        /* ignore — on reste sur la page courante */
      }
    }
  }, [closeLightbox, router]);

  // Ferme sans sync (pour les cas où une autre navigation a déjà eu lieu :
  // clic sur un tag pill → Link navigue, suppression → router.refresh).
  const closePlain = useCallback(() => {
    originalUrlRef.current = "";
    currentOffsetRef.current = null;
    closeLightbox();
  }, [closeLightbox]);

  // v-15 : verrouille le scroll du body quand la lightbox est ouverte
  useEffect(() => {
    if (!lightbox?.open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox?.open]);

  // P2 : recalcule minScale sur window resize. Si l'utilisateur était à minScale
  // (fit), on suit le nouveau minScale et on recentre ; sinon on conserve le
  // zoom mais on re-clampe tx/ty aux nouvelles bornes du stage.
  useEffect(() => {
    if (!lightbox?.open) return;
    function onResize() {
      const stage = stageRef.current;
      const img = imgRef.current;
      if (!stage || !img) return;
      const stageRect = stage.getBoundingClientRect();
      const pw = img.naturalWidth;
      const ph = img.naturalHeight;
      if (!pw || !ph || !stageRect.width || !stageRect.height) return;
      imgNaturalRef.current = { w: pw, h: ph };
      stageSizeRef.current = { w: stageRect.width, h: stageRect.height };
      const newMin = computeMinScale(pw, ph, stageRect.width, stageRect.height);
      minScaleRef.current = newMin;
      setMinScale(newMin);
      const s = zoomRef.current;
      if (s <= newMin + 0.0001) {
        // Était à minScale → suit le nouveau minScale, recentre.
        commitZoom(newMin, 0, 0, false);
      } else {
        // Était zoomé → conserve le zoom, re-clampe tx/ty aux nouvelles bornes.
        const newTx = clampPartialAxis(txRef.current, pw * s, stageRect.width);
        const newTy = clampPartialAxis(tyRef.current, ph * s, stageRect.height);
        commitZoom(s, newTx, newTy, false);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [lightbox?.open]);

  // P2 : nettoyage du timeout d'animation au démontage.
  useEffect(() => {
    return () => {
      if (animTimeoutRef.current !== null) {
        clearTimeout(animTimeoutRef.current);
        animTimeoutRef.current = null;
      }
    };
  }, []);

  // ---- Helpers zoom/pan (wikifeet P2) ----

  // Commit une nouvelle transformation zoom/tx/ty avec ou sans animation.
  // `animate=true` → transition CSS 200ms (pour le toggle click).
  // `animate=false` → instantané (pour wheel/pan, sinon lag).
  function commitZoom(z: number, x: number, y: number, animate: boolean) {
    zoomRef.current = z;
    txRef.current = x;
    tyRef.current = y;
    setZoom(z);
    setTx(x);
    setTy(y);
    if (animTimeoutRef.current !== null) {
      clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = null;
    }
    if (animate) {
      setAnimateTransform(true);
      animTimeoutRef.current = window.setTimeout(
        () => setAnimateTransform(false),
        ANIM_DURATION_MS
      );
    } else {
      setAnimateTransform(false);
    }
  }

  // Handler img.onLoad : calcule minScale puis initialise zoom=minScale (fit).
  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const stage = stageRef.current;
    const stageRect = stage?.getBoundingClientRect();
    const pw = img.naturalWidth;
    const ph = img.naturalHeight;
    if (!pw || !ph || !stageRect) {
      setImgLoaded(true);
      return;
    }
    imgNaturalRef.current = { w: pw, h: ph };
    stageSizeRef.current = { w: stageRect.width, h: stageRect.height };
    const newMin = computeMinScale(pw, ph, stageRect.width, stageRect.height);
    minScaleRef.current = newMin;
    setMinScale(newMin);
    // Initialise le zoom à minScale (image fittée, centrée).
    zoomRef.current = newMin;
    txRef.current = 0;
    tyRef.current = 0;
    setZoom(newMin);
    setTx(0);
    setTy(0);
    setImgLoaded(true);
  }

  // Raccourcis clavier : Échap ferme, ←/→ navigue
  useEffect(() => {
    if (!lightbox?.open) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeAndSync();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        void goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        void goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox?.open, neighbors, closeAndSync]);

  // v-4 / P1.3 : bouton 4 souris (back/forward) → ferme la lightbox.
  // ATTENTION : on n'active ce listener QUE quand la lightbox est ouverte.
  // Si elle est fermée, le bouton 4 garde son comportement natif (retour arrière).
  // On intercepte sur mousedown ET mouseup pour empêcher le navigateur de faire
  // son retour arrière natif avant qu'on ait eu le temps de fermer la lightbox.
  useEffect(() => {
    if (!lightbox?.open) return;
    function onMouseDown(e: MouseEvent) {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    function onMouseUp(e: MouseEvent) {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
        closeAndSync();
      }
    }
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mouseup", onMouseUp, true);
    return () => {
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mouseup", onMouseUp, true);
    };
  }, [lightbox?.open, closeAndSync]);

  // v-13 : navigation cross-page. Si l'id voisin n'est pas dans items, fetch
  // le média voisin via /api/media/:id et ajoute-le à items.
  async function navigateTo(targetId: number | null) {
    if (!lightbox || targetId === null) return;
    const idx = lightbox.items.findIndex((i) => i.id === targetId);
    if (idx >= 0) {
      setLightboxIndex(idx);
      return;
    }
    // Cross-page : fetch le média voisin et ajoute-le à items
    try {
      const res = await fetch(`/api/media/${targetId}`);
      if (!res.ok) return;
      const neighbor = (await res.json()) as MediaDetail;
      // Pre-set detail pour éviter le flash "loading" (loadCurrent va quand
      // même re-fetcher pour la cohérence, mais le spinner ne s'affichera pas).
      setDetail(neighbor);
      const newItems = [...lightbox.items, neighbor];
      openLightbox(newItems, newItems.length - 1, lightbox.query);
    } catch {
      /* ignore */
    }
  }
  function goPrev() {
    return navigateTo(neighbors.prev);
  }
  function goNext() {
    return navigateTo(neighbors.next);
  }

  // ---- Zoom via molette (wikifeet P2 : continu, anchor curseur, partial-axis) ----
  function onWheel(e: React.WheelEvent) {
    if (!item || item.kind !== "image") return;
    // Ignore si l'image n'est pas encore chargée (pas de dimensions naturelles).
    if (imgNaturalRef.current.w === 0 || imgNaturalRef.current.h === 0) return;
    e.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    // Curseur relatif au centre du stage (wikifeet: cx = clientX - ww/2).
    const cx = e.clientX - (stageRect.left + stageRect.width / 2);
    const cy = e.clientY - (stageRect.top + stageRect.height / 2);
    // wikifeet: `nextscale = currentScale + wheelDeltaY/600`. wheelDeltaY est
    // positif pour scroll-up (zoom in) — convention legacy. deltaY moderne est
    // l'inverse, donc on inverse le signe.
    const wheelDelta = -e.deltaY;

    // Accumule les deltas et la position curseur pour le batch rAF.
    wheelAccumRef.current += wheelDelta;
    cursorAccumRef.current = { cx, cy };

    // Si un rAF est déjà schedulé, on attend (batch).
    if (zoomRafRef.current !== null) return;
    zoomRafRef.current = requestAnimationFrame(() => {
      zoomRafRef.current = null;
      const delta = wheelAccumRef.current;
      wheelAccumRef.current = 0;
      const { cx, cy } = cursorAccumRef.current;

      const sOld = zoomRef.current;
      const minS = minScaleRef.current;
      // wikifeet: nextscale = current + wheelDelta/600, clamp [minscale, 2].
      let sNew = sOld + delta / MIN_WHEEL_DIVISOR;
      if (sNew < minS) sNew = minS;
      if (sNew > MAX_ZOOM) sNew = MAX_ZOOM;
      if (Math.abs(sNew - sOld) < 0.0001) return; // déjà au min/max

      let newTx: number;
      let newTy: number;
      if (Math.abs(sNew - minS) < 0.0001) {
        // Retour à minScale → recentrer (wikifeet: tx=0, ty=0, gzoom=null).
        newTx = 0;
        newTy = 0;
      } else {
        // Anchor au curseur (wikifeet: ax = (cx - tx)/scale; tx_new = cx - ax*nextscale).
        const ax = (cx - txRef.current) / sOld;
        const ay = (cy - tyRef.current) / sOld;
        newTx = cx - ax * sNew;
        newTy = cy - ay * sNew;
        // Clamp partial-axis (5.5) + empêche de sortir de l'image (10).
        const { w: pw, h: ph } = imgNaturalRef.current;
        const { w: vw, h: vh } = stageSizeRef.current;
        if (pw > 0 && ph > 0 && vw > 0 && vh > 0) {
          newTx = clampPartialAxis(newTx, pw * sNew, vw);
          newTy = clampPartialAxis(newTy, ph * sNew, vh);
        }
      }
      commitZoom(sNew, newTx, newTy, false);
    });
  }

  // ---- Pan via pointer events (wikifeet P2 : que si scale > minScale) ----
  function onPointerDown(e: React.PointerEvent) {
    if (!item || item.kind !== "image") return;
    // Ignore les clics sur boutons (close, nav, etc.) — laisse leur onClick fire.
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    // Toujours enregistrer la position de départ pour distinguer clic/drag,
    // même à minScale (où on ne capture pas le pointer — pas de drag possible).
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    if (zoomRef.current > minScaleRef.current + 0.0001) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      stageRef.current?.classList.add("mb-grabbing");
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || dragRef.current.id !== e.pointerId) return;
    // Détecte clic vs drag (seuil 3px). startX/Y servent uniquement à ça ;
    // le delta de pan utilise movementX/Y (cf. ci-dessous).
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX) {
      dragRef.current.moved = true;
    }
    // Pan uniquement si zoom > minScale (wikifeet: gpan = 1 si scale > minscale).
    if (zoomRef.current <= minScaleRef.current + 0.0001) return;
    if (!dragRef.current.moved) return;
    // wikifeet (wfc.js mousemove) :
    //   tx = cx - ax * nextscale + touch.movementX
    // Avec nextscale === currentScale (pas de zoom pendant le pan), cette
    // formule se simplifie en  tx = old_tx + movementX. On l'applique
    // directement : movementX/Y sont les deltas depuis le dernier pointermove.
    let newTx = txRef.current + e.movementX;
    let newTy = tyRef.current + e.movementY;
    // Clamp partial-axis (5.5) + empêche de sortir de l'image (10).
    const { w: pw, h: ph } = imgNaturalRef.current;
    const { w: vw, h: vh } = stageSizeRef.current;
    const s = zoomRef.current;
    if (pw > 0 && ph > 0 && vw > 0 && vh > 0) {
      newTx = clampPartialAxis(newTx, pw * s, vw);
      newTy = clampPartialAxis(newTy, ph * s, vh);
    }
    // Pas d'animation pendant le pan (sinon lag).
    if (animTimeoutRef.current !== null) {
      clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = null;
    }
    setAnimateTransform(false);
    txRef.current = newTx;
    tyRef.current = newTy;
    setTx(newTx);
    setTy(newTy);
  }
  function onPointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (drag?.id !== e.pointerId) return;
    dragRef.current = null;
    stageRef.current?.classList.remove("mb-grabbing");
    // Si drag (pan) → rien d'autre à faire.
    if (drag.moved) return;

    // Ignore les clics sur boutons (close, nav, etc.) — laisse leur onClick fire.
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;

    // Clic (pas de drag). Calcule la position relative au centre du stage.
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const cx = e.clientX - (stageRect.left + stageRect.width / 2);
    const cy = e.clientY - (stageRect.top + stageRect.height / 2);
    const { w: pw, h: ph } = imgNaturalRef.current;
    const minS = minScaleRef.current;

    // 5. Clic sur fond gris (hors image) → fermer la visionneuse.
    // wikifeet: |cx| > 0.5 * pw * minscale || |cy| > 0.5 * ph * minscale → close.
    if (
      pw > 0 &&
      ph > 0 &&
      (Math.abs(cx) > 0.5 * pw * minS || Math.abs(cy) > 0.5 * ph * minS)
    ) {
      closeAndSync();
      return;
    }

    // 4. Clic sur image → toggle minscale (fit) <-> 1 (taille réelle).
    // wikifeet (wfc.js mouseup sans pan) : nextscale=1, tx=-cx/minscale,
    // ty=-cy/minscale. Le pixel image sous le curseur (cx/minscale en
    // image-space) devient le centre du viewport (position 0 à l'écran après
    // translation). Au second clic → retour à minscale, tx=0, ty=0.
    const sOld = zoomRef.current;
    if (sOld <= minS + 0.0001) {
      // Au minScale → aller à 1 (taille réelle 1:1), recentré sur le clic.
      const sNew = 1;
      if (Math.abs(sNew - minS) < 0.0001) return; // minScale déjà = 1 (image < viewport)
      let newTx = -cx / minS;
      let newTy = -cy / minS;
      // Clamp partial-axis (5.5) : si l'image ne dépasse pas le viewport sur
      // un axe à l'échelle 1 (rendered ≤ viewport), on force tx/ty = 0 sur cet
      // axe (image centrée, pas de pan possible sur cet axe).
      const { w: vw, h: vh } = stageSizeRef.current;
      if (pw > 0 && ph > 0 && vw > 0 && vh > 0) {
        newTx = clampPartialAxis(newTx, pw * sNew, vw);
        newTy = clampPartialAxis(newTy, ph * sNew, vh);
      }
      commitZoom(sNew, newTx, newTy, true);
    } else {
      // Zoomé → retour à minScale, recentré (wikifeet: tx=0, ty=0, gzoom=null).
      commitZoom(minS, 0, 0, true);
    }
  }

  // ---- Actions sur les tags ----
  // v-11 : si le tag existe → ajoute directement, sinon → ouvre pop-in création
  async function addTag() {
    if (!item || !newTag.trim()) return;
    const norm = normalizeTagName(newTag);
    if (!norm) return;

    setTagBusy(true);
    try {
      // Vérifie si le tag existe déjà (autocomplete exact match)
      const checkRes = await fetch(
        `/api/tags/autocomplete?q=${encodeURIComponent(norm)}&limit=50`
      );
      const checkData: { items: TagDTO[] } = checkRes.ok
        ? ((await checkRes.json()) as { items: TagDTO[] })
        : { items: [] };
      const exists = checkData.items.some((t) => t.name === norm);

      if (exists) {
        await postAddTag(norm);
      } else {
        // Ouvre la pop-in de création avec catégorie par défaut "general"
        setNewTagCategory("general");
        setCreateTagDialog({ tag: norm });
      }
    } finally {
      setTagBusy(false);
    }
  }

  async function postAddTag(tag: string, category?: TagCategory) {
    if (!item) return;
    setTagBusy(true);
    try {
      const res = await fetch(`/api/media/${item.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(category ? { tag, category } : { tag }),
      });
      if (res.ok) {
        const data = (await res.json()) as { item: MediaDetail };
        setDetail(data.item);
        setNewTag("");
        toast({
          title: "Tag ajouté",
          description: displayTag(tag),
        });
      } else {
        toast({ title: "Erreur", description: "Impossible d'ajouter le tag" });
      }
    } finally {
      setTagBusy(false);
    }
  }

  // v-11 : validation de la pop-in création
  async function confirmCreateTag() {
    if (!createTagDialog) return;
    setCreateTagBusy(true);
    try {
      await postAddTag(createTagDialog.tag, newTagCategory);
      setCreateTagDialog(null);
    } finally {
      setCreateTagBusy(false);
    }
  }

  async function removeTag(name: string) {
    if (!item) return;
    // Optimistic : on retire localement puis on persiste
    setDetail((d) =>
      d ? { ...d, tags: d.tags.filter((t) => t.name !== name) } : d
    );
    try {
      await fetch(`/api/media/${item.id}/tags/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
    } catch {
      /* ignore — on a déjà retiré localement */
    }
  }

  // ---- Actions barre du bas ----
  async function toggleFavorite() {
    if (!item) return;
    const prev = detail?.favorite ?? false;
    setDetail((d) => (d ? { ...d, favorite: !d.favorite } : d));
    try {
      const res = await fetch(`/api/media/${item.id}/favorite`, {
        method: "POST",
      });
      if (!res.ok) {
        setDetail((d) => (d ? { ...d, favorite: prev } : d));
        return;
      }
      const data = await res.json();
      setDetail((d) => (d ? { ...d, favorite: !!data.favorite } : d));
      window.dispatchEvent(
        new CustomEvent("mb-favorite-toggled", {
          detail: { id: item.id, favorite: data.favorite },
        })
      );
    } catch {
      setDetail((d) => (d ? { ...d, favorite: prev } : d));
    }
  }
  function openInExplorer() {
    if (!item) return;
    fetch(`/api/media/${item.id}/reveal`, { method: "POST" })
      .then((r) => {
        if (!r.ok) throw new Error();
      })
      .catch(() =>
        toast({
          title: "Non disponible",
          description:
            "L'ouverture dans l'explorateur sera disponible dans la version native (Tauri).",
        })
      );
  }

  // v-10 : suppression via AlertDialog. On ouvre la pop-in, l'action confirm
  // exécute le DELETE puis ferme la lightbox (sans sync page, car le média
  // n'existe plus — router.refresh suffit).
  // P3.3 : supporte keepFiles pour conserver les fichiers sur disque.
  async function confirmDeleteMedia() {
    if (!item) return;
    setDeleteBusy(true);
    try {
      const url = keepFiles
        ? `/api/media/${item.id}?keepFiles=true`
        : `/api/media/${item.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        setDeleteDialogOpen(false);
        router.refresh();
        closePlain();
      } else {
        toast({ title: "Erreur", description: "Suppression impossible" });
      }
    } catch {
      toast({ title: "Erreur réseau" });
    } finally {
      setDeleteBusy(false);
      setKeepFiles(false);
    }
  }

  if (!lightbox?.open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 mb-zoom-in"
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse"
    >
      {/* Stage */}
      <div
        ref={stageRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`checker relative flex flex-1 items-center justify-center overflow-hidden ${
          zoom > minScale + 0.0001 ? "mb-grab" : "cursor-zoom-in"
        }`}
      >
        {/* Bouton fermer */}
        <button
          onClick={closeAndSync}
          aria-label="Fermer (Échap)"
          className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Boutons nav latéraux */}
        {neighbors.prev !== null && (
          <button
            onClick={() => void goPrev()}
            aria-label="Précédent (←)"
            className="absolute left-3 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-md bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {neighbors.next !== null && (
          <button
            onClick={() => void goNext()}
            aria-label="Suivant (→)"
            className="absolute right-3 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-md bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Média */}
        {loading ? (
          <div className="text-zinc-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <MediaStage
            item={item}
            zoom={zoom}
            tx={tx}
            ty={ty}
            imgRef={imgRef}
            onImgLoad={onImgLoad}
            imgLoaded={imgLoaded}
            animateTransform={animateTransform}
          />
        )}

        {/* Badge zoom (image) — P2 : affiché quand zoom > minScale (fit) */}
        {item.kind === "image" && zoom > minScale + 0.0001 && (
          <div className="absolute left-4 top-4 z-20 rounded bg-black/60 px-2 py-1 font-mono text-xs text-white backdrop-blur">
            {zoom.toFixed(2)}×
          </div>
        )}
      </div>

      {/* Barre d'actions + infos + tags (v-16 : layout 2 lignes) */}
      <div className="flex flex-col gap-3 border-t border-border bg-card/97 px-4 py-3 backdrop-blur">
        {/* Ligne 1 : infos fichier + input ajout tag + actions (v-16) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p
              className="line-clamp-1 text-sm font-medium text-foreground"
              title={item.originalName}
            >
              {item.originalName}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.width && item.height ? `${item.width}×${item.height} · ` : ""}
              {formatBytes(item.size)}
              {item.duration ? ` · ${formatDuration(item.duration)}` : ""}
              {detail?.importedAt
                ? ` · ${new Date(detail.importedAt).toLocaleDateString("fr-FR")}`
                : ""}
              {detail?.source ? ` · ${detail.source}` : ""}
            </p>
          </div>

          {/* Input ajout tag (v-16 : déplacé en première ligne, à droite) */}
          <div className="relative ml-auto flex items-center gap-1">
            <TagAutocomplete
              value={newTag}
              onChange={setNewTag}
              onSubmit={addTag}
              placeholder="Ajouter un tag…"
              dropdownPosition="top"
              className="h-8 w-40 rounded-md border-border bg-secondary px-2 py-1 text-xs sm:w-56"
            />
            <button
              onClick={addTag}
              disabled={tagBusy || !newTag.trim()}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-secondary text-muted-foreground transition hover:border-[#d9a94e]/50 hover:text-[#d9a94e] disabled:opacity-40"
              aria-label="Ajouter le tag"
            >
              {tagBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFavorite}
              className={
                detail?.favorite
                  ? "text-[#d9a94e] hover:bg-[#d9a94e]/10"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }
              title="Ajouter aux favoris"
            >
              <Star
                className={`h-4 w-4 ${detail?.favorite ? "fill-[#d9a94e]" : ""}`}
              />
              <span className="hidden sm:inline">
                {detail?.favorite ? "Favori" : "Ajouter aux favoris"}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={openInExplorer}
              className="text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Ouvrir dans l'explorateur"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Explorer</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Supprimer</span>
            </Button>
          </div>
        </div>

        {/* Ligne 2 : tags existants en pills cliquables (v-16) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(detail?.tags ?? item.tags).map((t) => (
            <span
              key={t.id}
              className={`group inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
                CATEGORY_PILL[t.category] ??
                "border-border bg-secondary text-muted-foreground"
              }`}
              title={t.name}
            >
              <Link
                href={searchHref(t.name)}
                onClick={closePlain}
                className={CATEGORY_TEXT[t.category] ?? ""}
              >
                {displayTag(t.name)}
              </Link>
              <button
                onClick={() => removeTag(t.name)}
                className="text-muted-foreground/60 hover:text-rose-300"
                aria-label={`Retirer ${t.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {(detail?.tags ?? item.tags).length === 0 && (
            <span className="text-xs italic text-muted-foreground">
              Aucun tag. Utilise le champ ci-dessus pour en ajouter.
            </span>
          )}
        </div>
      </div>

      {/* v-10 : AlertDialog confirmation suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le média</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer définitivement « {item.originalName} » ? Le fichier
              original sera conservé sur disque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* P3.3 : checkbox "conserver le fichier sur le disque" */}
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 p-3">
            <Checkbox
              id="keep-files-single"
              checked={keepFiles}
              onCheckedChange={(c) => setKeepFiles(c === true)}
              className="data-[state=checked]:border-[#d9a94e] data-[state=checked]:bg-[#d9a94e] data-[state=checked]:text-[#1a1408]"
            />
            <div className="min-w-0 flex-1">
              <Label htmlFor="keep-files-single" className="cursor-pointer text-xs font-medium text-foreground">
                Conserver le fichier sur le disque
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Supprime le média de la bibliothèque mais garde le fichier dans library/originals/
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Annuler</AlertDialogCancel>
            <Button
              onClick={confirmDeleteMedia}
              disabled={deleteBusy}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleteBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* v-11 : Dialog création de tag inconnu */}
      <Dialog
        open={createTagDialog !== null}
        onOpenChange={(o) => {
          if (!o) setCreateTagDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un nouveau tag</DialogTitle>
            <DialogDescription>
              Le tag «{" "}
              <span className="font-mono text-foreground">
                {createTagDialog?.tag ?? ""}
              </span>{" "}
              » n'existe pas encore. Choisis une catégorie avant de le créer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="tag-category-select"
            >
              Catégorie
            </label>
            <Select
              value={newTagCategory}
              onValueChange={(v) => setNewTagCategory(v as TagCategory)}
            >
              <SelectTrigger id="tag-category-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreateTagDialog(null)}
              disabled={createTagBusy}
            >
              Annuler
            </Button>
            <Button
              onClick={confirmCreateTag}
              disabled={createTagBusy}
              className="bg-[#d9a94e] text-black hover:bg-[#d9a94e]/90"
            >
              {createTagBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Helpers URL pour v-14 ---
function parsePageFromUrl(url: string): number {
  try {
    const idx = url.indexOf("?");
    if (idx < 0) return 1;
    const params = new URLSearchParams(url.slice(idx + 1));
    const p = parseInt(params.get("page") ?? "1", 10);
    return isFinite(p) && p > 0 ? p : 1;
  } catch {
    return 1;
  }
}

function parseTagsFromUrl(url: string): string {
  try {
    const idx = url.indexOf("?");
    if (idx < 0) return "";
    const params = new URLSearchParams(url.slice(idx + 1));
    return params.get("tags") ?? "";
  } catch {
    return "";
  }
}

// P1.5 fix : récupère la densité grille depuis l'URL (?density=N).
// Défaut = 7 (correspond à PAGE_SIZE).
function parseDensityFromUrl(url: string): number {
  try {
    const idx = url.indexOf("?");
    if (idx < 0) return 7;
    const params = new URLSearchParams(url.slice(idx + 1));
    const d = parseInt(params.get("density") ?? "7", 10);
    return isFinite(d) && d >= 4 && d <= 30 ? d : 7;
  } catch {
    return 7;
  }
}

// --- Stage média (image zoomable / video / audio / pdf / placeholder) ---
function MediaStage({
  item,
  zoom,
  tx,
  ty,
  imgRef,
  onImgLoad,
  imgLoaded,
  animateTransform,
}: {
  item: MediaListItem;
  zoom: number;
  tx: number;
  ty: number;
  imgRef: React.RefObject<HTMLImageElement | null>;
  onImgLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  imgLoaded: boolean;
  animateTransform: boolean;
}) {
  const url = item.fileUrl;
  const ext = item.ext.toLowerCase();

  if (item.kind === "image") {
    // P2 (wikifeet) : positionnement absolu centré + transform combiné.
    // - `position: absolute; left: 50%; top: 50%` place le top-left au centre du stage.
    // - `translate(-50%, -50%)` recentre l'image sur son propre centre.
    // - `translate(tx, ty)` applique le pan en px écran.
    // - `scale(zoom)` applique l'échelle absolue (1 = taille réelle 1:1, minScale = fit).
    // Pas de max-w/max-h : l'image prend sa taille naturelle, le transform fait
    // tout le travail. Le stage overflow-hidden clippe ce qui dépasse.
    const transition = animateTransform
      ? `transform ${ANIM_DURATION_MS}ms ease-out, opacity 150ms ease-out`
      : "opacity 150ms ease-out";
    return (
      <img
        ref={imgRef}
        src={url}
        alt={item.originalName}
        draggable={false}
        onLoad={onImgLoad}
        className="absolute left-1/2 top-1/2 select-none"
        style={{
          transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${zoom})`,
          transformOrigin: "center center",
          maxWidth: "none",
          maxHeight: "none",
          opacity: imgLoaded ? 1 : 0,
          transition,
          willChange: "transform",
        }}
      />
    );
  }

  if (item.kind === "video") {
    return (
      <video
        src={url}
        poster={item.thumbUrl ?? undefined}
        controls
        autoPlay
        loop
        playsInline
        className="max-h-[calc(100vh-12rem)] max-w-full"
      />
    );
  }

  if (item.kind === "audio") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-16">
        <p className="text-sm text-muted-foreground">{item.originalName}</p>
        <audio src={url} controls className="w-full max-w-xl" />
      </div>
    );
  }

  if (ext === "pdf" || ["txt", "md", "csv", "json", "xml"].includes(ext)) {
    return (
      <iframe
        src={url}
        title={item.originalName}
        className="h-[calc(100vh-12rem)] w-full max-w-5xl rounded-lg border border-border bg-white"
      />
    );
  }

  // Placeholder générique
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-20 text-center">
      <p className="font-medium text-foreground">{item.originalName}</p>
      <p className="text-sm text-muted-foreground">
        Aperçu non disponible pour les fichiers .{ext}
      </p>
    </div>
  );
}
