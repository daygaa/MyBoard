// Pop-in « Exporter des tags » (TAGM-10, TAGM-18 ; retour T3, points TAGM-18.3 et TAGM-18.8 ; lot R8-1), à la place du
// petit menu « Exporter ▾ » : les tags à exporter (« Tags du filtre », grisé sans filtre ; « Tous les tags » ; « Tags
// sélectionnés », grisé sans sélection), puis « Recréer les synonymes » et « Recréer les règles de parents », cochées,
// chacune avec dessous une option plus petite, décochée, et sa bulle Windows (textes de l'utilisateur, 04/11) ; le
// nombre de tags du code ; « Copier le code » met le code dans le presse-papiers. Ce qui part : exportSelection.ts.

import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import type { RulesIndex } from "@/hooks/useTagRules";
import { api, type Category, type ManagedTag } from "@/lib/api";
import { exportSelection, type ExportOptions } from "@/lib/exportSelection";
import { formatNumber, plural } from "@/lib/format";
import { encodeTags } from "@/lib/shareCode";
import { cn } from "@/lib/utils";
import { showGridBadge } from "@/stores/badge";
import { CANCEL, GOLD } from "./TagChoice";

type Which = "filter" | "all" | "checked";

const count = (n: number, one: string, many?: string) => `${formatNumber(n)} ${plural(n, one, many)}`;

/** « 3 groupes de synonymes et 2 règles de parents » (réponse 7 du lot R8, D9) ; vide s'il n'y en a pas. */
export function linksText(groups: number, parents: number): string {
  return [groups && count(groups, "groupe de synonymes", "groupes de synonymes"), parents && count(parents, "règle de parents", "règles de parents")].filter(Boolean).join(" et ");
}

const FULL_GROUPS =
  "Si un groupe de synonymes contient un tag de la sélection, tous les tags du groupe sont exportés, même ceux qui ne sont pas sélectionnés, et le groupe est recréé en entier à l'import.";
const WHOLE_CHAINS = "Si un tag sélectionné fait partie d'une règle de parents, toute la chaîne est exportée, même si les autres tags de la chaîne ne sont pas sélectionnés.";

/** Une case ; `sub` : l'option plus petite, décalée sous la case principale. */
function Option({ zone, on, onChange, title, sub = false, children }: { zone: string; on: boolean; onChange: (on: boolean) => void; title?: string; sub?: boolean; children: ReactNode }) {
  return (
    <label data-zone={zone} title={title} className={cn("flex w-fit cursor-pointer items-center gap-2 text-foreground", sub ? "mt-1 ml-6 text-xs" : "mt-3 text-sm")}>
      <Checkbox checked={on} onCheckedChange={(c) => onChange(c === true)} className={sub ? "size-3.5" : undefined} />
      {children}
    </label>
  );
}

export function ExportTagsDialog({ visible, filtered, all, checked, categories, rules, tagOf, onClose }: {
  /** Tags du filtre en cours, affichés ou non. */
  visible: ManagedTag[];
  filtered: boolean;
  all: ManagedTag[];
  checked: ManagedTag[];
  categories: Category[];
  rules: RulesIndex;
  tagOf: (id: number) => ManagedTag | undefined;
  onClose: () => void;
}) {
  // D'office : la sélection s'il y en a une, sinon le filtre s'il y en a un, sinon tous les tags (réponse 1 du 04/11).
  const [which, setWhich] = useState<Which>(() => (checked.length ? "checked" : filtered ? "filter" : "all"));
  const [options, setOptions] = useState<ExportOptions>({ groups: true, fullGroups: false, parents: true, wholeChains: false });
  const set = (patch: Partial<ExportOptions>) => setOptions((o) => ({ ...o, ...patch }));
  const chosen = which === "checked" ? checked : which === "filter" ? visible : all;
  const selection = useMemo(() => exportSelection(chosen, tagOf, rules, options), [chosen, tagOf, rules, options]);
  const n = selection.tags.length;

  const copy = () => {
    if (n === 0) return;
    onClose();
    const links = linksText(selection.groups.length, selection.parents.length);
    void encodeTags(selection.tags, categories, selection.groups, selection.parents)
      .then((code) => api.writeClipboardText(code))
      .then(() => showGridBadge(`${count(n, "tag copié", "tags copiés")}${links ? ` (avec ${links})` : ""}`));
  };

  const choices: { key: Which; label: string; n: number; disabled: boolean }[] = [
    { key: "filter", label: "Tags du filtre", n: visible.length, disabled: !filtered },
    { key: "all", label: "Tous les tags", n: all.length, disabled: false },
    { key: "checked", label: "Tags sélectionnés", n: checked.length, disabled: checked.length === 0 },
  ];
  return (
    <Modal
      open
      even
      onEnter={copy}
      onClose={onClose}
      zone="export-tags"
      title="Exporter des tags"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className={CANCEL}>
            Annuler
          </Button>
          <Button data-zone="export-tags.copier" disabled={n === 0} onClick={copy} className={GOLD}>
            Copier le code
          </Button>
        </>
      }
    >
      <div data-zone="export-tags.choix" className="space-y-0.5">
        {choices.map((c) => (
          <label
            key={c.key}
            data-zone={`export-tags.choix.${c.key}`}
            className={cn("flex items-center gap-2 rounded px-1.5 py-1 text-sm", c.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-secondary/50", which === c.key && "bg-secondary/60")}
          >
            <input type="radio" checked={which === c.key} disabled={c.disabled} onChange={() => setWhich(c.key)} className="accent-[#d9a94e]" />
            {c.label} ({formatNumber(c.n)})
          </label>
        ))}
      </div>
      <Option zone="export-tags.synonymes" on={options.groups} onChange={(groups) => set({ groups })}>
        Recréer les synonymes{options.groups && ` (${count(selection.groups.length, "groupe")})`}
      </Option>
      {options.groups && (
        <Option zone="export-tags.groupes-complets" on={options.fullGroups} onChange={(fullGroups) => set({ fullGroups })} title={FULL_GROUPS} sub>
          Exporter les groupes complets
        </Option>
      )}
      <Option zone="export-tags.parents" on={options.parents} onChange={(parents) => set({ parents })}>
        Recréer les règles de parents{options.parents && ` (${formatNumber(selection.parents.length)})`}
      </Option>
      {options.parents && (
        <Option zone="export-tags.chaines" on={options.wholeChains} onChange={(wholeChains) => set({ wholeChains })} title={WHOLE_CHAINS} sub>
          Exporter toute la chaîne d'un tag
        </Option>
      )}
      <p data-zone="export-tags.total" className="mt-4 text-sm text-muted-foreground select-text">
        Le code contiendra {count(n, "tag")}.
      </p>
    </Modal>
  );
}
