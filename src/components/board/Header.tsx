"use client";

// MyBoard — Header sticky global.
// Logo + barre de recherche (centrale) + stats + bouton Importer + burger desktop.
//
// Menu burger dépliant (lp-3) : un bouton Menu visible sur TOUS les viewports
// ouvre/replie un panneau latéral gauche (sous le header) qui contient :
//   - Importer des médias (lien /import)
//   - Filtres & Tags (mobile uniquement — ouvre le Sheet TagList)
//   - Groupes (liste + bouton "Créer un groupe")
//   - Favoris (lien /?tags=favorite)
//   - Paramètres (placeholder inactif)
//
// Le panneau se déplie par translate-x (transition 300ms). Sur mobile il
// complète le Sheet actuel (TagList), sur desktop il devient le hub de nav.

import Link from "next/link";
import { Suspense, useEffect, useState, useCallback } from "react";
import {
  Menu,
  Upload,
  Image as ImageIcon,
  Film,
  Tag,
  Star,
  Settings,
  Filter,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBoardUI } from "./store";
import { SearchBar } from "./SearchBar";
import type { StatsResponse } from "@/lib/types";
import { formatCount } from "@/lib/shared";
import { GROUP_COLOR_PRESETS } from "@/lib/group-helpers";

type GroupItem = {
  id: number;
  name: string;
  color: string;
  count: number;
};

/**
 * Hook utilitaire : fetch la liste des groupes depuis l'API.
 * Refetch quand `shouldFetch` devient true (lazy load : on ne fetch que
 * quand le panneau burger est ouvert au moins une fois).
 */
function useGroups(shouldFetch: boolean) {
  const [groups, setGroups] = useState<GroupItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!shouldFetch) return;
    let cancelled = false;
    // Légitime : on démarre un fetch asynchrone (side-effectful) — la règle
    // react-hooks/set-state-in-effect vise le state dérivé synchronisé, pas
    // les appels réseau. On désactive donc pour cette ligne.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch("/api/groups", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((data: GroupItem[]) => {
        if (!cancelled) {
          setGroups(data);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shouldFetch, reloadKey]);

  return { groups, loading, error, reload };
}

/** Boîte de dialogue "Créer un groupe" : nom + couleur (preset). */
function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(GROUP_COLOR_PRESETS[0].value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset le formulaire à chaque ouverture
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
      onCreated();
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
              htmlFor="group-name"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Nom
            </label>
            <Input
              id="group-name"
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

/** Panneau burger dépliant (rendu côté client, lazy-fetch des groupes). */
function BurgerPanel() {
  const burgerOpen = useBoardUI((s) => s.burgerOpen);
  const setBurgerOpen = useBoardUI((s) => s.setBurgerOpen);
  const setMobileSidebar = useBoardUI((s) => s.setMobileSidebar);
  const hydrateBurgerOpen = useBoardUI((s) => s.hydrateBurgerOpen);

  // Hydrate l'état burger depuis localStorage APRÈS mount (SSR-safe).
  useEffect(() => {
    hydrateBurgerOpen();
  }, [hydrateBurgerOpen]);

  const { groups, loading, error, reload } = useGroups(burgerOpen);
  const [createOpen, setCreateOpen] = useState(false);

  // Ferme le panneau sur Échap (accessibilité)
  useEffect(() => {
    if (!burgerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setBurgerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [burgerOpen, setBurgerOpen]);

  // Bloque le scroll body quand le panneau est ouvert (mobile seulement)
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (burgerOpen) {
      const prev = document.body.style.overflow;
      // Laisse le scroll sur desktop (le panneau est un overlay non-modal)
      if (window.matchMedia("(max-width: 767px)").matches) {
        document.body.style.overflow = "hidden";
      }
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [burgerOpen]);

  return (
    <>
      {/* Backdrop (capture le clic pour fermer) — subtil sur desktop, plus
          marqué sur mobile. Top-14 pour ne pas recouvrir le header. */}
      <div
        aria-hidden={!burgerOpen}
        onClick={() => setBurgerOpen(false)}
        className={`fixed inset-0 top-14 z-20 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 md:bg-black/30 md:backdrop-blur-0 ${
          burgerOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panneau coulissant gauche */}
      <aside
        aria-label="Menu navigation"
        aria-hidden={!burgerOpen}
        className={`fixed left-0 top-14 bottom-0 z-30 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-card shadow-2xl shadow-black/40 transition-transform duration-300 ${
          burgerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* En-tête du panneau */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Navigation
          </span>
          <button
            type="button"
            onClick={() => setBurgerOpen(false)}
            aria-label="Fermer le menu"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions rapides */}
        <nav className="space-y-0.5 p-2">
          <Link
            href="/import"
            onClick={() => setBurgerOpen(false)}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            <Upload className="h-4 w-4 text-[#d9a94e]" />
            Importer des médias
          </Link>

          {/* Mobile uniquement : ouvre le Sheet TagList (filtres) */}
          <button
            type="button"
            onClick={() => {
              setBurgerOpen(false);
              // Léger délai pour laisser le burger se fermer avant d'ouvrir le Sheet
              setTimeout(() => setMobileSidebar(true), 50);
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary md:hidden"
          >
            <Filter className="h-4 w-4 text-[#d9a94e]" />
            Filtres & tags
          </button>

          <Link
            href="/?tags=favorite"
            onClick={() => setBurgerOpen(false)}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            <Star className="h-4 w-4 text-[#d9a94e]" />
            Favoris
          </Link>
        </nav>

        {/* Section Groupes */}
        <div className="mt-2 border-t border-border p-2">
          <div className="flex items-center justify-between px-3 py-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Groupes
            </h3>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              title="Créer un groupe"
            >
              <Plus className="h-3.5 w-3.5" /> Nouveau
            </button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
            </div>
          )}

          {error && (
            <p className="px-3 py-2 text-xs text-rose-400" role="alert">
              Erreur : {error}
            </p>
          )}

          {groups && groups.length === 0 && !loading && (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              Aucun groupe pour le moment.
              <br />
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-1 text-[#d9a94e] hover:underline"
              >
                Créer le premier →
              </button>
            </p>
          )}

          {groups && groups.length > 0 && (
            <ul className="mt-1 max-h-72 space-y-0.5 overflow-y-auto pr-1">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    onClick={() => setBurgerOpen(false)}
                    className="group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition hover:bg-secondary"
                    title={`${g.name} — ${g.count} média(s)`}
                  >
                    <span
                      className="block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/40"
                      style={{ background: g.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                    <span className="shrink-0 rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                      {g.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Section Paramètres (placeholder, inactif) */}
        <div className="mt-auto border-t border-border p-2">
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60"
            title="Bientôt disponible"
          >
            <Settings className="h-4 w-4" />
            Paramètres
          </button>
          <p className="px-3 pb-2 text-[10px] text-muted-foreground/50">
            Bientôt disponible
          </p>
        </div>
      </aside>

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={reload}
      />
    </>
  );
}

export function BoardHeader({ stats }: { stats: StatsResponse }) {
  const setMobileSidebar = useBoardUI((s) => s.setMobileSidebar);
  const mobileSidebarOpen = useBoardUI((s) => s.mobileSidebarOpen);
  const mobileSidebarContent = useBoardUI((s) => s.mobileSidebarContent);
  const toggleBurger = useBoardUI((s) => s.toggleBurger);
  const burgerOpen = useBoardUI((s) => s.burgerOpen);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="flex min-h-14 items-center gap-3 px-3 sm:gap-4 sm:px-4 lg:px-6">
          {/* Burger dépliant — visible sur TOUS les viewports (lp-3) */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={burgerOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={burgerOpen}
            onClick={toggleBurger}
            className={
              burgerOpen
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo + wordmark */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5"
            aria-label="MyBoard — accueil"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full ring-2 ring-[#d9a94e]/40 bg-gradient-to-br from-[#e3b75f] to-[#b88838] shadow-sm">
              <span className="block h-2.5 w-2.5 rounded-full bg-[#1a1408]" />
            </span>
            <span className="hidden text-[15px] font-semibold tracking-tight text-foreground sm:inline">
              My<span className="text-[#d9a94e]">Board</span>
            </span>
          </Link>

          {/* Barre de recherche centrale (desktop seulement) */}
          <div className="mx-auto hidden w-full max-w-xl md:block">
            <Suspense fallback={<div className="h-9 rounded-md bg-card/60" />}>
              <SearchBar />
            </Suspense>
          </div>

          {/* Spacer sur mobile pour pousser Importer à droite */}
          <div className="ml-auto md:hidden" />

          {/* Stats (desktop) */}
          <div className="hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
            <span className="inline-flex items-center gap-1.5" title="Images">
              <ImageIcon className="h-3.5 w-3.5 text-[#d9a94e]/80" />
              <span className="tabular-nums">{formatCount(stats.images)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5" title="Vidéos">
              <Film className="h-3.5 w-3.5 text-[#d9a94e]/80" />
              <span className="tabular-nums">{formatCount(stats.videos)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5" title="Tags">
              <Tag className="h-3.5 w-3.5 text-[#d9a94e]/80" />
              <span className="tabular-nums">{formatCount(stats.tags)}</span>
            </span>
          </div>

          {/* Bouton Importer */}
          <Button
            asChild
            size="sm"
            className="shrink-0 bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] focus-visible:ring-[#d9a94e]/40"
          >
            <Link href="/import" className="gap-1.5">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importer</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Panneau burger dépliant (rendu hors header pour échapper au z-40
          sticky et pouvoir se positionner en fixed top-14) */}
      <BurgerPanel />

      {/* Sheet mobile : contenu de la sidebar injecté par la page via le store.
          Le Sheet reste accessible via le bouton "Filtres & tags" du panneau burger. */}
      <Sheet
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebar}
        aria-label="Filtres & tags"
      >
        <SheetContent
          side="left"
          className="w-[300px] overflow-y-auto border-border bg-card p-0 sm:max-w-[300px]"
        >
          <SheetHeader className="px-4 pt-4">
            <SheetTitle className="text-left text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Filtres & tags
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{mobileSidebarContent}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
