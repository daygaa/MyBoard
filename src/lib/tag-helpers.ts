// MyBoard — helpers Prisma pour la gestion des tags (shared entre routes API).
//
// Toutes les opérations "business" sur les tags passent par ici pour garantir
// la cohérence des compteurs dénormalisés (Tag.postCount / Media.tagCount)
// et la suppression des tags orphelins.

import type { PrismaClient } from "@prisma/client";
import { mediaFileUrl, mediaThumbUrl, normalizeTagName } from "./shared";
import type { MediaDetail, MediaKind, MediaListItem, MediaTagDTO, TagDTO } from "./types";

/** Normalise un nom de tag brut (wrap de normalizeTagName depuis shared.ts). */
export function normalizeTag(raw: string): string {
  return normalizeTagName(raw);
}

/**
 * Récupère un tag par son nom normalisé, ou le crée s'il n'existe pas encore.
 * N'incrémente PAS postCount (fait à l'attach via attachTag).
 * Utilise upsert avec update vide = INSERT OR IGNORE sémantique.
 */
export async function getOrCreateTag(
  db: PrismaClient,
  name: string,
  category?: string
): Promise<{ id: number; name: string; category: string; postCount: number }> {
  const norm = normalizeTag(name);
  if (!norm) throw new Error("Tag name vide après normalisation");

  // Catégorie validée (default general)
  const cat = category && category.length ? category : "general";

  const tag = await db.tag.upsert({
    where: { name: norm },
    create: { name: norm, category: cat, postCount: 0 },
    update: {},
    select: { id: true, name: true, category: true, postCount: true },
  });
  return tag;
}

/**
 * Attache un tag à un média.
 * - INSERT OR IGNORE MediaTag
 * - Incrémente Tag.postCount + Media.tagCount UNIQUEMENT si nouvel attach.
 * Renvoie true si nouvel attach, false si déjà présent.
 */
export async function attachTag(
  db: PrismaClient,
  mediaId: number,
  tagId: number
): Promise<boolean> {
  const existing = await db.mediaTag.findUnique({
    where: { mediaId_tagId: { mediaId, tagId } },
    select: { mediaId: true },
  });
  if (existing) return false;

  await db.mediaTag.create({ data: { mediaId, tagId } });
  await db.tag.update({
    where: { id: tagId },
    data: { postCount: { increment: 1 } },
  });
  await db.media.update({
    where: { id: mediaId },
    data: { tagCount: { increment: 1 } },
  });
  return true;
}

/**
 * Détache un tag d'un média.
 * - DELETE MediaTag (si existant)
 * - Décrémente Tag.postCount + Media.tagCount
 * - Supprime le tag s'il devient orphelin (postCount = 0)
 * Renvoie true si détaché, false si non attaché initialement.
 */
export async function detachTag(
  db: PrismaClient,
  mediaId: number,
  tagId: number
): Promise<boolean> {
  const existing = await db.mediaTag.findUnique({
    where: { mediaId_tagId: { mediaId, tagId } },
    select: { mediaId: true },
  });
  if (!existing) return false;

  await db.mediaTag.delete({
    where: { mediaId_tagId: { mediaId, tagId } },
  });

  // Décrémenter le postCount du tag; si 0 → supprimer (orphelin)
  const tag = await db.tag.findUnique({
    where: { id: tagId },
    select: { postCount: true },
  });
  if (tag) {
    const newCount = Math.max(0, tag.postCount - 1);
    if (newCount === 0) {
      await db.tag.delete({ where: { id: tagId } }).catch(() => {});
    } else {
      await db.tag.update({
        where: { id: tagId },
        data: { postCount: newCount },
      });
    }
  }

  // Décrémenter tagCount du média (floor 0)
  await db.media.update({
    where: { id: mediaId },
    data: { tagCount: { decrement: 1 } },
  }).catch(() => {});
  return true;
}

/** Récupère les tags d'un média unique (avec leur catégorie). */
export async function tagsForMedia(
  db: PrismaClient,
  mediaId: number
): Promise<MediaTagDTO[]> {
  const rows = await db.mediaTag.findMany({
    where: { mediaId },
    include: { tag: { select: { id: true, name: true, category: true } } },
    orderBy: { tag: { name: "asc" } },
  });
  return rows.map((r) => ({
    id: r.tag.id,
    name: r.tag.name,
    category: r.tag.category,
  }));
}

/**
 * Batch : récupère les tags pour une liste de médias.
 * Renvoie une map mediaId -> MediaTagDTO[].
 * 1 seule requête SQL avec mediaId IN [...].
 */
export async function tagsForMediaList(
  db: PrismaClient,
  mediaIds: number[]
): Promise<Record<number, MediaTagDTO[]>> {
  const map: Record<number, MediaTagDTO[]> = {};
  if (mediaIds.length === 0) return map;
  for (const id of mediaIds) map[id] = [];

  const rows = await db.mediaTag.findMany({
    where: { mediaId: { in: mediaIds } },
    include: { tag: { select: { id: true, name: true, category: true } } },
  });
  for (const r of rows) {
    if (!map[r.mediaId]) map[r.mediaId] = [];
    map[r.mediaId].push({
      id: r.tag.id,
      name: r.tag.name,
      category: r.tag.category,
    });
  }
  return map;
}

/**
 * Tags présents sur les médias de la page courante, avec postCount GLOBAL.
 * Renvoie TagDTO[] trié par postCount desc, puis name asc.
 */
export async function pageTags(
  db: PrismaClient,
  mediaIds: number[]
): Promise<TagDTO[]> {
  if (mediaIds.length === 0) return [];

  // 1. TagIds distincts présents sur ces médias
  const mediaTags = await db.mediaTag.findMany({
    where: { mediaId: { in: mediaIds } },
    select: { tagId: true },
    distinct: ["tagId"],
  });
  const tagIds = mediaTags.map((mt) => mt.tagId);
  if (tagIds.length === 0) return [];

  // 2. Tags complets (avec postCount GLOBAL — pas juste de la page)
  const tags = await db.tag.findMany({
    where: { id: { in: tagIds } },
    select: { id: true, name: true, category: true, postCount: true },
  });

  return tags
    .sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name))
    .map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      postCount: t.postCount,
    }));
}

/**
 * Helper de mapping : convertit une ligne Prisma Media (avec tags inclus)
 * en MediaListItem (DTO prêt pour l'UI).
 */
export type MediaWithTags = {
  id: number;
  sha256: string;
  originalName: string;
  ext: string;
  mime: string;
  kind: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  source: string | null;
  storage: string;
  remoteUrl: string | null;
  remoteThumbUrl: string | null;
  hasThumb: boolean;
  favorite: boolean;
  score: number;
  views: number;
  tagCount: number;
  importedAt: Date;
  tags?: { tag: { id: number; name: string; category: string } }[];
};

export function mediaToDTO(m: MediaWithTags): MediaListItem {
  const tags: MediaTagDTO[] = (m.tags ?? []).map((r) => ({
    id: r.tag.id,
    name: r.tag.name,
    category: r.tag.category,
  }));
  return {
    id: m.id,
    kind: m.kind as MediaKind,
    ext: m.ext,
    mime: m.mime,
    originalName: m.originalName,
    size: m.size,
    width: m.width,
    height: m.height,
    duration: m.duration,
    hasThumb: m.hasThumb,
    thumbUrl: mediaThumbUrl({
      id: m.id,
      storage: m.storage,
      remoteThumbUrl: m.remoteThumbUrl,
      hasThumb: m.hasThumb,
    }),
    fileUrl: mediaFileUrl({ id: m.id, storage: m.storage, remoteUrl: m.remoteUrl }),
    tags,
    tagCount: m.tagCount,
    favorite: m.favorite,
    score: m.score,
    views: m.views,
    importedAt: m.importedAt instanceof Date ? m.importedAt.toISOString() : String(m.importedAt),
  };
}

/** Détail complet d'un média (avec tags) — pour la visionneuse. */
export async function mediaDetail(
  db: PrismaClient,
  id: number
): Promise<MediaDetail | null> {
  const m = await db.media.findUnique({
    where: { id },
    include: { tags: { include: { tag: { select: { id: true, name: true, category: true } } } } },
  });
  if (!m) return null;
  const base = mediaToDTO(m as MediaWithTags);
  return {
    ...base,
    sha256: m.sha256,
    source: m.source,
    storage: m.storage,
  };
}

// ---------------------------------------------------------------------------
// CRUD Tag (gestionnaire de tags : /tags page)
// ---------------------------------------------------------------------------

/**
 * Met à jour un tag : renomme et/ou change sa catégorie.
 * - Vérifie l'unicité du nom en cas de renommage.
 * - Renvoie le tag mis à jour, ou null si introuvable / conflit.
 */
export async function updateTag(
  db: PrismaClient,
  id: number,
  patch: { name?: string; category?: string }
): Promise<{ id: number; name: string; category: string; postCount: number } | null> {
  const data: { name?: string; category?: string } = {};

  if (patch.name !== undefined) {
    const norm = normalizeTag(patch.name);
    if (!norm) throw new Error("Nom de tag vide après normalisation");
    if (norm.length > 255) throw new Error("Nom de tag trop long (max 255)");
    // Vérifie l'unicité (un autre tag avec ce nom existe déjà)
    const existing = await db.tag.findFirst({
      where: { name: norm, NOT: { id } },
      select: { id: true },
    });
    if (existing) throw new Error("UNIQUE_VIOLATION");
    data.name = norm;
  }

  if (patch.category !== undefined) {
    // Catégorie validée (default general) — on accepte n'importe quelle string
    // non vide mais on normalise vers les catégories connues si possible.
    const cat = patch.category && patch.category.length ? patch.category : "general";
    data.category = cat;
  }

  if (Object.keys(data).length === 0) {
    // Rien à mettre à jour : renvoie l'état courant
    const t = await db.tag.findUnique({
      where: { id },
      select: { id: true, name: true, category: true, postCount: true },
    });
    return t;
  }

  try {
    return await db.tag.update({
      where: { id },
      data,
      select: { id: true, name: true, category: true, postCount: true },
    });
  } catch {
    return null;
  }
}

/**
 * Supprime un tag.
 * - Pour chaque média attaché : décrémente Media.tagCount.
 * - Supprime toutes les liaisons MediaTag (cascade gérée par Prisma/SQLite).
 * - Supprime la ligne Tag.
 * Renvoie true si supprimé, false si introuvable.
 */
export async function deleteTag(
  db: PrismaClient,
  id: number
): Promise<boolean> {
  const tag = await db.tag.findUnique({
    where: { id },
    select: { id: true, postCount: true },
  });
  if (!tag) return false;

  // Récupère tous les médias liés pour décrémenter leur tagCount
  const links = await db.mediaTag.findMany({
    where: { tagId: id },
    select: { mediaId: true },
  });

  // Décrémente tagCount sur chaque média (best-effort, en parallèle)
  if (links.length > 0) {
    await Promise.all(
      links.map((l) =>
        db.media.update({
          where: { id: l.mediaId },
          data: { tagCount: { decrement: 1 } },
        }).catch(() => {})
      )
    );
  }

  // Supprime les liaisons MediaTag (la suppression du Tag va cascader mais
  // on le fait explicitement pour être sûr quel que soit le mode onDelete)
  await db.mediaTag.deleteMany({ where: { tagId: id } }).catch(() => {});

  // Supprime le tag
  try {
    await db.tag.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Récupère tous les tags présents sur les médias d'un groupe, avec leur
 * postCount global. Tri par postCount desc puis name asc.
 */
export async function tagsForGroup(
  db: PrismaClient,
  groupId: number
): Promise<TagDTO[]> {
  // 1. TagIds distincts présents sur les médias du groupe
  const rows = await db.mediaTag.findMany({
    where: { media: { groups: { some: { groupId } } } },
    select: { tagId: true },
    distinct: ["tagId"],
  });
  const tagIds = rows.map((r) => r.tagId);
  if (tagIds.length === 0) return [];

  // 2. Tags complets (postCount global)
  const tags = await db.tag.findMany({
    where: { id: { in: tagIds } },
    select: { id: true, name: true, category: true, postCount: true },
  });

  return tags
    .sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name))
    .map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      postCount: t.postCount,
    }));
}
