// Lancement de l'import au clic sur « Importer » : les pop-ins dans l'ordre choisi le 10/11 (réponse Q8), chacune
// seulement si elle sert : paires originaux + versions (IMP-64), « Compresser aussi » (IMP-60), puis les deux
// confirmations de « Supprimer les originaux » (IMP-28, comme DEL-04). Annuler l'une d'elles : rien ne démarre.

import { useState, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api, type ImportOptions, type PairChoice } from "@/lib/api";
import type { KindCounts } from "@/lib/mediaWords";
import { useImport } from "@/stores/import";
import { useViewer } from "@/stores/viewer";
import { CompressExistingDialog } from "./CompressExistingDialog";
import { PairsDialog } from "./PairsDialog";

export function useImportStart() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const [checking, setChecking] = useState(false);

  /** Ouvre une pop-in et attend sa réponse (`null` : annulée). */
  const ask = <T,>(render: (done: (answer: T | null) => void) => ReactNode) =>
    new Promise<T | null>((resolve) =>
      setDialog(
        render((answer) => {
          setDialog(null);
          resolve(answer);
        }),
      ),
    );

  const start = async () => {
    const s = useImport.getState();
    const options: ImportOptions = {
      compressQuality: s.compress ? s.quality : null,
      convertTo: s.convert ? s.convertTo : null,
      processExisting: false,
      deleteOriginals: false,
      pairs: "both",
      deletePairFiles: false,
    };
    const processing = options.compressQuality !== null || options.convertTo !== null;
    setChecking(true);
    try {
      const pairs = await api.countPairs();
      if (pairs.total > 0) {
        const answer = await ask<{ choice: PairChoice; deleteFiles: boolean }>((done) => (
          <PairsDialog count={pairs} onAnswer={(choice, deleteFiles) => done({ choice, deleteFiles })} onCancel={() => done(null)} />
        ));
        if (!answer) return;
        options.pairs = answer.choice;
        options.deletePairFiles = answer.deleteFiles;
      }
      if (processing) {
        const counts = await api.countCompressibleExisting(options.compressQuality, options.convertTo);
        if (counts.images + counts.videos + counts.audio + counts.documents > 0) {
          const answer = await ask<boolean>((done) => (
            <CompressExistingDialog
              counts={counts satisfies KindCounts}
              convert={options.convertTo !== null}
              deleteOriginals={s.deleteOriginals}
              onAnswer={done}
              onCancel={() => done(null)}
            />
          ));
          if (answer === null) return;
          options.processExisting = answer;
        }
      }
      if (processing && s.deleteOriginals) {
        const first = await ask<true>((done) => (
          <ConfirmDialog
            zone="import.suppression-originaux"
            title="Supprimer les originaux ?"
            message="Après leur compression ou leur conversion, les originaux seront effacés définitivement du disque, sans passer par la Corbeille. Un original n'est effacé qu'une fois sa nouvelle version enregistrée."
            confirmLabel="Continuer"
            onCancel={() => done(null)}
            onConfirm={() => done(true)}
          />
        ));
        if (!first) return;
        const second = await ask<true>((done) => (
          <ConfirmDialog
            danger
            zone="import.suppression-originaux.confirmation"
            title="Êtes-vous sûr de vouloir supprimer les originaux de votre stockage ?"
            message="Cette suppression est définitive."
            confirmLabel="Supprimer les originaux"
            onCancel={() => done(null)}
            onConfirm={() => done(true)}
          />
        ));
        if (!second) return;
        options.deleteOriginals = true;
      }
      await api.startImport(useImport.getState().defaultTags, options);
    } catch (error) {
      useViewer.getState().setError({ action: "Importer", code: null, message: String(error) });
    } finally {
      setChecking(false);
    }
  };

  return { start, checking, dialog };
}
