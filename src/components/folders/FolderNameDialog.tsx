// Pop-in du nom d'un dossier : création (« + Nouveau » du menu burger, « Créer un dossier… » des
// listes, FOLD-01, FOLD-09 : les médias donnés y sont rangés aussitôt) et renommage (FOLD-02). Même
// style que « Créer un nouveau tag ». Nom déjà pris : refusé, et une 2e pop-in propose « nom-2 »
// (sinon le premier numéro libre, à partir du nom sans son suffixe, FOLD-12) ; « Non » revient au
// champ.

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { api, type Folder } from "@/lib/api";
import { refreshFolders, type NameError } from "@/lib/folders";

type Props = {
  /** Dossier à renommer ; absent : création. */
  folder?: Folder;
  /** Création : médias à y ranger tout de suite. */
  mediaIds?: number[];
  onCancel: () => void;
  onDone: () => void;
};

const CANCEL = "text-foreground hover:bg-secondary hover:text-foreground";
const GOLD = "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]";

export function FolderNameDialog({ folder, mediaIds = [], onCancel, onDone }: Props) {
  const [name, setName] = useState(folder?.name ?? "");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      if (folder) await api.renameFolder(folder.id, value);
      else await api.createFolder(value, mediaIds);
      await refreshFolders();
      onDone();
    } catch (e) {
      const refused = e as NameError;
      if (refused?.kind === "taken") setSuggestion(refused.suggestion);
      else setError(refused?.kind === "failed" ? refused.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (suggestion !== null) {
    return (
      <Modal
        open
        even
        onClose={() => setSuggestion(null)}
        zone="dossier-nom.deja-pris"
        title="Nom déjà utilisé"
        description={`Ce nom est déjà utilisé, voulez-vous le renommer « ${suggestion} » ?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuggestion(null)} className={CANCEL}>
              Non
            </Button>
            <Button
              data-zone="dossier-nom.deja-pris.oui"
              onClick={() => {
                setName(suggestion);
                setSuggestion(null);
                void submit(suggestion);
              }}
              className={GOLD}
            >
              Oui
            </Button>
          </>
        }
      />
    );
  }

  return (
    <Modal
      open
      onClose={onCancel}
      zone="dossier-nom"
      title={folder ? "Renommer le dossier" : "Nouveau dossier"}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} className={CANCEL}>
            Annuler
          </Button>
          <Button data-zone="dossier-nom.valider" disabled={!name.trim() || busy} onClick={() => void submit(name)} className={GOLD}>
            {folder ? "Renommer" : "Créer"}
          </Button>
        </>
      }
    >
      <input
        data-zone="dossier-nom.champ"
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit(name);
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        placeholder="Nom du dossier"
        className="h-9 w-full rounded-md border border-border bg-card/60 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-[#d9a94e]/60"
      />
      {error && <p className="mt-2 text-xs break-all text-rose-300">{error}</p>}
    </Modal>
  );
}
