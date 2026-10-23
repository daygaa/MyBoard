// Renommer un tag (CTX-04) : pop-in du style de « Créer un nouveau tag ». Si le nom est déjà porté
// par un autre tag, pop-in « [tag] existe déjà et X médias y sont attachés, voulez-vous les
// fusionner ? » (« Oui » rouge) : les médias passent au tag existant, l'ancien disparaît (son nom
// peut rester comme synonyme, TAGM-17). Nom d'un synonyme actif : fusion proposée avec son tag
// principal (TAGM-15). La même confirmation sert au renommage dans la ligne du gestionnaire
// (TAGM-04). Un tag renommé dans la recherche en cours y prend son nouveau nom (SRCH-27).

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { api, type Renamed, type TagInfo } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { displayTag, normalizeTag } from "@/lib/tags";
import { followRename, mergeTags, runTagAction } from "@/lib/tagManager";
import { useViewer } from "@/stores/viewer";
import { KeepAliasesBox } from "./KeepAliasesBox";

const CANCEL = "text-foreground hover:bg-secondary hover:text-foreground";

type Existing = Extract<Renamed, { kind: "exists" }>;

type Source = Pick<TagInfo, "id" | "name">;

/** « X existe déjà… voulez-vous les fusionner ? » ; « Oui » fusionne `source` dans le tag existant. */
export function MergeTagDialog({ source, existing, onCancel, onDone }: { source: Source; existing: Existing; onCancel: () => void; onDone: () => void }) {
  const [keep, setKeep] = useState(true);
  const count = existing.mediaCount;
  const attached = `${formatNumber(count)} ${plural(count, "média")} y ${count > 1 ? "sont attachés" : "est attaché"}`;
  const merge = () => void mergeTags([source], existing, keep).then(onDone);
  return (
    <Modal
      open
      even
      onEnter={merge}
      onClose={onCancel}
      zone="tag-fusion"
      title="Nom déjà utilisé"
      description={
        existing.alias
          ? `« ${displayTag(existing.alias)} » est un synonyme de « ${displayTag(existing.name)} », et ${attached}, voulez-vous les fusionner ?`
          : `« ${displayTag(existing.name)} » existe déjà et ${attached}, voulez-vous les fusionner ?`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} className={CANCEL}>
            Non
          </Button>
          <Button data-zone="tag-fusion.oui" onClick={merge} className="bg-destructive text-white hover:bg-destructive/90">
            Oui
          </Button>
        </>
      }
    >
      <KeepAliasesBox checked={keep} onChange={setKeep} />
    </Modal>
  );
}

/** Renomme `tag` ; `true` si c'est fait, l'autre tag s'il faut proposer la fusion, `null` sinon (nom
 *  vide, erreur affichée). */
export async function renameTag(tag: Source, name: string): Promise<true | Existing | null> {
  const result = await runTagAction("Renommer le tag", () => api.renameTag(tag.id, name));
  if (result?.kind === "exists") return result;
  if (result?.kind === "ownAlias") {
    const message = `« ${displayTag(normalizeTag(name))} » est déjà un synonyme de ce tag : supprimez d'abord ce synonyme (Gestionnaire de tags › Synonymes et parents).`;
    useViewer.getState().setError({ action: "Renommer le tag", code: null, message });
    return null;
  }
  if (result?.kind !== "done") return null;
  followRename(tag.name, normalizeTag(name));
  return true;
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

  if (existing) return <MergeTagDialog source={tag} existing={existing} onCancel={() => setExisting(null)} onDone={onDone} />;
  return (
    <Modal
      open
      onEnter={() => void submit()}
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
