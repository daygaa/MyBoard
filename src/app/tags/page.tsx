// MyBoard — Page Gestionnaire de Tags (P6).
//
// Route : /tags
// Server component — accès direct à la DB via Prisma (pas de boucle HTTP).
// Liste tous les tags triés par postCount desc, puis les passe au composant
// client <TagsTable/> qui gère les actions (rename / change category / delete).
//
// Le thème doré est respecté (cards + tableaux avec hover, pas d'indigo/bleu).

import Link from "next/link";
import { ChevronLeft, Tags, Upload } from "lucide-react";
import { db } from "@/lib/db";
import type { TagDTO } from "@/lib/types";
import { TagsTable } from "@/components/tags/TagsTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gestionnaire de Tags — MyBoard",
};

export default async function TagsPage() {
  // Liste tous les tags triés par postCount desc, puis name asc.
  // Pas de pagination : la bibliothèque est locale et le nombre de tags
  // reste gérable (typiquement < 10 000).
  let tags: TagDTO[] = [];
  let dbError: string | null = null;
  try {
    const rows = await db.tag.findMany({
      orderBy: [{ postCount: "desc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, postCount: true },
    });
    tags = rows.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      postCount: t.postCount,
    }));
  } catch (e) {
    console.error("[/tags] DB error:", e);
    dbError = "Impossible de charger les tags.";
  }

  const totalTags = tags.length;
  const totalMediaTagged = tags.reduce((s, t) => s + t.postCount, 0);

  return (
    <main className="min-w-0 flex-1 px-4 py-5 lg:px-6">
      {/* En-tête de page */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Retour à la bibliothèque
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#d9a94e]/15 ring-1 ring-[#d9a94e]/30"
            aria-hidden
          >
            <Tags className="h-4 w-4 text-[#d9a94e]" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">
              Gestionnaire de Tags
            </h1>
            <p className="text-xs text-muted-foreground">
              {totalTags.toLocaleString("fr-FR")} tag{totalTags > 1 ? "s" : ""} ·{" "}
              {totalMediaTagged.toLocaleString("fr-FR")} média
              {totalMediaTagged > 1 ? "s" : ""} taggé
              {totalMediaTagged > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Bouton Importer (raccourci) */}
        <Link
          href="/import"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#d9a94e] px-3 py-1.5 text-xs font-medium text-[#1a1408] transition hover:bg-[#e3b75f]"
        >
          <Upload className="h-3.5 w-3.5" />
          Importer
        </Link>
      </div>

      {/* Tableau ou erreur */}
      {dbError ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-rose-500/40 py-16 text-center">
          <p className="text-sm text-rose-400" role="alert">
            {dbError}
          </p>
        </div>
      ) : totalTags === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border py-24 text-center">
          <p className="text-lg font-medium text-foreground">
            Aucun tag pour le moment
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Importez des médias avec des tags pour les voir apparaître ici.
          </p>
          <Link
            href="/import"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#d9a94e] px-4 py-2 text-sm font-medium text-[#1a1408] transition hover:bg-[#e3b75f]"
          >
            Importer des médias
          </Link>
        </div>
      ) : (
        <TagsTable tags={tags} />
      )}
    </main>
  );
}
