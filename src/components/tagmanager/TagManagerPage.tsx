// Page « Gestionnaire de tags » (TAGM-04), même esprit que la v8 en plus compact : onglets « Tags » et
// « Synonymes et parents » sur toute la largeur de la fenêtre, juste sous l'en-tête (TAGM-04.1, TAGM-15.2) ;
// en-tête de la page (retour à la bibliothèque, titre, « N tags · M médias taggés »). Largeur : 72 % de la
// fenêtre (TAGM-04.2 : +10 % de chaque côté sur l'écran 1080p), toute la fenêtre si elle est étroite.
// Onglet « Tags » : boutons Créer un tag (TAGM-04.8) · Tags proches (TAGM-13) · Exporter (pop-in) · Importer
// (TAGM-10) · Supprimer les tags non utilisés (TAGM-08) ; filtres (TagFilters : nom, catégorie, Masqués, Rares) ; tableau
// trié et virtualisé, 100 tags affichés puis « Afficher 100 de plus » (TAGM-04.5 ; un nouveau filtre ou tri
// repart des 100 premiers) ; barre des actions groupées quand des tags sont cochés (TAGM-11 ; Échap décoche
// tout, TAGM-11.1). Onglet « Synonymes et parents » : RulesTab, avec « Tags proches » seul au bout à droite de
// l'en-tête (TAGM-13.4). Les onglets, l'en-tête de la page et les filtres restent en haut pendant le
// défilement, les titres des colonnes du tableau dessous (retour T3, point TAGM-15.3) ; un nouveau filtre ou
// tri ramène en haut de la page, en glissant (retour T3, point TAGM-04.13). L'état de l'onglet « Tags » est
// rangé par page d'historique (tagsTabState.ts, retour T3, point TAGM-04.14).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Tags } from "lucide-react";
import { createStore, type StoreApi } from "zustand";

import { GridBadge } from "@/components/library/GridBadge";
import { SynonymTagDialog, renameTag } from "@/components/tags/RenameTagDialog";
import { TagDeleteDialog } from "@/components/tags/TagDeleteDialog";
import { tagMenu } from "@/components/tags/tagMenu";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { useElementHeight } from "@/hooks/useElementHeight";
import { useTagRules } from "@/hooks/useTagRules";
import type { ManagedTag, Renamed } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import { navigate, useTagTab, type TagTab } from "@/lib/router";
import { displayTag } from "@/lib/tags";
import { hasEscapeLayer } from "@/lib/escape";
import { SIMILAR } from "@/lib/historySteps";
import { similarBlocks } from "@/lib/similarTags";
import { cn } from "@/lib/utils";
import { showGridBadge } from "@/stores/badge";
import { searchInLibrary } from "@/stores/search";
import { inField } from "@/stores/selection";
import { useUI } from "@/stores/ui";
import { BulkBar } from "./BulkBar";
import { CreateSynonymsDialog, UnusedTagsDialog } from "./CleanupDialogs";
import { SimilarTagsDialog, type SimilarSnapshot } from "./SimilarTagsDialog";
import { ExportTagsDialog } from "./ExportTagsDialog";
import { ImportTagsDialog } from "./ImportTagsDialog";
import { NewTagButton } from "./NewTagButton";
import { RulesTab } from "./RulesTab";
import { TagFilters } from "./TagFilters";
import { Tabs } from "./TagManagerTabs";
import { TagTable } from "./TagTable";
import { freshTagsTab, NO_FILTERS, STEP, useTagsEntry, useTagsTab, type TagsTabState } from "./tagsTabState";
import { useTagList } from "./useTagList";

const TOOL = "h-8 gap-1.5 border-border bg-card/60 text-xs hover:bg-secondary hover:text-foreground";
/** Largeur de la page : 72 % de la fenêtre (TAGM-04.2), toute la fenêtre si elle est étroite. */
const PAGE = "mx-auto w-full max-w-[max(72rem,72vw)] px-4 lg:px-6";

type Dialog = "similar" | "import" | "export" | "unused" | "merge" | null;

export function TagManagerPage() {
  return useTagTab() === "tags" ? <TagsTabEntry /> : <ManagerPage tab="rules" store={null} />;
}

/** Onglet « Tags » : recréé avec l'état de sa page à chaque retour arrière / avant vers une autre page. */
function TagsTabEntry() {
  const { key, store } = useTagsEntry();
  return <ManagerPage key={key} tab="tags" store={store} />;
}

function ManagerPage({ tab, store }: { tab: TagTab; store: StoreApi<TagsTabState> | null }) {
  const { list: categories } = useCategories();
  const rules = useTagRules();
  // Onglet « Synonymes et parents » : un état de passage (ses filtres ne servent pas).
  const [spare] = useState(() => createStore<TagsTabState>(freshTagsTab));
  const state = store ?? spare;
  const { data, visible, filtered, filters, setFilters, sort, sortBy } = useTagList(rules, state);
  const all = useMemo(() => data?.tags ?? [], [data]);
  const { limit, checked, setChecked } = useTagsTab(state, tab === "tags" && !!data);
  const topRef = useRef<HTMLDivElement>(null);
  const topHeight = useElementHeight(topRef);
  const shown = useMemo(() => visible.slice(0, limit), [visible, limit]);
  const byId = useMemo(() => new Map(all.map((t) => [t.id, t])), [all]);
  const tagOf = useCallback((id: number) => byId.get(id), [byId]);
  const [editing, setEditing] = useState<number | null>(null);
  const [merging, setMerging] = useState<{ source: ManagedTag; existing: Extract<Renamed, { kind: "exists" }> } | null>(null);
  const [deleting, setDeleting] = useState<ManagedTag[] | null>(null);
  // Retour arrière sur l'étape d'une pop-in « Tags proches » quittée par une loupe : elle se rouvre (TAGM-13.1).
  const [similar, setSimilar] = useState(() => (window.history.state?.[SIMILAR] as SimilarSnapshot | undefined) ?? undefined);
  const [dialog, setDialog] = useState<Dialog>(similar ? "similar" : null);
  const similarLevel = useUI((s) => s.similarLevel);
  // Tags proches : ils tiennent compte des groupes de synonymes et des paires écartées (lot R6-2).
  const blocks = useMemo(() => similarBlocks(all, data?.ignores ?? [], rules.groupOf, similarLevel), [all, data, rules, similarLevel]);
  // « Non utilisé » : sans média, et ni dans un groupe de synonymes (fusionné ou non) ni dans une règle de parents
  // (enfant ou parent) : ceux-là servent, ils ne sont même pas proposés (retour T3, point TAGM-08.2).
  const unused = useMemo(
    () => all.filter((t) => t.mediaCount === 0 && !rules.groupOf.has(t.id) && !rules.parentsOf.has(t.id) && !rules.childrenOf.has(t.id)),
    [all, rules],
  );
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

  const similarButton = (
    <Button data-zone="gestionnaire-tags.proches" variant="outline" size="sm" onClick={() => setDialog("similar")} className={TOOL}>
      Tags proches ({formatNumber(blocks.length)})
    </Button>
  );

  return (
    <>
      {/* Haut fixe, sans trait dessous (choix de l'utilisateur), collé sous l'en-tête de 57 px (bordure
          comprise) : à sa place de départ, sans saut d'1 px au premier défilement. */}
      <div ref={topRef} data-zone="gestionnaire-tags.haut" className="sticky top-[57px] z-30 bg-background">
        <Tabs />
        <div className={cn(PAGE, "pt-5")}>
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
                  setFilters({ ...NO_FILTERS, text: displayTag(name) });
                  showGridBadge(`Tag « ${displayTag(name)} » créé`);
                }}
              />
              {tab === "tags" && similarButton}
              {/* Pop-in d'export à la place du petit menu (retour T3, point TAGM-18.8, lot R8-1). */}
              <Button data-zone="gestionnaire-tags.exporter" variant="outline" size="sm" onClick={() => setDialog("export")} className={TOOL}>
                Exporter
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
          {tab === "tags" && <TagFilters filters={filters} setFilters={setFilters} shown={visible.length} total={all.length} />}
        </div>
      </div>
      <main
        data-zone="gestionnaire-tags"
        style={{ "--haut-fixe": `${topHeight}px` } as React.CSSProperties}
        className={cn(PAGE, "pb-5", tab === "rules" && "flex min-h-0 flex-1 flex-col")}
      >
        {tab === "rules" ? (
          <RulesTab tags={all} rules={rules} />
        ) : (
          <>
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
              onMore={() => state.setState((s) => ({ limit: s.limit + STEP }))}
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

        {merging && <SynonymTagDialog source={merging.source} existing={merging.existing} onCancel={() => setMerging(null)} onDone={() => setMerging(null)} />}
        {deleting && <TagDeleteDialog tags={deleting} onCancel={() => setDeleting(null)} onDone={() => setDeleting(null)} />}
        {dialog === "similar" && (
          <SimilarTagsDialog
            blocks={blocks}
            ignores={data?.ignores ?? []}
            tagOf={tagOf}
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
        {dialog === "export" && (
          <ExportTagsDialog visible={visible} filtered={filtered} all={all} checked={checkedTags} categories={categories} rules={rules} tagOf={tagOf} onClose={() => setDialog(null)} />
        )}
        {dialog === "unused" && <UnusedTagsDialog tags={unused} onClose={() => setDialog(null)} />}
        {dialog === "merge" && <CreateSynonymsDialog checked={checkedTags} groupOf={rules.groupOf} tagOf={tagOf} onClose={() => setDialog(null)} />}
      </main>
    </>
  );
}
