"use client";

// MyBoard — Autocomplétion de tags réutilisable.
// Input avec dropdown de suggestions (debounce 150ms, fetch /api/tags/autocomplete).
// Supporte la polarité (-tag) et les préfixes catégorie (artist:foo → tag "foo").

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { CATEGORY_DOT, CATEGORY_TEXT, displayTag, formatCount } from "@/lib/shared";
import type { TagDTO } from "@/lib/types";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  multiline?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  className?: string;
  /**
   * v-12 : position du dropdown d'autocomplétion.
   * - "bottom" (défaut) : le dropdown apparaît SOUS l'input (top-full mt-1).
   * - "top" : le dropdown apparaît AU-DESSUS de l'input (bottom-full mb-1).
   *   Utilisé dans la lightbox où l'input est en bas de l'écran.
   */
  dropdownPosition?: "top" | "bottom";
};

/** Position [start, end] du token sous le caret. */
function tokenBounds(value: string, caret: number): [number, number] {
  let start = caret;
  while (start > 0 && !/\s/.test(value[start - 1])) start--;
  let end = caret;
  while (end < value.length && !/\s/.test(value[end])) end++;
  return [start, end];
}

export function TagAutocomplete({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
  multiline,
  inputRef,
  className,
  dropdownPosition = "bottom",
}: Props) {
  const localRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const ref = inputRef ?? localRef;
  const [items, setItems] = useState<TagDTO[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [caret, setCaret] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const [tStart, tEnd] = tokenBounds(value, caret);
  const rawToken = value.slice(tStart, tEnd);
  const prefixMatch = rawToken.match(/^(-?)((?:[a-z]+:)?)(.*)$/i);
  const neg = prefixMatch?.[1] ?? "";
  const catPrefix = prefixMatch?.[2] ?? "";
  const query = prefixMatch?.[3] ?? "";
  const isMeta = /^(type|kind|ext|order|sort|tagcount):$/i.test(catPrefix);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!query || isMeta || query.length < 1) {
        if (!cancelled) {
          setItems([]);
          setActive(0);
        }
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `/api/tags/autocomplete?q=${encodeURIComponent(query)}&limit=10`,
          { signal: ctrl.signal }
        );
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { items: TagDTO[] };
          setItems(data.items ?? []);
          setActive(0);
        }
      } catch {
        /* aborted */
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, isMeta]);

  function pick(s: TagDTO) {
    const keepPrefix = catPrefix && !isMeta ? catPrefix : "";
    const insert = `${neg}${keepPrefix}${s.name} `;
    const after = value.slice(tEnd).replace(/^\s+/, "");
    const next = value.slice(0, tStart) + insert + after;
    onChange(next);
    setItems([]);
    const pos = tStart + insert.length;
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
        setCaret(pos);
      }
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const showing = open && items.length > 0;
    if (showing && e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (showing && e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (showing && e.key === "Tab") {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (
        showing &&
        rawToken &&
        items[active] &&
        items[active].name !== query.toLowerCase()
      ) {
        pick(items[active]);
      } else {
        setItems([]);
        setOpen(false);
        onSubmit?.();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setItems([]);
    }
  }

  const common = {
    value,
    placeholder,
    autoFocus,
    spellCheck: false,
    autoComplete: "off",
    autoCapitalize: "off",
    onKeyDown,
    onFocus: () => setOpen(true),
    onBlur: () => setTimeout(() => setOpen(false), 120),
    onSelect: (
      e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => setCaret(e.currentTarget.selectionStart ?? 0),
    className:
      className ??
      "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-[#d9a94e]/60 focus:bg-secondary focus:ring-2 focus:ring-[#d9a94e]/20",
  };

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          {...common}
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          rows={6}
          onChange={(e) => {
            onChange(e.target.value);
            setCaret(e.target.selectionStart ?? 0);
            setOpen(true);
          }}
        />
      ) : (
        <input
          {...common}
          ref={ref as React.RefObject<HTMLInputElement>}
          type="text"
          onChange={(e) => {
            onChange(e.target.value);
            setCaret(e.target.selectionStart ?? 0);
            setOpen(true);
          }}
        />
      )}
      {open && items.length > 0 && (
        <ul
          className={`absolute left-0 right-0 z-50 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-2xl shadow-black/50 ${
            dropdownPosition === "top"
              ? "bottom-full mb-1"
              : "top-full mt-1"
          }`}
        >
          {items.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition ${
                  i === active ? "bg-[#d9a94e]/15" : "hover:bg-secondary"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    CATEGORY_DOT[s.category] ?? "bg-zinc-400"
                  }`}
                />
                <span
                  className={`truncate ${
                    CATEGORY_TEXT[s.category] ?? "text-foreground"
                  }`}
                >
                  {displayTag(s.name)}
                </span>
                <span className="ml-auto pl-2 text-xs tabular-nums text-muted-foreground">
                  {formatCount(s.postCount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
