// Dossiers du menu burger (NAV-02, FOLD-01, FOLD-02, FOLD-07), apparence v8 (captures 08 et 09) :
// « + Nouveau », puis chaque dossier dans l'ordre choisi par le bouton « tri » à côté du titre (FOLD-10,
// stores/folderSort.ts ; par défaut A → Z) : pastille de couleur, nom, nombre de
// médias, menu ⋮ (le clic droit sur la ligne ouvre le même). Un clic ouvre la page du dossier.
// En bas, « Dossiers masqués (N) » les montre en gris : ligne provisoire pour les tests de la
// phase 3, retirée avec le gestionnaire de dossiers (FOLD-05, FOLD-06).

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, MoreVertical, Plus } from "lucide-react";

import { useSortedFolders } from "@/hooks/useFolders";
import type { Folder } from "@/lib/api";
import { openContextMenu, openMenuAt, type MenuEntry } from "@/lib/contextMenu";
import { navigate, useFolderId, useRoute } from "@/lib/router";
import { cn, titleIfCut } from "@/lib/utils";
import { FOLDER_SORTS, useFolderSort } from "@/stores/folderSort";
import { FolderNameDialog } from "./FolderNameDialog";
import { folderMenu } from "./folderMenus";

const HEAD_BUTTON =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground";

/** Bouton « tri » (FOLD-10) : menu des ordres, l'ordre en cours coché ; chaque entrée montre son sens. */
function SortButton() {
  const label = useFolderSort((s) => FOLDER_SORTS.find((o) => o.key === s.key)?.label[s.dirs[s.key]]);
  return (
    <button
      type="button"
      data-zone="menu.dossiers.tri"
      aria-label={`Trier les dossiers (${label})`}
      title={`Trier les dossiers : ${label}`}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const { key, dirs, choose } = useFolderSort.getState();
        const entries: MenuEntry[] = FOLDER_SORTS.map((o) => ({ label: o.label[dirs[o.key]], checked: o.key === key, run: () => choose(o.key) }));
        openMenuAt(r.left, r.bottom + 4, entries, e.detail === 0, { anchor: e.currentTarget });
      }}
      className={HEAD_BUTTON}
    >
      tri <ChevronDown className="h-3 w-3" />
    </button>
  );
}

function FolderRow({ folder, active, onDone }: { folder: Folder; active: boolean; onDone: () => void }) {
  return (
    <div
      data-zone="menu.dossier"
      data-dossier={folder.id}
      onContextMenu={(e) => openContextMenu(e, () => folderMenu(folder))}
      className={cn("flex items-center gap-1.5 rounded-md pr-1 transition hover:bg-secondary", active && "bg-secondary", folder.hidden && "opacity-50")}
    >
      <button
        type="button"
        onClick={() => {
          navigate("folder", folder.id);
          onDone();
        }}
        className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-sm font-medium text-foreground"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: folder.color }} />
        <span onMouseEnter={(e) => titleIfCut(e.currentTarget)} className="min-w-0 flex-1 truncate text-left">
          {folder.name}
        </span>
      </button>
      <span className="shrink-0 rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
        {folder.mediaCount}
      </span>
      <button
        type="button"
        data-zone="menu.dossier.options"
        aria-label={`Options du dossier « ${folder.name} »`}
        title="Options du dossier"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          openMenuAt(r.left, r.bottom + 4, folderMenu(folder), e.detail === 0, { anchor: e.currentTarget });
        }}
        className="grid h-7 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

export function FolderList({ onDone }: { onDone: () => void }) {
  const folders = useSortedFolders();
  const route = useRoute();
  const current = useFolderId();
  const [creating, setCreating] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  /** Dossier tout juste créé par « + Nouveau » : il reçoit le focus du clavier une fois la pop-in
   *  fermée (sinon elle le rendrait à « + Nouveau ») et le dossier listé (retour du 24/10). */
  const [created, setCreated] = useState<number | null>(null);
  useEffect(() => {
    if (created === null || creating) return;
    const row = document.querySelector<HTMLElement>(`[data-dossier="${created}"] button`);
    if (!row) return;
    row.focus();
    setCreated(null);
  }, [created, creating, folders]);
  const visible = folders.filter((f) => !f.hidden);
  const hidden = folders.filter((f) => f.hidden);
  const row = (f: Folder) => <FolderRow key={f.id} folder={f} active={route === "folder" && current === f.id} onDone={onDone} />;

  return (
    <div data-zone="menu.dossiers" className="mt-2 border-t border-border p-2">
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Dossiers</h3>
          <SortButton />
        </div>
        <button type="button" data-zone="menu.dossiers.nouveau" onClick={() => setCreating(true)} className={HEAD_BUTTON}>
          <Plus className="h-3.5 w-3.5" /> Nouveau
        </button>
      </div>
      {folders.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">Aucun dossier pour le moment.</p>}
      {visible.map(row)}
      {hidden.length > 0 && (
        <>
          <button
            type="button"
            data-zone="menu.dossiers.masques"
            aria-expanded={showHidden}
            onClick={() => setShowHidden((v) => !v)}
            className="mt-1 flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showHidden && "rotate-90")} />
            Dossiers masqués ({hidden.length})
          </button>
          {showHidden && hidden.map(row)}
        </>
      )}
      {creating && (
        <FolderNameDialog onCancel={() => setCreating(false)} onDone={() => setCreating(false)} onCreated={(f) => setCreated(f.id)} />
      )}
    </div>
  );
}
