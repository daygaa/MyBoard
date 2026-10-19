// Renommer un tag (CTX-04) : pop-in du style de « Créer un nouveau tag ». Si le nom est déjà porté
// par un autre tag, pop-in « [tag] existe déjà et X médias y sont attachés, voulez-vous les
// fusionner ? » (« Oui » rouge) : les médias passent au tag existant, l'ancien disparaît. La même
// confirmation sert au renommage dans la ligne du gestionnaire (TAGM-04).

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { api, type Renamed, type TagInfo } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { displayTag } from "@/lib/tags";
import { mergeTags, runTagAction } from "@/lib/tagManager";

const CANCEL = "text-foreground hover:bg-secondary hover:text-foreground";

type Existing = Extract<Renamed, { kind: "exists" }>;

/** « X existe déjà… voulez-vous les fusionner ? » ; « Oui » fusionne `sourceId` dans le tag existant. */
export function MergeTagDialog({ sourceId, existing, onCancel, onDone }: { sourceId: number; existing: Existing; onCancel: () => void; onDone: () => void }) {
  const count = existing.mediaCount;
  return (
    <Modal
      open
      even
      onClose={onCancel}
      zone="tag-fusion"
      title="Nom déjà utilisé"
      description={`« ${displayTag(existing.name)} » existe déjà et ${formatNumber(count)} ${plural(count, "média")} y ${count > 1 ? "sont attachés" : "est attaché"}, voulez-vous les fusionner ?`}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} className={CANCEL}>
            Non
          </Button>
          <Button
            data-zone="tag-fusion.oui"
            onClick={() => void mergeTags([sourceId], existing.id).then(onDone)}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Oui
          </Button>
        </>
      }
    />
  );
}

/** Renomme `tag` ; `true` si c'est fait, l'autre tag s'il faut proposer la fusion, `null` sinon (nom
 *  vide, erreur affichée). */
export async function renameTag(tag: Pick<TagInfo, "id">, name: string): Promise<true | Existing | null> {
  const result = await runTagAction("Renommer le tag", () => api.renameTag(tag.id, name));
  if (result?.kind === "exists") return result;
  return result?.kind === "done" ? true : null;
}

export function RenameTagDialog({ tag, onCancel, onDone }: { tag: TagInfo; onCancel: () => void; onDone: () => void }) {
  const [name, setName] = useState(displayTag(tag.name));
  const [existing, setExisting] = useState<Existing | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const result = await renameTag(tag, name);
    setBusy(false);
    if (result === true) onDone();
    else if (result) setExisting(result);
  };

  if (existing) return <MergeTagDialog sourceId={tag.id} existing={existing} onCancel={() => setExisting(null)} onDone={onDone} />;
  return (
    <Modal
      open
      onClose={onCancel}
      zone="tag-renommer"
      title="Renommer le tag"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} className={CANCEL}>
            Annuler
          </Button>
          <Button
            data-zone="tag-renommer.valider"
            disabled={!name.trim() || busy}
            onClick={() => void submit()}
            className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]"
          >
            Renommer
          </Button>
        </>
      }
    >
      <input
        data-zone="tag-renommer.champ"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          void submit();
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="h-9 w-full rounded-md border border-border bg-card/60 px-3 font-mono text-sm text-foreground outline-none focus:border-[#d9a94e]/60"
      />
    </Modal>
  );
}
