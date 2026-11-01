// Chaînes d'une règle dans la pop-in « Supprimer la règle ? » (retour T3, point TAGM-16.1, croquis de
// l'utilisateur du 28/10) : chaque chaîne en colonne, du tag le plus bas au plus haut, une flèche entre deux
// tags, dans un cadre gris ; la règle supprimée sur un gris plus clair ; la suite de la chaîne (au-dessus du
// parent) sur un fond rouge pâle quand la case de retrait est cochée. Deux chaînes à la fois : les autres
// défilent vers la droite (molette comprise) et un bout de la suivante dépasse. Toutes les colonnes prennent la
// hauteur de la plus haute, limitée : une longue chaîne défile dans sa colonne, ouverte sur la règle, et la
// pop-in ne change pas de taille quand on passe d'une chaîne à l'autre.
// Pop-in de suppression d'un tag (`deleted`, retour T3, point TAGM-16.8) : la même présentation, `at` étant le tag
// supprimé, rayé ; ses règles (le tag au-dessous, lui, le tag au-dessus) sur le gris plus clair, la suite au-dessus
// en rouge pâle quand la case est cochée.

import { Fragment, useEffect, useLayoutEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";

import type { Chain } from "@/lib/rulesApi";
import { displayTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

/** Écart entre deux colonnes (0,75 rem), repris dans le calcul de leur largeur. */
const GAP = "0.75rem";

/** Nom entier, centré ; un nom plus large que la colonne passe à la ligne ; `struck` : le tag supprimé. */
function Tag({ name, struck }: { name: string; struck?: boolean }) {
  return (
    <span className={cn("block px-1 text-center font-mono text-xs text-foreground [overflow-wrap:break-word]", struck && "text-muted-foreground line-through")}>
      {displayTag(name)}
    </span>
  );
}

const Arrow = () => <ArrowDown className="mx-auto my-0.5 h-3 w-3 text-muted-foreground" />;

/** Tags à la suite, une flèche entre deux (et une avant le premier si `arrowFirst`) ; `struck` : place du tag rayé. */
function Tags({ names, arrowFirst = false, struck = -1 }: { names: string[]; arrowFirst?: boolean; struck?: number }) {
  return names.map((name, i) => (
    <Fragment key={name}>
      {(i > 0 || arrowFirst) && <Arrow />}
      <Tag name={name} struck={i === struck} />
    </Fragment>
  ));
}

function Column({ chain, removing, deleted, width }: { chain: Chain; removing: boolean; deleted: boolean; width: string }) {
  // Règle supprimée : son enfant et son parent ; tag supprimé : lui, et les tags juste au-dessous et au-dessus.
  const start = deleted ? Math.max(0, chain.at - 1) : chain.at;
  const below = chain.tags.slice(0, start);
  const rule = chain.tags.slice(start, chain.at + 2);
  const above = chain.tags.slice(chain.at + 2);
  const ref = useRef<HTMLDivElement>(null);
  const ruleRef = useRef<HTMLDivElement>(null);
  // Longue chaîne : la colonne s'ouvre centrée sur la règle.
  useLayoutEffect(() => {
    const col = ref.current;
    const box = ruleRef.current;
    if (col && box && col.scrollHeight > col.clientHeight) col.scrollTop = box.offsetTop - (col.clientHeight - box.offsetHeight) / 2;
  }, []);
  return (
    <div
      ref={ref}
      data-zone="regle-suppression.chaine"
      style={{ width }}
      className="max-h-60 shrink-0 snap-start overflow-y-auto overscroll-contain rounded-lg border border-border bg-secondary/40 p-1.5"
    >
      {below.length > 0 && (
        <div className="py-1">
          <Tags names={below} />
          <Arrow />
        </div>
      )}
      <div ref={ruleRef} data-zone="regle-suppression.chaine.regle" className="rounded-md bg-white/[0.08] py-1">
        <Tags names={rule} struck={deleted ? chain.at - start : -1} />
      </div>
      {above.length > 0 && (
        <div data-zone="regle-suppression.chaine.suite" className={cn("mt-0.5 rounded-md py-1 transition-colors", removing && "bg-rose-500/[0.12]")}>
          <Tags names={above} arrowFirst />
        </div>
      )}
    </div>
  );
}

export function ChainStrip({ chains, removing, deleted = false }: { chains: Chain[]; removing: boolean; deleted?: boolean }) {
  const strip = useRef<HTMLDivElement>(null);
  // Plus de deux chaînes : la 3e dépasse d'environ 12 % de sa largeur (deux colonnes, deux écarts, 0,12 colonne) ;
  // une ou deux : moitié de la place.
  const width = chains.length > 2 ? `calc((100% - 2 * ${GAP}) / 2.12)` : `calc((100% - ${GAP}) / 2)`;
  // Molette : défilement vers la droite, sauf au-dessus d'une colonne qui peut encore défiler dans ce sens.
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || e.deltaY === 0) return;
      const col = (e.target as HTMLElement).closest<HTMLElement>('[data-zone="regle-suppression.chaine"]');
      const canScroll = col && (e.deltaY > 0 ? col.scrollTop + col.clientHeight < col.scrollHeight - 1 : col.scrollTop > 0);
      if (canScroll) return;
      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: "smooth" });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  return (
    <div
      ref={strip}
      data-zone="regle-suppression.chaines"
      style={{ gap: GAP }}
      className={cn("flex snap-x snap-mandatory overflow-x-auto overscroll-contain pb-1.5", chains.length === 1 && "justify-center")}
    >
      {chains.map((chain, i) => (
        <Column key={i} chain={chain} removing={removing} deleted={deleted} width={width} />
      ))}
    </div>
  );
}
