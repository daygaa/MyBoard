// Page d'import : import sur place de fichiers et de dossiers ; carte « Options d'import » à droite de la carte
// Fichiers et tags par défaut dessous (IMP-30, disposition v8). La page passe toujours SOUS l'en-tête (IMP-57) : ses
// listes et aperçus (suggestions des tags, aperçu agrandi) restent sous le logo, le menu burger et « Importer ».

import { ArrowLeft, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { navigate } from "@/lib/router";
import { DefaultTagsEditor } from "./DefaultTagsEditor";
import { FileList } from "./FileList";
import { FilesCard } from "./FilesCard";
import { ImportActionBar } from "./ImportActionBar";
import { OptionsCard } from "./OptionsCard";

export function ImportPage() {
  return (
    <main className="isolate mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-6">
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
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <FilesCard />
          <OptionsCard />
        </div>
        <DefaultTagsEditor />
        <ImportActionBar />
        <FileList />
      </div>
    </main>
  );
}
