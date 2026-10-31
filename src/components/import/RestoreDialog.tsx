// Fin d'un import (DEL-05) : fichiers supprimés de la bibliothèque il y a moins d'un mois et
// réimportés. Une seule pop-in les liste (miniature, nom, date de suppression, tags, favori,
// dossiers, note), une case par média (toutes cochées) ; « Restaurer » remet les données des médias
// cochés, les autres restent importés sans données (leur réserve est effacée). Montée dans App :
// elle apparaît même si l'on a quitté la page d'import. Seuls ses boutons la ferment : un Échap ne
// doit pas faire perdre ces données.

import { useState } from "react";
import { FileImage, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { useCategories } from "@/hooks/useCategories";
import { api, thumbUrl, type RestoreCandidate } from "@/lib/api";
import { displayTag } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { useImport } from "@/stores/import";
import { useThumbs } from "@/stores/thumbs";
import { useViewer } from "@/stores/viewer";

function Thumb({ item }: { item: RestoreCandidate }) {
  // La miniature est refaite après l'import : nouvel essai quand elle est prête.
  const status = useThumbs((s) => s.updates[item.mediaId]?.status ?? -1);
  const [failedAt, setFailedAt] = useState<number | null>(null);
  if (failedAt === status) return <FileImage className="h-6 w-6 text-zinc-600" />;
  return (
    <img key={status} src={thumbUrl(item.hash, "small")} alt="" draggable={false} onError={() => setFailedAt(status)} className="h-full w-full object-cover" />
  );
}

function Row({ item, checked, onToggle }: { item: RestoreCandidate; checked: boolean; onToggle: () => void }) {
  const { color } = useCategories();
  const date = new Date(item.deletedAt).toLocaleDateString("fr-FR");
  return (
    <label data-zone="restauration.media" className="flex cursor-pointer gap-3 rounded-lg border border-border p-2.5 hover:bg-secondary/40">
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-1" />
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-[#0d0e12]">
        <Thumb item={item} />
      </span>
      <span className="min-w-0 flex-1 space-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{item.fileName}</span>
          {item.favorite && <Star className="h-3.5 w-3.5 shrink-0 fill-[#d9a94e] text-[#d9a94e]" aria-label="Favori" />}
        </span>
        <span className="block text-muted-foreground">Supprimé le {date}</span>
        {item.tags.length > 0 && (
          <span className="flex flex-wrap gap-x-2 gap-y-0.5">
            {item.tags.map((t) => (
              <span key={`${t.alias ?? ""}>${t.name}`} style={{ color: color(t.category) }}>
                {t.alias && <span className="text-muted-foreground">{displayTag(t.alias)} → </span>}
                {displayTag(t.name)}
              </span>
            ))}
          </span>
        )}
        {item.folders.length > 0 && (
          <span className="block text-muted-foreground">
            Dossiers :{" "}
            {item.folders.map((f, i) => (
              <span key={`${f.name}-${i}`} className={cn(!f.exists && "line-through")} title={f.exists ? undefined : "Dossier supprimé depuis : il ne sera pas recréé"}>
                {i > 0 && ", "}
                {f.name}
                {!f.exists && " (supprimé depuis)"}
              </span>
            ))}
          </span>
        )}
        {item.notes && <span className="line-clamp-2 block text-muted-foreground italic">Note : {item.notes}</span>}
      </span>
    </label>
  );
}

/** Toujours le même tableau vide : un nouveau à chaque lecture relancerait l'affichage sans fin. */
const NONE: RestoreCandidate[] = [];

export function RestoreDialog() {
  const candidates = useImport((s) => s.snapshot?.result?.restorable ?? NONE);
  const [unchecked, setUnchecked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  if (candidates.length === 0) return null;

  const answer = async (restoreChecked: boolean) => {
    const restore = restoreChecked ? candidates.filter((c) => !unchecked.has(c.mediaId)).map((c) => c.mediaId) : [];
    const discard = candidates.map((c) => c.mediaId).filter((id) => !restore.includes(id));
    setBusy(true);
    try {
      await api.restoreMediaData(restore, discard);
      setUnchecked(new Set());
    } catch (error) {
      useViewer.getState().setError({ action: "Restaurer les données", code: null, message: String(error) });
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: number) =>
    setUnchecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const one = candidates.length === 1;
  const canRestore = !busy && unchecked.size !== candidates.length;

  return (
    <Modal
      open
      wide
      dismissible={false}
      onEnter={() => {
        if (canRestore) void answer(true);
      }}
      onClose={() => {}}
      zone="restauration"
      title={one ? "Restaurer les données de ce média ?" : `Restaurer les données de ces ${candidates.length} médias ?`}
      description={
        one
          ? "Ce fichier avait été supprimé de la bibliothèque il y a moins d'un mois : ses données ont été gardées."
          : "Ces fichiers avaient été supprimés de la bibliothèque il y a moins d'un mois : leurs données ont été gardées."
      }
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={() => void answer(false)} className="text-foreground hover:bg-secondary hover:text-foreground">
            Ne rien restaurer
          </Button>
          <Button
            data-zone="restauration.restaurer"
            disabled={!canRestore}
            onClick={() => void answer(true)}
            className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]"
          >
            Restaurer
          </Button>
        </>
      }
    >
      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {candidates.map((c) => (
          <Row key={c.mediaId} item={c} checked={!unchecked.has(c.mediaId)} onToggle={() => toggle(c.mediaId)} />
        ))}
      </div>
    </Modal>
  );
}
