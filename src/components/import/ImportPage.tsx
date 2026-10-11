// Page d'import (phase 1) : import sur place de fichiers et de dossiers.
// Les options de conversion / compression et les tags par défaut arrivent en phase 4.

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { navigate } from "@/lib/router";
import { FilesCard } from "./FilesCard";
import { ImportActionBar } from "./ImportActionBar";

/** ffmpeg sert aux miniatures vidéo (IMP-48) : message clair s'il est absent. */
function FfmpegNotice() {
  const { data } = useQuery({ queryKey: ["ffmpeg"], queryFn: api.ffmpegStatus, staleTime: Infinity });
  if (!data) return null;
  if (data.found) {
    return (
      <p data-zone="import.ffmpeg" className="text-[11px] text-muted-foreground" title={data.path ?? undefined}>
        ffmpeg {data.version} détecté : les vidéos auront une miniature.
      </p>
    );
  }
  return (
    <div
      data-zone="import.ffmpeg"
      className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        ffmpeg est introuvable : les vidéos seront importées sans miniature. Installez ffmpeg (par exemple avec la commande{" "}
        <code className="font-mono text-xs">winget install Gyan.FFmpeg</code>), puis relancez MyBoard.
      </span>
    </div>
  );
}

export function ImportPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-6">
      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("library")}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la bibliothèque
        </Button>
      </div>

      <header className="mb-6">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#d9a94e]/15 ring-1 ring-[#d9a94e]/30">
            <Upload className="h-5 w-5 text-[#d9a94e]" />
          </span>
          Importer des médias
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Glissez-déposez vos fichiers ou dossiers, ou cliquez sur{" "}
          <strong className="text-foreground">Importer un fichier</strong> /{" "}
          <strong className="text-foreground">Importer un dossier</strong>. MyBoard référence vos photos, vidéos, musiques et
          documents là où ils sont. Les doublons (même contenu, même sous un autre nom) sont automatiquement ignorés, et les
          miniatures sont créées en arrière-plan.
        </p>
      </header>

      <div className="space-y-5">
        <FilesCard />
        <FfmpegNotice />
        <ImportActionBar />
      </div>
    </main>
  );
}
