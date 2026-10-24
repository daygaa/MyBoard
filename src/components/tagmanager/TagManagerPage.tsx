// Page « Gestionnaire de tags » (TAGM-04), même esprit que la v8 en plus compact : en-tête (retour à la
// bibliothèque, titre, « N tags · M médias taggés », onglets « Tags » et « Synonymes et parents »).
// Onglet « Tags » : boutons Tags proches (TAGM-13) · Exporter ▾ · Importer (TAGM-10) · Supprimer les tags
// non utilisés (TAGM-08) ; filtres (nom, catégorie, Masqués, Rares) ; tableau trié et virtualisé ; barre
// des actions groupées quand des tags sont cochés (TAGM-11). Onglet « Synonymes et parents » : RulesTab.

import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Search, Tags } from "lucide-react";

import { GridBadge } from "@/components/library/GridBadge";
import { MergeTagDialog, renameTag } from "@/components/tags/RenameTagDialog";
import { TagDeleteMessage, tagMenu } from "@/components/tags/tagMenu";
import { CategorySelect } from "@/components/tags/CategorySelect";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCategories } from "@/hooks/useCategories";
import { useTagRules } from "@/hooks/useTagRules";
import { api, type ManagedTag, type Renamed } from "@/lib/api";
import { openContextMenu, openMenuAt } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import { navigate, openTagTab, useTagTab } from "@/lib/router";
import { encodeTags } from "@/lib/shareCode";
import { displayTag } from "@/lib/tags";
import { deleteTags, similarGroups } from "@/lib/tagManager";
import { cn } from "@/lib/utils";
import { showGridBadge } from "@/stores/badge";
import { searchInLibrary } from "@/stores/search";
import { BulkBar } from "./BulkBar";
import { MergeTagsDialog, SimilarTagsDialog, UnusedTagsDialog } from "./CleanupDialogs";
import { ImportTagsDialog } from "./ImportTagsDialog";
import { RuleAskHost } from "./RuleAskHost";
import { RulesTab } from "./RulesTab";
import { TagTable } from "./TagTable";
import { useTagList } from "./useTagList";

const TOOL = "h-8 gap-1.5 border-border bg-card/60 text-xs hover:bg-secondary hover:text-foreground";
const SEGMENT = "rounded-md px-2.5 py-1 text-xs font-medium transition";

type Dialog = "similar" | "import" | "unused" | "merge" | null;

/** Onglets du gestionnaire (« Synonymes et parents » : TAGM-15, TAGM-16). */
function Tabs() {
  const tab = useTagTab();
  return (
    <div data-zone="gestionnaire-tags.onglets" className="flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5">
      {(["tags", "rules"] as const).map((key) => (
        <button
          key={key}
          type="button"
          data-zone={`gestionnaire-tags.onglet-${key === "tags" ? "tags" : "regles"}`}
          aria-pressed={tab === key}
          onClick={() => openTagTab(key)}
          className={cn(SEGMENT, "py-1.5", tab === key ? "bg-[#d9a94e]/15 text-[#d9a94e]" : "text-muted-foreground hover:text-foreground")}
        >
          {key === "tags" ? "Tags" : "Synonymes et parents"}
        </button>
      ))}
    </div>
  );
}

export function TagManagerPage() {
  const { list: categories } = useCategories();
  const { data, visible, filtered, filters, setFilters, sort, sortBy } = useTagList();
  const all = useMemo(() => data?.tags ?? [], [data]);
  const tab = useTagTab();
  const rules = useTagRules();
  const byId = useMemo(() => new Map(all.map((t) => [t.id, t])), [all]);
  const tagOf = useCallback((id: number) => byId.get(id), [byId]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<number | null>(null);
  const [merging, setMerging] = useState<{ source: ManagedTag; existing: Extract<Renamed, { kind: "exists" }> } | null>(null);
  const [deleting, setDeleting] = useState<ManagedTag[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const groups = useMemo(() => similarGroups(all, data?.ignored ?? []), [all, data]);
  const unused = useMemo(() => all.filter((t) => t.mediaCount === 0), [all]);
  // Tags cochés encore présents (un tag supprimé ou fusionné quitte la liste).
  const checkedTags = useMemo(() => all.filter((t) => checked.has(t.id)), [all, checked]);

  const onCheck = useCallback((id: number, on: boolean) => {
    setChecked((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const onRename = useCallback(async (tag: ManagedTag, name: string) => {
    const result = await renameTag(tag, name);
    if (result === null) return false;
    if (result !== true) setMerging({ source: tag, existing: result });
    return true;
  }, []);
  const onSearch = useCallback((tag: ManagedTag) => searchInLibrary([tag.name]), []);
  const onDelete = useCallback((tag: ManagedTag) => setDeleting([tag]), []);
  const onMenu = useCallback(
    (e: React.MouseEvent, tag: ManagedTag) => openContextMenu(e, () => tagMenu(tag, categories, { renameInline: () => setEditing(tag.id) })),
    [categories],
  );

  const exportList = (tags: ManagedTag[]) => {
    const { code, aliases, parents } = encodeTags(tags, categories, rules);
    const extra = [aliases && `${formatNumber(aliases)} ${plural(aliases, "synonyme")}`, parents && `${formatNumber(parents)} ${plural(parents, "règle")}`].filter(Boolean);
    const copied = `${formatNumber(tags.length)} ${plural(tags.length, "tag copié", "tags copiés")}${extra.length ? ` (avec ${extra.join(" et ")})` : ""}`;
    void api.writeClipboardText(code).then(() => showGridBadge(copied));
  };
  const openExport = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    openMenuAt(
      r.left,
      r.bottom + 4,
      [
        { label: `Tags affichés (${formatNumber(visible.length)})`, disabled: !filtered, run: () => exportList(visible) },
        { label: `Tous les tags (${formatNumber(all.length)})`, run: () => exportList(all) },
        ...(checkedTags.length ? [{ label: `Tags cochés (${formatNumber(checkedTags.length)})`, run: () => exportList(checkedTags) }] : []),
      ],
      e.detail === 0,
    );
  };
  const toggle = (key: "hidden" | "rare") => setFilters((f) => ({ ...f, [key]: !f[key] }));

  return (
    <main data-zone="gestionnaire-tags" className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button data-zone="gestionnaire-tags.retour" variant="outline" size="sm" onClick={() => navigate("library")} className={TOOL}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Bibliothèque
        </Button>
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d9a94e]/15 text-[#d9a94e]">
            <Tags className="h-4 w-4" />
          </span>
          <div className="select-text">
            <h1 className="text-base leading-tight font-semibold text-foreground">Gestionnaire de tags</h1>
            <p data-zone="gestionnaire-tags.compteurs" className="text-xs text-muted-foreground">
              {formatNumber(all.length)} {plural(all.length, "tag")} · {formatNumber(data?.taggedMedia ?? 0)} {plural(data?.taggedMedia ?? 0, "média taggé", "médias taggés")}
            </p>
          </div>
        </div>
        <Tabs />
        <div className={cn("ml-auto flex flex-wrap items-center gap-2", tab !== "tags" && "hidden")}>
          <Button data-zone="gestionnaire-tags.proches" variant="outline" size="sm" onClick={() => setDialog("similar")} className={TOOL}>
            Tags proches ({formatNumber(groups.length)})
          </Button>
          <Button data-zone="gestionnaire-tags.exporter" variant="outline" size="sm" onClick={openExport} className={TOOL}>
            Exporter
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button data-zone="gestionnaire-tags.importer" variant="outline" size="sm" onClick={() => setDialog("import")} className={TOOL}>
            Importer
          </Button>
          <Button
            data-zone="gestionnaire-tags.non-utilises"
            variant="outline"
            size="sm"
            disabled={unused.length === 0}
            onClick={() => setDialog("unused")}
            className={cn(TOOL, "text-rose-300 hover:text-rose-200")}
          >
            Supprimer les tags non utilisés
          </Button>
        </div>
      </div>

      {tab === "rules" ? (
        <RulesTab tags={all} rules={rules} />
      ) : (
        <>
          <div data-zone="gestionnaire-tags.filtres" className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                data-zone="gestionnaire-tags.filtre-nom"
                value={filters.text}
                onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
                placeholder="Filtrer par nom…"
                spellCheck={false}
                className="h-8 w-full rounded-lg border border-border bg-card/60 pr-3 pl-8 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-[#d9a94e]/60"
              />
            </div>
            <CategorySelect
              zone="gestionnaire-tags.filtre-categorie"
              value={filters.category}
              onChange={(category) => setFilters((f) => ({ ...f, category }))}
              allLabel="Toutes les catégories"
              className="h-8 w-48 text-xs"
            />
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5">
              {(["hidden", "rare"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  data-zone={`gestionnaire-tags.filtre-${key === "hidden" ? "masques" : "rares"}`}
                  aria-pressed={filters[key]}
                  onClick={() => toggle(key)}
                  title={key === "hidden" ? "Seulement les tags masqués de la recherche" : "Seulement les tags portés par un seul média"}
                  className={cn(SEGMENT, filters[key] ? "bg-[#d9a94e]/15 text-[#d9a94e]" : "text-muted-foreground hover:text-foreground")}
                >
                  {key === "hidden" ? "Masqués" : "Rares"}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {formatNumber(visible.length)} / {formatNumber(all.length)} {plural(all.length, "tag")}
            </span>
          </div>

          <TagTable
            tags={visible}
            checked={checked}
            editing={editing}
            sort={sort}
            onSort={sortBy}
            onCheckAll={(on) => {
              const shown = visible.map((t) => t.id);
              const next = new Set(checked);
              for (const id of shown) if (on) next.add(id);
              else next.delete(id);
              setChecked(next);
            }}
            onCheck={onCheck}
            onEdit={setEditing}
            onRename={onRename}
            onSearch={onSearch}
            onDelete={onDelete}
            onMenu={onMenu}
            rules={rules}
            tagOf={tagOf}
          />

          {checkedTags.length > 0 && (
            <BulkBar tags={checkedTags} onMerge={() => setDialog("merge")} onDelete={() => setDeleting(checkedTags)} onClear={() => setChecked(new Set())} />
          )}
        </>
      )}
      <GridBadge />
      <RuleAskHost />

      {merging && <MergeTagDialog source={merging.source} existing={merging.existing} onCancel={() => setMerging(null)} onDone={() => setMerging(null)} />}
      {deleting && (
        <ConfirmDialog
          zone="gestionnaire-tags.confirmation"
          danger
          title={deleting.length === 1 ? `Supprimer « ${displayTag(deleting[0].name)} » ?` : `Supprimer ces ${formatNumber(deleting.length)} tags ?`}
          message={
            deleting.length === 1 ? (
              <TagDeleteMessage tag={deleting[0]} />
            ) : deleting.some((t) => rules.aliasesOf.has(t.id) || rules.parentsOf.has(t.id) || rules.childrenOf.has(t.id)) ? (
              "Ils seront retirés de tous leurs médias. Leurs synonymes et leurs règles de parents partiront avec eux."
            ) : (
              "Ils seront retirés de tous leurs médias."
            )
          }
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const ids = deleting.map((t) => t.id);
            setDeleting(null);
            void deleteTags(ids);
          }}
        />
      )}
      {dialog === "similar" && <SimilarTagsDialog groups={groups} onClose={() => setDialog(null)} />}
      {dialog === "import" && <ImportTagsDialog onClose={() => setDialog(null)} />}
      {dialog === "unused" && <UnusedTagsDialog tags={unused} onClose={() => setDialog(null)} />}
      {dialog === "merge" && <MergeTagsDialog tags={checkedTags} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
    </main>
  );
}
