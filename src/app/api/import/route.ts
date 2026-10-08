// POST /api/import
// Reçoit un FormData multi-part :
//   - "files" : un ou plusieurs File
//   - "options" : JSON string ImportOptions
// Renvoie un bilan final { total, imported, duplicates, skipped, errors[], results[] }.
//
// Le frontend envoie un fichier à la fois pour avoir une progression par fichier
// (voir src/components/import/ImportFlow.tsx), mais la route supporte aussi
// l'envoi groupé si besoin.

import { NextResponse } from "next/server";
import {
  normalizeImportOptions,
  processUpload,
  type ImportFileResult,
  type ImportOptions,
} from "@/lib/import-processing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Limite soft pour éviter un DoS par mass-upload via l'API
const MAX_FILES_PER_REQUEST = 200;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const optionsRaw = form.get("options");
    const options = normalizeImportOptions(
      typeof optionsRaw === "string" ? safeParse(optionsRaw) : null
    );

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Aucun fichier reçu dans le FormData" },
        { status: 400 }
      );
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Trop de fichiers dans une seule requête (max ${MAX_FILES_PER_REQUEST})` },
        { status: 413 }
      );
    }

    const results: ImportFileResult[] = [];
    for (const file of files) {
      // Traitement séquentiel pour ne pas saturer sharp / ffmpeg en parallèle
      const r = await processUpload(file, options);
      results.push(r);
    }

    const summary = {
      total: files.length,
      imported: results.filter((r) => r.status === "imported").length,
      duplicates: results.filter((r) => r.status === "duplicate").length,
      skipped: 0,
      errors: results
        .filter((r) => r.status === "error")
        .map((r) => ({ file: r.file, error: r.error ?? "Erreur inconnue" })),
      results,
    };

    return NextResponse.json(summary, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[POST /api/import] error:", err);
    return NextResponse.json(
      { error: "Erreur serveur", details: String(err) },
      { status: 500 }
    );
  }
}

/** Parse du JSON options avec garde-fou (fallback sur défauts si invalide). */
function safeParse(raw: string): Partial<ImportOptions> | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
