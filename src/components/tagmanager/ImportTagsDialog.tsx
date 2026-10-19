// Importer une liste de tags (TAGM-10) : champ où coller le code de partage, aperçu « N tags à
// créer, M déjà présents » et leur liste ; « Importer » crée les tags manquants avec leur catégorie
// (sans média), ceux déjà présents ne changent pas. Ensuite « N tags importés », avec « Ok » et
// « Annuler » (par sécurité : retire les N tags créés, laisse les M déjà présents).

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useCategories } from "@/hooks/useCategories";
import { api, type ManagedTag } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { displayTag, normalizeTag } from "@/lib/tags";
import { decodeTags, deleteTags, runTagAction } from "@/lib/tagManager";

const CANCEL = "text-foreground hover:bg-secondary hover:text-foreground";
const GOLD = "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]";

export function ImportTagsDialog({ existing, onClose }: { existing: ManagedTag[]; onClose: () => void }) {
  const { list: categories } = useCategories();
  const [code, setCode] = useState("");
  const [created, setCreated] = useState<number[] | null>(null);
  const shared = useMemo(() => (code.trim() ? decodeTags(code) : null), [code]);
  const known = useMemo(() => new Set(existing.map((t) => t.name)), [existing]);
  // Un nom en double dans le code ne compte qu'une fois.
  const rows = [...new Map((shared ?? []).map((t) => [normalizeTag(t.name), t])).entries()].map(([name, t]) => ({ ...t, name, present: known.has(name) }));
  const toCreate = rows.filter((r) => !r.present && r.name);
  const colorOf = (key: string) => categories.find((c) => c.key === key)?.color;

  if (created !== null) {
    const n = created.length;
    return (
      <Modal
        open
        even
        dismissible={false}
        onClose={() => {}}
        zone="import-tags.fait"
        title={`${formatNumber(n)} ${plural(n, "tag importé", "tags importés")}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => void deleteTags(created).then(onClose)} className={CANCEL} title="Retirer les tags qui viennent d'être créés">
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
    const ids = await runTagAction("Importer des tags", () => api.importTags(toCreate.map(({ name, category, hidden }) => ({ name, category, hidden }))));
    if (ids) setCreated(ids);
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      zone="import-tags"
      title="Importer une liste de tags"
      description="Colle ici le code de partage copié par « Exporter » (dans ce MyBoard ou un autre)."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className={CANCEL}>
            Annuler
          </Button>
          <Button data-zone="import-tags.importer" disabled={toCreate.length === 0} onClick={() => void importNow()} className={GOLD}>
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
        placeholder="MYBOARD-TAGS-1:…"
        spellCheck={false}
        className="h-20 w-full resize-none rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[#d9a94e]/60 focus:outline-none"
      />
      {code.trim() !== "" && shared === null && <p className="mt-2 text-sm text-rose-300">Ce texte n'est pas un code de liste de tags MyBoard.</p>}
      {shared && (
        <>
          <p data-zone="import-tags.apercu" className="mt-3 text-sm text-foreground">
            {formatNumber(toCreate.length)} {plural(toCreate.length, "tag")} à créer, {formatNumber(rows.length - toCreate.length)} déjà{" "}
            {plural(rows.length - toCreate.length, "présent")}
          </p>
          <div className="mt-2 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border p-2">
            {rows.map((r) => (
              <span
                key={r.name}
                title={r.present ? "Déjà présent : inchangé" : undefined}
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
