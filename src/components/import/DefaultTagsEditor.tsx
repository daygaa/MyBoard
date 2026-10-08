"use client";

// MyBoard — Éditeur de tags par défaut (Phase 2 — imp-8 / imp-9).
//
// Layout : [textbar d'écriture du tag] [menu déroulant catégorie] [bouton "Ajouter"]
// En dessous : badges colorés (par catégorie) des tags ajoutés, chacun avec un × pour retirer.
//
// Comportement :
// - Autocomplétion via le moteur de TagAutocomplete (importé depuis /components/board).
// - Si clic sur suggestion (ou Tab+Entrée) → ajoute le badge avec la catégorie du tag en DB
//   (le menu déroulant catégorie est ignoré).
// - Si le tag tapé n'existe pas en DB → utilise la catégorie du menu déroulant.
// - Normalisation automatique : espaces → underscores, minuscules.
//
// L'état `defaultTags` est `{name, category}[]` et est contrôlé par le parent (ImportFlow).

import { useCallback, useState } from "react";
import { Tag as TagIcon, X, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TagAutocomplete } from "@/components/board/TagAutocomplete";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_PILL,
  CATEGORY_DOT,
  displayTag,
  normalizeTagName,
} from "@/lib/shared";
import type { DefaultTag } from "@/lib/import-processing";
import type { TagDTO } from "@/lib/types";

type Props = {
  defaultTags: DefaultTag[];
  onChange: (next: DefaultTag[]) => void;
  disabled?: boolean;
};

/** Retire les préfixes polarity (-) et catégorie (artist:foo → foo). */
function stripTagPrefix(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^[-~]+/, "");
  s = s.replace(/^[a-z]+:/i, "");
  return s.trim();
}

export function DefaultTagsEditor({
  defaultTags,
  onChange,
  disabled = false,
}: Props) {
  const [input, setInput] = useState("");
  const [category, setCategory] = useState<string>("general");

  /** Cherche la catégorie réelle d'un tag en DB (via autocomplete endpoint). */
  const lookupCategory = useCallback(async (
    normName: string
  ): Promise<string | null> => {
    try {
      const res = await fetch(
        `/api/tags/autocomplete?q=${encodeURIComponent(normName)}&limit=1`
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { items: TagDTO[] };
      const match = (data.items ?? []).find((s) => s.name === normName);
      return match?.category ?? null;
    } catch {
      return null;
    }
  }, []);

  /** Ajoute un tag (normalisé) à la liste. Résout la catégorie depuis la DB si possible. */
  const commitTag = useCallback(
    async (rawName: string) => {
      const stripped = stripTagPrefix(rawName);
      const norm = normalizeTagName(stripped);
      if (!norm) {
        setInput("");
        return;
      }
      // Déduplication locale
      if (defaultTags.some((t) => t.name === norm)) {
        setInput("");
        return;
      }
      // Cherche la catégorie réelle en DB (si tag existant)
      const dbCat = await lookupCategory(norm);
      const finalCategory =
        dbCat && CATEGORIES.includes(dbCat as (typeof CATEGORIES)[number])
          ? dbCat
          : category;
      onChange([...defaultTags, { name: norm, category: finalCategory }]);
      setInput("");
    },
    [defaultTags, category, lookupCategory, onChange]
  );

  /** Handler des changements de l'input TagAutocomplete. */
  const handleInputChange = (v: string) => {
    setInput(v);
    // Détection d'un "commit" : un whitespace en fin de chaîne signifie
    // que l'utilisateur a tapé Espace ou pické une suggestion (qui insère "tagname ")
    if (/\s$/.test(v) && v.trim()) {
      void commitTag(v.trim());
    }
  };

  /** Handler quand l'utilisateur presse Enter (sans pick de suggestion). */
  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    void commitTag(trimmed);
  };

  const removeTag = (idx: number) => {
    onChange(defaultTags.filter((_, i) => i !== idx));
  };

  return (
    <Card className="border-border bg-card/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <TagIcon className="h-4 w-4 text-[#d9a94e]" />
          Tags par défaut
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Ligne d'ajout : textbar + catégorie + bouton Ajouter */}
        <div className="flex flex-wrap items-stretch gap-2">
          <div className="min-w-[200px] flex-1">
            <TagAutocomplete
              value={input}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              placeholder="ex. red_hair, vacances, demo…"
              disabled={disabled}
            />
          </div>
          <Select
            value={category}
            onValueChange={setCategory}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 w-[160px] shrink-0 bg-background/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[c]}`}
                    />
                    {CATEGORY_LABELS[c]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="default"
            onClick={() => handleSubmit()}
            disabled={disabled || !input.trim()}
            className="h-9 shrink-0 border-[#d9a94e]/40 bg-[#d9a94e]/10 text-[#d9a94e] hover:bg-[#d9a94e]/20 hover:text-[#e3b75f]"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Les espaces sont normalisés en <code className="font-mono">_</code>.
          Si un tag existe déjà en base, sa catégorie d&apos;origine est conservée.
        </p>

        {/* Badges des tags ajoutés */}
        {defaultTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {defaultTags.map((t, idx) => {
              const pillCls =
                CATEGORY_PILL[t.category] ?? CATEGORY_PILL.general;
              return (
                <span
                  key={`${t.name}-${idx}`}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${pillCls}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[t.category] ?? CATEGORY_DOT.general}`}
                  />
                  {displayTag(t.name)}
                  <button
                    type="button"
                    aria-label={`Retirer le tag ${displayTag(t.name)}`}
                    onClick={() => removeTag(idx)}
                    disabled={disabled}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm transition hover:bg-foreground/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
