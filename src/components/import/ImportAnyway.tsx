// « Les importer quand même » (IMP-87, réponse Q30 A du 15/11) : les fichiers illisibles sur ce PC du dernier import,
// avec ses tags par défaut, gardés tels quels ; le bilan de ce petit import suit. Dans le bilan et sous la progression
// de la page Importer.

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export function ImportAnyway() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setBusy(true);
    setError(null);
    api.importUnreadable().catch((e: unknown) => {
      setError(String(e));
      setBusy(false);
    });
  };
  return (
    <div className="mt-2">
      <Button
        data-zone="import.illisibles.importer"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={run}
        className="border-border text-foreground hover:bg-secondary hover:text-foreground"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Les importer quand même
      </Button>
      {error && <p className="mt-1 text-xs text-rose-400 select-text">{error}</p>}
    </div>
  );
}
