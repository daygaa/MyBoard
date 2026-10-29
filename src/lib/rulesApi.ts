// Groupes de synonymes et tags parents (TAGM-15 à TAGM-18, refonte TAGM-20) : appels au cœur Rust
// (src-tauri/src/tag_rules.rs, tag_import.rs) et types échangés.

import { invoke } from "@tauri-apps/api/core";

import type { SharedTag } from "./api";

/** Nom d'un groupe (hors principal) : relié (`tagId`, un vrai tag) ou fusionné (`tagId` vide) ; `media` :
 *  médias du tag, ou médias notés pour défaire la fusion. */
export type NameRow = { id: number; tagId: number | null; name: string; merged: boolean; media: number };
/** Groupe de synonymes ; `media` : médias que trouve la recherche d'un de ses noms. */
export type GroupRow = { id: number; principalId: number; media: number; names: NameRow[]; createdAt: number };
/** Règle « enfant → parent » ; `enabled` = son interrupteur (D-047) ; `media` : médias qui ont reçu le
 *  parent par elle. */
export type ParentRow = { id: number; childId: number; parentId: number; enabled: boolean; media: number; createdAt: number };
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
  pure: string[];
  joined: string[];
  fullyMerged: boolean;
};
/** Refus expliqué, ou médias qui ont déjà l'enfant sans le parent (case de la confirmation). */
export type RuleCheck = { error: string | null; media: number };
/** Une chaîne, du tag le plus bas au plus haut (noms) ; `at` : place de l'enfant de la règle (son parent suit). */
export type Chain = { tags: string[]; at: number };
/** Suppression d'une règle : médias où elle a posé le parent, chaînes qui passent par elle. */
export type DeleteCheck = { media: number; chains: Chain[] };
export type TagLinks = { aliases: number; parents: number };

export type SharedAlias = { alias: string; tag: string; enabled: boolean };
export type SharedRule = { child: string; parent: string; enabled: boolean };
export type SharedList = { tags: SharedTag[]; aliases: SharedAlias[]; parents: SharedRule[] };
/** Ce que crée (ou créerait, pour l'aperçu) l'import d'une liste. */
export type ImportReport = {
  tags: number[];
  present: string[];
  aliases: number[];
  skippedAliases: number;
  parents: number[];
  skippedParents: number;
  tagged: number;
};

export const rulesApi = {
  list: () => invoke<TagRules>("list_tag_rules"),
  groupPreview: (principal: string, names: string[]) => invoke<GroupPreview>("group_preview", { principal, names }),
  /** `merge` : l'interrupteur « Fusionner » du formulaire ; renvoie le groupe. */
  createGroup: (principal: number, names: string[], merge: boolean) => invoke<number>("create_group", { principal, names, merge }),
  setNameMerged: (id: number, merged: boolean) => invoke<void>("set_name_merged", { id, merged }),
  setGroupMerged: (id: number, merged: boolean) => invoke<void>("set_group_merged", { id, merged }),
  removeGroupName: (id: number) => invoke<void>("remove_group_name", { id }),
  deleteGroup: (id: number) => invoke<void>("delete_group", { id }),
  /** Médias qui passeront au nouveau principal (D3.1). */
  principalCheck: (group: number, name: number) => invoke<number>("principal_check", { group, name }),
  setGroupPrincipal: (group: number, name: number) => invoke<void>("set_group_principal", { group, name }),
  parentCheck: (child: number, parent: number) => invoke<RuleCheck>("parent_check", { child, parent }),
  /** `apply` : poser aussi le parent sur les médias qui ont déjà l'enfant ; renvoie le nombre de médias qui
   *  l'ont reçu. */
  createParent: (child: number, parent: number, apply: boolean) => invoke<number>("create_parent", { child, parent, apply }),
  setParentEnabled: (id: number, enabled: boolean) => invoke<void>("set_parent_enabled", { id, enabled }),
  parentDeleteCheck: (id: number) => invoke<DeleteCheck>("parent_delete_check", { id }),
  /** `remove` : retirer le parent des médias où la règle l'a posé. */
  deleteParent: (id: number, remove: boolean) => invoke<void>("delete_parent", { id, remove }),
  tagLinks: (id: number) => invoke<TagLinks>("tag_links", { id }),
  /** Tag tapé dans le champ d'une règle, créé sans média ; renvoie son identifiant. */
  createTag: (name: string, categoryId: number) => invoke<number>("create_tag", { name, categoryId }),
  previewImport: (list: SharedList) => invoke<ImportReport>("preview_tag_import", { list }),
  importTags: (list: SharedList) => invoke<ImportReport>("import_tags", { list }),
  undoImport: (report: ImportReport) => invoke<void>("undo_tag_import", { tags: report.tags, aliases: report.aliases, parents: report.parents }),
};
