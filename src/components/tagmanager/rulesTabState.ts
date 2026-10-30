// État de l'onglet « Synonymes et parents », un par page de l'historique (retour T3, points TAGM-15.19 et
// TAGM-15.20, 30/10) : chaque ouverture de l'onglet par un clic est une nouvelle page, avec un état neuf (ordre
// des groupes alphabétique) ; un retour arrière / avant sur une page de l'onglet, même après être allé ailleurs
// par un clic, retrouve son état : champs, interrupteur « Fusionner », groupes dépliés, filtres, ordre des
// groupes, défilement des listes. Les données, elles, sont communes : un groupe créé ou une fusion faite dans
// une autre page de l'onglet s'y voit. Le numéro de la page est noté dans l'état de l'historique (`regles`).

import { createContext, useContext, useEffect, useState } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

import type { PillDoc } from "@/lib/pillText";
import { openTagTab } from "@/lib/router";
import type { RuleDocs } from "./RuleForm";

/** Pastille du formulaire des groupes : un tag (`id`), ou un tag fusionné tapé par son nom (`id` vide). */
export type Chip = { name: string; id: number | null };

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
  /** Ordre des groupes, figé pour cette page. */
  order: number[] | null;
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
  order: null,
  groupFilter: "",
  parentFilter: "",
  scroll: {},
};

const STEP = "regles";
const RULES = "#/tags/regles";
const stores = new Map<string, StoreApi<RulesTabState>>();
/** Filtre posé par le lien « Gérer dans « Synonymes et parents » » de la colonne du tableau des tags. */
let pendingFilter: string | null = null;
let counter = 0;

/** Ouvre l'onglet (nouvelle page) filtré sur ce texte. */
export function openRulesFiltered(text: string) {
  pendingFilter = text;
  openTagTab("rules");
}

/** Numéro de la page d'historique en cours ; une page qui n'en a pas (nouvelle ouverture) en reçoit un. */
function entryKey(): string {
  const state = (window.history.state ?? {}) as Record<string, unknown>;
  if (typeof state[STEP] === "string") return state[STEP];
  const key = `${Date.now()}-${++counter}`;
  window.history.replaceState({ ...state, [STEP]: key }, "");
  return key;
}

function storeFor(key: string): StoreApi<RulesTabState> {
  let store = stores.get(key);
  if (!store) {
    const groupFilter = pendingFilter ?? "";
    pendingFilter = null;
    store = createStore<RulesTabState>(() => ({ ...FRESH, groupFilter }));
    stores.set(key, store);
  }
  return store;
}

/** Page de l'onglet affichée, relue à chaque retour arrière / avant ; son état. */
export function useRulesEntry(): { key: string; store: StoreApi<RulesTabState> } {
  const [key, setKey] = useState(entryKey);
  useEffect(() => {
    const onPop = () => window.location.hash.startsWith(RULES) && setKey(entryKey());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return { key, store: storeFor(key) };
}

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
