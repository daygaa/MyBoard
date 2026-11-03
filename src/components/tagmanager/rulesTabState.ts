// État de l'onglet « Synonymes et parents », un par page de l'historique (retour T3, points TAGM-15.19 et
// TAGM-15.20, 30/10) : chaque ouverture de l'onglet par un clic est une nouvelle page, avec un état neuf (ordre
// des groupes alphabétique) ; un retour arrière / avant sur une page de l'onglet, même après être allé ailleurs
// par un clic, retrouve son état : champs, interrupteur « Fusionner », groupes dépliés, filtres, ordre des
// groupes, tris et ordre des listes (retour T3, point TAGM-15.10), défilement des listes. Les données, elles, sont communes : un groupe créé ou une fusion faite dans
// une autre page de l'onglet s'y voit. Le numéro de la page est noté dans l'état de l'historique (`regles`,
// lib/pageStates.ts).

import { createContext, useContext } from "react";
import { useStore, type StoreApi } from "zustand";

import { historyPageStates } from "@/lib/pageStates";
import type { PillDoc } from "@/lib/pillText";
import { openTagTab, tagTabOf } from "@/lib/router";
import type { RuleDocs } from "./RuleForm";
import type { ColumnSort } from "./SortHeader";

/** Pastille du formulaire des groupes : un tag (`id`), un tag fusionné tapé par son nom (`id` vide), ou un tag à
 *  créer avec le groupe (`id` vide, `category` choisie dans la pop-in, retour T3, point TAGM-15.24). */
export type Chip = { name: string; id: number | null; category?: number };

/** Colonnes triables : groupes (nom du principal, médias, fusion) ; règles (enfant puis parent, médias, On/Off). */
export type GroupSortKey = "name" | "media" | "merged";
export type ParentSortKey = "name" | "media" | "enabled";

export type RulesTabState = {
  principal: PillDoc<Chip> | null;
  names: PillDoc<Chip> | null;
  /** Interrupteur « Fusionner » ; `auto` : tag principal et état du groupe pour lesquels il a été réglé
   *  d'office (D2.2), pour ne pas le régler à nouveau au retour. */
  merge: { on: boolean; auto: string | null };
  /** Champs « Enfant » et « Parent » du formulaire des règles. */
  parentDocs: RuleDocs;
  /** Groupes dépliés. */
  open: number[];
  /** Tri de chaque liste (clic sur un titre). */
  groupSort: ColumnSort<GroupSortKey>;
  parentSort: ColumnSort<ParentSortKey>;
  /** Ordre des groupes et des règles, figé pour cette page jusqu'au prochain clic sur un titre (vide : à refaire). */
  order: number[] | null;
  parentOrder: number[] | null;
  groupFilter: string;
  parentFilter: string;
  /** Défilement de chaque liste, par zone. */
  scroll: Record<string, number>;
};

const FRESH: RulesTabState = {
  principal: null,
  names: null,
  merge: { on: false, auto: null },
  parentDocs: [null, null],
  open: [],
  groupSort: { key: "name", desc: false },
  parentSort: { key: "name", desc: false },
  order: null,
  parentOrder: null,
  groupFilter: "",
  parentFilter: "",
  scroll: {},
};

/** Filtre posé par le lien « Gérer dans « Synonymes et parents » » de la colonne du tableau des tags. */
let pendingFilter: string | null = null;

/** Ouvre l'onglet (nouvelle page) filtré sur ce texte. */
export function openRulesFiltered(text: string) {
  pendingFilter = text;
  openTagTab("rules");
}

/** Page de l'onglet affichée, relue à chaque retour arrière / avant ; son état. */
export const useRulesEntry = historyPageStates<RulesTabState>(
  "regles",
  (hash) => tagTabOf(hash) === "rules",
  () => {
    const groupFilter = pendingFilter ?? "";
    pendingFilter = null;
    return { ...FRESH, groupFilter };
  },
);

const Context = createContext<StoreApi<RulesTabState> | null>(null);
export const RulesTabProvider = Context.Provider;

/** État de la page de l'onglet (lecture et écriture hors affichage : `getState`, `setState`). */
export function useRulesStore(): StoreApi<RulesTabState> {
  const store = useContext(Context);
  if (!store) throw new Error("useRulesStore : hors de l'onglet « Synonymes et parents »");
  return store;
}

/** Une partie de l'état, redessinée quand elle change. */
export function useRulesTab<U>(selector: (s: RulesTabState) => U): U {
  return useStore(useRulesStore(), selector);
}

/** Ordre figé : celui déjà affiché ; un nouvel élément se place avant le premier élément déjà affiché qui le
 *  suit dans l'ordre du tri ; un élément disparu est retiré. */
export function frozenOrder(sorted: number[], frozen: number[] | null): number[] {
  if (!frozen) return sorted;
  const present = new Set(sorted);
  const out = frozen.filter((id) => present.has(id));
  const known = new Set(out);
  sorted.forEach((id, i) => {
    if (known.has(id)) return;
    const next = sorted.slice(i + 1).find((x) => known.has(x));
    out.splice(next === undefined ? out.length : out.indexOf(next), 0, id);
    known.add(id);
  });
  return out;
}
