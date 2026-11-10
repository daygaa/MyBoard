// Appels au cœur Rust (commandes Tauri) et types échangés.
// Les noms correspondent aux structures Rust de src-tauri/src (library.rs, import/, tags.rs, media/).

import type { KindCounts } from "./mediaWords";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export type MediaKind = "image" | "video" | "audio" | "document";

/** Valeurs de `thumbStatus` (voir src-tauri/src/thumbs/mod.rs). */
export const THUMB = { todo: 0, ready: 1, error: 2, none: 3, noFfmpeg: 4 } as const;

export type MediaItem = {
  id: number;
  hash: string;
  fileName: string;
  ext: string;
  kind: MediaKind;
  size: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  thumbStatus: number;
  /** Favori (FAV-01). */
  favorite: boolean;
  /** Dossiers qui contiennent le média (FOLD-09). */
  folders: number[];
  /** Image ou vidéo lue directement sur le disque par la fenêtre (VIEW-53, VIEW-55) ; absente : `media://`. */
  fileUrl?: string | null;
};

/** Dossier manuel (FOLD-01) ; masqué : absent des listes (FOLD-02). */
/** `createdAt`, `openedAt` : création et dernière ouverture (jamais ouvert : sa création), en ms (tris FOLD-10). */
export type Folder = { id: number; name: string; color: string; hidden: boolean; mediaCount: number; createdAt: number; openedAt: number };

export type ListQuery = {
  kinds: MediaKind[];
  /** Termes de la recherche par tags (`tag`, `-tag`, `tag*`) ; vide = toute la bibliothèque. */
  terms: string[];
  sort: string;
  seed: number;
  page: number;
  pageSize: number;
  /** Vue Favoris (FAV-02). */
  favorites?: boolean;
  /** Page d'un dossier (FOLD-04). */
  folder?: number | null;
  /** Texte cherché dans le nom des fichiers (SRCH-26). */
  file?: string | null;
};

export type ListPage = {
  items: MediaItem[];
  total: number;
  page: number;
  pageCount: number;
  /** Médias par page réellement utilisés (position d'un média dans tous les résultats). */
  pageSize: number;
};

export type Stats = {
  total: number;
  images: number;
  videos: number;
  audio: number;
  documents: number;
  tags: number;
  thumbsPending: number;
  /** Nombre de favoris (titre de la vue Favoris, FAV-04). */
  favorites: number;
};

export type FfmpegStatus = { found: boolean; path: string | null; version: string | null };

/** Catégorie de tags (TAGM-01) : nom, couleur et ordre viennent de la base. */
export type Category = { id: number; key: string; name: string; color: string; sortOrder: number };

export type TagInfo = {
  id: number;
  name: string;
  categoryId: number;
  /** Nombre total de médias de la bibliothèque qui portent ce tag (SRCH-10). */
  mediaCount: number;
  /** Masqué de la recherche (TAGM-05) : gris clair et en dernier dans la visionneuse (CTX-04). */
  hidden: boolean;
  /** Bulle d'aide au survol du tag (TAGM-14). */
  description: string | null;
  /** Suggestion venue d'un synonyme (TAGM-15) : le nom tapé, affiché « synonyme → nom ». */
  alias?: string;
  /** Autres noms reliés de son groupe (suggestions et `findTag` seulement ; retour T3, points TAGM-15.26 et
   *  TAGM-15.27). */
  synonyms?: Synonym[];
};

/** Pop-in de suppression : ce qui arrivera aux groupes de synonymes des tags (tag_delete.rs). */
export type DeletePreview = {
  /** Tags fusionnés dans un principal supprimé, eux-mêmes non supprimés (case « Supprimer aussi »). */
  merged: string[];
  principals: { name: string; kept: string[]; next: string | null; keptAlso: string[]; nextAlso: string | null }[];
  /** Tag fusionné supprimé : ses médias notés, et ceux qui n'ont son principal que par lui. */
  fused: { name: string; principal: string; media: number; only: number }[];
  linked: { name: string; principal: string; dissolved: boolean }[];
  /** Règles de parents qui partent avec les tags ; leurs parents directs gardés ; tags posés plus haut dans la chaîne ;
   *  médias où elles ont posé des tags gardés ; chaînes du tag (un seul tag) (retour T3, point TAGM-16.8). */
  rules: { child: string; parent: string }[];
  parents: string[];
  further: boolean;
  posed: number;
  chains: { tags: string[]; at: number }[];
  /** Médias qui portent au moins un de ces tags (TAGM-19). */
  media: number;
};

/** Un tag de la corbeille (TAGM-19) : ce à quoi il était lié au moment de sa suppression. */
export type TrashTag = { id: number; name: string; categoryId: number | null; hidden: boolean; media: number; rules: number; synonyms: number; deletedAt: number };

/** Autre nom relié du groupe d'un tag ; les tags fusionnés n'y sont pas (ils n'ont aucun média). */
export type Synonym = { name: string; categoryId: number; mediaCount: number; principal: boolean };

/** Tag du gestionnaire (TAGM-04) : avec sa date de création (TAGM-12). */
export type ManagedTag = TagInfo & { createdAt: number };

/** Tags proches écartés (TAGM-13, lot R6-2) : « Ignorer » un bloc (`group` : toutes les paires entre `apart`) ou des
 *  tags décochés (`apart` : paires entre eux et `kept`). */
export type SimilarIgnore = { id: number; kind: "group" | "apart"; apart: number[]; kept: number[] };

export type TagManagerData = {
  tags: ManagedTag[];
  /** Médias qui portent au moins un tag. */
  taggedMedia: number;
  ignores: SimilarIgnore[];
};

/** Renommage : fait, vide, nom pris par un tag ou un synonyme actif (fusion proposée, CTX-04, TAGM-15), ou synonyme du tag lui-même. */
/** Retrait d'un enfant (TAGM-22) : parents qui partiraient (ordre de la chaîne), pour chacun le nombre de médias d'où
 *  il partirait (`counts`), médias touchés, tags d'où partent les chaînes. */
export type ChainParents = { parents: string[]; counts: number[]; media: number; origins: string[] };
export type Renamed = { kind: "done" } | { kind: "empty" } | { kind: "exists"; id: number; name: string; mediaCount: number; alias: string | null } | { kind: "ownAlias" };

/** Tag d'une liste partagée (TAGM-10, TAGM-18) : catégorie par sa clé (« general »…). */
export type SharedTag = { name: string; category: string; hidden: boolean; description?: string | null };

/** Tag à créer s'il n'existe pas ; la catégorie est ignorée pour un tag existant (IMP-31). */
export type NewTag = { name: string; categoryId: number | null };

/** Fiche détaillée d'un média pour la visionneuse (VIEW-10, VIEW-23). */
export type MediaDetail = {
  id: number;
  path: string;
  fileCreatedAt: number | null;
  importedAt: number;
  tags: TagInfo[];
  /** Note libre (VIEW-19). */
  notes: string | null;
  /** Favori (FAV-01). */
  favorite: boolean;
  /** Dossiers qui contiennent le média (FOLD-09). */
  folders: number[];
};

/** Résultat d'une miniature, envoyé par lots (événement `thumbs-ready`). */
export type ThumbUpdate = {
  id: number;
  status: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type ScanSummary = {
  total: number;
  images: number;
  videos: number;
  audio: number;
  documents: number;
  ignored: number;
  inaccessible: number;
  bytes: number;
};

export type ImportProgress = {
  total: number;
  processed: number;
  imported: number;
  updated: number;
  alreadyPresent: number;
  duplicates: number;
  errors: number;
  /** Compression des images (IMP-20) : gardées compressées · originaux gardés (moins de 5 % de gain) · impossibles. */
  compressed: number;
  notSmaller: number;
  compressFailed: number;
  currentFile: string | null;
};

/** Média réimporté dont les données sont en réserve (DEL-05). */
export type RestoreCandidate = {
  mediaId: number;
  hash: string;
  fileName: string;
  deletedAt: number;
  /** Tags qui seront posés ; `alias` : le tag fusionné d'origine, montré « kitty → cat » (retour T3, point AUT.22). */
  tags: { name: string; category: number; alias?: string }[];
  favorite: boolean;
  folders: { name: string; exists: boolean }[];
  notes: string | null;
};

export type ImportResult = {
  cancelled: boolean;
  fatal: string | null;
  errorFiles: { path: string; message: string }[];
  elapsedMs: number;
  /** Pop-in de fin d'import (DEL-05) ; vide une fois réglée. */
  restorable: RestoreCandidate[];
};

/** Fichier qui n'a pas pu être effacé (DEL-04) : son média est revenu dans la bibliothèque. */
/** Piste de sous-titres d'une vidéo (VIEW-52) : `key` = `f:<fichier>` ou `e:<piste intégrée>`. */
export type SubTrack = { key: string; label: string; lang: string | null };
/** Réplique d'une piste de sous-titres, en secondes. */
export type SubCue = { start: number; end: number; text: string };

export type FailedFile = { id: number; path: string; code: number | null; message: string; readOnly: boolean; alsoReadOnly: boolean };

export type ImportPhase = "idle" | "scanning" | "ready" | "importing" | "finished";

/** Une ligne de la liste des fichiers avant l'import (IMP-10). */
export type ScanEntry = { path: string; name: string; size: number; ext: string; kind: MediaKind };
export type ScanPage = { entries: ScanEntry[]; total: number };

/** Options de la carte « Options d'import » (IMP-30) : qualité si « Compresser les images » est cochée (IMP-20). */
export type ImportOptions = { compressQuality: number | null; compressExisting: boolean };

/** Photo complète de l'état de l'import (événement `import-state`). */
export type ImportSnapshot = {
  phase: ImportPhase;
  /** Fichiers et dossiers choisis (bouton ou glisser-déposer). */
  sources: string[];
  recursive: boolean;
  scan: ScanSummary | null;
  progress: ImportProgress | null;
  result: ImportResult | null;
};

export const api = {
  listMedia: (query: ListQuery) => invoke<ListPage>("list_media", { query }),
  stats: () => invoke<Stats>("library_stats"),
  prioritizeThumbs: (ids: number[]) => invoke<void>("prioritize_thumbs", { ids }),
  requestPreviews: (want: PreviewKey[], cancel: PreviewKey[]) => invoke<void>("request_previews", { want, cancel }),
  ffmpegStatus: () => invoke<FfmpegStatus>("ffmpeg_status"),
  importSnapshot: () => invoke<ImportSnapshot>("import_snapshot"),
  scanPaths: (paths: string[], recursive: boolean) => invoke<void>("scan_paths", { paths, recursive }),
  supportedExtensions: () => invoke<string[]>("supported_extensions"),
  startImport: (defaultTags: NewTag[], options: ImportOptions) => invoke<void>("start_import", { defaultTags, options }),
  /** Médias de la liste déjà dans la bibliothèque au même endroit, jamais compressés, par type (pop-in IMP-60). */
  countCompressibleExisting: () => invoke<KindCounts>("count_compressible_existing"),
  cancelImport: () => invoke<void>("cancel_import"),
  /** Liste des fichiers avant l'import, par pages (IMP-10 à IMP-12) ; retirer, tout vider (IMP-51, CTX-14). */
  scanFiles: (offset: number, limit: number) => invoke<ScanPage>("scan_files", { offset, limit }),
  removeScanFile: (path: string) => invoke<void>("remove_scan_file", { path }),
  clearScan: () => invoke<void>("clear_scan"),
  revealScanFile: (path: string) => invoke<void>("reveal_scan_file", { path }),
  tagCategories: () => invoke<Category[]>("tag_categories"),
  autocompleteTags: (text: string) => invoke<TagInfo[]>("autocomplete_tags", { text }),
  findTag: (name: string) => invoke<TagInfo | null>("find_tag", { name }),
  pageTags: (ids: number[]) => invoke<TagInfo[]>("page_tags", { ids }),
  addMediaTag: (mediaId: number, tag: NewTag) => invoke<void>("add_media_tag", { mediaId, tag }),
  removeMediaTag: (mediaId: number, tagId: number) => invoke<void>("remove_media_tag", { mediaId, tagId }),
  /** Parents que la chaîne des tags retirés avait posés et qui partiraient (TAGM-22) ; sans rien changer. */
  chainParents: (media: number[], tags: number[]) => invoke<ChainParents>("chain_parents", { media, tags }),
  removeChainParents: (media: number[], tags: number[]) => invoke<ChainParents>("remove_chain_parents", { media, tags }),
  mediaDetail: (id: number) => invoke<MediaDetail | null>("media_detail", { id }),
  revealMedia: (id: number) => invoke<void>("reveal_media", { id }),
  openMedia: (id: number) => invoke<void>("open_media", { id }),
  copyMedia: (id: number) => invoke<void>("copy_media", { id }),
  screenDpi: () => invoke<number | null>("screen_dpi"),
  setViewerFullscreen: (on: boolean) => invoke<void>("set_viewer_fullscreen", { on }),
  setMediaNotes: (id: number, notes: string) => invoke<void>("set_media_notes", { id, notes }),
  openUrl: (url: string) => invoke<void>("open_url", { url }),
  readClipboardText: () => invoke<string | null>("read_clipboard_text"),
  writeClipboardText: (text: string) => invoke<void>("write_clipboard_text", { text }),
  copyImage: (id: number) => invoke<void>("copy_image", { id }),
  setWallpaper: (id: number) => invoke<void>("set_wallpaper", { id }),
  /** Fenêtre « Enregistrer sous » ; rien d'enregistré si l'utilisateur annule. `date` : « JJ-MM-AA ». */
  saveVideoFrame: (id: number, seconds: number, date: string) => invoke<void>("save_video_frame", { id, seconds, date }),
  /** Image d'un GIF à `seconds` dans le presse-papiers (VIEW-54). */
  copyGifFrame: (id: number, seconds: number) => invoke<void>("copy_gif_frame", { id, seconds }),
  /** Vidéo d'un GIF (convertie si besoin, VIEW-54) : adresse relative à passer à `gifVideoUrl`. */
  prepareGif: (id: number) => invoke<string>("prepare_gif", { id }),
  /** Sous-titres d'une vidéo (VIEW-52) : fichiers à côté, puis pistes intégrées. */
  videoSubtitles: (id: number) => invoke<SubTrack[]>("video_subtitles", { id }),
  /** Temps des images clés d'une vidéo (glissement du curseur, VIEW-55). */
  videoKeyframes: (id: number) => invoke<number[]>("video_keyframes", { id }),
  subtitleCues: (id: number, key: string) => invoke<SubCue[]>("subtitle_cues", { id, key }),
  /** « Importer un fichier » (fenêtre « Ouvrir » de Windows) : la piste, ou null si l'utilisateur annule. */
  importSubtitle: (id: number) => invoke<SubTrack | null>("import_subtitle", { id }),
  removeImportedSubtitle: (id: number, key: string) => invoke<void>("remove_imported_subtitle", { id, key }),
  /** Commande du menu de la fenêtre (CTX-13) : comme celui de Windows. */
  windowCommand: (command: WindowCommand) => invoke<void>("window_command", { command }),
  /** Renvoie le nombre de médias réellement ajoutés ou retirés (badge de SEL-08). */
  setFavorite: (ids: number[], on: boolean) => invoke<number>("set_favorite", { ids, on }),
  /** Marque les médias à supprimer (DEL-01) ; `deleteFiles` : effacer aussi leurs fichiers (DEL-04). */
  deleteMedia: (ids: number[], deleteFiles: boolean, force = false) => invoke<void>("delete_media", { ids, deleteFiles, force }),
  restoreMediaData: (restore: number[], discard: number[]) => invoke<void>("restore_media_data", { restore, discard }),
  listFolders: () => invoke<Folder[]>("list_folders"),
  /** Nom refusé : erreur `NameError` (lib/folders.ts). */
  createFolder: (name: string, mediaIds: number[]) => invoke<Folder>("create_folder", { name, mediaIds }),
  renameFolder: (id: number, name: string) => invoke<void>("rename_folder", { id, name }),
  setFolderHidden: (id: number, hidden: boolean) => invoke<void>("set_folder_hidden", { id, hidden }),
  setFolderColor: (id: number, color: string) => invoke<void>("set_folder_color", { id, color }),
  deleteFolder: (id: number) => invoke<void>("delete_folder", { id }),
  /** Renvoie le nombre de médias réellement ajoutés ou retirés (badge de SEL-08). */
  setFolderMedia: (folderId: number, mediaIds: number[], on: boolean) => invoke<number>("set_folder_media", { folderId, mediaIds, on }),
  /** Page du dossier affichée : dernière ouverture notée (tri FOLD-10). */
  markFolderOpened: (id: number) => invoke<void>("mark_folder_opened", { id }),
  /** Tous les résultats de la vue, toutes pages confondues (« Sélectionner tous les résultats », SEL-03). */
  resultIds: (query: ListQuery) => invoke<number[]>("result_ids", { query }),
  selectionInfo: (ids: number[]) => invoke<SelectionInfo>("selection_info", { ids }),
  /** Tags présents sur la sélection (champ « Retirer des tags », SEL-07). */
  selectionTags: (ids: number[]) => invoke<TagInfo[]>("selection_tags", { ids }),
  selectionCommonTags: (ids: number[]) => invoke<string[]>("selection_common_tags", { ids }),
  editSelectionTags: (ids: number[], add: NewTag[], remove: number[]) => invoke<void>("edit_selection_tags", { ids, add, remove }),
  // Gestionnaire de tags (TAGM-04 et suivants) et menus des tags (CTX-04, CTX-12).
  listManagedTags: () => invoke<TagManagerData>("list_managed_tags"),
  renameTag: (id: number, name: string) => invoke<Renamed>("rename_tag", { id, name }),
  setTagsCategory: (ids: number[], categoryId: number) => invoke<number>("set_tags_category", { ids, categoryId }),
  setTagsHidden: (ids: number[], hidden: boolean) => invoke<number>("set_tags_hidden", { ids, hidden }),
  /** `withMerged`, `strip` : les cases de la pop-in de suppression (retour T3, point TAGM-15.28) ; `permanent` : sans
   *  passer par la corbeille (TAGM-19). */
  deleteTags: (ids: number[], withMerged = false, strip = false, removePosed = false, permanent = false) =>
    invoke<number>("delete_tags", { ids, withMerged, strip, removePosed, permanent }),
  /** Corbeille des tags (TAGM-19). */
  trashList: () => invoke<TrashTag[]>("trash_list"),
  trashFind: (name: string) => invoke<TrashTag | null>("trash_find", { name }),
  trashRestore: (ids: number[]) => invoke<number>("trash_restore", { ids }),
  trashDelete: (ids: number[]) => invoke<number>("trash_delete", { ids }),
  deletePreview: (ids: number[]) => invoke<DeletePreview>("delete_preview", { ids }),
  setTagDescription: (id: number, text: string) => invoke<void>("set_tag_description", { id, text }),
  /** Tags proches (lot R6-2) : écarter `apart` de `kept` (vide : « Ignorer » le bloc `apart`). */
  ignoreSimilar: (apart: number[], kept: number[]) => invoke<void>("ignore_similar", { apart, kept }),
  unignoreSimilar: (id: number) => invoke<void>("unignore_similar", { id }),
  /** « Créer des synonymes pour tous » ; `extend` : règles cochées « Étendre ». */
  createSimilarGroups: (items: { principal: number; names: string[]; merge: boolean; apart: number[]; kept: number[] }[], extend: number[]) =>
    invoke<void>("create_similar_groups", { items, extend }),
};

/** Ce que contient une sélection : favoris, et nombre de ses médias dans chaque dossier (SEL-08). */
export type SelectionInfo = { favorites: number; folders: { id: number; count: number }[] };

export type WindowCommand = "restore" | "move" | "size" | "minimize" | "maximize" | "close";

/** Événements émis par le cœur Rust. */
export const EVENTS = {
  libraryChanged: "library-changed",
  thumbsReady: "thumbs-ready",
  previewsReady: "previews-ready",
  importState: "import-state",
  /** Alt + Espace : ouvrir le menu de la fenêtre de MyBoard (CTX-13). */
  windowMenu: "menu-fenetre",
  /** Médias réellement supprimés (DEL-02). */
  mediaDeleted: "media-deleted",
  /** Fichiers impossibles à effacer (DEL-04). */
  deletionFailed: "deletion-failed",
} as const;

/** Tailles servies par le protocole `thumb://` : 320 px, 128 px (LIB-12), aperçus 640 px (LIB-09)
 *  et 1 280 px (LIB-16). */
export type ThumbTier = "normal" | "small" | "preview" | "large";

const TIER_PREFIX: Record<ThumbTier, string> = { normal: "", small: "s/", preview: "p/", large: "l/" };

/** Grand aperçu fait à la demande : un média et sa taille (LIB-09, LIB-16). */
export type PreviewSize = 640 | 1280;
export type PreviewKey = { id: number; size: PreviewSize };

/** Racine du protocole (`http://thumb.localhost/` sous Windows). On ajoute le chemin
 *  nous-mêmes : `convertFileSrc` encoderait le « / » de « s/… » en « %2F ». */
const THUMB_ROOT = convertFileSrc("", "thumb");

/** Adresse d'une miniature d'un média. */
export function thumbUrl(hash: string, tier: ThumbTier = "normal"): string {
  return `${THUMB_ROOT}${TIER_PREFIX[tier]}${hash}.webp`;
}

/** Aperçu d'un fichier de la liste avant l'import (IMP-10), pas encore dans la bibliothèque. */
export function scanPreviewUrl(path: string, large = false): string {
  // `large` : aperçu agrandi de 256 px au survol de la miniature (IMP-59).
  return `${THUMB_ROOT}${large ? "apercu-grand" : "apercu"}?p=${encodeURIComponent(path)}`;
}

const MEDIA_ROOT = convertFileSrc("", "media");

/** Adresse du FICHIER ORIGINAL d'un média (protocole `media://`, visionneuse). L'empreinte
 *  fait partie de l'adresse : son contenu ne change jamais, la fenêtre peut le garder en cache. */
export function mediaUrl(item: Pick<MediaItem, "id" | "hash" | "ext">): string {
  return `${MEDIA_ROOT}${item.id}/${item.hash}.${item.ext}`;
}

/** Adresse du fichier d'une image ou d'une vidéo pour la visionneuse : lu directement sur le disque par la fenêtre
 *  (VIEW-53, VIEW-55 : 10 fois plus rapide, sans bloquer MyBoard), sinon `media://` (formats convertis, chemins réseau). */
export const directUrl = (item: MediaItem): string => item.fileUrl ?? mediaUrl(item);

/** Adresse de la vidéo d'un GIF (VIEW-54), d'après la réponse de `prepareGif`. */
export const gifVideoUrl = (path: string) => `${MEDIA_ROOT}${path}`;
