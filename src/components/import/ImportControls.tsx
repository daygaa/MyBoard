// Boutons de l'import (IMP-42, IMP-43 ; réponses du 09/11 et du 11/11) : « Arrêter » met en pause aussitôt (ffmpeg
// compris) ; en pause, de gauche à droite (retour du 11/11) : « Annuler l'import » (rouge, avec confirmation : défait
// tout l'import), « Terminer ici » (garde ce qui est fait, abandonne le reste de la liste, ouvre le bilan) et
// « Reprendre » (à la place d'« Arrêter » ; repart du fichier où l'import s'était arrêté). Après la fin de l'import,
// « Annuler l'import » reste proposé (`UndoButton`, à gauche de « Voir la bibliothèque »). Il est grisé quand l'import
// efface des fichiers du disque (« Supprimer les originaux », « Supprimer du stockage la version non importée ») : il ne
// pourrait pas tout défaire.

import { useState } from "react";
import { Flag, Play, Square, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api, type ImportSnapshot } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useViewer } from "@/stores/viewer";

const OUTLINE = "border-border text-foreground hover:bg-secondary hover:text-foreground";
const RED = "border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200";

const run = (action: string, call: () => Promise<void>) =>
  void call().catch((error) => useViewer.getState().setError({ action, code: null, message: String(error) }));

/** « Annuler l'import », pendant une pause ou après la fin de l'import ; grisé avec sa raison dans une bulle. */
export function UndoButton({ snapshot }: { snapshot: ImportSnapshot }) {
  const [confirm, setConfirm] = useState(false);
  const added = snapshot.progress?.imported ?? 0;
  const running = snapshot.phase === "importing";
  const why = snapshot.undoable
    ? undefined
    : snapshot.result?.undone
      ? "Cet import a déjà été annulé."
      : "Impossible pour cet import : des fichiers sont effacés du disque pendant l'import (« Supprimer les originaux » ou « Supprimer du stockage la version non importée »).";
  return (
    <>
      {/* Bouton grisé : la bulle passe par son cadre (un bouton désactivé ne reçoit pas la souris). */}
      <span className={snapshot.undoable ? undefined : "cursor-not-allowed"} title={why}>
        <Button data-zone="import.annuler" variant="outline" size="sm" disabled={!snapshot.undoable} onClick={() => setConfirm(true)} className={RED}>
          <Undo2 className="h-4 w-4" />
          Annuler l'import
        </Button>
      </span>
      {confirm && (
        <ConfirmDialog
          danger
          zone="import.annuler.confirmation"
          title="Annuler l'import ?"
          message={`Tout ${running ? "l'import en cours" : "cet import"} sera défait : ${added === 1 ? "le média ajouté sera retiré de la bibliothèque, " : added > 1 ? `les ${formatNumber(added)} médias ajoutés seront retirés de la bibliothèque, ` : ""}les fichiers écrits par MyBoard seront effacés et les médias déjà présents retrouveront leur état d'avant. Vos fichiers d'origine ne sont jamais touchés.`}
          confirmLabel="Annuler l'import"
          cancelLabel="Non"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            run("Annuler l'import", api.undoImport);
          }}
        />
      )}
    </>
  );
}

/** Boutons pendant l'import. */
export function ImportControls({ snapshot }: { snapshot: ImportSnapshot }) {
  if (!snapshot.paused) {
    return (
      <Button data-zone="import.arreter" variant="outline" size="sm" onClick={() => run("Arrêter", api.pauseImport)} className={RED}>
        <Square className="h-4 w-4" />
        Arrêter
      </Button>
    );
  }
  return (
    <>
      <UndoButton snapshot={snapshot} />
      <Button
        data-zone="import.terminer-ici"
        variant="outline"
        size="sm"
        title="Garde ce qui est déjà importé, abandonne le reste de la liste et ouvre le bilan."
        onClick={() => run("Terminer ici", api.finishImport)}
        className={OUTLINE}
      >
        <Flag className="h-4 w-4" />
        Terminer ici
      </Button>
      <Button
        data-zone="import.reprendre"
        size="sm"
        onClick={() => run("Reprendre", api.resumeImport)}
        className="gap-1.5 bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]"
      >
        <Play className="h-4 w-4" />
        Reprendre
      </Button>
    </>
  );
}
