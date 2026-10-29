// Termes actifs de la recherche (SRCH-07), sous le champ de la barre latérale : « Tout effacer »
// centré sur sa propre ligne (SRCH-19), puis UNE ligne de pastilles (SRCH-18). Les deux lignes
// gardent leur place même sans recherche (« Tout effacer » grisé, texte gris dans la ligne) : la
// liste des tags dessous ne bouge jamais. Pastilles en trop : « +N » collé au bord droit ; la
// souris qui s'approche de la ligne déplie les autres par-dessus la liste des tags, elles se
// replient quand elle s'éloigne (même principe que la barre du bas en plein écran, VIEW-18).
// Clic droit : menu du terme (CTX-12). Nom coupé par « … » : bulle avec le nom complet.
// Nom de fichier cherché (SRCH-26) : pastille blanche, la première, retirée par sa croix ; sa loupe est
// centrée comme la croix et son texte placé comme celui d'un tag (retour T3, point SRCH-26.1) ; exclu
// (« -abc », SRCH-26.2) : « −abc » rayé. Menu : Copier le texte · Exclure / Inclure ce nom · Retirer de
// la recherche ‖ Tout effacer.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSearch } from "lucide-react";

import { termMenu } from "@/components/tags/tagMenu";
import { TagPill } from "@/components/tags/TagPill";
import { FALLBACK_COLOR, useCategories } from "@/hooks/useCategories";
import { useUnfolded } from "@/hooks/useUnfolded";
import { api } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { displayTag, splitFile, splitTerm, withDescription } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { useSearch } from "@/stores/search";

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
      title={withDescription(exclude ? `Exclut ${displayTag(name)}` : undefined, tag?.description)}
      struck={exclude}
      onContextMenu={(e) => openContextMenu(e, () => termMenu(term, tag, list))}
      fullTitleIfCut
      className={className}
    >
      {label}
    </TagPill>
  );
}

/** Couleur de la pastille du nom de fichier : blanc (texte de l'interface). */
const FILE_COLOR = "#ececef";

/** Pastille du nom de fichier cherché (SRCH-26). */
function FilePill({ file, className }: { file: string; className?: string }) {
  const setFile = useSearch((s) => s.setFile);
  const setTerms = useSearch((s) => s.setTerms);
  const { exclude, text } = splitFile(file);
  return (
    <TagPill
      color={FILE_COLOR}
      icon={<FileSearch className="h-3 w-3 shrink-0" />}
      onRemove={() => setFile(null)}
      removeLabel="Retirer le nom de fichier de la recherche"
      title={exclude ? `Nom de fichier ne contenant pas « ${text} »` : `Nom de fichier contenant « ${text} »`}
      struck={exclude}
      onContextMenu={(e) =>
        openContextMenu(e, () => [
          { label: "Copier le texte", run: () => void api.writeClipboardText(text) },
          exclude ? { label: "Inclure ce nom", run: () => setFile(text) } : { label: "Exclure ce nom", run: () => setFile(`-${text}`) },
          { label: "Retirer de la recherche", run: () => setFile(null) },
          "separator",
          { label: "Tout effacer", run: () => setTerms([]) },
        ])
      }
      fullTitleIfCut
      className={className}
    >
      <span data-zone="barre-laterale.recherche.fichier">{exclude ? `−${text}` : text}</span>
    </TagPill>
  );
}

/** Souris sur un élément posé par-dessus la barre latérale (liste de suggestions, menu…) : rien ne
 *  se déplie dessous. */
const covered = (target: EventTarget | null) =>
  !(target instanceof Element) ||
  !target.closest('[data-zone="barre-laterale"]') ||
  target.closest('[data-zone$=".suggestions"]') !== null;

export function SearchTerms() {
  const terms = useSearch((s) => s.terms);
  const file = useSearch((s) => s.file);
  const setTerms = useSearch((s) => s.setTerms);
  const count = terms.length + (file ? 1 : 0);
  const panelRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  /** Pastilles qui ne tiennent pas sur la ligne (les dernières). */
  const [hidden, setHidden] = useState(0);
  // La ligne de pastilles, puis les pastilles dépliées (hooks/useUnfolded.ts).
  const rectOf = useCallback(() => panelRef.current?.getBoundingClientRect(), []);
  const unfolded = useUnfolded(rectOf, hidden > 0, covered);

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
          disabled={count === 0}
          className="px-1 text-xs text-muted-foreground transition enabled:hover:text-foreground disabled:text-muted-foreground/40"
        >
          Tout effacer
        </button>
      </div>
      {/* Hauteur d'une ligne de pastilles, toujours réservée. Dépliée, la ligne garde sa place : les
          suivantes s'ajoutent dessous, sur un fond posé par-dessus la liste des tags. */}
      <div data-zone="barre-laterale.recherche.termes" className="relative mt-1.5 h-[22px]">
        {count === 0 && <p className="text-center text-xs leading-[22px] text-muted-foreground/60">Aucun tag dans la recherche</p>}
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
            {file && <FilePill file={file} className={cn("mr-1.5 mb-1.5 max-w-[calc(100%_-_var(--plus-w))] align-top", !unfolded && count - 1 < hidden && "invisible")} />}
            {terms.map((term, i) => {
              const at = i + (file ? 1 : 0);
              return (
                // Repliées, les pastilles en trop restent en place (mesurées) mais invisibles : ni clic
                // ni Tab ne les atteignent.
                <TermPill
                  key={term}
                  term={term}
                  className={cn(
                    "mr-1.5 mb-1.5 align-top",
                    at === 0 && "max-w-[calc(100%_-_var(--plus-w))]",
                    !unfolded && at >= count - hidden && "invisible",
                  )}
                />
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
