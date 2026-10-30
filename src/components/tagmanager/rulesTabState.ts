// État de l'onglet « Synonymes et parents » gardé quand on le quitte (retour T3, points TAGM-15.19 et
// TAGM-15.20, 30/10) : un retour arrière / avant n'est pas un rechargement : les champs, les groupes dépliés, le
// filtre des parents, l'ordre des groupes et le défilement des listes sont retrouvés. Un changement de page par
// un clic (onglet, autre page) remet tout à neuf : l'ordre des groupes redevient alphabétique.

import { create } from "zustand";

import type { PillDoc } from "@/lib/pillText";
import { onClickNavigation } from "@/lib/router";

/** Pastille du formulaire des groupes : un tag (`id`), ou un nom qui n'en est pas un (`id` vide). */
export type Chip = { name: string; id: number | null };

type State = {
  principal: PillDoc<Chip> | null;
  names: PillDoc<Chip> | null;
  /** Interrupteur « Fusionner » ; `auto` : tag principal et état du groupe pour lesquels il a été réglé
   *  d'office (D2.2), pour ne pas le régler à nouveau au retour. */
  merge: { on: boolean; auto: string | null };
  parentTexts: [string, string];
  /** Groupes dépliés. */
  open: number[];
  /** Ordre des groupes, figé jusqu'au rechargement de l'onglet. */
  order: number[] | null;
  parentFilter: string;
  /** Défilement de chaque liste, par zone. */
  scroll: Record<string, number>;
};

const FRESH: State = {
  principal: null,
  names: null,
  merge: { on: false, auto: null },
  parentTexts: ["", ""],
  open: [],
  order: null,
  parentFilter: "",
  scroll: {},
};

export const useRulesTab = create<State>(() => FRESH);
onClickNavigation(() => useRulesTab.setState(FRESH));

/** Ordre figé : celui déjà affiché ; un nouveau groupe se place avant le premier groupe déjà affiché qui le
 *  suit dans l'ordre alphabétique ; un groupe disparu est retiré. */
export function frozenOrder(alphabetical: number[], frozen: number[] | null): number[] {
  if (!frozen) return alphabetical;
  const present = new Set(alphabetical);
  const out = frozen.filter((id) => present.has(id));
  const known = new Set(out);
  alphabetical.forEach((id, i) => {
    if (known.has(id)) return;
    const next = alphabetical.slice(i + 1).find((x) => known.has(x));
    out.splice(next === undefined ? out.length : out.indexOf(next), 0, id);
    known.add(id);
  });
  return out;
}
