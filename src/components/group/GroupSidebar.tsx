"use client";

// MyBoard — Sidebar dédiée à la page /groups/[id] (P6).
//
// Cette sidebar est identique visuellement à celle de la page browse (TagList +
// SearchBar) mais les liens et la barre de recherche restent SCOPÉS au groupe
// courant : tout click/navigate préserve /groups/[id] dans l'URL.
//
// Les composants TagList.tsx et SearchBar.tsx ne sont PAS modifiés (zone "NE
// TOUCHE PAS"). On crée ici des variantes GroupTagList / GroupSearchBar qui
// réutilisent les mêmes primitives visuelles mais avec un basePath différent.
//
// La fonction `groupSearchHref` construit des URLs du type :
//   /groups/<id>?tags=<q>&page=<p>

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { TagAutocomplete } from "@/components/board/TagAutocomplete";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_TEXT,
  addTermToQuery,
  displayTag,
  type TagCategory,
} from "@/lib/shared";
import type { TagDTO } from "@/lib/types";

/** Construit l'URL /groups/<id>?tags=...&page=... */
export function groupSearchHref(
  groupId: number,
  tags: string,
  page = 1
): string {
  const params = new URLSearchParams();
  const t = tags.trim().replace(/\s+/g, " ");
  if (t) params.set("tags", t);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/groups/${groupId}?${qs}` : `/groups/${groupId}`;
}

// ---------------------------------------------------------------------------
// GroupSearchBar — comme SearchBar mais scoped au groupe
// ---------------------------------------------------------------------------

export function GroupSearchBar({ groupId }: { groupId: number }) {
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
    router.push(groupSearchHref(groupId, next));
    setValue("");
  };

  // Termes actifs (depuis l'URL) pour les chips
  const currentQuery = searchParams.get("tags") ?? "";
  const terms = currentQuery.split(/\s+/).filter(Boolean);

  function removeTerm(t: string) {
    const rest = terms.filter((x) => x !== t).join(" ");
    router.push(groupSearchHref(groupId, rest));
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

      {/* Chips des termes actifs */}
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
                title={`Retirer « ${displayTag(t.replace(/^-/, ""))} » de la recherche`}
              >
                {neg ? "NON " : ""}
                {displayTag(t.replace(/^-/, ""))}
                <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
              </button>
            );
          })}
          <button
            onClick={() => router.push(groupSearchHref(groupId, ""))}
            className="ml-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Tout effacer
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupTagList — comme TagList mais scoped au groupe
// ---------------------------------------------------------------------------

type TagListProps = {
  tags: TagDTO[];
  query: string;
  groupId: number;
  grouped?: boolean;
};

export function GroupTagList({
  tags,
  query,
  groupId,
  grouped = true,
}: TagListProps) {
  if (tags.length === 0) {
    return (
      <p className="px-1 text-sm text-muted-foreground">
        Aucun tag sur ce dossier.
      </p>
    );
  }

  // Tri par postCount descendant puis nom
  const sorted = [...tags].sort(
    (a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name)
  );

  const groups = grouped
    ? CATEGORIES.map((c) => ({
        c,
        items: sorted.filter((t) => t.category === c),
      })).filter((g) => g.items.length > 0)
    : [{ c: "general" as TagCategory, items: sorted }];

  return (
    <div className="space-y-4">
      {groups.map(({ c, items }) => (
        <div key={c}>
          {grouped && (
            <h4 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABELS[c]}
              <span className="ml-2 font-normal text-muted-foreground/60">
                {items.length}
              </span>
            </h4>
          )}
          <ul>
            {items.map((t) => (
              <li
                key={t.id}
                className="group flex items-center gap-1 rounded-md px-1 py-[3px] text-[13px] hover:bg-secondary"
              >
                <Link
                  href={groupSearchHref(groupId, addTermToQuery(query, t.name))}
                  title={`Ajouter « ${t.name} » à la recherche (ET)`}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-emerald-500/15 hover:text-emerald-300"
                  aria-label={`Ajouter ${t.name}`}
                >
                  +
                </Link>
                <Link
                  href={groupSearchHref(
                    groupId,
                    addTermToQuery(query, `-${t.name}`)
                  )}
                  title={`Exclure « ${t.name} » de la recherche`}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-rose-500/15 hover:text-rose-300"
                  aria-label={`Exclure ${t.name}`}
                >
                  −
                </Link>
                <Link
                  href={groupSearchHref(groupId, t.name)}
                  className={`min-w-0 flex-1 truncate pl-0.5 transition hover:underline ${
                    CATEGORY_TEXT[t.category] ?? "text-foreground"
                  }`}
                  title={t.name}
                >
                  {displayTag(t.name)}
                </Link>
                <span className="shrink-0 pl-1 text-[11px] tabular-nums text-muted-foreground">
                  {t.postCount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
