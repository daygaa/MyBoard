// MyBoard — helpers Prisma pour la gestion des groupes (collections manuelles).
//
// Un groupe est une collection nommée de médias (indépendante des tags).
// Un média peut appartenir à plusieurs groupes (relation N↔N via MediaGroup).
// Les médias ne sont PAS supprimés quand on supprime un groupe (onDelete: Cascade
// sur MediaGroup suffit à nettoyer les liaisons).
//
// Toutes les opérations "business" sur les groupes passent par ici pour
// garantir la cohérence (INSERT OR IGNORE sur MediaGroup, batch efficace, etc.).
//
// P6 — "Masquer" un dossier : le schema Group n'a pas de champ `hidden` (et on
// ne touche pas à prisma/schema.prisma), on utilise donc AppMeta avec la clé
// `group_hidden_<id>` = "1" pour masquer un groupe du menu burger. Le groupe
// reste accessible via /groups/[id] directement.

import type { PrismaClient, Prisma } from "@prisma/client";
import { mediaFileUrl, mediaThumbUrl } from "./shared";
import { buildWhere, parseQuery } from "./search";
import type { MediaListItem, TagDTO } from "./types";

// ---------------------------------------------------------------------------
// Couleurs proposées pour les groupes (palette dorée + accents chauds/froids
// discrets — cohérente avec le thème MyBoard, sans indigo/bleu vif).
// ---------------------------------------------------------------------------
export const GROUP_COLOR_PRESETS: { name: string; value: string }[] = [
  { name: "Or", value: "#d9a94e" },
  { name: "Ambre", value: "#f59e0b" },
  { name: "Émeraude", value: "#10b981" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Cendre", value: "#a1a1aa" },
];

const DEFAULT_GROUP_COLOR = "#d9a94e";

export type GroupDTO = {
  id: number;
  name: string;
  color: string;
  count: number;
  createdAt: string;
};

export type GroupDetailDTO = GroupDTO & {
  items: MediaListItem[];
};

/** Normalise un nom de groupe : trim + collapse espaces + max 80 chars.
 *  Conserve la casse (contrairement aux tags) car les noms de groupes sont
 *  affichés tels quels à l'utilisateur. */
export function normalizeGroupName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 80);
}

/** Valide et normalise un code couleur hex (#rrggbb). Retourne la couleur par
 *  défaut si invalide. */
export function normalizeColor(raw: string | undefined | null): string {
  if (!raw) return DEFAULT_GROUP_COLOR;
  const v = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    // #abc → #aabbcc
    const expanded = "#" + v.slice(1).split("").map((c) => c + c).join("");
    return expanded.toLowerCase();
  }
  return DEFAULT_GROUP_COLOR;
}

// ---------------------------------------------------------------------------
// Visibilité (AppMeta) — P6
// ---------------------------------------------------------------------------

/** Clé AppMeta pour masquer un groupe du menu burger. */
export function hiddenMetaKey(id: number): string {
  return `group_hidden_${id}`;
}

/** Masque ou ré-affiche un groupe dans le menu burger (AppMeta). */
export async function setGroupHidden(
  db: PrismaClient,
  id: number,
  hidden: boolean
): Promise<void> {
  const key = hiddenMetaKey(id);
  if (hidden) {
    await db.appMeta.upsert({
      where: { key },
      create: { key, value: "1" },
      update: { value: "1" },
    });
  } else {
    try {
      await db.appMeta.delete({ where: { key } });
    } catch {
      /* déjà absent — ok */
    }
  }
}

/** Indique si un groupe est masqué du menu burger. */
export async function isGroupHidden(
  db: PrismaClient,
  id: number
): Promise<boolean> {
  const m = await db.appMeta.findUnique({
    where: { key: hiddenMetaKey(id) },
    select: { value: true },
  });
  return m?.value === "1";
}

// ---------------------------------------------------------------------------
// CRUD Group
// ---------------------------------------------------------------------------

/** Crée un groupe. Lance une erreur Prisma si le nom existe déjà (unique). */
export async function createGroup(
  db: PrismaClient,
  name: string,
  color?: string
): Promise<{ id: number; name: string; color: string }> {
  const norm = normalizeGroupName(name);
  if (!norm) throw new Error("Nom de groupe vide");
  const c = normalizeColor(color);
  const g = await db.group.create({
    data: { name: norm, color: c },
    select: { id: true, name: true, color: true },
  });
  return g;
}

/** Récupère un groupe par son ID (sans médias). */
export async function getGroup(
  db: PrismaClient,
  id: number
): Promise<{ id: number; name: string; color: string; createdAt: Date } | null> {
  return db.group.findUnique({
    where: { id },
    select: { id: true, name: true, color: true, createdAt: true },
  });
}

/** Liste tous les groupes (visibles) avec le nombre de médias dans chacun.
 *  Tri alpha. Si `includeHidden` est true, les groupes masqués du menu burger
 *  (AppMeta `group_hidden_<id>`) sont inclus. */
export async function listGroups(
  db: PrismaClient,
  options: { includeHidden?: boolean } = {}
): Promise<GroupDTO[]> {
  const { includeHidden = false } = options;
  const [rows, hiddenRows] = await Promise.all([
    db.group.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        _count: { select: { media: true } },
      },
    }),
    includeHidden
      ? Promise.resolve([] as { key: string }[])
      : db.appMeta.findMany({
          where: { key: { startsWith: "group_hidden_" } },
          select: { key: true },
        }),
  ]);
  const hiddenIds = new Set(
    hiddenRows.map((r) => {
      const m = r.key.match(/^group_hidden_(\d+)$/);
      return m ? Number(m[1]) : NaN;
    }).filter((n) => Number.isFinite(n))
  );

  return rows
    .filter((r) => includeHidden || !hiddenIds.has(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      count: r._count.media,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
}

/** Met à jour le nom et/ou la couleur d'un groupe. */
export async function updateGroup(
  db: PrismaClient,
  id: number,
  patch: { name?: string; color?: string }
): Promise<{ id: number; name: string; color: string } | null> {
  const data: { name?: string; color?: string } = {};
  if (patch.name !== undefined) {
    const norm = normalizeGroupName(patch.name);
    if (!norm) throw new Error("Nom de groupe vide");
    data.name = norm;
  }
  if (patch.color !== undefined) {
    data.color = normalizeColor(patch.color);
  }
  if (Object.keys(data).length === 0) {
    // Rien à mettre à jour : renvoie l'état courant
    const g = await db.group.findUnique({
      where: { id },
      select: { id: true, name: true, color: true },
    });
    return g;
  }
  try {
    return await db.group.update({
      where: { id },
      data,
      select: { id: true, name: true, color: true },
    });
  } catch {
    return null; // groupe introuvable ou contrainte unique violée
  }
}

/** Supprime un groupe. Les médias ne sont PAS supprimés (cascade sur MediaGroup
 *  nettoie les liaisons). Renvoie true si supprimé, false si introuvable. */
export async function deleteGroup(
  db: PrismaClient,
  id: number
): Promise<boolean> {
  try {
    await db.group.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Liaisons Media ↔ Group
// ---------------------------------------------------------------------------

/** Attache une liste de médias à un groupe (INSERT OR IGNORE batch).
 *  Renvoie le nombre d'attachs effectivement créés (exclut les déjà présents). */
export async function addGroupMedia(
  db: PrismaClient,
  groupId: number,
  mediaIds: number[]
): Promise<number> {
  if (mediaIds.length === 0) return 0;

  // Récupère les mediaIds déjà attachés pour les exclure du batch d'insert.
  const existing = await db.mediaGroup.findMany({
    where: { groupId, mediaId: { in: mediaIds } },
    select: { mediaId: true },
  });
  const existingSet = new Set(existing.map((r) => r.mediaId));
  const toInsert = mediaIds.filter((id) => !existingSet.has(id));

  if (toInsert.length === 0) return 0;

  // Vérifie que le groupe existe (sinon Prisma lèvera une erreur de FK).
  // On ne fait pas le check ici pour économiser une requête : la route API
  // appelle createGroup / getGroup avant, donc le groupe est censé exister.

  // Vérifie aussi que les médias existent (filter les IDs inexistants pour
  // éviter une erreur FK sur l'insert batch).
  const realMedia = await db.media.findMany({
    where: { id: { in: toInsert } },
    select: { id: true },
  });
  const realIds = new Set(realMedia.map((m) => m.id));
  const validToInsert = toInsert.filter((id) => realIds.has(id));

  if (validToInsert.length === 0) return 0;

  // Note : on a déjà filtré les doublons + vérifié l'existence des médias
  // ci-dessus, donc `createMany` sans `skipDuplicates` est sûr. Prisma +
  // SQLite ne supporte pas `skipDuplicates` dans le typage de `createMany`
  // (cf. https://www.prisma.io/docs/concepts/components/prisma-client/crud#create).
  await db.mediaGroup.createMany({
    data: validToInsert.map((mediaId) => ({ mediaId, groupId })),
  });

  return validToInsert.length;
}

/** Détache une liste de médias d'un groupe (DELETE batch).
 *  Renvoie le nombre de détachs effectifs. */
export async function removeGroupMedia(
  db: PrismaClient,
  groupId: number,
  mediaIds: number[]
): Promise<number> {
  if (mediaIds.length === 0) return 0;
  const res = await db.mediaGroup.deleteMany({
    where: { groupId, mediaId: { in: mediaIds } },
  });
  return res.count;
}

// ---------------------------------------------------------------------------
// Médias d'un groupe (pour la page dédiée /groups/[id])
// ---------------------------------------------------------------------------

/** Récupère les MediaListItem complets pour un groupe, avec pagination.
 *  Tri par ordre d'ajout au groupe (createdAt MediaGroup DESC = plus récent d'abord). */
export async function mediaForGroup(
  db: PrismaClient,
  groupId: number,
  page: number,
  pageSize: number
): Promise<{ items: MediaListItem[]; total: number }> {
  const skip = (Math.max(1, page) - 1) * pageSize;

  const [rows, total] = await Promise.all([
    db.mediaGroup.findMany({
      where: { groupId },
      orderBy: { media: { id: "desc" } },
      skip,
      take: pageSize,
      include: {
        media: {
          include: {
            tags: { include: { tag: { select: { id: true, name: true, category: true } } } },
          },
        },
      },
    }),
    db.mediaGroup.count({ where: { groupId } }),
  ]);

  const items: MediaListItem[] = rows.map((r) => {
    const m = r.media;
    return {
      id: m.id,
      kind: m.kind as MediaListItem["kind"],
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
      tags: m.tags
        .map((mt) => ({
          id: mt.tag.id,
          name: mt.tag.name,
          category: mt.tag.category,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      tagCount: m.tagCount,
      favorite: m.favorite,
      score: m.score,
      views: m.views,
      importedAt:
        m.importedAt instanceof Date ? m.importedAt.toISOString() : String(m.importedAt),
    };
  });

  return { items, total };
}

// ---------------------------------------------------------------------------
// Médias d'un groupe FILTRÉS par tags (P6 — sidebar tags dans /groups/[id])
// ---------------------------------------------------------------------------

/**
 * Récupère les MediaListItem pour un groupe, FILTRÉS par une requête booru
 * (tags inclus/exclus, type:, ext:, order:…). Pagination + total.
 *
 * Combine la clause WHERE du groupe (MediaGroup.groupId) avec celle de la
 * recherche tag (buildWhere) via un AND Prisma.
 *
 * Tri : order:newest/oldest supporté (id-based). Pour les autres tris, on
 * retombe sur newest. Le tri se fait sur Media directement (pas sur MediaGroup)
 * car on filtre par Media.
 */
export async function mediaForGroupFiltered(
  db: PrismaClient,
  groupId: number,
  q: string,
  page: number,
  pageSize: number
): Promise<{ items: MediaListItem[]; total: number; parsed: ReturnType<typeof parseQuery> }> {
  const pq = parseQuery(q);
  const tagWhere = await buildWhere(db, pq);
  // buildWhere renvoie null si la requête tag garantit un résultat vide
  // (e.g. tag inexistant). Dans ce cas, on short-circuit.
  if (tagWhere === null) {
    return { items: [], total: 0, parsed: pq };
  }

  // Clause Where combinant groupe + recherche tag.
  // On doit passer par MediaGroup pour rester cohérent avec la relation N↔N.
  const groupWhere: Prisma.MediaGroupWhereInput = {
    groupId,
    media: tagWhere,
  };

  // Tri : seuls newest/oldest sont id-based. Pour les autres, on ordonne sur
  // la relation media.
  const isNewest = pq.order === "newest" || pq.order === "favorite" || pq.order === "random";
  const orderByMedia: Prisma.MediaOrderByWithRelationInput =
    pq.order === "oldest"
      ? { id: "asc" }
      : pq.order === "size"
        ? { size: "desc" }
        : pq.order === "size_asc"
          ? { size: "asc" }
          : pq.order === "tagcount"
            ? { tagCount: "desc" }
            : pq.order === "tagcount_asc"
              ? { tagCount: "asc" }
              : pq.order === "favorite"
                ? { favorite: "desc" }
                : { id: isNewest ? "desc" : "desc" };

  const skip = (Math.max(1, page) - 1) * pageSize;

  const [rows, total] = await Promise.all([
    db.mediaGroup.findMany({
      where: groupWhere,
      orderBy: { media: orderByMedia },
      skip,
      take: pageSize,
      include: {
        media: {
          include: {
            tags: { include: { tag: { select: { id: true, name: true, category: true } } } },
          },
        },
      },
    }),
    db.mediaGroup.count({ where: groupWhere }),
  ]);

  const items: MediaListItem[] = rows.map((r) => {
    const m = r.media;
    return {
      id: m.id,
      kind: m.kind as MediaListItem["kind"],
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
      tags: m.tags
        .map((mt) => ({
          id: mt.tag.id,
          name: mt.tag.name,
          category: mt.tag.category,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      tagCount: m.tagCount,
      favorite: m.favorite,
      score: m.score,
      views: m.views,
      importedAt:
        m.importedAt instanceof Date ? m.importedAt.toISOString() : String(m.importedAt),
    };
  });

  return { items, total, parsed: pq };
}

/**
 * Récupère tous les tags présents sur les médias d'un groupe (avec leur
 * postCount global). Tri par postCount desc, puis name asc. P6 — sidebar.
 *
 * Délègue à tagsForGroup (tag-helpers) pour la logique.
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
