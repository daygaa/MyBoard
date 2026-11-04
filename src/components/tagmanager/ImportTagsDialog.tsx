// Importer une liste de tags (TAGM-10, TAGM-18) : champ où coller le code de partage (nouveau format, lot R8-1 :
// shareCode.ts), aperçu « N tags à créer, M déjà présents » et leur liste, puis les groupes de synonymes et les
// règles de parents à créer (aperçu exact : le cœur Rust fait l'import puis l'annule). « Importer » crée les tags
// manquants avec leur catégorie et leur description (sans média), les groupes et les règles (qui posent leurs
// parents) ; ce qui est déjà présent ne change pas. Ensuite « N tags importés », avec « Ok » et « Annuler », bordé
// de rouge (retour T3, point TAGM-18.5 ; par sécurité : retire ce qui vient d'être créé).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useCategories } from "@/hooks/useCategories";
import { formatNumber, plural } from "@/lib/format";
import { rulesApi, type ImportReport } from "@/lib/rulesApi";
import { decodeTags } from "@/lib/shareCode";
import { runTagAction } from "@/lib/tagManager";
import { displayTag, normalizeTag } from "@/lib/tags";
import { linksText } from "./ExportTagsDialog";

const CANCEL = "text-foreground hover:bg-secondary hover:text-foreground";
const GOLD = "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]";

const count = (n: number, one: string, many?: string) => `${formatNumber(n)} ${plural(n, one, many)}`;

/** Groupes de synonymes, règles et médias touchés, en une phrase (vide s'il n'y en a pas ; mots de D9, réponse 7 du lot
 *  R8). */
function rulesLine(report: ImportReport, future: boolean): string {
  const links = linksText(report.groups, report.parents.length);
  const many = report.groups + report.parents.length > 1;
  let line = links ? `${links} ${future ? "à créer" : report.groups > 0 ? (many ? "créés" : "créé") : many ? "créées" : "créée"}` : "";
  const skipped = report.skippedNames + report.skippedParents;
  if (skipped) line += `${line ? " · " : ""}${count(skipped, "élément ignoré", "éléments ignorés")} (déjà dans un autre groupe, ou boucle)`;
  if (report.tagged) line += `${line ? ". " : ""}Les règles ${future ? "poseront" : "ont posé"} ${count(report.tagged, "tag parent", "tags parents")} sur les médias`;
  return line ? `${line}.` : "";
}

export function ImportTagsDialog({ onClose }: { onClose: () => void }) {
  const { list: categories } = useCategories();
  const [code, setCode] = useState("");
  const [done, setDone] = useState<ImportReport | null>(null);
  // Lecture du code (décompression) : `undefined` le temps de la lire, `null` si ce n'est pas un code MyBoard.
  const { data: shared } = useQuery({ queryKey: ["share-code", code], queryFn: () => decodeTags(code), enabled: code.trim() !== "" });
  const { data: preview } = useQuery({ queryKey: ["import-preview", code], queryFn: () => rulesApi.previewImport(shared!), enabled: !!shared });
  const present = useMemo(() => new Set(preview?.present ?? []), [preview]);
  // Un nom en double dans le code ne compte qu'une fois.
  const rows = [...new Map((shared?.tags ?? []).map((t) => [normalizeTag(t.name), t])).entries()].map(([name, t]) => ({ ...t, name, present: present.has(name) }));
  const colorOf = (key: string) => categories.find((c) => c.key === key)?.color;
  const creates = preview ? preview.tags.length + preview.names.length + preview.parents.length : 0;

  if (done !== null) {
    const n = done.tags.length;
    return (
      <Modal
        open
        even
        dismissible={false}
        onEnter={onClose}
        onClose={() => {}}
        zone="import-tags.fait"
        title={`${count(n, "tag importé", "tags importés")}`}
        description={rulesLine(done, false) || undefined}
        footer={
          <>
            <Button
              variant="ghost"
              data-zone="import-tags.annuler"
              onClick={() => void runTagAction("Annuler l'import", () => rulesApi.undoImport(done)).then(onClose)}
              className={`border border-destructive ${CANCEL}`}
              title="Retirer ce qui vient d'être créé"
            >
              Annuler
            </Button>
            <Button data-zone="import-tags.ok" onClick={onClose} className={GOLD}>
              Ok
            </Button>
          </>
        }
      />
    );
  }

  const importNow = async () => {
    if (!shared) return;
    const report = await runTagAction("Importer des tags", () => rulesApi.importTags(shared));
    if (report) setDone(report);
  };

  return (
    <Modal
      open
      wide
      onEnter={() => creates > 0 && void importNow()}
      onClose={onClose}
      zone="import-tags"
      title="Importer une liste de tags"
      description="Colle ici le code de partage copié par « Exporter »."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className={CANCEL}>
            Annuler
          </Button>
          <Button data-zone="import-tags.importer" disabled={creates === 0} onClick={() => void importNow()} className={GOLD}>
            Importer
          </Button>
        </>
      }
    >
      <textarea
        data-zone="import-tags.code"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="MYBOARD-TAGS-2:…"
        spellCheck={false}
        className="h-20 w-full resize-none rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[#d9a94e]/60 focus:outline-none"
      />
      {code.trim() !== "" && shared === null && <p className="mt-2 text-sm text-rose-300">Ce texte n'est pas un code de liste de tags MyBoard.</p>}
      {shared && preview && (
        <>
          <p data-zone="import-tags.apercu" className="mt-3 text-sm text-foreground">
            {count(preview.tags.length, "tag")} à créer, {formatNumber(preview.present.length)} déjà {plural(preview.present.length, "présent")}
          </p>
          {rulesLine(preview, true) && (
            <p data-zone="import-tags.regles" className="mt-1 text-sm text-muted-foreground">
              {rulesLine(preview, true)}
            </p>
          )}
          <div className="mt-2 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border p-2">
            {rows.map((r) => (
              <span
                key={r.name}
                title={r.present ? "Déjà présent : inchangé" : r.description || undefined}
                className="rounded-md border px-2 py-0.5 font-mono text-xs"
                style={r.present ? undefined : { color: colorOf(r.category), borderColor: `${colorOf(r.category)}4d` }}
              >
                <span className={r.present ? "text-muted-foreground" : undefined}>{displayTag(r.name)}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
