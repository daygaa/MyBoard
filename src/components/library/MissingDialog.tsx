// Fichiers déplacés, renommés ou supprimés hors de MyBoard (LIB-05 ; réponses du 09/11 et Q4 A du 11/11) : à la fin
// de la vérification de l'ouverture, une pop-in les liste (miniature, nom, chemin) ; ses 2 boutons valent pour toute la
// liste. « Supprimer de la bibliothèque » : comme « Supprimer » avec les fichiers gardés (données en réserve un mois,
// DEL-05) ; « Conserver la miniature » : les médias restent, marqués « fichier introuvable », et retrouvent leur fichier
// s'il est réimporté. Échap ou la croix : rien ne change, la pop-in revient à l'ouverture suivante.

import { useState } from "react";
import { FileX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HoverCard } from "@/components/ui/hover-card";
import { Modal } from "@/components/ui/modal";
import { thumbUrl } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { checkApi, type MissingMedia } from "@/lib/libraryCheck";
import { useLibraryCheck } from "@/stores/libraryCheck";
import { useViewer } from "@/stores/viewer";

function Row({ item }: { item: MissingMedia }) {
  const [failed, setFailed] = useState(false);
  return (
    <li data-zone="fichiers-disparus.media" className="flex items-center gap-3 rounded-lg border border-border p-2">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-secondary">
        {failed ? (
          <FileX className="h-5 w-5 text-zinc-500" />
        ) : (
          <img src={thumbUrl(item.hash, "small")} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} className="h-full w-full object-cover" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{item.fileName}</span>
        <span className="block truncate text-xs text-muted-foreground" title={item.path}>
          {item.path}
        </span>
      </span>
    </li>
  );
}

export function MissingDialog() {
  const check = useLibraryCheck((s) => s.check);
  const dismissed = useLibraryCheck((s) => s.dismissedVersion);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [busy, setBusy] = useState(false);
  // Fermée sans réponse : elle ne revient que pour d'autres fichiers disparus (clé rebranchée…). Seuls les 500 premiers
  // sont envoyés par le cœur Rust, qui garde la liste complète et règle toute la liste.
  if (check.missingTotal === 0 || check.missingVersion === dismissed) return null;
  const list = check.missing;
  const total = check.missingTotal;
  const settle = (keep: boolean, action: string) => {
    setBusy(true);
    void checkApi
      .settle(keep)
      .catch((error: unknown) => useViewer.getState().setError({ action, code: null, message: String(error) }))
      .finally(() => setBusy(false));
  };
  const keep = () => settle(true, "Conserver la miniature");
  const remove = () => settle(false, "Supprimer de la bibliothèque");

  return (
    <Modal
      open
      wide
      zone="fichiers-disparus"
      onClose={() => useLibraryCheck.getState().dismissDialog()}
      onEnter={keep}
      title="Ces médias ont été supprimés ou déplacés de vos fichiers"
      description={`${formatNumber(total)} ${plural(total, "média de la bibliothèque n'a plus son fichier", "médias de la bibliothèque n'ont plus leur fichier")} à l'emplacement connu : supprimé, déplacé ou renommé en dehors de MyBoard.`}
      footer={
        <>
          <Button
            data-zone="fichiers-disparus.supprimer"
            variant="outline"
            disabled={busy}
            onClick={remove}
            className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
          >
            Supprimer de la bibliothèque
          </Button>
          <span onMouseEnter={(e) => setAnchor(e.currentTarget.getBoundingClientRect())} onMouseLeave={() => setAnchor(null)}>
            <Button data-zone="fichiers-disparus.conserver" disabled={busy} onClick={keep} className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]">
              Conserver la miniature
            </Button>
          </span>
          {anchor && (
            <HoverCard anchor={anchor} place="below" zone="fichiers-disparus.conserver.bulle">
              <span className="block max-w-xs leading-relaxed">
                Les médias restent dans la bibliothèque (tags, dossiers, favori), marqués « fichier introuvable ». Si ces fichiers sont
                réimportés, la miniature sera remplacée par le fichier réel.
              </span>
            </HoverCard>
          )}
        </>
      }
    >
      <ul className="space-y-1.5">
        {list.map((item) => (
          <Row key={item.id} item={item} />
        ))}
        {total > list.length && <li className="px-2 text-xs text-muted-foreground">… et {formatNumber(total - list.length)} autres</li>}
      </ul>
    </Modal>
  );
}
