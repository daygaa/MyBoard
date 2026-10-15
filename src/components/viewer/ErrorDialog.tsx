// Échec d'une action lancée hors de la visionneuse (menu d'une vignette : fichier introuvable,
// disque débranché…) : pop-in avec le même contenu que le message de la visionneuse (VIEW-28) ;
// « Copier » met tout le texte dans le presse-papiers, « Copié » s'affiche comme sur le bouton
// « Copier » de la visionneuse (VIEW-35) ; « OK » ferme (CTX-19). Dans la visionneuse, c'est la
// barre du bas qui l'affiche (ErrorBanner).

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { explainWindowsError } from "@/lib/windowsErrors";
import { useViewer } from "@/stores/viewer";

/** Durée de « Copié », comme dans la visionneuse. */
const COPIED_MS = 1500;

export function ErrorDialog() {
  const error = useViewer((s) => (s.open ? null : s.error));
  const setError = useViewer((s) => s.setError);
  const [copied, setCopied] = useState(false);
  if (!error) return null;
  const explanation = explainWindowsError(error.code);
  const code = error.code !== null ? `Erreur Windows ${error.code}` : null;
  const copy = async () => {
    const text = [`${error.action} : échec`, code, error.message, explanation].filter(Boolean).join("\n");
    await api.writeClipboardText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <Modal
      open
      onClose={() => setError(null)}
      zone="erreur"
      title={`${error.action} : échec`}
      description={
        <div className="space-y-1">
          {code && <p className="font-mono text-xs text-rose-300/80">{code}</p>}
          <p className="break-all text-rose-200/90">{error.message}</p>
          {explanation && <p>{explanation}</p>}
        </div>
      }
      footer={
        <>
          <Button
            data-zone="erreur.copier"
            variant="ghost"
            onClick={() => void copy()}
            className={copied ? "text-[#d9a94e] hover:bg-secondary hover:text-[#d9a94e]" : "text-foreground hover:bg-secondary hover:text-foreground"}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copié" : "Copier"}
          </Button>
          <Button data-zone="erreur.ok" onClick={() => setError(null)} className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]">
            OK
          </Button>
        </>
      }
    />
  );
}
