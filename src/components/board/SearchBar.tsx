"use client";

// MyBoard — Barre de recherche principale (header).
// Lit la query courante via useSearchParams, gère l'autocomplétion.
// Sur Entrée → navigation vers /?tags=...
//
// IMPORTANT (modif_UI.txt lp-16) : la barre de recherche ne doit PAS refléter
// la query courante — les tags actifs sont affichés UNIQUEMENT sous forme de
// chips cliquables. La barre reste vide tant que l'utilisateur ne tape pas,
// pour pouvoir ajouter un nouveau tag sans voir le texte existant.

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { TagAutocomplete } from "./TagAutocomplete";
import { searchHref, displayTag } from "@/lib/shared";

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Raccourci "/" pour focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(t.tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = () => {
    if (!value.trim()) return;
    // Ajoute le terme tapé à la query courante (sans écraser les chips existants)
    const current = searchParams.get("tags") ?? "";
    const next = [current, value.trim()].filter(Boolean).join(" ");
    router.push(searchHref(next));
    setValue("");
  };

  // Termes actifs (depuis l'URL) pour les chips
  const currentQuery = searchParams.get("tags") ?? "";
  const terms = currentQuery.split(/\s+/).filter(Boolean);

  function removeTerm(t: string) {
    const rest = terms.filter((x) => x !== t).join(" ");
    router.push(searchHref(rest));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <TagAutocomplete
            value={value}
            onChange={setValue}
            onSubmit={submit}
            inputRef={ref}
            placeholder="Ajouter un tag à la recherche…"
          />
        </div>
        <button
          type="button"
          aria-label="Rechercher"
          onClick={submit}
          className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg bg-[#d9a94e] text-[#1a1408] transition hover:bg-[#e3b75f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a94e]"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {/* Chips des termes actifs (seul endroit où les tags actifs sont visibles) */}
      {terms.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {terms.map((t) => {
            const neg = t.startsWith("-");
            const meta = /^-?[a-z]+:/i.test(t);
            const cls = neg
              ? "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
              : meta
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20";
            return (
              <button
                key={t}
                onClick={() => removeTerm(t)}
                className={`group flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition ${cls}`}
                title={`Retirer « ${displayTag(t.replace(/^-/, "")) } » de la recherche`}
              >
                {neg ? "NON " : ""}
                {displayTag(t.replace(/^-/, ""))}
                <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
              </button>
            );
          })}
          <button
            onClick={() => router.push("/")}
            className="ml-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Tout effacer
          </button>
        </div>
      )}
    </div>
  );
}
