// Doublons trouvés pendant l'import, dans le bilan (IMP-91, reprend DUP-05 ; réponses Q36 à Q39 du 15/11) : un groupe
// par média, séparé du suivant par un trait ; une ligne par fichier : miniature (agrandie au survol, comme dans la liste
// avant l'import), nom (bulle : son chemin ; icône de bibliothèque au bout pour le fichier du média), poids, boutons
// Explorateur et application par défaut, case pour le supprimer. Au moins une case reste décochée par groupe ; cases
// toutes décochées à l'ouverture. Clic droit sur la ligne : Copier le nom ‖ Afficher dans l'explorateur de fichiers ‖
// Ouvrir avec l'application par défaut. « Supprimer les doublons » (confirmé, suppression définitive comme DEL-04)
// efface les fichiers cochés ; les groupes réduits à un fichier disparaissent, puis la section quand il n'en reste plus.
// 2e tour (retours du 16/11) : liste plus haute (moitié de la fenêtre), bouton à droite ; une version faite par MyBoard se
// coche aussi (Q43 A), avec son icône à droite de celle de la bibliothèque : compressée ou convertie (Q44 A).

import { useState } from "react";
import { ChevronDown, ExternalLink, FolderOpen, Library, Loader2, RefreshCw, Shrink, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api, type DupFile, type DupGroup } from "@/lib/api";
import { whileBusy } from "@/lib/busy";
import { openContextMenu, type MenuEntry } from "@/lib/contextMenu";
import { formatBytes, formatNumber, plural } from "@/lib/format";
import { ListThumb } from "./ListThumb";

/** Groupes affichés, puis « Voir plus » (comme la liste avant l'import, IMP-11). */
const STEP = 50;
const ICON_BUTTON = "grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground";

/** Nom d'un format dans une bulle : « PNG », « WebP », « JPG »… */
function formatName(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "webp") return "WebP";
  if (e === "webm") return "WebM";
  if (e === "jpeg" || e === "jpe") return "JPG";
  return e.toUpperCase();
}

/** Icône de la version faite par MyBoard, à droite de celle de la bibliothèque (Q44 A). */
function VersionIcon({ file }: { file: DupFile }) {
  if (!file.version) return null;
  const converted = file.version === "converted";
  const title = converted
    ? `Version convertie par MyBoard${file.convertedFrom ? ` (${formatName(file.convertedFrom)} → ${formatName(file.ext)})` : ""}`
    : "Version compressée par MyBoard";
  const Icon = converted ? RefreshCw : Shrink;
  return (
    <span data-zone={`import.bilan.doublons.${converted ? "convertie" : "compressee"}`} title={title} className="shrink-0">
      <Icon className="h-3.5 w-3.5 text-[#d9a94e]" />
    </span>
  );
}

type Actions = { reveal: (f: DupFile) => void; open: (f: DupFile) => void; copyName: (f: DupFile) => void };

function rowMenu(file: DupFile, act: Actions): MenuEntry[] {
  return [
    { label: "Copier le nom", run: () => act.copyName(file) },
    "separator",
    { label: "Afficher dans l'explorateur de fichiers", run: () => act.reveal(file) },
    { label: "Ouvrir avec l'application par défaut", run: () => act.open(file) },
  ];
}

function Row({ file, checked, locked, onCheck, act }: { file: DupFile; checked: boolean; locked: boolean; onCheck: (v: boolean) => void; act: Actions }) {
  return (
    <li data-zone="import.bilan.doublons.fichier" className="flex items-center gap-2 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5" onContextMenu={(e) => openContextMenu(e, () => rowMenu(file, act))}>
        <ListThumb entry={file} floating />
        <span className="min-w-0 flex-1 select-text">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm text-foreground" title={file.path}>
              {file.name}
            </span>
            {file.inLibrary && (
              <span data-zone="import.bilan.doublons.bibliotheque" title="Présent dans la bibliothèque" className="shrink-0">
                <Library className="h-3.5 w-3.5 text-[#d9a94e]" />
              </span>
            )}
            <VersionIcon file={file} />
          </span>
          <span className="block text-[11px] text-muted-foreground tabular-nums">{formatBytes(file.size)}</span>
        </span>
      </div>
      <button type="button" data-zone="import.bilan.doublons.explorateur" title="Afficher dans l'explorateur de fichiers" onClick={() => act.reveal(file)} className={ICON_BUTTON}>
        <FolderOpen className="h-4 w-4" />
      </button>
      <button type="button" data-zone="import.bilan.doublons.ouvrir" title="Ouvrir avec l'application par défaut" onClick={() => act.open(file)} className={ICON_BUTTON}>
        <ExternalLink className="h-4 w-4" />
      </button>
      <span className="grid w-7 shrink-0 place-items-center" title={!file.deletable ? "Toujours gardé" : locked ? "Au moins un fichier est gardé dans chaque groupe" : "Supprimer ce fichier du disque"}>
        {file.deletable && <Checkbox data-zone="import.bilan.doublons.case" checked={checked} disabled={locked} onCheckedChange={(c) => onCheck(c === true)} />}
      </span>
    </li>
  );
}

export function ImportDuplicates({ groups }: { groups: DupGroup[] }) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [shown, setShown] = useState(STEP);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  if (groups.length === 0) return null;

  // Cases encore valables : les lignes effacées ont quitté leur groupe.
  const present = new Set(groups.flatMap((g) => g.files.map((f) => f.path)));
  const chosen = [...checked].filter((p) => present.has(p));
  const report = (action: string, call: () => Promise<void>) =>
    void whileBusy(call).then(
      () => setErrors([]),
      (e: unknown) => setErrors([`${action} : ${String(e)}`]),
    );
  const act: Actions = {
    reveal: (f) => report("Afficher dans l'explorateur de fichiers", () => api.revealScanFile(f.path)),
    open: (f) => report("Ouvrir avec l'application par défaut", () => api.openImportFile(f.path)),
    copyName: (f) => report("Copier le nom", () => api.writeClipboardText(f.name)),
  };
  const check = (path: string, value: boolean) =>
    setChecked((old) => {
      const next = new Set(old);
      if (value) next.add(path);
      else next.delete(path);
      return next;
    });
  const remove = () => {
    setConfirm(false);
    setBusy(true);
    whileBusy(() => api.deleteImportDuplicates(chosen))
      .then(
        (r) => setErrors(r.failed.map((f) => `${f.path.split(/[\\/]/).pop()} : ${f.message}`)),
        (e: unknown) => setErrors([String(e)]),
      )
      .finally(() => {
        setChecked(new Set());
        setBusy(false);
      });
  };
  const files = groups.reduce((n, g) => n + g.files.length, 0);
  const rest = groups.length - shown;

  return (
    <div data-zone="import.bilan.doublons" className="mt-4">
      <p className="mb-1 text-[10px] font-semibold tracking-wider uppercase">
        Doublons trouvés ({formatNumber(groups.length)} {plural(groups.length, "groupe")}, {formatNumber(files)} fichiers)
      </p>
      <div className="max-h-[50vh] overflow-y-auto overscroll-contain rounded-md border border-border bg-background/40 px-2">
        <ul className="divide-y divide-border">
          {groups.slice(0, shown).map((g) => {
            const kept = g.files.filter((f) => !checked.has(f.path)).length;
            return (
              <li key={g.media} data-zone="import.bilan.doublons.groupe">
                <ul>
                  {g.files.map((f) => (
                    <Row key={f.path} file={f} act={act} checked={checked.has(f.path)} locked={busy || (kept === 1 && !checked.has(f.path))} onCheck={(v) => check(f.path, v)} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        {rest > 0 && (
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="text-xs text-muted-foreground select-text">
              et {formatNumber(rest)} {plural(rest, "groupe supplémentaire", "groupes supplémentaires")}
            </span>
            <button
              type="button"
              data-zone="import.bilan.doublons.voir-plus"
              onClick={() => setShown((n) => n + STEP)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-xs text-[#d9a94e] transition hover:bg-[#d9a94e]/10"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Voir plus
            </button>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-col items-end">
        <Button
          data-zone="import.bilan.doublons.supprimer"
          variant="outline"
          size="sm"
          disabled={chosen.length === 0 || busy}
          onClick={() => setConfirm(true)}
          className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Supprimer les doublons
        </Button>
        {errors.map((e) => (
          <p key={e} className="mt-1 self-stretch text-xs text-rose-400 select-text">
            {e}
          </p>
        ))}
      </div>
      {confirm && (
        <ConfirmDialog
          danger
          zone="import.bilan.doublons.confirmation"
          title={`Supprimer ${formatNumber(chosen.length)} ${plural(chosen.length, "fichier")} du disque ?`}
          message="Ils seront supprimés définitivement, sans passer par la Corbeille de Windows. Dans chaque groupe, les fichiers non cochés sont gardés."
          confirmLabel="Supprimer"
          onCancel={() => setConfirm(false)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
