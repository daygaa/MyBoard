"use client";

// MyBoard — Visionneuse plein écran (Lightbox) — Phase 3 refonte.
//
// - Overlay fixed inset-0, fond noir 95%.
// - Zoom/pan image via wheel :
//     * v-1 : transition CSS duration-150 ease-out + rAF pour lisser le zoom
//             molette (batche les wheel events < 16ms en une seule update).
//     * v-2 : zoom au curseur — la position sous la souris reste fixe pendant le
//             zoom. Formule : tx_new = cx - (s_new/s_old) * (cx - tx_old).
//             Au retour à zoom=1, tx/ty reviennent à 0 (centre).
//     * v-3 : clic gauche sans drag (< 3px de mouvement) bascule entre zoom 1
//             et zoom 2 (centré, tx=ty=0). Distingue clic vs drag via la
//             distance parcourue entre pointerdown et pointerup.
// - Pan via pointer events (drag, uniquement si zoom > 1).
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
  searchHref,
} from "@/lib/shared";
import type { TagCategory } from "@/lib/shared";
import type { MediaDetail, MediaListItem, TagDTO } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;
const ZOOM_FACTOR = 1.2;
const CLICK_TOGGLE_ZOOM = 2;
const CLICK_DRAG_THRESHOLD_PX = 3;

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
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

  // Zoom/pan (image uniquement)
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  // Refs miroir des états zoom/tx/ty pour les lire synchroniquement dans les
  // callbacks rAF (sinon on aurait des stale closures sur les wheel events).
  const zoomRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    baseTx: number;
    baseTy: number;
    moved: boolean;
  } | null>(null);
  // rAF id pour lisser le zoom molette (v-1)
  const zoomRafRef = useRef<number | null>(null);

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
    zoomRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    // Annule tout rAF de zoom en attente (changement d'image)
    if (zoomRafRef.current !== null) {
      cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = null;
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
        const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
        if (origPage !== currentPage) {
          const tags = parseTagsFromUrl(origUrl);
          router.push(searchHref(tags, currentPage));
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

  // v-4 : bouton 4 souris (back/forward) → ferme la lightbox
  useEffect(() => {
    if (!lightbox?.open) return;
    function onMouseDown(e: MouseEvent) {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
        closeAndSync();
      }
    }
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
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

  // ---- Zoom via molette (v-1 fluide + v-2 curseur) ----
  function onWheel(e: React.WheelEvent) {
    if (!item || item.kind !== "image") return;
    e.preventDefault();

    // Position du curseur relative au centre de l'image rendue (v-2).
    // Le bounding rect reflète la taille post-transform, donc le centre
    // (r.left + r.width/2) est invariant sous scale (transformOrigin: center).
    const img = imgRef.current;
    let cx = 0;
    let cy = 0;
    if (img) {
      const r = img.getBoundingClientRect();
      cx = e.clientX - (r.left + r.width / 2);
      cy = e.clientY - (r.top + r.height / 2);
    }

    const dir = e.deltaY < 0 ? 1 : -1;

    // v-1 : rAF pour lisser — si plusieurs wheel events arrivent dans le même
    // frame, on n'applique qu'un seul zoom (le premier schedulé).
    if (zoomRafRef.current !== null) return;
    zoomRafRef.current = requestAnimationFrame(() => {
      zoomRafRef.current = null;
      const sOld = zoomRef.current;
      const sNew = clampZoom(sOld * (dir > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR));
      if (sNew === sOld) return; // déjà à min/max

      let newTx: number;
      let newTy: number;
      if (sNew === 1) {
        // Retour à 1 → reset pan (centre)
        newTx = 0;
        newTy = 0;
      } else {
        // Formule : tx_new = cx - (s_new/s_old) * (cx - tx_old)
        newTx = cx - (sNew / sOld) * (cx - txRef.current);
        newTy = cy - (sNew / sOld) * (cy - tyRef.current);
      }
      zoomRef.current = sNew;
      txRef.current = newTx;
      tyRef.current = newTy;
      setZoom(sNew);
      setTx(newTx);
      setTy(newTy);
    });
  }

  // ---- Pan via pointer events (v-3 : distinguer clic vs drag) ----
  function onPointerDown(e: React.PointerEvent) {
    if (!item || item.kind !== "image") return;
    // Toujours enregistrer la position de départ pour distinguer clic/drag (v-3),
    // même à zoom=1 (où on ne capture pas le pointer — pas de drag possible).
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseTx: txRef.current,
      baseTy: tyRef.current,
      moved: false,
    };
    if (zoomRef.current > 1) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      stageRef.current?.classList.add("mb-grabbing");
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || dragRef.current.id !== e.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX) {
      dragRef.current.moved = true;
    }
    if (zoomRef.current > 1) {
      const newTx = dragRef.current.baseTx + dx;
      const newTy = dragRef.current.baseTy + dy;
      txRef.current = newTx;
      tyRef.current = newTy;
      setTx(newTx);
      setTy(newTy);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (drag?.id !== e.pointerId) return;
    dragRef.current = null;
    stageRef.current?.classList.remove("mb-grabbing");
    // v-3 : si pas bougé > 3px → clic → toggle zoom x2/x1
    if (!drag.moved) {
      const sOld = zoomRef.current;
      if (sOld === 1) {
        // Zoom à 2 (centré, tx=ty=0)
        zoomRef.current = CLICK_TOGGLE_ZOOM;
        txRef.current = 0;
        tyRef.current = 0;
        setZoom(CLICK_TOGGLE_ZOOM);
        setTx(0);
        setTy(0);
      } else {
        // Déjà zoomé → retour à 1
        zoomRef.current = 1;
        txRef.current = 0;
        tyRef.current = 0;
        setZoom(1);
        setTx(0);
        setTy(0);
      }
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
  async function confirmDeleteMedia() {
    if (!item) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/media/${item.id}`, { method: "DELETE" });
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
        className="checker relative flex flex-1 items-center justify-center overflow-hidden mb-grab"
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
          />
        )}

        {/* Badge zoom (image) */}
        {item.kind === "image" && zoom > 1 && (
          <div className="absolute left-4 top-4 z-20 rounded bg-black/60 px-2 py-1 font-mono text-xs text-white backdrop-blur">
            {zoom.toFixed(1)}×
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

// --- Stage média (image zoomable / video / audio / pdf / placeholder) ---
function MediaStage({
  item,
  zoom,
  tx,
  ty,
  imgRef,
}: {
  item: MediaListItem;
  zoom: number;
  tx: number;
  ty: number;
  imgRef: React.RefObject<HTMLImageElement | null>;
}) {
  const url = item.fileUrl;
  const ext = item.ext.toLowerCase();

  if (item.kind === "image") {
    // v-1 : transition duration-150 ease-out pour un zoom fluide (au lieu de
    // duration-75 saccadé). Le drag pan reste instantané car les pointermove
    // events firent à 60+ Hz et la transition lisse le jitter sans lag visible.
    return (
      <img
        ref={imgRef}
        src={url}
        alt={item.originalName}
        draggable={false}
        className="max-h-[calc(100vh-12rem)] max-w-full select-none object-contain transition-transform duration-150 ease-out"
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          transformOrigin: "center center",
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
