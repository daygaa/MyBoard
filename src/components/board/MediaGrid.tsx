"use client";

// MyBoard — Grille de médias virtualisée.
// Grille responsive auto-fill 160px, lazy-render via IntersectionObserver
// (rend effectif uniquement quand la carte approche du viewport + buffer).
// Sélection multiple (shift+clic plage), barre d'actions bulk.
//
// Menu 3 points (lp-9) : en mode batch, un bouton MoreVertical à GAUCHE de la
// barre d'actions ouvre un DropdownMenu avec :
//   - Supprimer (AlertDialog de confirmation → DELETE batch sur /api/media/:id)
//   - Ajouter aux favoris (POST /api/media/:id/favorite pour les non-favoris)
//   - Ajouter au groupe > (sous-menu : groupes existants + Créer un groupe)

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Square,
  X,
  Loader2,
  MoreVertical,
  Trash2,
  Star,
  FolderPlus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MediaCard, gridIdsRef } from "./MediaCard";
import { TagAutocomplete } from "./TagAutocomplete";
import { useBoardUI } from "./store";
import type { MediaListItem } from "@/lib/types";
import { GROUP_COLOR_PRESETS } from "@/lib/group-helpers";

type Props = {
  items: MediaListItem[];
  query: string;
};

type GroupItem = {
  id: number;
  name: string;
  color: string;
  count: number;
};

/** Boîte de dialogue "Créer un groupe" (depuis le menu 3 points). */
function CreateGroupDialogInline({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (groupId: number) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(GROUP_COLOR_PRESETS[0].value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setColor(GROUP_COLOR_PRESETS[0].value);
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Veuillez saisir un nom");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color }),
      });
      if (res.status === 409) {
        setErr("Un groupe avec ce nom existe déjà");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error ?? "Erreur lors de la création");
        return;
      }
      const data = (await res.json()) as { id: number };
      onCreated(data.id);
      onOpenChange(false);
    } catch {
      setErr("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Créer un groupe</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="bulk-group-name"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Nom
            </label>
            <Input
              id="bulk-group-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Sélection persos, Références…"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) submit();
              }}
              className="border-border bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Couleur
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {GROUP_COLOR_PRESETS.map((c) => {
                const active = color.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.value}
                    type="button"
                    title={c.name}
                    aria-label={`Couleur ${c.name}`}
                    aria-pressed={active}
                    onClick={() => setColor(c.value)}
                    className={`grid h-7 w-7 place-items-center rounded-full ring-2 transition ${
                      active
                        ? "ring-foreground"
                        : "ring-transparent hover:ring-border"
                    }`}
                    style={{ background: c.value }}
                  >
                    {active && (
                      <span className="block h-2 w-2 rounded-full bg-black/70" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {err && (
            <p className="text-xs text-rose-400" role="alert">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="border-border"
          >
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="gap-1.5 bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {busy ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Menu 3 points vertical : actions batch (supprimer / favoris / groupe). */
function BulkActionsMenu({
  items,
  selected,
  onDone,
}: {
  items: MediaListItem[];
  selected: Set<number>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [keepFiles, setKeepFiles] = useState(false); // P3.3 : checkbox conserver fichiers
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groups, setGroups] = useState<GroupItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const selectedCount = selected.size;
  const disabled = selectedCount === 0;

  // Charge les groupes existants à la 1ère ouverture du menu
  const [fetchNeeded, setFetchNeeded] = useState(false);
  useEffect(() => {
    if (!fetchNeeded || groups !== null) return;
    let cancelled = false;
    fetch("/api/groups", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((data: GroupItem[]) => {
        if (!cancelled) setGroups(data);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchNeeded, groups]);

  function reloadGroups() {
    setGroups(null); // force refetch
  }

  async function handleDelete() {
    if (disabled) return;
    setBusy(true);
    setMsg(null);
    // P3.4 : masquage immédiat (optimistic) — onDone() cache les cartes
    setDeleteOpen(false);
    onDone();
    try {
      const ids = [...selected];
      // P3.1/P3.2 : route bulk-delete dédiée (batch de 10 côté serveur)
      const res = await fetch("/api/media/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, keepFiles }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const ok = data.deleted ?? 0;
      const failed = data.failed ?? 0;
      if (failed === 0) {
        setMsg({ kind: "ok", text: `${ok} média(s) supprimé(s)${keepFiles ? " (fichiers conservés)" : ""}` });
      } else {
        setMsg({
          kind: "err",
          text: `${ok} supprimé(s), ${failed} en échec`,
        });
      }
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Erreur réseau" });
      router.refresh();
    } finally {
      setBusy(false);
      setKeepFiles(false); // reset checkbox pour la prochaine fois
    }
  }

  async function handleFavorite() {
    if (disabled) return;
    // On ne toggle QUE les médias non-favoris (pour éviter de toggler dans le
    // mauvais sens ceux déjà favoris — sémantique "Ajouter aux favoris").
    const toFav = items.filter((i) => selected.has(i.id) && !i.favorite);
    if (toFav.length === 0) {
      setMsg({ kind: "ok", text: "Tous les sélectionnés sont déjà favoris" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const results = await Promise.allSettled(
        toFav.map((i) =>
          fetch(`/api/media/${i.id}/favorite`, { method: "POST" }).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
          })
        )
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - ok;
      if (failed === 0) {
        setMsg({ kind: "ok", text: `${ok} média(s) ajouté(s) aux favoris` });
      } else {
        setMsg({
          kind: "err",
          text: `${ok} ajouté(s), ${failed} en échec`,
        });
      }
      onDone();
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Erreur réseau" });
    } finally {
      setBusy(false);
    }
  }

  async function handleAddToGroup(groupId: number, groupName: string) {
    if (disabled) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMsg({
          kind: "err",
          text: data?.error ?? "Erreur lors de l'ajout au groupe",
        });
        return;
      }
      const data = (await res.json()) as { added: number; requested: number };
      setMsg({
        kind: "ok",
        text:
          data.added > 0
            ? `${data.added} média(s) ajouté(s) à « ${groupName} »`
            : `Tous les médias étaient déjà dans « ${groupName} »`,
      });
      reloadGroups();
      onDone();
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Erreur réseau" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) setFetchNeeded(true);
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled || busy}
              aria-label="Actions sur la sélection"
              title={
                disabled
                  ? "Sélectionnez des médias pour activer les actions"
                  : "Actions sur la sélection"
              }
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="w-56 border-border bg-popover"
          >
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={busy}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleFavorite} disabled={busy}>
              <Star className="h-4 w-4" />
              Ajouter aux favoris
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={busy}>
                <FolderPlus className="h-4 w-4" />
                <span className="ml-1">Ajouter au groupe</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60 border-border bg-popover">
                {groups === null && (
                  <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
                  </div>
                )}
                {groups !== null && groups.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Aucun groupe. Créez-en un ci-dessous.
                  </div>
                )}
                {groups !== null &&
                  groups.length > 0 &&
                  groups.map((g) => (
                    <DropdownMenuItem
                      key={g.id}
                      onClick={() => handleAddToGroup(g.id, g.name)}
                      disabled={busy}
                    >
                      <span
                        className="block h-2.5 w-2.5 rounded-full ring-1 ring-black/40"
                        style={{ background: g.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{g.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
                        {g.count}
                      </span>
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setCreateGroupOpen(true)}
                  disabled={busy}
                  className="text-[#d9a94e] focus:text-[#e3b75f]"
                >
                  <Plus className="h-4 w-4" />
                  Créer un groupe
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Message d'état inline (succès/erreur) */}
        {msg && (
          <span
            className={`text-xs ${
              msg.kind === "ok" ? "text-emerald-400" : "text-rose-400"
            }`}
            role="status"
          >
            {msg.text}
          </span>
        )}
      </div>

      {/* AlertDialog de confirmation suppression */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-border bg-card sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Supprimer {selectedCount} média{selectedCount > 1 ? "s" : ""} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les fichiers originaux et leurs
              miniatures seront supprimés du disque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* P3.3 : checkbox "conserver les fichiers sur le disque" */}
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/40 p-3">
            <Checkbox
              id="keep-files-bulk"
              checked={keepFiles}
              onCheckedChange={(c) => setKeepFiles(c === true)}
              className="mt-0.5 data-[state=checked]:border-[#d9a94e] data-[state=checked]:bg-[#d9a94e] data-[state=checked]:text-[#1a1408]"
            />
            <div className="min-w-0 flex-1">
              <Label htmlFor="keep-files-bulk" className="cursor-pointer text-xs font-medium text-foreground">
                Conserver les fichiers sur le disque
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Si coché, supprime les médias de la bibliothèque mais garde les fichiers dans {`library/originals/`} (réimportables plus tard).
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-border"
              disabled={busy}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="gap-1.5 bg-rose-600 text-white hover:bg-rose-500"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de création de groupe */}
      <CreateGroupDialogInline
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onCreated={(groupId) => {
          // Après création, on ajoute directement la sélection au nouveau groupe
          reloadGroups();
          handleAddToGroup(groupId, "le nouveau groupe");
        }}
      />
    </>
  );
}

/** Wrapper lazy-render : ne monte le contenu que lorsqu'il approche du viewport.
 *
 *  IMPORTANT — cohérence SSR/CSR : on démarre TOUJOURS avec `visible=false`
 *  (rend le skeleton), puis on bascule en `true` après mount côté client via
 *  useEffect + IntersectionObserver. Cela garantit que le HTML server-rendered
 *  correspond au HTML client-rendered (sinon : erreur d'hydration React).
 *  Sans IntersectionObserver (navigateur très vieux), on rend tout au mount.
 */
function LazyCard({
  item,
  index,
  onOpen,
}: {
  item: MediaListItem;
  index: number;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Si IntersectionObserver n'existe pas (navigateur très vieux), on rend tout.
    if (typeof IntersectionObserver === "undefined") {
      // Légitime : on DOIT setState après mount pour éviter le mismatch
      // d'hydration SSR/CSR (le skeleton doit être rendu côté serveur ET client
      // au 1er render, puis basculé côté client seulement).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px 0px" } // buffer autour du viewport
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="aspect-square w-full">
      {visible ? (
        <MediaCard item={item} index={index} onOpen={onOpen} />
      ) : (
        <div className="mb-skeleton h-full w-full rounded-lg" />
      )}
    </div>
  );
}

export function MediaGrid({ items, query }: Props) {
  const router = useRouter();
  const batchMode = useBoardUI((s) => s.batchMode);
  const setBatchMode = useBoardUI((s) => s.setBatchMode);
  const selected = useBoardUI((s) => s.selected);
  const selectAll = useBoardUI((s) => s.selectAll);
  const clearSelection = useBoardUI((s) => s.clearSelection);
  const openLightbox = useBoardUI((s) => s.openLightbox);
  const setMobileSidebarContent = useBoardUI((s) => s.setMobileSidebarContent);
  const gridDensity = useBoardUI((s) => s.gridDensity);
  const hydrateGridDensity = useBoardUI((s) => s.hydrateGridDensity);

  // Hydrate gridDensity depuis localStorage APRÈS mount (fix hydration mismatch
  // issue2.txt : "Confort" server / "Standard" client).
  useEffect(() => {
    hydrateGridDensity();
  }, [hydrateGridDensity]);

  // Sync la densité vers l'URL (pour que le serveur re-query avec le bon pageSize).
  // On ne le fait qu'après hydratation (pas au 1er render) pour éviter une boucle.
  const [densityHydrated, setDensityHydrated] = useState(false);
  useEffect(() => {
    setDensityHydrated(true);
  }, []);
  useEffect(() => {
    if (!densityHydrated) return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get("density");
    if (current === String(gridDensity)) return;
    if (gridDensity === 7) {
      url.searchParams.delete("density"); // défaut, pas besoin en URL
    } else {
      url.searchParams.set("density", String(gridDensity));
    }
    // Reset page à 1 quand la densité change (le pageSize change, donc les pages aussi)
    url.searchParams.delete("page");
    router.replace(url.pathname + (url.search ? "?" + url.search : ""));
  }, [gridDensity, densityHydrated, router]);

  const [add, setAdd] = useState("");
  const [remove, setRemove] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  // Grille : N colonnes FIXES (peu importe la résolution), la taille des thumbs
  // s'adapte en temps réel (modif_UI.txt lp-7). On utilise `repeat(N, minmax(0, 1fr))`
  // au lieu de `repeat(auto-fill, minmax(X, 1fr))` : le navigateur ne décide plus
  // du nombre de cols, il respecte strictement gridDensity.
  // minmax(0, 1fr) au lieu de 1fr pur pour éviter l'overflow sur très petite largeur.

  // Tient à jour la ref partagée pour le shift+clic plage (MediaCard)
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  useEffect(() => {
    gridIdsRef.current = ids;
    return () => {
      gridIdsRef.current = null;
    };
  }, [ids]);

  // Libère le contenu de la sidebar mobile à l'unmount
  useEffect(() => {
    return () => setMobileSidebarContent(null);
  }, [setMobileSidebarContent]);

  async function applyBulk() {
    if (!add.trim() && !remove.trim()) return;
    if (selected.size === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/media/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...selected],
          add: add.trim(),
          remove: remove.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMsg({
          kind: "ok",
          text: `${data.updated ?? selected.size} média(s) mis à jour`,
        });
        setAdd("");
        setRemove("");
        router.refresh();
      } else {
        setMsg({ kind: "err", text: "Erreur lors de la mise à jour" });
      }
    } catch {
      setMsg({ kind: "err", text: "Erreur réseau" });
    } finally {
      setBusy(false);
    }
  }

  function openAt(index: number) {
    openLightbox(items, index, query);
  }

  // Callback "action effectuée" pour le menu 3 points : clear sélection + exit batch
  function handleBulkActionDone() {
    clearSelection();
    setBatchMode(false);
  }

  return (
    <div>
      {/* Barre d'actions haut : menu 3 points (gauche) + sélection multiple (droite) */}
      <div className="mb-3 flex items-center justify-between gap-2">
        {/* Gauche : menu 3 points (uniquement en mode batch) */}
        <div className="flex min-h-8 items-center">
          {batchMode && (
            <BulkActionsMenu
              items={items}
              selected={selected}
              onDone={handleBulkActionDone}
            />
          )}
        </div>

        {/* Droite : Tout/Aucun/Terminer ou Sélection multiple */}
        <div className="flex items-center gap-2">
          {batchMode ? (
            <>
              <button
                onClick={() => selectAll(ids)}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <CheckSquare className="h-3.5 w-3.5" /> Tout
              </button>
              <button
                onClick={clearSelection}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <Square className="h-3.5 w-3.5" /> Aucun
              </button>
              <button
                onClick={() => setBatchMode(false)}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs text-foreground transition hover:bg-secondary/80"
              >
                <X className="h-3.5 w-3.5" /> Terminer
              </button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchMode(true)}
              className="border-border bg-card/60 text-xs hover:bg-secondary hover:text-foreground"
            >
              Sélection multiple
            </Button>
          )}
        </div>
      </div>

      {/* Grille responsive — densité pilotée par le store (localStorage). */}
      <div
        className="grid gap-2 transition-[grid-template-columns] duration-150"
        style={{
          gridTemplateColumns: `repeat(${gridDensity}, minmax(0, 1fr))`,
        }}
      >
        {items.map((m, idx) => (
          <LazyCard
            key={m.id}
            item={m}
            index={idx}
            onOpen={() => openAt(idx)}
          />
        ))}
      </div>

      {/* Barre d'actions bulk (sticky bas) */}
      {batchMode && (
        <div className="sticky bottom-4 z-30 mt-4 rounded-xl border border-border bg-card/95 p-3 shadow-2xl shadow-black/60 backdrop-blur">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <span className="shrink-0 text-sm font-medium text-foreground">
              {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <TagAutocomplete
                value={add}
                onChange={setAdd}
                onSubmit={applyBulk}
                placeholder="Ajouter des tags…"
              />
            </div>
            <div className="min-w-0 flex-1">
              <TagAutocomplete
                value={remove}
                onChange={setRemove}
                onSubmit={applyBulk}
                placeholder="Retirer des tags…"
              />
            </div>
            <Button
              onClick={applyBulk}
              disabled={busy || selected.size === 0}
              className="shrink-0 gap-1.5 bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {busy ? "…" : "Appliquer"}
            </Button>
          </div>
          {msg && (
            <p
              className={`mt-2 text-xs ${
                msg.kind === "ok" ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {msg.text}
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Astuce : Maj + clic pour sélectionner une plage. Utilisez le menu 3 points à gauche pour supprimer, favoris ou groupes.
          </p>
        </div>
      )}
    </div>
  );
}
