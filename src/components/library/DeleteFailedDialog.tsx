// Fichiers non effacés (DEL-04, DEL-08) : leurs médias sont revenus dans la bibliothèque avec toutes
// leurs données. Les fichiers en lecture seule sont listés à part, chacun avec son chemin (un clic
// ouvre l'Explorateur sur le fichier), et « Supprimer quand même » (rouge) les efface en retirant la
// lecture seule. Ceux qui échouent encore restent listés avec la raison, sans le bouton. « Copier »
// met tout le texte dans le presse-papiers (CTX-19).

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { api, type FailedFile } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { explainWindowsError } from "@/lib/windowsErrors";
import { forceDeleteMedia } from "@/stores/deletion";
import { closeFailures, startForcing, useDeleteFailures } from "@/stores/deleteFailures";

const COPIED_MS = 1500;
const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const reason = (f: FailedFile) => [f.message, f.code !== null ? `erreur Windows ${f.code}` : null].filter(Boolean).join(", ");

function FileLine({ file, withReason }: { file: FailedFile; withReason: boolean }) {
  const explanation = withReason ? explainWindowsError(file.code) : null;
  return (
    <li className="min-w-0 py-1">
      <p className="truncate text-sm font-medium text-foreground" title={fileName(file.path)}>
        {fileName(file.path)}
      </p>
      <button
        type="button"
        data-zone="suppression-echec.chemin"
        onClick={() => void api.revealMedia(file.id).catch(() => {})}
        title="Afficher dans l'explorateur de fichiers"
        className="block max-w-full text-left font-mono text-xs break-all text-[#d9a94e] underline-offset-2 hover:underline"
      >
        {file.path}
      </button>
      {withReason && (
        <p className="text-xs text-rose-200/90">
          {reason(file)}
          {explanation && <span className="text-muted-foreground"> — {explanation}</span>}
        </p>
      )}
    </li>
  );
}

export function DeleteFailedDialog() {
  const { failures, forcing, forced } = useDeleteFailures();
  const [copied, setCopied] = useState(false);
  if (failures.length === 0 && forcing.length === 0) return null;

  const readOnly = failures.filter((f) => f.readOnly);
  const others = failures.filter((f) => !f.readOnly);
  const total = failures.length;
  const copy = async () => {
    const lines = failures.map((f) => `${f.path} : ${reason(f)}`);
    await api.writeClipboardText(["Supprimer les fichiers de votre stockage : échec", ...lines].join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  };
  const force = () => {
    const ids = readOnly.map((f) => f.id);
    startForcing(ids);
    void forceDeleteMedia(ids);
  };

  return (
    <Modal
      open
      wide
      onEnter={closeFailures}
      onClose={closeFailures}
      zone="suppression-echec"
      title={total === 0 ? "Suppression en cours…" : `${formatNumber(total)} ${plural(total, "fichier non supprimé", "fichiers non supprimés")}`}
      description={
        total === 0
          ? "Les fichiers en lecture seule sont en cours d'effacement."
          : total === 1
            ? "Son média est revenu dans la bibliothèque avec toutes ses données."
            : "Leurs médias sont revenus dans la bibliothèque avec toutes leurs données."
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => void copy()} className={copied ? "text-[#d9a94e] hover:bg-secondary hover:text-[#d9a94e]" : "text-foreground hover:bg-secondary hover:text-foreground"}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copié" : "Copier"}
          </Button>
          {readOnly.length > 0 && !forced && (
            <Button data-zone="suppression-echec.forcer" onClick={force} className="bg-destructive text-white hover:bg-destructive/90">
              Supprimer quand même
            </Button>
          )}
          <Button data-zone="suppression-echec.ok" onClick={closeFailures} className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]">
            OK
          </Button>
        </>
      }
    >
      <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
        {readOnly.length > 0 && (
          <section data-zone="suppression-echec.lecture-seule">
            <p className="text-sm text-foreground">
              {readOnly.length === 1 ? "Ce fichier est en lecture seule : il n'a pas été effacé." : `Ces ${formatNumber(readOnly.length)} fichiers sont en lecture seule : ils n'ont pas été effacés.`}
            </p>
            <ul className="mt-1 divide-y divide-border/60">
              {readOnly.map((f) => (
                <FileLine key={f.id} file={f} withReason={false} />
              ))}
            </ul>
          </section>
        )}
        {others.length > 0 && (
          <section data-zone="suppression-echec.autres">
            <p className="text-sm text-foreground">
              {others.length === 1 ? "Ce fichier n'a pas pu être effacé :" : "Ces fichiers n'ont pas pu être effacés :"}
            </p>
            <ul className="mt-1 divide-y divide-border/60">
              {others.map((f) => (
                <FileLine key={f.id} file={f} withReason />
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
