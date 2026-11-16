// Liste des fichiers choisis, sous la barre d'actions (IMP-10, apparence v8), groupée par dossier (IMP-88, réponse Q20 B
// du 14/11) : un dossier ajouté = une ligne (`FolderLine`, dépliable), un fichier choisi seul = une ligne simple
// (`FileRow`). 100 lignes, puis « et X supplémentaires » et « Voir plus » (+100 par clic, IMP-11) ; les lignes sont lues
// par pages dans le cœur Rust : la page reste fluide avec 100 000 fichiers choisis (IMP-12). « Tout vider » (IMP-51)
// remet la page à son état de départ. Pendant l'import, la liste reste affichée, sans croix ni « Tout vider » ; elle
// disparaît à la fin (IMP-50).
// IMP-88, retouche 6 : les fichiers des dossiers dépliés arrivent dans la même réponse que les lignes (état déplié et
// « Voir plus » de chaque dossier gardés ici) : la liste passe d'un état complet au suivant, sans image intermédiaire.

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, ListChecks, Loader2, Trash2 } from "lucide-react";

import { api, type ScanLine } from "@/lib/api";
import { formatBytes, formatNumber, plural } from "@/lib/format";
import { useImport } from "@/stores/import";
import { FileRow } from "./FileRow";
import { FolderLine } from "./FolderLine";

const STEP = 100;

/** Fichier choisi seul, pas encore parcouru : son nom, le temps du parcours. */
function PendingFile({ line }: { line: ScanLine }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-2.5 py-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-[#d9a94e]" />
      <span className="truncate" title={line.path}>
        {line.path.split(/[\\/]/).pop()}
      </span>
    </li>
  );
}

export function FileList() {
  const snapshot = useImport((s) => s.snapshot);
  const phase = snapshot?.phase ?? "idle";
  const visible = phase === "scanning" || phase === "ready" || phase === "importing";
  const locked = phase === "importing";
  const lines = snapshot?.lines ?? 0;
  const version = snapshot?.listVersion ?? 0;
  const total = snapshot?.scan?.total ?? 0;
  const bytes = snapshot?.scan?.bytes ?? 0;
  const [shown, setShown] = useState(STEP);
  // Fichiers montrés par dossier, s'il n'en montre pas 100 : 0 = replié, sinon « Voir plus » cliqué.
  const [view, setView] = useState<Record<number, number>>({});
  // Liste vidée : on repart des 100 premières lignes, dossiers dépliés.
  useEffect(() => {
    if (lines === 0) {
      setShown(STEP);
      setView({});
    }
  }, [lines]);
  const folders = Object.entries(view).map(([id, n]): [number, number] => [Number(id), n]);
  const { data } = useQuery({
    queryKey: ["scan-lines", version, shown, phase, folders],
    queryFn: () => api.scanLines(0, shown, folders),
    enabled: visible && lines > 0,
    placeholderData: keepPreviousData,
  });
  if (!visible || lines === 0 || !data) return null;
  const rest = data.total - data.lines.length;

  return (
    // Pas d'ancrage du défilement du navigateur dans la liste : il prenait pour repère une ligne déplacée par la mise à
    // jour et faisait sauter la page ; `keepInPlace` garde la ligne cliquée sous le curseur (IMP-88, retouche 2).
    <section data-zone="import.liste" className="rounded-xl border border-border bg-card/60 p-6 [overflow-anchor:none]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          <ListChecks className="h-4 w-4 text-[#d9a94e]" />
          Fichiers sélectionnés
          <span className="rounded bg-[#d9a94e]/15 px-1.5 py-0.5 text-xs text-[#d9a94e] tabular-nums select-text">{formatNumber(total)}</span>
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums select-text">{formatBytes(bytes)}</span>
          {!locked && (
            <button
              type="button"
              data-zone="import.liste.vider"
              onClick={() => void api.clearScan()}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Tout vider
            </button>
          )}
        </div>
      </div>
      <ul className="space-y-1.5">
        {data.lines.map((line) =>
          line.folder ? (
            <FolderLine
              key={line.id}
              line={line}
              locked={locked}
              open={(view[line.id] ?? STEP) > 0}
              onToggle={() =>
                setView(({ [line.id]: n, ...rest }) => (n === 0 ? rest : { ...rest, [line.id]: 0 }))
              }
              onMore={() => setView((v) => ({ ...v, [line.id]: (v[line.id] ?? STEP) + STEP }))}
            />
          ) : line.entry ? (
            <FileRow key={line.id} entry={line.entry} locked={locked} />
          ) : (
            <PendingFile key={line.id} line={line} />
          ),
        )}
      </ul>
      {rest > 0 && (
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <span className="text-xs text-muted-foreground select-text">
            et {formatNumber(rest)} {plural(rest, "élément supplémentaire", "éléments supplémentaires")}
          </span>
          <button
            type="button"
            data-zone="import.liste.voir-plus"
            onClick={() => setShown((n) => n + STEP)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-[#d9a94e] transition hover:bg-[#d9a94e]/10"
          >
            <ChevronDown className="h-4 w-4" />
            Voir plus
          </button>
        </div>
      )}
    </section>
  );
}
