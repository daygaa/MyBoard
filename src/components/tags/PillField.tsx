// Champ à pastilles (SEL-07, SEL-12) : une petite zone éditable où les tags validés sont des pastilles
// posées dans le texte, comme une image dans un traitement de texte. Le navigateur ne fait que l'afficher :
// chaque frappe, effacement ou déplacement passe par le contenu (lib/pillText.ts) et son historique
// (usePills), puis le champ est redessiné et le curseur replacé (pillDom.ts). Un seul composant pour la
// barre de la sélection, puis la recherche (SRCH-28) et les règles du gestionnaire (TAGM-15.5).
// Clavier, comme pour du texte (choix des 24 et 25/10) :
// - on tape n'importe où, entre deux pastilles comprises ; Entrée change le texte où est le curseur en
//   pastille (`resolve`) ; la liste de suggestions suit ce texte ;
// - ← / → (Ctrl : mot par mot), Début / Fin, Maj pour sélectionner ; une pastille compte comme un
//   caractère ; Retour arrière / Suppr effacent la sélection, sinon le caractère ou la pastille voisine ;
// - Ctrl + A : le texte où est le curseur, puis tout le champ (tout de suite hors d'un texte) ;
// - Ctrl + Z / Ctrl + Y : historique ; Entrée sans aucun texte tapé dans le champ : `onEnterEmpty`.
// Souris : un clic place le curseur (sur une pastille : à sa droite), un cliquer-glisser sélectionne
// textes et pastilles (depuis une pastille : depuis son bord le plus proche), double-clic : le texte.
// Pastilles sélectionnées : même aspect qu'un texte surligné (index.css, `data-choisie`).

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import type { Pills } from "@/hooks/usePills";
import type { TagInfo } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { bounds, caretAt, covers, endOf, isCollapsed, isRaw, sameSel, START, step, textAt, textOf } from "@/lib/pillText";
import { normalizeTag } from "@/lib/tags";
import { registerEditable } from "@/lib/textMenus";
import { cn } from "@/lib/utils";
import { pillCommands } from "./pillCommands";
import { applySelection, EMPTY_TEXT, posAtPoint, readSelection } from "./pillDom";
import { moveHighlight, SuggestionList, useTagSuggestions, type Dropdown } from "./TagSuggestions";

type Props<T> = {
  zone: string;
  pills: Pills<T>;
  pillKey: (item: T) => string | number;
  /** Nom copié dans le presse-papiers (forme enregistrée, comme « Copier le tag »). */
  pillName: (item: T) => string;
  /** Pastille ; `remove` l'efface (croix). */
  renderPill: (item: T, remove: () => void) => ReactNode;
  /** Texte validé par Entrée : sa pastille, ou `null` (le texte reste). */
  resolve: (text: string) => T | null | Promise<T | null>;
  /** Suggestion choisie → pastille. */
  toItem: (tag: TagInfo) => T;
  source?: TagInfo[];
  placeholder: string;
  dropdown?: Dropdown;
  onEnterEmpty?: () => void;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  editorRef?: (el: HTMLDivElement | null) => void;
};

/** Collage sur une seule ligne. */
const oneLine = (text: string) => text.replace(/\s*\r?\n\s*/g, " ");

export function PillField<T>(props: Props<T>) {
  const { zone, pills, pillKey, pillName, renderPill, resolve, toItem, source, placeholder, dropdown = "top", onEnterEmpty, className } = props;
  const { doc, sel } = pills;
  const box = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const [listLeft, setListLeft] = useState(0);
  /** Saisie d'un caractère composé en cours (accents par une touche morte…) : le navigateur écrit. */
  const composing = useRef(false);
  /** Change après une composition : les textes sont redessinés à neuf. */
  const [version, setVersion] = useState(0);
  const dragging = useRef(false);
  /** Dernier état, pour les écouteurs posés une fois (sélection du navigateur, menu d'édition). */
  const latest = useRef({ pills, props });

  // Texte où se trouve le curseur, et ses suggestions.
  const current = textAt(sel);
  const typed = current === null ? "" : normalizeTag(doc.texts[current]);
  const suggestions = useTagSuggestions(typed, source);
  const open = focused && !dismissed && typed !== "" && suggestions.length > 0;
  useEscape(open, () => setDismissed(true), { escapeOnly: true });
  useEffect(() => {
    setDismissed(false);
    setHighlight(-1);
  }, [current, typed]);

  useLayoutEffect(() => {
    latest.current = { pills, props };
    const el = editor.current;
    if (el && document.activeElement === el && !composing.current) applySelection(el, doc, sel);
  });
  useLayoutEffect(() => {
    const span = current === null ? null : editor.current?.querySelector(`[data-texte="${current}"]`);
    if (open && span && box.current) setListLeft(span.getBoundingClientRect().left - box.current.getBoundingClientRect().left);
  }, [open, current, doc]);

  const cmd = pillCommands(pills, resolve);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.altKey) return;
    if (open && moveHighlight(e, suggestions.length, dropdown, setHighlight)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const take = (fn: () => void) => {
      e.preventDefault();
      fn();
    };
    if (e.key === "Enter") {
      return take(() => {
        if (open && highlight >= 0) cmd.validate(current as number, toItem(suggestions[highlight]));
        else if (current !== null && isRaw(doc.texts[current])) cmd.validate(current);
        else if (!pills.hasText) onEnterEmpty?.();
      });
    }
    if (ctrl && !e.shiftKey && key === "z") return take(pills.undo);
    if (ctrl && (key === "y" || (e.shiftKey && key === "z"))) return take(pills.redo);
    if (ctrl && !e.shiftKey && key === "a") return take(cmd.selectStep);
    if (e.key === "Backspace" || e.key === "Delete") return take(() => cmd.erase(e.key === "Backspace" ? -1 : 1, ctrl));
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const dir = e.key === "ArrowLeft" ? -1 : 1;
      return take(() => {
        const [from, to] = bounds(sel);
        // Sélection et flèche seule : le curseur va au bord de la sélection, comme dans un texte.
        if (!e.shiftKey && !isCollapsed(sel)) return pills.select(caretAt(dir < 0 ? from : to));
        const focus = step(doc, sel.focus, dir, ctrl);
        pills.select(e.shiftKey ? { anchor: sel.anchor, focus } : caretAt(focus));
      });
    }
    if (e.key === "Home" || e.key === "End") {
      const focus = e.key === "Home" ? START : endOf(doc);
      return take(() => pills.select(e.shiftKey ? { anchor: sel.anchor, focus } : caretAt(focus)));
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    const el = editor.current;
    if (!el || e.button !== 0 || !(e.target instanceof Element) || e.target.closest("ul")) return; // liste : elle garde le focus
    e.preventDefault();
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    if (e.target.closest("[data-pastille] button")) return; // croix : elle agit au clic
    const { pos, pill } = posAtPoint(el, doc, e.clientX, e.clientY);
    if (e.detail >= 3) return cmd.selectAll();
    if (e.detail === 2 && pill === null) {
      const length = doc.texts[pos.t].length;
      return pills.select(length ? { anchor: { t: pos.t, o: 0 }, focus: { t: pos.t, o: length } } : caretAt(pos));
    }
    const anchor = e.shiftKey ? sel.anchor : pos;
    pills.select(e.shiftKey ? { anchor, focus: pos } : caretAt(pill !== null ? { t: pill + 1, o: 0 } : pos));
    const start = { x: e.clientX, y: e.clientY };
    const onMove = (m: globalThis.MouseEvent) => {
      if (!dragging.current && Math.hypot(m.clientX - start.x, m.clientY - start.y) < 4) return;
      dragging.current = true;
      const { pills: p } = latest.current;
      p.select({ anchor, focus: posAtPoint(el, p.doc, m.clientX, m.clientY).pos });
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Ce que le navigateur ferait seul (taper, coller, défaire, effacer…) passe par le contenu ; seule la
  // composition d'un caractère (touche morte, saisie asiatique) le laisse écrire, relu à la fin.
  const onBeforeInput = (e: InputEvent) => {
    if (e.inputType === "insertCompositionText") {
      composing.current = true;
      return;
    }
    e.preventDefault();
    const data = e.data ?? e.dataTransfer?.getData("text/plain") ?? "";
    if (e.inputType === "insertText" || e.inputType === "insertReplacementText") cmd.typeText(data);
    else if (e.inputType === "insertFromPaste" && data) cmd.typeText(oneLine(data), null);
    else if (e.inputType === "historyUndo") pills.undo();
    else if (e.inputType === "historyRedo") pills.redo();
    else if (e.inputType.startsWith("delete")) cmd.erase(e.inputType.includes("Forward") ? 1 : -1, e.inputType.includes("Word"));
  };
  const onCompositionEnd = () => {
    composing.current = false;
    const el = editor.current;
    const selection = window.getSelection();
    const span = selection?.anchorNode?.parentElement?.closest<HTMLElement>("[data-texte]");
    if (!el || !span || !el.contains(span)) return;
    const t = Number(span.dataset.texte);
    const raw = span.textContent ?? "";
    const before = (selection?.anchorNode?.textContent ?? "").slice(0, selection?.anchorOffset ?? 0).replaceAll(EMPTY_TEXT, "");
    const text = raw.replaceAll(EMPTY_TEXT, "");
    pills.edit((d) => ({ doc: { texts: d.texts.map((x, i) => (i === t ? text : x)), pills: d.pills }, sel: caretAt({ t, o: before.length }) }), "taper");
    setVersion((v) => v + 1);
  };

  // Écouteurs posés une fois : saisie, sélection du navigateur (↑ / ↓, menu « Tout sélectionner »…),
  // commandes du menu d'édition (CTX-03).
  const handlers = useRef({ onBeforeInput, cmd });
  handlers.current = { onBeforeInput, cmd };
  useEffect(() => {
    const el = editor.current;
    if (!el) return;
    const beforeInput = (e: InputEvent) => handlers.current.onBeforeInput(e);
    const selectionChange = () => {
      const { pills: p } = latest.current;
      if (document.activeElement !== el || composing.current || dragging.current) return;
      const read = readSelection(el, p.doc);
      if (read && !sameSel(read, p.sel)) p.select(read);
    };
    el.addEventListener("beforeinput", beforeInput);
    document.addEventListener("selectionchange", selectionChange);
    const unregister = registerEditable(el, {
      canUndo: () => latest.current.pills.canUndo,
      undo: () => latest.current.pills.undo(),
      selected: () => {
        const { pills: p, props: q } = latest.current;
        return isCollapsed(p.sel) ? "" : textOf(p.doc, p.sel, q.pillName);
      },
      isEmpty: () => latest.current.pills.list.length === 0 && !latest.current.pills.doc.texts.some(Boolean),
      erase: () => handlers.current.cmd.eraseSelection(),
      paste: (text) => handlers.current.cmd.typeText(oneLine(text), null),
      selectAll: () => handlers.current.cmd.selectAll(),
    });
    return () => {
      el.removeEventListener("beforeinput", beforeInput);
      document.removeEventListener("selectionchange", selectionChange);
      unregister();
    };
  }, []);

  const last = doc.texts.length - 1;
  return (
    <div ref={box} data-zone={zone} data-champ-pastilles onMouseDown={onMouseDown} className={cn("relative cursor-text", className)}>
      <div
        ref={(el) => {
          editor.current = el;
          props.editorRef?.(el);
        }}
        data-zone={`${zone}.champ`}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={placeholder}
        spellCheck={false}
        onKeyDown={onKeyDown}
        onFocus={() => {
          setFocused(true);
          props.onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          props.onBlur?.();
        }}
        onCopy={(e) => {
          e.preventDefault();
          if (!isCollapsed(sel)) e.clipboardData.setData("text/plain", textOf(doc, sel, pillName));
        }}
        onCut={(e) => {
          e.preventDefault();
          if (isCollapsed(sel)) return;
          e.clipboardData.setData("text/plain", textOf(doc, sel, pillName));
          cmd.eraseSelection();
        }}
        onCompositionEnd={onCompositionEnd}
        onDragStart={(e) => e.preventDefault()}
        className="min-h-7 min-w-0 flex-1 text-sm leading-7 break-words whitespace-pre-wrap text-foreground outline-none"
      >
        {doc.texts.flatMap((text, t) => [
          // Texte vide : 4 px entre deux pastilles ; texte tapé : 4 px de chaque côté.
          <span key={`t:${t}:${version}`} data-texte={t} className={text ? "px-1" : "px-0.5"}>
            {text || EMPTY_TEXT}
          </span>,
          t < doc.pills.length && (
            <span
              key={`p:${pillKey(doc.pills[t])}`}
              data-pastille={t}
              data-choisie={focused && covers(sel, t) ? "" : undefined}
              contentEditable={false}
              className="inline-flex align-middle select-none"
            >
              {renderPill(doc.pills[t], () => cmd.remove(t))}
            </span>
          ),
        ])}
        {!pills.hasText && doc.texts[last] === "" && (
          <span contentEditable={false} data-aide className="pointer-events-none text-muted-foreground select-none">
            {placeholder}
          </span>
        )}
      </div>
      {open && current !== null && (
        <SuggestionList
          zone={`${zone}.champ`}
          suggestions={suggestions}
          highlight={highlight}
          setHighlight={setHighlight}
          dropdown={dropdown}
          onPick={(tag) => cmd.validate(current, toItem(tag))}
          className="max-w-[28rem] min-w-56"
          style={{ left: listLeft }}
        />
      )}
    </div>
  );
}
