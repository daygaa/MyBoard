// Page « Gestionnaire de tags » (TAGM-04), même esprit que la v8 en plus compact : onglets « Tags » et
// « Synonymes et parents » sur toute la largeur de la fenêtre, juste sous l'en-tête (TAGM-04.1, TAGM-15.2) ;
// en-tête de la page (retour à la bibliothèque, titre, « N tags · M médias taggés »). Largeur : 72 % de la
// fenêtre (TAGM-04.2 : +10 % de chaque côté sur l'écran 1080p), toute la fenêtre si elle est étroite.
// Onglet « Tags » : boutons Créer un tag (TAGM-04.8) · Tags proches (TAGM-13) · Exporter ▾ · Importer
// (TAGM-10) · Supprimer les tags non utilisés (TAGM-08) ; filtres (TagFilters : nom, catégorie, Masqués, Rares) ; tableau
// trié et virtualisé, 100 tags affichés puis « Afficher 100 de plus » (TAGM-04.5 ; un nouveau filtre ou tri
// repart des 100 premiers) ; barre des actions groupées quand des tags sont cochés (TAGM-11 ; Échap décoche
// tout, TAGM-11.1). Onglet « Synonymes et parents » : RulesTab, avec « Tags proches » seul au bout à droite de
// l'en-tête (TAGM-13.4).

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Tags } from "lucide-react";

import { GridBadge } from "@/components/library/GridBadge";
import { MergeTagDialog, renameTag } from "@/components/tags/RenameTagDialog";
import { TagDeleteMessage, tagMenu } from "@/components/tags/tagMenu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCategories } from "@/hooks/useCategories";
import { useTagRules } from "@/hooks/useTagRules";
import { api, type ManagedTag, type Renamed } from "@/lib/api";
import { openContextMenu, openMenuAt } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import { navigate, useTagTab } from "@/lib/router";
import { encodeTags } from "@/lib/shareCode";
import { displayTag } from "@/lib/tags";
import { hasEscapeLayer } from "@/lib/escape";
import { SIMILAR } from "@/lib/historySteps";
import { deleteTags, similarGroups } from "@/lib/tagManager";
import { cn } from "@/lib/utils";
import { showGridBadge } from "@/stores/badge";
import { searchInLibrary } from "@/stores/search";
import { inField } from "@/stores/selection";
import { useUI } from "@/stores/ui";
import { BulkBar } from "./BulkBar";
import { MergeTagsDialog, UnusedTagsDialog } from "./CleanupDialogs";
import { SimilarTagsDialog, type SimilarSnapshot } from "./SimilarTagsDialog";
import { ImportTagsDialog } from "./ImportTagsDialog";
import { NewTagButton } from "./NewTagButton";
import { RuleAskHost } from "./RuleAskHost";
import { RulesTab } from "./RulesTab";
import { TagFilters } from "./TagFilters";
import { Tabs } from "./TagManagerTabs";
import { TagTable } from "./TagTable";
import { useTagList } from "./useTagList";

const TOOL = "h-8 gap-1.5 border-border bg-card/60 text-xs hover:bg-secondary hover:text-foreground";
/** Tags affichés à la fois, puis en plus à chaque « Afficher 100 de plus » (TAGM-04.5). */
const STEP = 100;

type Dialog = "similar" | "import" | "unused" | "merge" | null;

export function TagManagerPage() {
  const { list: categories } = useCategories();
  const rules = useTagRules();
  const { data, visible, filtered, filters, setFilters, sort, sortBy } = useTagList(rules);
  const all = useMemo(() => data?.tags ?? [], [data]);
  const tab = useTagTab();
  const [limit, setLimit] = useState(STEP);
  useEffect(() => setLimit(STEP), [filters, sort]);
  const shown = useMemo(() => visible.slice(0, limit), [visible, limit]);
  const byId = useMemo(() => new Map(all.map((t) => [t.id, t])), [all]);
  const tagOf = useCallback((id: number) => byId.get(id), [byId]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<number | null>(null);
  const [merging, setMerging] = useState<{ source: ManagedTag; existing: Extract<Renamed, { kind: "exists" }> } | null>(null);
  const [deleting, setDeleting] = useState<ManagedTag[] | null>(null);
  // Retour arrière sur l'étape d'une pop-in « Tags proches » quittée par une loupe : elle se rouvre (TAGM-13.1).
  const [similar, setSimilar] = useState(() => (window.history.state?.[SIMILAR] as SimilarSnapshot | undefined) ?? undefined);
  const [dialog, setDialog] = useState<Dialog>(similar ? "similar" : null);
  const similarLevel = useUI((s) => s.similarLevel);
  const groups = useMemo(() => similarGroups(all, data?.ignored ?? [], similarLevel), [all, data, similarLevel]);
  const unused = useMemo(() => all.filter((t) => t.mediaCount === 0), [all]);
  // Tags cochés encore présents (un tag supprimé ou fusionné quitte la liste).
  const checkedTags = useMemo(() => all.filter((t) => checked.has(t.id)), [all, checked]);

  // Échap décoche tous les tags (retour T3, point TAGM-11.1), comme la croix de la barre du bas ; comme
  // Échap en mode sélection (SEL-01) : rien d'ouvert par-dessus, hors d'un champ de saisie.
  const anyChecked = tab === "tags" && checked.size > 0;
  useEffect(() => {
    if (!anyChecked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !hasEscapeLayer() && !inField(e.target)) setChecked(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyChecked]);

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

  const similarButton = (
    <Button data-zone="gestionnaire-tags.proches" variant="outline" size="sm" onClick={() => setDialog("similar")} className={TOOL}>
      Tags proches ({formatNumber(groups.length)})
    </Button>
  );

  return (
    <>
      <Tabs />
      <main data-zone="gestionnaire-tags" className="mx-auto w-full max-w-[max(72rem,72vw)] px-4 py-5 lg:px-6">
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
          <div className={cn("ml-auto flex flex-wrap items-center gap-2", tab !== "tags" && "hidden")}>
            <NewTagButton
              tags={all}
              rules={rules}
              tagOf={tagOf}
              onCreated={(name) => {
                // Le filtre montre le nouveau tag (choix de l'utilisateur), sinon il pourrait tomber après les 100 premiers.
                setFilters({ text: displayTag(name), category: null, hidden: false, rare: false });
                showGridBadge(`Tag « ${displayTag(name)} » créé`);
              }}
            />
            {tab === "tags" && similarButton}
            <Button data-zone="gestionnaire-tags.exporter" variant="outline" size="sm" onClick={openExport} className={TOOL}>
              Exporter
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button data-zone="gestionnaire-tags.importer" variant="outline" size="sm" onClick={() => setDialog("import")} className={TOOL}>
              Importer
            </Button>
            {/* Grisé, la bulle passe par l'enveloppe (TAGM-08.1). */}
            <span title={unused.length === 0 ? "Aucun tag non utilisé" : undefined} className="inline-flex">
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
            </span>
          </div>
          {tab === "rules" && <div className="ml-auto">{similarButton}</div>}
        </div>

        {tab === "rules" ? (
          <RulesTab tags={all} rules={rules} />
        ) : (
          <>
            <TagFilters filters={filters} setFilters={setFilters} shown={visible.length} total={all.length} />

            <TagTable
              tags={shown}
              checked={checked}
              editing={editing}
              sort={sort}
              onSort={sortBy}
              onCheckAll={(on) => {
                // La case de l'en-tête : les tags affichés seulement (TAGM-04.5).
                const next = new Set(checked);
                for (const t of shown) if (on) next.add(t.id);
                else next.delete(t.id);
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
              total={visible.length}
              more={Math.min(STEP, visible.length - shown.length)}
              onMore={() => setLimit((n) => n + STEP)}
            />

            {checkedTags.length > 0 && (
              <BulkBar
                tags={checkedTags}
                matching={visible.length}
                onSelectAll={() => setChecked(new Set([...checked, ...visible.map((t) => t.id)]))}
                allSelected={visible.every((t) => checked.has(t.id))}
                onMerge={() => setDialog("merge")}
                onDelete={() => setDeleting(checkedTags)}
                onClear={() => setChecked(new Set())}
              />
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
        {dialog === "similar" && (
          <SimilarTagsDialog
            groups={groups}
            initial={similar}
            onSearch={(tag, snapshot) => {
              window.history.replaceState({ ...window.history.state, [SIMILAR]: snapshot }, "");
              searchInLibrary([tag.name]);
            }}
            onClose={() => {
              // Fermée : l'étape ne la rouvrira plus.
              const { [SIMILAR]: _closed, ...state } = window.history.state ?? {};
              window.history.replaceState(state, "");
              setSimilar(undefined);
              setDialog(null);
            }}
          />
        )}
        {dialog === "import" && <ImportTagsDialog onClose={() => setDialog(null)} />}
        {dialog === "unused" && <UnusedTagsDialog tags={unused} onClose={() => setDialog(null)} />}
        {dialog === "merge" && <MergeTagsDialog tags={checkedTags} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
      </main>
    </>
  );
}
