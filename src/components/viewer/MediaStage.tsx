// Contenu de la visionneuse selon le type de média : image zoomable, vidéo, son, document.
// Vidéos : fichier original lu directement, avec lecture partielle (avancer est immédiat) ;
// lecture automatique, en boucle, avec le son, boucle désactivable (VIEW-26).
// Format que le lecteur intégré ne sait pas lire : message clair + « Ouvrir avec
// l'application par défaut » (VIEW-24), en attendant la conversion à la volée (VIEW-25).

import { useState, type ReactNode } from "react";
import { ExternalLink, File, FileSpreadsheet, Film, Music, Repeat } from "lucide-react";

import { api, mediaUrl, type MediaItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useViewer } from "@/stores/viewer";
import { ImageStage } from "./ImageStage";

const SHEETS = ["xls", "xlsx", "xlsm", "ods", "csv", "gsheet"];

function OpenExternally({ item }: { item: MediaItem }) {
  return (
    <button
      type="button"
      data-zone="visionneuse.ouvrir-externe"
      onClick={() => void api.openMedia(item.id)}
      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#d9a94e] px-4 py-2 text-sm font-medium text-[#1a1408] transition hover:bg-[#e3b75f]"
    >
      <ExternalLink className="h-4 w-4" />
      Ouvrir avec l'application par défaut
    </button>
  );
}

/** Carte centrée : icône, nom, message, bouton d'ouverture externe. */
function Card({ item, icon, message }: { item: MediaItem; icon: ReactNode; message?: string }) {
  return (
    <div className="flex max-w-lg flex-col items-center rounded-xl border border-border bg-card px-8 py-12 text-center">
      {icon}
      <p className="mt-4 font-medium break-all text-foreground">{item.fileName}</p>
      {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
      <OpenExternally item={item} />
    </div>
  );
}

function VideoStage({ item }: { item: MediaItem }) {
  const loop = useViewer((s) => s.loop);
  const setLoop = useViewer((s) => s.setLoop);
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <Card
        item={item}
        icon={<Film className="h-12 w-12 text-muted-foreground" />}
        message="Cette vidéo ne peut pas être lue dans MyBoard : son format n'est pas pris en charge par le lecteur intégré."
      />
    );
  }
  return (
    <>
      <video
        data-zone="visionneuse.video"
        src={mediaUrl(item)}
        controls
        autoPlay
        loop={loop}
        playsInline
        onError={() => setFailed(true)}
        // Piste image illisible (le son seul passerait) : même message.
        onLoadedMetadata={(e) => e.currentTarget.videoWidth === 0 && setFailed(true)}
        className="max-h-full max-w-full"
      />
      <button
        type="button"
        data-zone="visionneuse.boucle"
        aria-pressed={loop}
        onClick={() => setLoop(!loop)}
        title={loop ? "Lecture en boucle activée : cliquer pour la désactiver" : "Lecture en boucle désactivée : cliquer pour l'activer"}
        className={cn(
          "absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1.5 text-xs transition hover:bg-black/90",
          loop ? "text-[#d9a94e]" : "text-zinc-400",
        )}
      >
        <Repeat className="h-3.5 w-3.5" />
        {loop ? "Boucle" : "Boucle désactivée"}
      </button>
    </>
  );
}

export function MediaStage({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  if (item.kind === "image") return <ImageStage item={item} onClose={onClose} />;

  let content: ReactNode;
  if (item.kind === "video") content = <VideoStage item={item} />;
  else if (item.kind === "audio") {
    content = (
      <div className="flex w-full max-w-xl flex-col items-center rounded-xl border border-border bg-card px-6 py-12">
        <Music className="h-12 w-12 text-amber-300/80" />
        <p className="mt-4 mb-6 font-medium break-all text-foreground">{item.fileName}</p>
        <audio data-zone="visionneuse.audio" src={mediaUrl(item)} controls autoPlay className="w-full" />
      </div>
    );
  } else if (item.ext === "pdf") {
    content = (
      <iframe
        data-zone="visionneuse.pdf"
        src={mediaUrl(item)}
        title={item.fileName}
        className="h-full w-full max-w-5xl rounded-lg border border-border bg-white"
      />
    );
  } else {
    const Icon = SHEETS.includes(item.ext) ? FileSpreadsheet : File;
    content = <Card item={item} icon={<Icon className="h-14 w-14 text-sky-300" />} />;
  }
  // Clic sur le fond (hors du contenu) : fermer, comme pour une image non zoomée (VIEW-02).
  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {content}
    </div>
  );
}
