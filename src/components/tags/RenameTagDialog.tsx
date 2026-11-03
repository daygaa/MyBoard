// Renommer un tag (CTX-04) : pop-in du style de « Créer un nouveau tag ». Si le nom est déjà porté par un autre
// tag (ou par un tag fusionné : c'est son principal qui compte), rien n'est renommé : pop-in « Créer un synonyme ? »
// (retour T3, point TAGM-15.8 ; refonte, D7, D8, lot R6-1) : les deux tags seront reliés, interrupteur « Fusionner »
// éteint d'office (allumé si le groupe est entièrement fusionné, D2.2) ; la pop-in de fusion ou de réunion de groupes
// suit si besoin. La même pop-in sert au renommage dans la ligne du gestionnaire (TAGM-04). Un tag renommé dans la
// recherche en cours y prend son nouveau nom (SRCH-27).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { api, type Renamed, type TagInfo } from "@/lib/api";
import { createGroup } from "@/lib/groupRules";
import { rulesApi } from "@/lib/rulesApi";
import { media, q } from "@/lib/tagRules";
import { displayTag, normalizeTag } from "@/lib/tags";
import { followRename, runTagAction } from "@/lib/tagManager";
import { useViewer } from "@/stores/viewer";
import { MergeSwitch } from "./MergeSwitch";

const CANCEL = "text-foreground hover:bg-secondary hover:text-foreground";
const GOLD = "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]";

type Existing = Extract<Renamed, { kind: "exists" }>;

type Source = Pick<TagInfo, "id" | "name">;

/** « Créer un synonyme ? » : `source` rejoint le groupe du tag existant (relié, ou fusionné avec l'interrupteur). */
export function SynonymTagDialog({ source, existing, onCancel, onDone }: { source: Source; existing: Existing; onCancel: () => void; onDone: () => void }) {
  const { data: preview } = useQuery({ queryKey: ["group-preview", existing.name, [source.name]], queryFn: () => rulesApi.groupPreview(existing.name, [source.name]) });
  const [merge, setMerge] = useState<boolean | null>(null);
  const on = merge ?? preview?.fullyMerged ?? false;
  const nothing = preview !== undefined && preview.added.length === 0;
  const [from, to] = [displayTag(source.name), displayTag(existing.name)];
  const create = () => {
    if (!preview || nothing) return;
    onDone();
    void createGroup({ id: existing.id, name: preview.principal ?? existing.name }, [source.name], on, preview, [], () => {}, true);
  };
  const where = existing.alias ? `« ${displayTag(existing.alias)} » est fusionné dans « ${to} »` : `« ${to} » existe déjà`;
  return (
    <Modal
      open
      even
      onEnter={create}
      onClose={onCancel}
      zone="tag-synonyme"
      title="Créer un synonyme ?"
      description={
        nothing
          ? `« ${from} » est déjà un synonyme de « ${displayTag(preview.principal ?? existing.name)} ».`
          : `${where} (${media(existing.mediaCount)}). « ${from} » et « ${to} » seront reliés : chercher l'un trouvera aussi l'autre. Rien n'est renommé.`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} className={CANCEL}>
            Annuler
          </Button>
          <Button data-zone="tag-synonyme.creer" disabled={!preview || nothing} onClick={create} className={GOLD}>
            Créer
          </Button>
        </>
      }
    >
      {!nothing && <MergeSwitch on={on} onChange={setMerge} zone="tag-synonyme.fusion" />}
    </Modal>
  );
}

/** Renomme `tag` ; `true` si c'est fait, l'autre tag s'il faut proposer la fusion, `null` sinon (nom
 *  vide, erreur affichée). */
export async function renameTag(tag: Source, name: string): Promise<true | Existing | null> {
  const result = await runTagAction("Renommer le tag", () => api.renameTag(tag.id, name));
  if (result?.kind === "exists") return result;
  if (result?.kind === "ownAlias") {
    // Texte de l'utilisateur (réponse 6 du lot R7 ; retour T3, point TAGM-11.2).
    const message = `${q(normalizeTag(name))} est un tag existant et est déjà un synonyme de ${q(tag.name)} : pour en faire le tag principal, utilisez l'étoile de son groupe dans Gestionnaire de tags › Synonymes et parents.`;
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

  if (existing) return <SynonymTagDialog source={tag} existing={existing} onCancel={() => setExisting(null)} onDone={onDone} />;
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
            className={GOLD}
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
