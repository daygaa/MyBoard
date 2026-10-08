"use client";

// MyBoard — Sidebar de tags (façon Danbooru).
// Tags groupés par catégorie, + / - à côté de chaque tag, compteur postCount.
// Tri par postCount descendant au sein de chaque catégorie.

import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_TEXT,
  addTermToQuery,
  displayTag,
  formatCount,
  searchHref,
  type TagCategory,
} from "@/lib/shared";
import type { TagDTO } from "@/lib/types";

type Props = {
  tags: TagDTO[];
  query: string;
  grouped?: boolean;
};

export function TagList({ tags, query, grouped = true }: Props) {
  if (tags.length === 0) {
    return (
      <p className="px-1 text-sm text-muted-foreground">
        Aucun tag sur cette page.
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
                  href={searchHref(addTermToQuery(query, t.name))}
                  title={`Ajouter « ${t.name} » à la recherche (ET)`}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-emerald-500/15 hover:text-emerald-300"
                  aria-label={`Ajouter ${t.name}`}
                >
                  +
                </Link>
                <Link
                  href={searchHref(addTermToQuery(query, `-${t.name}`))}
                  title={`Exclure « ${t.name} » de la recherche`}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-rose-500/15 hover:text-rose-300"
                  aria-label={`Exclure ${t.name}`}
                >
                  −
                </Link>
                <Link
                  href={searchHref(t.name)}
                  className={`min-w-0 flex-1 truncate pl-0.5 transition hover:underline ${
                    CATEGORY_TEXT[t.category] ?? "text-foreground"
                  }`}
                  title={t.name}
                >
                  {displayTag(t.name)}
                </Link>
                <span className="shrink-0 pl-1 text-[11px] tabular-nums text-muted-foreground">
                  {formatCount(t.postCount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
