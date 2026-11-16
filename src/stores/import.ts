// Dernier état connu de l'import, tel qu'envoyé par le cœur Rust (événement `import-state`),
// tags par défaut choisis pour le prochain import (IMP-30) et options de l'import. Les options (sous-dossiers,
// compression et conversion des images et des vidéos, leurs qualités et formats) retiennent le dernier choix, même après la fermeture de
// MyBoard, en attendant la page Paramètres (IMP-29, SET-05) ; sauf « Supprimer les originaux » (IMP-28) : décochée à
// chaque ouverture de MyBoard, comme la case « Supprimer les fichiers de votre stockage » de DEL-04.

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ImageTarget, ImportSnapshot, NewTag, VideoTarget } from "@/lib/api";

/** Tag par défaut : `name` part au cœur tel que tapé (un nom fusionné y est noté pour la défusion, D-047) ;
 *  `shown` : le tag réellement posé, montré sur la pastille (le principal d'un nom fusionné, IMP-79). */
export type DefaultTag = NewTag & { shown?: string };

/** Nom montré d'un tag par défaut. */
export const shownName = (t: DefaultTag) => t.shown ?? t.name;
import { showGridBadge } from "./badge";
import { usePreviews } from "./previews";

/** Qualité de compression : 20 à 95, 85 par défaut (comme la v8, IMP-20). */
export const QUALITY = { min: 20, max: 95, initial: 85 } as const;
/** Crans de « Qualité vidéo » (IMP-24), de 0 à 4 ; « Moyenne » par défaut. */
export const VIDEO_QUALITY = ["Minimale", "Basse", "Moyenne", "Haute", "Maximale"] as const;

type Processing = { compress: boolean; convert: boolean; compressVideos: boolean; convertVideos: boolean };
/** Sans aucune compression ni conversion, « Supprimer les originaux » n'a pas de sens : décochée (et grisée, IMP-28). */
export const processing = (s: Processing) => s.compress || s.convert || s.compressVideos || s.convertVideos;

/** Parcours relancé sur une liste qui existe déjà (case « Sous-dossiers », ajout) : son état (« Analyse du dossier… »,
 *  bouton « Importer » sans nombre, sablier des lignes) ne s'affiche que s'il dure plus de 0,3 s ; sinon les chiffres
 *  passent directement de l'ancien au nouveau (IMP-88, retouche 3 du 16/11). */
const QUIET_SCAN_MS = 300;
let quietTimer: number | undefined;

/** Texte du badge d'un ajout refusé (IMP-88, retouche 8) : « Dossier », « Dossiers », « Fichier » ou « Fichiers déjà
 *  dans la liste » ; les deux à la fois : « Dossier et fichiers déjà dans la liste »… */
function alreadyText({ folders, files }: ImportSnapshot["already"]): string {
  const folder = folders > 1 ? "Dossiers" : "Dossier";
  const file = files > 1 ? "fichiers" : "fichier";
  if (folders > 0) return `${files > 0 ? `${folder} et ${file}` : folder} déjà dans la liste`;
  return `${files > 1 ? "Fichiers" : "Fichier"} déjà dans la liste`;
}

type ImportState = {
  snapshot: ImportSnapshot | null;
  /** Le parcours en cours est montré (faux pendant ses 0,3 premières secondes si la liste existait déjà). */
  scanShown: boolean;
  /** Inclure les sous-dossiers (IMP-04). */
  recursive: boolean;
  /** « Compresser les images » (IMP-20) et sa qualité. */
  compress: boolean;
  quality: number;
  /** « Convertir les images en » (IMP-21) et le format choisi (JPG par défaut, comme la v8). */
  convert: boolean;
  convertTo: ImageTarget;
  /** « Compresser les vidéos » (IMP-69) et son cran ; « Convertir les vidéos en » (IMP-22) et le format choisi. */
  compressVideos: boolean;
  videoQuality: number;
  convertVideos: boolean;
  videoTarget: VideoTarget;
  /** « Supprimer les originaux » (IMP-28). */
  deleteOriginals: boolean;
  /** Tags ajoutés à tous les fichiers du prochain import (IMP-30) ; vidés une fois appliqués. */
  defaultTags: DefaultTag[];
  setSnapshot: (snapshot: ImportSnapshot) => void;
  setRecursive: (recursive: boolean) => void;
  setCompress: (compress: boolean) => void;
  setQuality: (quality: number) => void;
  setConvert: (convert: boolean) => void;
  setConvertTo: (convertTo: ImageTarget) => void;
  setCompressVideos: (compressVideos: boolean) => void;
  setVideoQuality: (videoQuality: number) => void;
  setConvertVideos: (convertVideos: boolean) => void;
  setVideoTarget: (videoTarget: VideoTarget) => void;
  setDeleteOriginals: (deleteOriginals: boolean) => void;
  addDefaultTag: (tag: DefaultTag) => void;
  removeDefaultTag: (name: string) => void;
  /** « Tout effacer » (IMP-79). */
  clearDefaultTags: () => void;
};

/** Phase affichée : un parcours pas encore montré (`scanShown`) laisse la liste « prête » à l'écran. */
export const shownPhase = (s: ImportState) =>
  s.snapshot?.phase === "scanning" && !s.scanShown ? "ready" : (s.snapshot?.phase ?? "idle");

export const useImport = create<ImportState>()(
  persist(
    (set, get) => ({
      snapshot: null,
      scanShown: false,
      recursive: true,
      compress: false,
      quality: QUALITY.initial,
      convert: false,
      convertTo: "jpg",
      compressVideos: false,
      videoQuality: 2,
      convertVideos: false,
      videoTarget: "h264",
      deleteOriginals: false,
      defaultTags: [],
      setSnapshot: (snapshot) => {
        // Import terminé : les tags par défaut ont été appliqués, la carte revient à zéro
        // (comme l'encadré de dépôt, IMP-50).
        const before = get().snapshot;
        const finished = snapshot.phase === "finished" && before?.phase === "importing";
        let scanShown = get().scanShown;
        if (snapshot.phase !== "scanning") {
          window.clearTimeout(quietTimer);
          scanShown = false;
        } else if (before?.phase !== "scanning") {
          window.clearTimeout(quietTimer);
          scanShown = !(before?.phase === "ready" && before.lines > 0);
          if (!scanShown) quietTimer = window.setTimeout(() => set({ scanShown: true }), QUIET_SCAN_MS);
        }
        set(finished ? { snapshot, scanShown, defaultTags: [] } : { snapshot, scanShown });
        // Ajout refusé, déjà dans la liste : badge bref en haut de l'écran (IMP-88, retouche 8).
        if (before && snapshot.alreadyListed > before.alreadyListed) showGridBadge(alreadyText(snapshot.already));
        // Fichiers réimportés : leurs aperçus ratés sont redemandés (LIB-05).
        if (finished) usePreviews.getState().bumpRetry();
      },
      setRecursive: (recursive) => set({ recursive }),
      setCompress: (compress) => set({ compress, deleteOriginals: get().deleteOriginals && processing({ ...get(), compress }) }),
      setQuality: (quality) => set({ quality: Math.min(QUALITY.max, Math.max(QUALITY.min, Math.round(quality))) }),
      setConvert: (convert) => set({ convert, deleteOriginals: get().deleteOriginals && processing({ ...get(), convert }) }),
      setConvertTo: (convertTo) => set({ convertTo }),
      setCompressVideos: (compressVideos) =>
        set({ compressVideos, deleteOriginals: get().deleteOriginals && processing({ ...get(), compressVideos }) }),
      setVideoQuality: (videoQuality) => set({ videoQuality: Math.min(4, Math.max(0, Math.round(videoQuality))) }),
      setConvertVideos: (convertVideos) =>
        set({ convertVideos, deleteOriginals: get().deleteOriginals && processing({ ...get(), convertVideos }) }),
      setVideoTarget: (videoTarget) => set({ videoTarget }),
      setDeleteOriginals: (deleteOriginals) => set({ deleteOriginals }),
      addDefaultTag: (tag) => {
        // Déjà là, tapé ou par son principal : une seule pastille.
        if (get().defaultTags.some((t) => t.name === tag.name || shownName(t) === shownName(tag))) return;
        set({ defaultTags: [...get().defaultTags, tag] });
      },
      removeDefaultTag: (name) => set({ defaultTags: get().defaultTags.filter((t) => t.name !== name) }),
      clearDefaultTags: () => set({ defaultTags: [] }),
    }),
    {
      name: "myboard.import-options",
      // Seules les options sont gardées ; l'état de l'import vient toujours du cœur Rust.
      partialize: (s) => ({
        recursive: s.recursive,
        compress: s.compress,
        quality: s.quality,
        convert: s.convert,
        convertTo: s.convertTo,
        compressVideos: s.compressVideos,
        videoQuality: s.videoQuality,
        convertVideos: s.convertVideos,
        videoTarget: s.videoTarget,
      }),
    },
  ),
);
