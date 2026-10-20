// Synonymes et tags parents (TAGM-15 à TAGM-18) : appels au cœur Rust (src-tauri/src/tag_rules.rs,
// tag_import.rs) et types échangés.

import { invoke } from "@tauri-apps/api/core";

import type { SharedTag } from "./api";

/** Synonyme « alias → tag principal » ; `media` : médias notés pour défaire la fusion. */
export type AliasRow = { id: number; alias: string; tagId: number; enabled: boolean; media: number; createdAt: number };
/** Règle « enfant → parent » ; `enabled` = sa case, `auto` = l'interrupteur « Auto » ; `media` : médias
 *  qui ont reçu le parent par elle. */
export type ParentRow = { id: number; childId: number; parentId: number; enabled: boolean; auto: boolean; media: number; createdAt: number };
export type TagRules = { aliases: AliasRow[]; parents: ParentRow[] };

/** Refus expliqué, ou médias du tag qui sera fusionné (`null` : aucun tag de ce nom). */
export type AliasCheck = { error: string | null; tagMedia: number | null };
/** Refus expliqué, ou médias qui recevront le parent. */
export type RuleCheck = { error: string | null; media: number };
/** Réactivation : médias où le parent sera remis, et ajouts faits pendant la désactivation. */
export type EnableCheck = { restore: number; skipped: number };
export type TagLinks = { aliases: number; parents: number };

export type SharedAlias = { alias: string; tag: string; enabled: boolean };
export type SharedRule = { child: string; parent: string; enabled: boolean; auto: boolean };
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
  aliasCheck: (alias: string, target: number) => invoke<AliasCheck>("alias_check", { alias, target }),
  createAlias: (alias: string, target: number) => invoke<void>("create_alias", { alias, target }),
  /** Médias du tag du même nom, fusionné à nouveau si l'on recoche ; `null` : aucun. */
  aliasEnableCheck: (id: number) => invoke<number | null>("alias_enable_check", { id }),
  setAliasEnabled: (id: number, enabled: boolean) => invoke<void>("set_alias_enabled", { id, enabled }),
  deleteAlias: (id: number) => invoke<void>("delete_alias", { id }),
  parentCheck: (child: number, parent: number) => invoke<RuleCheck>("parent_check", { child, parent }),
  /** Renvoie le nombre de médias qui ont reçu le parent. */
  createParent: (child: number, parent: number) => invoke<number>("create_parent", { child, parent }),
  parentEnableCheck: (id: number) => invoke<EnableCheck>("parent_enable_check", { id }),
  setParentEnabled: (id: number, enabled: boolean, addSkipped: boolean) => invoke<void>("set_parent_enabled", { id, enabled, addSkipped }),
  setParentAuto: (id: number, auto: boolean, addSkipped: boolean) => invoke<void>("set_parent_auto", { id, auto, addSkipped }),
  deleteParent: (id: number) => invoke<void>("delete_parent", { id }),
  tagLinks: (id: number) => invoke<TagLinks>("tag_links", { id }),
  /** Tag tapé dans le champ d'une règle, créé sans média ; renvoie son identifiant. */
  createTag: (name: string, categoryId: number) => invoke<number>("create_tag", { name, categoryId }),
  previewImport: (list: SharedList) => invoke<ImportReport>("preview_tag_import", { list }),
  importTags: (list: SharedList) => invoke<ImportReport>("import_tags", { list }),
  undoImport: (report: ImportReport) => invoke<void>("undo_tag_import", { tags: report.tags, aliases: report.aliases, parents: report.parents }),
};
