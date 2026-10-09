// POST /api/media/:id/favorite
// Toggle favorite via la table Favorite (P7.7 — ne plus utiliser Media.favorite).
// Renvoie {ok, favorite: boolean}.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USER_ID = "local"; // mono-utilisateur pour l'instant

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const media = await db.media.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!media) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    }

    // Check si déjà favori
    const existing = await db.favorite.findUnique({
      where: { mediaId_userId: { mediaId: id, userId: USER_ID } },
    });

    if (existing) {
      // Retirer des favoris
      await db.favorite.delete({
        where: { mediaId_userId: { mediaId: id, userId: USER_ID } },
      });
      // Sync le champ dénormalisé Media.favorite (pour compat queries existantes)
      await db.media.update({ where: { id }, data: { favorite: false } });
      return NextResponse.json({ ok: true, favorite: false });
    } else {
      // Ajouter aux favoris
      await db.favorite.create({
        data: { mediaId: id, userId: USER_ID },
      });
      await db.media.update({ where: { id }, data: { favorite: true } });
      return NextResponse.json({ ok: true, favorite: true });
    }
  } catch (err) {
    console.error("[POST /api/media/:id/favorite] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/media/:id/favorite → check si favori
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const fav = await db.favorite.findUnique({
      where: { mediaId_userId: { mediaId: id, userId: USER_ID } },
    });
    return NextResponse.json({ ok: true, favorite: !!fav });
  } catch (err) {
    console.error("[GET /api/media/:id/favorite] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
