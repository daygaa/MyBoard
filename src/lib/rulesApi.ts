// Groupes de synonymes et tags parents (TAGM-15 à TAGM-18, refonte TAGM-20) : appels au cœur Rust
// (src-tauri/src/tag_rules.rs, tag_import.rs) et types échangés.

import { invoke } from "@tauri-apps/api/core";

import type { NewTag, SharedTag } from "./api";

/** Nom d'un groupe (hors principal) : relié (`tagId`, un vrai tag) ou fusionné (`tagId` vide) ; `media` :
 *  médias du tag, ou médias notés pour défaire la fusion. */
/** Nom d'un groupe : toujours un tag (décision B), fusionné ou non ; `media` : ceux du tag, ou ceux notés à sa fusion. */
export type NameRow = { id: number; tagId: number; name: string; merged: boolean; media: number };
/** Groupe de synonymes ; `media` : médias que trouve la recherche d'un de ses noms. */
export type GroupRow = { id: number; principalId: number; principalName: string; media: number; names: NameRow[]; createdAt: number };
/** Règle « enfant → parent » ; `enabled` = son interrupteur (D-047) ; `media` : médias qui ont reçu le
 *  parent par elle. Lot R5 : `childFrom` / `parentFrom`, tag d'origine d'une règle déplacée par une fusion (repère
 *  « = ») ; `aside` : règle mise de côté, le tag fusionné qu'elle cite et son principal. */
export type ParentRow = {
  id: number;
  childId: number;
  parentId: number;
  enabled: boolean;
  media: number;
  createdAt: number;
  childName: string;
  parentName: string;
  childFrom: string | null;
  parentFrom: string | null;
  aside: { name: string; principal: string } | null;
};
/** Une règle par ses noms (règles restées sur le principal à une défusion). */
export type RuleName = { child: string; parent: string };
/** Ce qu'une fusion ou un changement de principal fait à une règle (pop-ins, lot R5) : réécrite (`newChild` →
 *  `newParent`), mise de côté (`reason` ; doublon ou case « Étendre » : la règle réécrite), plus mise de côté, ou
 *  règle du principal qui peut s'étendre aux médias des tags fusionnés (`of`). `extend` : la case « Étendre » et le
 *  nombre de médias qui recevraient le parent (D11.3) ; vide : pas de case. */
export type RuleChange = {
  id: number;
  kind: "moved" | "aside" | "back" | "principal";
  child: string;
  parent: string;
  newChild: string | null;
  newParent: string | null;
  reason: "duplicate" | "loop" | null;
  extend: number | null;
  of: string[];
};
/** Action dont la pop-in montre l'effet sur les règles. */
export type PlannedChange =
  | { kind: "name"; id: number }
  | { kind: "group"; id: number }
  | { kind: "create"; principal: number; names: string[]; newTags: NewTag[]; merge: boolean; promote: boolean }
  | { kind: "principal"; group: number; name: number }
  | { kind: "batch"; items: { principal: number; names: string[]; merge: boolean }[] };
export type TagRules = { groups: GroupRow[]; parents: ParentRow[] };

export type PreviewName = { name: string; merged: boolean; media: number };
/** Aperçu du formulaire de création (rien n'est écrit) : voir `group_list.rs`. */
export type GroupPreview = {
  principal: string | null;
  newPrincipal: boolean;
  /** Tag tapé en principal qui est un nom relié d'un groupe ; `principal` est alors celui de ce groupe. */
  member: string | null;
  existing: PreviewName[];
  added: PreviewName[];
  joined: string[];
  fullyMerged: boolean;
  /** Aperçu demandé avec `promote` : principal que remplace le tag choisi, et médias qui passeront de l'un à l'autre. */
  replaced: string | null;
  replacedMedia: number;
};
/** Refus expliqué, ou médias qui ont déjà l'enfant sans le parent (case de la confirmation). */
export type RuleCheck = { error: string | null; media: number };
/** Une chaîne, du tag le plus bas au plus haut (noms) ; `at` : place de l'enfant de la règle (son parent suit). */
export type Chain = { tags: string[]; at: number };
/** Suppression d'une règle : médias où elle a posé le parent, chaînes qui passent par elle. */
export type DeleteCheck = { media: number; chains: Chain[] };

/** Groupe de synonymes d'un code de partage : son tag principal et ses autres noms, fusionnés ou non (lot R8). */
export type SharedGroup = { principal: string; names: { name: string; merged: boolean }[] };
export type SharedRule = { child: string; parent: string; enabled: boolean };
export type SharedList = { tags: SharedTag[]; groups: SharedGroup[]; parents: SharedRule[] };
/** Cases de la pop-in d'import (retour T3, point TAGM-18.4). */
export type ImportOptions = { groups: boolean; parents: boolean; mergeExisting: boolean };
/** Nom d'une ligne de l'aperçu, avec son état de fusion après l'import. */
export type LineName = { name: string; merged: boolean };
/** Ligne « Groupes de synonymes » de l'aperçu (retour T3, point TAGM-18.9) : voir `import_groups.rs`. */
export type GroupLine = { kind: "new" | "completed" | "joined" | "changed"; principal: LineName; names: LineName[]; joined: { principal: LineName; names: LineName[] }[]; added: LineName[] };
/** Ce que crée (ou créerait, pour l'aperçu) l'import d'une liste : `names`, les noms ajoutés aux groupes ; `fused` et
 *  `joined`, de quoi défaire les fusions et les réunions (« Annuler ») ; `groups`, le nombre de groupes créés ou
 *  modifiés. */
export type ImportReport = {
  tags: number[];
  present: string[];
  names: number[];
  fused: number[];
  joined: { principal: number; names: [number, boolean][] }[];
  groups: number;
  groupLines: GroupLine[];
  skippedNames: number;
  parents: number[];
  ruleLines: { child: string; parent: string; enabled: boolean }[];
  skippedParents: number;
  tagged: number;
};

export const rulesApi = {
  list: () => invoke<TagRules>("list_tag_rules"),
  /** `promote` : le tag choisi, s'il est un nom d'un groupe, en devient le principal (tags cochés, point TAGM-11.4). */
  groupPreview: (principal: string, names: string[], promote = false) => invoke<GroupPreview>("group_preview", { principal, names, promote }),
  /** `merge` : l'interrupteur « Fusionner » du formulaire ; renvoie le groupe. */
  /** `newTags` : noms tapés qui ne sont pas encore des tags, créés avec le groupe (retour T3, point TAGM-15.24). */
  /** `extend` : les règles cochées « Étendre » dans la pop-in (D11.3) ; `promote` : comme pour l'aperçu. */
  createGroup: (principal: number, names: string[], merge: boolean, newTags: NewTag[] = [], extend: number[] = [], promote = false) =>
    invoke<number>("create_group", { principal, names, merge, newTags, extend, promote }),
  /** Ces quatre appels renvoient les règles restées sur le principal à la défusion (elles feraient une boucle). */
  setNameMerged: (id: number, merged: boolean, extend: number[] = []) => invoke<RuleName[]>("set_name_merged", { id, merged, extend }),
  setGroupMerged: (id: number, merged: boolean, extend: number[] = []) => invoke<RuleName[]>("set_group_merged", { id, merged, extend }),
  removeGroupName: (id: number) => invoke<RuleName[]>("remove_group_name", { id }),
  deleteGroup: (id: number) => invoke<RuleName[]>("delete_group", { id }),
  /** L'action jouée sans rien garder : ce qu'elle change aux règles de parents. */
  rulesPreview: (planned: PlannedChange) => invoke<RuleChange[]>("rules_preview", { planned }),
  /** Médias qui passeront au nouveau principal (D3.1). */
  principalCheck: (group: number, name: number) => invoke<number>("principal_check", { group, name }),
  setGroupPrincipal: (group: number, name: number) => invoke<void>("set_group_principal", { group, name }),
  /** `parent` vide : il n'est pas encore un tag (il sera créé avec la règle). */
  parentCheck: (child: number, parent: number | null) => invoke<RuleCheck>("parent_check", { child, parent }),
  /** `apply` : poser aussi le parent sur les médias qui ont déjà l'enfant ; renvoie le nombre de médias qui
   *  l'ont reçu. */
  createParent: (child: number, parent: number | null, apply: boolean, newParent?: NewTag) => invoke<number>("create_parent", { child, parent, newParent, apply }),
  setParentEnabled: (id: number, enabled: boolean) => invoke<void>("set_parent_enabled", { id, enabled }),
  parentDeleteCheck: (id: number) => invoke<DeleteCheck>("parent_delete_check", { id }),
  /** `remove` : retirer le parent des médias où la règle l'a posé. */
  deleteParent: (id: number, remove: boolean) => invoke<void>("delete_parent", { id, remove }),
  /** Tag tapé dans le champ d'une règle, créé sans média ; renvoie son identifiant. */
  createTag: (name: string, categoryId: number) => invoke<number>("create_tag", { name, categoryId }),
  previewImport: (list: SharedList, options: ImportOptions) => invoke<ImportReport>("preview_tag_import", { list, options }),
  importTags: (list: SharedList, options: ImportOptions) => invoke<ImportReport>("import_tags", { list, options }),
  undoImport: (r: ImportReport) => invoke<void>("undo_tag_import", { tags: r.tags, names: r.names, fused: r.fused, joined: r.joined, parents: r.parents }),
};
