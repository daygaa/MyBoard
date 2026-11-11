// Média dont le fichier est introuvable (LIB-05) ou sur un emplacement inaccessible (LIB-14) : la visionneuse l'ouvre
// quand même (retour du 11/11) et montre la plus grande miniature déjà créée (1 280, 640, 320 ou 128 px), avec un
// bandeau qui prévient que ce n'est que la miniature et donne le dernier chemin connu. Sans aucune miniature : la carte
// « Fichier introuvable ». Un clic sur le fond ferme (VIEW-02).

import { useEffect, useState } from "react";
import { FileX, Unplug } from "lucide-react";

import { thumbUrl, type MediaItem, type ThumbTier } from "@/lib/api";
import { checkApi } from "@/lib/libraryCheck";

const SIZES: Record<ThumbTier, string> = { large: "1 280 px", preview: "640 px", normal: "320 px", small: "128 px" };

export function LostStage({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  // `undefined` : en cours de recherche ; `null` : aucune miniature.
  const [tier, setTier] = useState<ThumbTier | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setTier(undefined);
    void checkApi
      .bestThumb(item.hash)
      .then((t) => live && setTier(t))
      .catch(() => live && setTier(null));
    return () => {
      live = false;
    };
  }, [item.hash]);
  const Icon = item.offline ? Unplug : FileX;
  const title = item.offline ? "Emplacement inaccessible" : "Fichier introuvable";
  const why = item.offline
    ? "Le disque, la clé ou le dossier réseau de ce média n'est pas accessible : rebranchez-le pour l'ouvrir."
    : "Ce fichier a été supprimé, déplacé ou renommé en dehors de MyBoard. Réimporté depuis son nouvel emplacement, il retrouvera cette fiche.";

  return (
    <div className="absolute inset-0 flex flex-col">
      {tier && (
        // Entre le bouton de la note (en haut à gauche) et la croix (en haut à droite), sans les recouvrir.
        <div
          data-zone="visionneuse.introuvable.bandeau"
          className="mx-16 mt-3 flex shrink-0 items-start gap-3 rounded-lg border border-amber-500/30 bg-[#2a2214] px-4 py-2 text-sm text-amber-100"
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1 select-text">
            <p>
              <span className="font-medium">{title}</span> : seule la miniature ({SIZES[tier]}) est affichée. {why}
            </p>
            <p className="text-xs break-all text-amber-100/70">Dernier chemin connu : {item.lastPath}</p>
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-1 items-center justify-center p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {tier ? (
          // Agrandie à la hauteur de la scène (le fond autour reste cliquable pour fermer, VIEW-02).
          <img data-zone="visionneuse.introuvable.miniature" src={thumbUrl(item.hash, tier)} alt="" draggable={false} className="h-full w-auto max-w-full object-contain" />
        ) : (
          tier === null && (
            <div data-zone="visionneuse.introuvable" className="flex max-w-lg flex-col items-center rounded-xl border border-border bg-card px-8 py-12 text-center">
              <Icon className="h-12 w-12 text-amber-300/80" />
              <p className="mt-4 font-medium text-foreground">{title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{why}</p>
              <p className="mt-4 text-xs text-muted-foreground">Dernier chemin connu</p>
              <p className="mt-1 text-sm break-all text-foreground select-text">{item.lastPath}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
