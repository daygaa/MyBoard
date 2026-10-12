// Message d'erreur d'une ouverture externe (VIEW-28) : ce qui a échoué, le code d'erreur
// Windows, le message de Windows et une explication en clair. Fermé par sa croix ou en
// passant à un autre média.

import { AlertTriangle, X } from "lucide-react";

import { explainWindowsError } from "@/lib/windowsErrors";
import { useViewer } from "@/stores/viewer";

export function ErrorBanner() {
  const error = useViewer((s) => s.error);
  const setError = useViewer((s) => s.setError);
  if (!error) return null;
  const explanation = explainWindowsError(error.code);
  return (
    <div
      data-zone="visionneuse.erreur"
      role="alert"
      className="flex items-start gap-3 border-t border-rose-500/30 bg-[#2a1416] px-4 py-2.5 text-sm text-rose-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {error.action} : échec
          {error.code !== null && <span className="ml-2 font-mono text-xs text-rose-300/80">Erreur Windows {error.code}</span>}
        </p>
        <p className="break-all text-rose-200/90">{error.message}</p>
        {explanation && <p className="mt-0.5 text-rose-200/70">{explanation}</p>}
      </div>
      <button
        type="button"
        onClick={() => setError(null)}
        aria-label="Fermer le message"
        className="shrink-0 text-rose-300/70 transition hover:text-rose-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
