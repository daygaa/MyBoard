// Termes actifs de la recherche (SRCH-07), sous le champ de la barre latérale : « Tout effacer »
// centré sur sa propre ligne (SRCH-19), puis UNE ligne de pastilles (SRCH-18). Les deux lignes
// gardent leur place même sans recherche (« Tout effacer » grisé, texte gris dans la ligne) : la
// liste des tags dessous ne bouge jamais. Pastilles en trop : « +N » collé au bord droit ; la
// souris qui s'approche de la ligne déplie les autres par-dessus la liste des tags, elles se
// replient quand elle s'éloigne (même principe que la barre du bas en plein écran, VIEW-18).
// Clic droit : menu du terme (CTX-12). Nom coupé par « … » : bulle avec le nom complet.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";

import { termMenu } from "@/components/tags/tagMenu";
import { TagPill } from "@/components/tags/TagPill";
import { FALLBACK_COLOR, useCategories } from "@/hooks/useCategories";
import { api } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { displayTag, splitTerm } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { useSearch } from "@/stores/search";

/** Distance d'approche de la ligne de pastilles pour déplier, et marge autour des pastilles dépliées
 *  avant de les replier (choix du 15/10), à gauche, à droite et en dessous seulement : au-dessus se
 *  trouve « Tout effacer », qui ne doit rien déplier (16/10). Elle ne bloque aucun clic. */
const BUFFER = 16;

/** Pastille d'un terme actif : couleur de la catégorie du tag s'il existe. */
function TermPill({ term, className }: { term: string; className?: string }) {
  const removeTerm = useSearch((s) => s.removeTerm);
  const { color, list } = useCategories();
  const { exclude, name, prefix } = splitTerm(term);
  const { data: tag } = useQuery({ queryKey: ["tag", name], queryFn: () => api.findTag(name), enabled: !prefix });
  const label = `${exclude ? "−" : ""}${displayTag(name)}${prefix ? "*" : ""}`;
  return (
    <TagPill
      color={tag ? color(tag.categoryId) : prefix ? "#d9a94e" : FALLBACK_COLOR}
      onRemove={() => removeTerm(term)}
      removeLabel={`Retirer « ${label} » de la recherche`}
      title={exclude ? `Exclut ${displayTag(name)}` : undefined}
      struck={exclude}
      onContextMenu={(e) => openContextMenu(e, () => termMenu(term, tag, list))}
      fullTitleIfCut
      className={className}
    >
      {label}
    </TagPill>
  );
}

/** Souris sur un élément posé par-dessus la barre latérale (liste de suggestions, menu…) : rien ne
 *  se déplie dessous. */
const covered = (target: EventTarget | null) =>
  !(target instanceof Element) ||
  !target.closest('[data-zone="barre-laterale"]') ||
  target.closest('[data-zone$=".suggestions"]') !== null;

/** Vrai quand les pastilles en trop sont dépliées : la souris est arrivée près de la ligne de
 *  pastilles, et ne s'est pas encore éloignée des pastilles dépliées (`panelRef` : l'une puis
 *  l'autre). */
function useUnfolded(panelRef: RefObject<HTMLElement | null>, active: boolean) {
  const [unfolded, setUnfolded] = useState(false);
  useEffect(() => {
    if (!active) return;
    let was = false;
    const update = (next: boolean) => {
      if (next === was) return;
      was = next;
      setUnfolded(next);
    };
    const onMove = (e: MouseEvent) => {
      const r = panelRef.current?.getBoundingClientRect();
      const near = !!r && e.clientX >= r.left - BUFFER && e.clientX <= r.right + BUFFER && e.clientY >= r.top && e.clientY <= r.bottom + BUFFER;
      update(near && (was || !covered(e.target)));
    };
    const onLeave = () => update(false);
    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      setUnfolded(false);
    };
  }, [panelRef, active]);
  return unfolded;
}

export function SearchTerms() {
  const terms = useSearch((s) => s.terms);
  const setTerms = useSearch((s) => s.setTerms);
  const panelRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  /** Pastilles qui ne tiennent pas sur la ligne (les dernières). */
  const [hidden, setHidden] = useState(0);
  const unfolded = useUnfolded(panelRef, hidden > 0);

  // Mesure avant chaque affichage : le « +N » prend sa place au bout de la 1re ligne, qui peut alors
  // contenir une pastille de moins (nouvelle mesure, toujours avant que l'écran soit dessiné).
  const measure = useCallback(() => {
    const line = lineRef.current;
    if (!line) return;
    // 1re pastille trop longue : coupée à côté du « +N » (marges comprises) plutôt que renvoyée dessous.
    line.style.setProperty("--plus-w", `${(plusRef.current?.offsetWidth ?? -12) + 12}px`);
    const top = line.getBoundingClientRect().top;
    const pills = line.querySelectorAll(':scope > [data-zone="tag.pastille"]');
    setHidden([...pills].filter((p) => p.getBoundingClientRect().top > top + 1).length);
  }, []);
  useLayoutEffect(measure);
  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    const observer = new ResizeObserver(measure);
    observer.observe(line);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <>
      <div className="mt-2 flex justify-center">
        <button
          type="button"
          data-zone="barre-laterale.recherche.tout-effacer"
          onClick={() => setTerms([])}
          disabled={terms.length === 0}
          className="px-1 text-xs text-muted-foreground transition enabled:hover:text-foreground disabled:text-muted-foreground/40"
        >
          Tout effacer
        </button>
      </div>
      {/* Hauteur d'une ligne de pastilles, toujours réservée. Dépliée, la ligne garde sa place : les
          suivantes s'ajoutent dessous, sur un fond posé par-dessus la liste des tags. */}
      <div data-zone="barre-laterale.recherche.termes" className="relative mt-1.5 h-[22px]">
        {terms.length === 0 && <p className="text-center text-xs leading-[22px] text-muted-foreground/60">Aucun tag dans la recherche</p>}
        <div ref={panelRef} className={cn("absolute inset-x-0 top-0 z-30", !unfolded && "h-full")}>
          {/* Fond : la marge du bas des pastilles (6 px) sert de marge intérieure. */}
          {unfolded && <div className="absolute -inset-x-2 -top-1.5 bottom-0 -z-10 rounded-lg border border-border bg-card shadow-lg" />}
          {/* Pastilles à la suite (comme du texte) ; le « +N » flotte à droite de la 1re ligne
              seulement : les lignes dépliées en dessous ont toute la largeur. */}
          <div ref={lineRef} className={cn("leading-none", !unfolded && "h-full overflow-hidden")}>
            {hidden > 0 && (
              <span
                ref={plusRef}
                data-zone="barre-laterale.recherche.termes.plus"
                className={cn(
                  "float-right ml-1.5 rounded-md border border-border px-1.5 py-0.5 text-xs tabular-nums",
                  unfolded ? "text-foreground" : "text-muted-foreground",
                )}
              >
                +{hidden}
              </span>
            )}
            {terms.map((term, i) => (
              // Repliées, les pastilles en trop restent en place (mesurées) mais invisibles : ni clic
              // ni Tab ne les atteignent.
              <TermPill
                key={term}
                term={term}
                className={cn(
                  "mr-1.5 mb-1.5 align-top",
                  i === 0 && "max-w-[calc(100%_-_var(--plus-w))]",
                  !unfolded && i >= terms.length - hidden && "invisible",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
