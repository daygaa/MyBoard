// Fichiers disparus et emplacements inaccessibles (LIB-05, LIB-14) : état envoyé par le cœur Rust (`library_check.rs`)
// à la fin de la vérification de l'ouverture, puis à chaque emplacement rebranché.

import { invoke } from "@tauri-apps/api/core";

import type { MediaKind } from "./api";

export type MissingMedia = { id: number; hash: string; fileName: string; path: string; kind: MediaKind };
export type OfflineRoot = { root: string; count: number };
/** `missing` : les 500 premiers médias disparus ; `missingTotal` : leur nombre ; `missingVersion` change quand d'autres
 *  s'ajoutent (la liste complète reste dans le cœur Rust). */
export type CheckState = { running: boolean; missing: MissingMedia[]; missingTotal: number; missingVersion: number; offline: OfflineRoot[] };

export const checkApi = {
  state: () => invoke<CheckState>("library_check_state"),
  /** Réponse pour toute la liste : « Conserver la miniature » (`keep`) ou « Supprimer de la bibliothèque ». */
  settle: (keep: boolean) => invoke<void>("settle_missing", { keep }),
};
