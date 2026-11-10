// Dernier état connu de l'import, tel qu'envoyé par le cœur Rust (événement `import-state`),
// tags par défaut choisis pour le prochain import (IMP-30) et options de l'import. Les options (sous-dossiers,
// compression et conversion des images et des vidéos, leurs qualités et formats) retiennent le dernier choix, même après la fermeture de
// MyBoard, en attendant la page Paramètres (IMP-29, SET-05) ; sauf « Supprimer les originaux » (IMP-28) : décochée à
// chaque ouverture de MyBoard, comme la case « Supprimer les fichiers de votre stockage » de DEL-04.

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ImageTarget, ImportSnapshot, NewTag, VideoTarget } from "@/lib/api";

/** Qualité de compression : 20 à 95, 85 par défaut (comme la v8, IMP-20). */
export const QUALITY = { min: 20, max: 95, initial: 85 } as const;
/** Crans de « Qualité vidéo » (IMP-24), de 0 à 4 ; « Moyenne » par défaut. */
export const VIDEO_QUALITY = ["Minimale", "Basse", "Moyenne", "Haute", "Maximale"] as const;

type Processing = { compress: boolean; convert: boolean; compressVideos: boolean; convertVideos: boolean };
/** Sans aucune compression ni conversion, « Supprimer les originaux » n'a pas de sens : décochée (et grisée, IMP-28). */
export const processing = (s: Processing) => s.compress || s.convert || s.compressVideos || s.convertVideos;

type ImportState = {
  snapshot: ImportSnapshot | null;
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
  defaultTags: NewTag[];
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
  addDefaultTag: (tag: NewTag) => void;
  removeDefaultTag: (name: string) => void;
};

export const useImport = create<ImportState>()(
  persist(
    (set, get) => ({
      snapshot: null,
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
        const finished = snapshot.phase === "finished" && get().snapshot?.phase === "importing";
        set(finished ? { snapshot, defaultTags: [] } : { snapshot });
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
        if (get().defaultTags.some((t) => t.name === tag.name)) return;
        set({ defaultTags: [...get().defaultTags, tag] });
      },
      removeDefaultTag: (name) => set({ defaultTags: get().defaultTags.filter((t) => t.name !== name) }),
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
