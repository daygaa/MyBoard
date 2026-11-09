// Contenu de la visionneuse selon le type de média : image zoomable, vidéo (lecteur
// personnalisé, VIEW-29 ; aussi les GIF animés, VIEW-54), son, document.
// Format que le lecteur intégré ne sait pas lire : message clair + « Ouvrir avec
// l'application par défaut » (VIEW-24), en attendant la conversion à la volée (VIEW-25) ;
// pareil pour un son illisible (.wma : trouvé en testant tous les formats, IMP-05).

import { useState, type ReactNode } from "react";
import { ExternalLink, File, FileSpreadsheet, Film, Music } from "lucide-react";

import { api, mediaUrl, type MediaItem } from "@/lib/api";
import { ImageStage } from "./ImageStage";
import { VideoStage } from "./VideoStage";
import { runExternal } from "./externalOpen";

const SHEETS = ["xls", "xlsx", "xlsm", "ods", "csv"];

function OpenExternally({ item }: { item: MediaItem }) {
  return (
    <button
      type="button"
      data-zone="visionneuse.ouvrir-externe"
      onClick={() => void runExternal("Ouvrir avec l'application par défaut", () => api.openMedia(item.id))}
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

/** Contenu centré dans la scène ; un clic sur le fond (hors du contenu) ferme (VIEW-02). */
function Centered({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

/** Lecteur de son ; si le moteur ne sait pas le lire, la carte « Ouvrir avec » comme pour une vidéo illisible. */
function AudioStage({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const [unplayable, setUnplayable] = useState(false);
  if (unplayable) {
    return (
      <Centered onClose={onClose}>
        <Card
          item={item}
          icon={<Music className="h-12 w-12 text-amber-300/80" />}
          message="Ce fichier audio ne peut pas être lu dans MyBoard : son format n'est pas pris en charge par le lecteur intégré."
        />
      </Centered>
    );
  }
  return (
    <Centered onClose={onClose}>
      <div className="flex w-full max-w-xl flex-col items-center rounded-xl border border-border bg-card px-6 py-12">
        <Music className="h-12 w-12 text-amber-300/80" />
        <p className="mt-4 mb-6 font-medium break-all text-foreground">{item.fileName}</p>
        <audio data-zone="visionneuse.audio" src={mediaUrl(item)} controls autoPlay onError={() => setUnplayable(true)} className="w-full" />
      </div>
    </Centered>
  );
}

/** `opening` : média ouvert depuis la grille, aucune flèche encore (image : original demandé aussitôt, VIEW-53). */
export function MediaStage({ item, onClose, opening }: { item: MediaItem; onClose: () => void; opening: boolean }) {
  // GIF animé : lecteur vidéo (VIEW-54) ; s'il ne peut pas être converti (ffmpeg absent…), comme une image.
  if (item.kind === "image" && item.ext === "gif") return <VideoStage item={item} onClose={onClose} fallback={<ImageStage item={item} onClose={onClose} />} />;
  if (item.kind === "image") return <ImageStage item={item} onClose={onClose} opening={opening} />;
  if (item.kind === "video") {
    const unplayable = (
      <Centered onClose={onClose}>
        <Card
          item={item}
          icon={<Film className="h-12 w-12 text-muted-foreground" />}
          message="Cette vidéo ne peut pas être lue dans MyBoard : son format n'est pas pris en charge par le lecteur intégré."
        />
      </Centered>
    );
    return <VideoStage item={item} onClose={onClose} fallback={unplayable} />;
  }
  // Une clé par média : l'état « illisible » ne passe pas au son suivant.
  if (item.kind === "audio") return <AudioStage key={item.id} item={item} onClose={onClose} />;
  if (item.ext === "pdf") {
    return (
      <Centered onClose={onClose}>
        <iframe
          data-zone="visionneuse.pdf"
          src={mediaUrl(item)}
          title={item.fileName}
          className="h-full w-full max-w-5xl rounded-lg border border-border bg-white"
        />
      </Centered>
    );
  }
  const Icon = SHEETS.includes(item.ext) ? FileSpreadsheet : File;
  return (
    <Centered onClose={onClose}>
      <Card item={item} icon={<Icon className="h-14 w-14 text-sky-300" />} />
    </Centered>
  );
}
