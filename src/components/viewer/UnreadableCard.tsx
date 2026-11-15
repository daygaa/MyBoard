// Cartes « illisible dans MyBoard » de la visionneuse (VIEW-59 ; réponses Q31 A, Q32 A, Q33 A du 15/11) : image qu'aucun
// décodeur de MyBoard ne lit (format sans programme sur ce PC, ou fichier abîmé), vidéo que ni le lecteur intégré ni
// ffmpeg ne lisent. Vidéo que ffmpeg lit : carte « Vidéo illisible » avec « Convertir » (ConvertVideo.tsx, VIEW-25).
// Pas de zoom (la carte remplace l'image) ; clic droit : le menu du média, entrées qui ont besoin de l'image ou de la
// lecture grisées. Sous « Ouvrir avec l'application par défaut » : « Supprimer » (VIEW-62).

import type { ReactNode } from "react";
import { Film, ImageOff } from "lucide-react";

import type { MediaItem } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { DeleteShownButton } from "./DeleteShown";
import { imageMenu, videoMenu } from "./mediaMenus";
import { OpenExternally } from "./OpenExternally";

/** Contenu centré dans la scène ; un clic sur le fond (hors du contenu) ferme (VIEW-02). */
export function Centered({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

export function UnreadableCard({ item, kind }: { item: MediaItem; kind: "image" | "vidéo" }) {
  const image = kind === "image";
  const Icon = image ? ImageOff : Film;
  return (
    <div
      data-zone={image ? "visionneuse.image-illisible" : "visionneuse.illisible"}
      onContextMenu={(e) => openContextMenu(e, () => (image ? imageMenu(item, null) : videoMenu(item, null)))}
      className="flex max-w-lg flex-col items-center rounded-xl border border-border bg-card px-8 py-10 text-center"
    >
      <Icon className="h-12 w-12 text-muted-foreground" />
      <p className="mt-4 font-semibold text-foreground">{image ? "Image illisible dans MyBoard" : "Vidéo illisible dans MyBoard"}</p>
      <p className="mt-1 text-sm font-medium break-all text-foreground/80 select-text">{item.fileName}</p>
      <p className="mt-2 text-sm text-muted-foreground select-text">
        {`MyBoard ne parvient pas à lire cette ${kind} : son format n'est pas pris en charge sur ce PC, ou le fichier est abîmé. Ouvrez-la avec l'application par défaut.`}
      </p>
      <OpenExternally item={item} />
      <DeleteShownButton item={item} />
    </div>
  );
}
