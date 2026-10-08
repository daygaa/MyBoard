// MyBoard — Page d'import (server component).
// Layout : titre + ImportFlow (wrapper client qui orchestre Dropzone + Options + Progress).
// Le footer sticky est géré par layout.tsx (mt-auto sur le footer).

import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportFlow } from "@/components/import/ImportFlow";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-6">
      {/* Lien retour */}
      <div className="mb-5">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Retour à la bibliothèque
          </Link>
        </Button>
      </div>

      {/* Titre + description */}
      <header className="mb-6">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#d9a94e]/15 ring-1 ring-[#d9a94e]/30">
            <Upload className="h-5 w-5 text-[#d9a94e]" />
          </span>
          Importer des médias
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Glissez-déposez vos fichiers ou dossiers, ou cliquez sur{" "}
          <strong className="text-foreground">Parcourir</strong>. Configurez la
          compression, la conversion d&apos;images (JPG/PNG/WebP/AVIF…), le
          transcodage vidéo (MP4/WebM/AV1…) et ajoutez des tags par défaut,
          puis lancez l&apos;import. Les doublons (sha256) sont automatiquement
          ignorés.
        </p>
      </header>

      <ImportFlow />
    </main>
  );
}
