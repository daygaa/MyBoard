// MyBoard — TagsTable (client component).
// Table des tags avec actions : renommer (Dialog), changer catégorie (Select),
// supprimer (AlertDialog). Calls PATCH/DELETE /api/tags/[id].
//
// Thème doré : header bg-card, hover bg-secondary, actions dorées, suppression
// en rose. Responsive : scroll horizontal sur petit écran.

"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  Loader2,
  Search,
  ChevronLeft,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_PILL,
  CATEGORY_DOT,
  displayTag,
  formatCount,
  isCategory,
  type TagCategory,
} from "@/lib/shared";
import type { TagDTO } from "@/lib/types";

type Props = {
  tags: TagDTO[];
};

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}));

export function TagsTable({ tags }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [renameTarget, setRenameTarget] = useState<TagDTO | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TagDTO | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Filtre local (texte + catégorie)
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return tags.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q);
    });
  }, [tags, filter, categoryFilter]);

  // Statistiques rapides
  const totalMedia = useMemo(
    () => tags.reduce((sum, t) => sum + t.postCount, 0),
    [tags]
  );

  // ---- Actions ----------------------------------------------------------

  function openRename(t: TagDTO) {
    setRenameTarget(t);
    setRenameOpen(true);
  }
  function openDelete(t: TagDTO) {
    setDeleteTarget(t);
    setDeleteOpen(true);
  }

  async function changeCategory(tag: TagDTO, newCategory: string) {
    if (newCategory === tag.category) return;
    if (!isCategory(newCategory)) return;
    try {
      const res = await fetch(`/api/tags/${tag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error("[TagsTable] changeCategory error:", data?.error);
        return;
      }
      router.refresh();
    } catch (e) {
      console.error("[TagsTable] changeCategory network error:", e);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar : recherche + filtre catégorie + stats */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer par nom de tag…"
            className="border-border bg-background pl-9"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v)}
        >
          <SelectTrigger className="w-[180px] border-border bg-background">
            <SelectValue placeholder="Toutes les catégories" />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover">
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} / {tags.length} tags ·{" "}
          {formatCount(totalMedia)} médias taggés
        </div>
      </div>

      {/* Tableau — scroll horizontal sur mobile */}
      <div className="overflow-hidden rounded-xl border border-border bg-card/60">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nom
              </TableHead>
              <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Catégorie
              </TableHead>
              <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nb médias
              </TableHead>
              <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="border-border">
                <TableCell
                  colSpan={4}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {tags.length === 0
                    ? "Aucun tag dans la bibliothèque."
                    : "Aucun tag ne correspond à votre filtre."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow
                  key={t.id}
                  className="border-border transition hover:bg-secondary/60"
                >
                  {/* Nom */}
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          CATEGORY_DOT[t.category] ?? "bg-zinc-400"
                        }`}
                        aria-hidden
                      />
                      <span className="truncate font-mono text-sm text-foreground">
                        {displayTag(t.name)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Catégorie (Select inline) */}
                  <TableCell className="py-2.5">
                    <Select
                      value={t.category}
                      onValueChange={(v) => changeCategory(t, v)}
                    >
                      <SelectTrigger
                        size="sm"
                        className={`h-7 w-[150px] border-transparent px-2 text-xs font-medium ${
                          CATEGORY_PILL[t.category] ??
                          "bg-secondary text-foreground"
                        }`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-popover">
                        {CATEGORY_OPTIONS.map((c) => (
                          <SelectItem
                            key={c.value}
                            value={c.value}
                            className="text-xs"
                          >
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Nb médias */}
                  <TableCell className="py-2.5 text-right">
                    <span className="rounded bg-secondary/60 px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {formatCount(t.postCount)}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openRename(t)}
                        aria-label={`Renommer le tag ${t.name}`}
                        title="Renommer"
                        className="grid h-7 w-7 place-items-center rounded text-muted-foreground transition hover:bg-[#d9a94e]/15 hover:text-[#d9a94e]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDelete(t)}
                        aria-label={`Supprimer le tag ${t.name}`}
                        title="Supprimer"
                        className="grid h-7 w-7 place-items-center rounded text-muted-foreground transition hover:bg-rose-500/15 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <RenameTagDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        tag={renameTarget}
        onDone={() => router.refresh()}
      />
      <DeleteTagDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tag={deleteTarget}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rename Dialog
// ---------------------------------------------------------------------------

function RenameTagDialog({
  open,
  onOpenChange,
  tag,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tag: TagDTO | null;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Init/Reset quand on ouvre
  useEffect(() => {
    if (open && tag) {
      setName(tag.name);
      setErr(null);
      setBusy(false);
    }
  }, [open, tag]);

  async function submit() {
    if (!tag) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Veuillez saisir un nom");
      return;
    }
    if (trimmed === tag.name) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tags/${tag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.status === 409) {
        setErr("Un autre tag porte déjà ce nom");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error ?? "Erreur lors du renommage");
        return;
      }
      onDone();
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
          <DialogTitle className="text-foreground">Renommer le tag</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Modifier le nom du tag « {tag ? displayTag(tag.name) : ""} ». Le nom
            sera normalisé (minuscules, espaces → underscores).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nouveau_nom"
            maxLength={255}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) submit();
            }}
            className="border-border bg-background font-mono"
          />
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
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            {busy ? "Enregistrement…" : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete AlertDialog
// ---------------------------------------------------------------------------

function DeleteTagDialog({
  open,
  onOpenChange,
  tag,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tag: TagDTO | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBusy(false);
      setErr(null);
    }
  }, [open]);

  async function confirmDelete() {
    if (!tag) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error ?? "Erreur lors de la suppression");
        return;
      }
      onDone();
      onOpenChange(false);
    } catch {
      setErr("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border bg-card sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Supprimer le tag
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Supprimer le tag « {tag ? displayTag(tag.name) : ""} » ? Il sera
            détaché de {tag ? formatCount(tag.postCount) : 0} média
            {tag && tag.postCount > 1 ? "s" : ""}. Les fichiers ne seront pas
            supprimés. Cette action est définitive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {err && (
          <p className="text-xs text-rose-400" role="alert">
            {err}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="border-border">
            Annuler
          </AlertDialogCancel>
          <Button
            onClick={confirmDelete}
            disabled={busy}
            className="gap-1.5 bg-rose-600 text-white hover:bg-rose-700"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Supprimer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/** Petit bouton "Retour" réutilisable. */
export function BackToHomeLink() {
  return (
    <a
      href="/"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      Retour à la bibliothèque
    </a>
  );
}

// TagCategory est réexporté pour cohérence de typage côté page.
export type { TagCategory };
