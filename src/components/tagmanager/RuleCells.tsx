// Colonnes « Synonymes » et « Parents » du tableau du gestionnaire (TAGM-15, TAGM-16, Q3-A) : un
// bouton avec le nombre de règles ouvre une petite liste modifiable, comme la description. Synonymes :
// les noms redirigés vers ce tag. Parents : les parents du tag (modifiables) puis ses enfants, en
// lecture seule (ils se modifient depuis leur propre ligne ou la page « Synonymes et parents »).

import { useState } from "react";
import { createPortal } from "react-dom";
import { Equal, ListTree } from "lucide-react";

import { TagInput } from "@/components/tags/TagInput";
import { usePopover } from "@/hooks/usePopover";
import type { ManagedTag } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import type { AliasRow, ParentRow } from "@/lib/rulesApi";
import { addAlias, addParent } from "@/lib/tagRules";
import { displayTag, normalizeTag } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { useTagResolver } from "./RuleForm";
import { AliasLine, ParentLine, type TagOf } from "./RuleLines";

const WIDTH = 320;

function CellButton({ zone, icon: Icon, count, title, popover }: { zone: string; icon: typeof Equal; count: number; title: string; popover: ReturnType<typeof usePopover> }) {
  return (
    <button
      ref={popover.buttonRef}
      type="button"
      data-zone={zone}
      onClick={popover.toggle}
      title={title}
      className={cn(
        "flex h-7 min-w-9 items-center justify-center gap-1 rounded-md px-1.5 text-xs tabular-nums transition hover:bg-secondary",
        popover.open || count > 0 ? "text-[#d9a94e]" : "text-muted-foreground/60 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {count > 0 && formatNumber(count)}
    </button>
  );
}

/** Champ d'ajout de la petite liste : Entrée ajoute ; le refus s'affiche dessous. Le tag lui-même et ce
 *  que la liste contient déjà sont grisés dans les suggestions (SRCH-29). */
function AddField({ zone, placeholder, self, listed, onAdd }: { zone: string; placeholder: string; self: string; listed: string[]; onAdd: (text: string) => Promise<string | null | false> }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async (value: string) => {
    if (!normalizeTag(value)) return;
    // `false` : pop-in annulée, le champ garde son texte (retour T3, point TAGM-16.2).
    const refused = await onAdd(value);
    setError(refused || null);
    if (refused === null) setText("");
  };
  return (
    <div className="mt-2">
      <TagInput
        zone={zone}
        value={text}
        onChange={(v) => {
          setText(v);
          setError(null);
        }}
        onSubmit={(v) => void submit(v)}
        onPick={(tag) => void submit(tag.name)}
        placeholder={placeholder}
        taken={(tag) => (tag.name === self ? "C'est le tag lui-même" : listed.includes(tag.name) ? "Ce tag est déjà dans cette liste" : null)}
        className="h-8"
        inputClassName="font-mono text-xs"
      />
      {error && <p className="mt-1.5 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

function Panel({ popover, zone, title, children }: { popover: ReturnType<typeof usePopover>; zone: string; title: string; children: React.ReactNode }) {
  return createPortal(
    <div ref={popover.panelRef} data-zone={zone} className="fixed z-[90] rounded-lg border border-border bg-card p-2.5 shadow-xl" style={popover.style}>
      <p className="mb-1.5 px-1.5 text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{title}</p>
      {children}
    </div>,
    document.body,
  );
}

const Empty = ({ text }: { text: string }) => <p className="px-1.5 py-1 text-xs text-muted-foreground">{text}</p>;

export function SynonymsCell({ tag, aliases, tagOf }: { tag: ManagedTag; aliases: AliasRow[]; tagOf: TagOf }) {
  const popover = usePopover(WIDTH);
  const label = displayTag(tag.name);
  return (
    <>
      <CellButton zone="gestionnaire-tags.synonymes" icon={Equal} count={aliases.length} title={`Synonymes de « ${label} »`} popover={popover} />
      {popover.open && (
        <Panel popover={popover} zone="gestionnaire-tags.synonymes.liste" title={`Taper l'un de ces noms donne « ${label} » :`}>
          {aliases.length ? aliases.map((row) => <AliasLine key={row.id} row={row} tagOf={tagOf} showTarget={false} />) : <Empty text="Aucun synonyme." />}
          <AddField
            zone="gestionnaire-tags.synonymes.ajout"
            placeholder="Ajouter un synonyme…"
            self={tag.name}
            listed={aliases.map((row) => row.alias)}
            onAdd={(text) => addAlias(text, tag)}
          />
        </Panel>
      )}
    </>
  );
}

export function ParentsCell({ tag, parents, childRules, tagOf }: { tag: ManagedTag; parents: ParentRow[]; childRules: ParentRow[]; tagOf: TagOf }) {
  const popover = usePopover(WIDTH);
  const { resolve, dialog } = useTagResolver();
  const label = displayTag(tag.name);
  const childNames = childRules.map((r) => ({ id: r.id, name: tagOf(r.childId)?.name ?? "?", enabled: r.enabled }));
  const title = `Parents de « ${label} »${childRules.length ? ` · ${formatNumber(childRules.length)} ${plural(childRules.length, "enfant")}` : ""}`;
  return (
    <>
      <CellButton zone="gestionnaire-tags.parents" icon={ListTree} count={parents.length} title={title} popover={popover} />
      {popover.open && (
        <Panel popover={popover} zone="gestionnaire-tags.parents.liste" title={`Poser « ${label} » pose aussi :`}>
          {parents.length ? parents.map((row) => <ParentLine key={row.id} row={row} tagOf={tagOf} showChild={false} />) : <Empty text="Aucun parent." />}
          <AddField
            zone="gestionnaire-tags.parents.ajout"
            placeholder="Ajouter un parent…"
            self={tag.name}
            listed={parents.map((row) => tagOf(row.parentId)?.name ?? "")}
            onAdd={async (text) => {
              const parent = await resolve(text);
              return parent ? addParent(tag, parent) : false;
            }}
          />
          {childNames.length > 0 && (
            <div data-zone="gestionnaire-tags.parents.enfants" className="mt-2.5 border-t border-border pt-2">
              <p className="mb-1 px-1.5 text-[11px] text-muted-foreground">Enfants (ils posent « {label} »)</p>
              <p className="px-1.5 font-mono text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]">
                {childNames.map((c, i) => (
                  <span key={c.id} className={cn(!c.enabled && "text-muted-foreground")} title={c.enabled ? undefined : "Règle éteinte"}>
                    {displayTag(c.name)}
                    {i < childNames.length - 1 && ", "}
                  </span>
                ))}
              </p>
            </div>
          )}
        </Panel>
      )}
      {dialog}
    </>
  );
}
