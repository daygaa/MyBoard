// Champ à pastilles (SEL-07, SEL-12) : une petite zone éditable où les tags validés sont des pastilles
// posées dans le texte, comme une image dans un traitement de texte. Le navigateur ne fait que l'afficher :
// chaque frappe, effacement ou déplacement passe par le contenu (lib/pillText.ts) et son historique
// (usePills), puis le champ est redessiné et le curseur replacé (pillDom.ts, D-043). Un seul composant pour
// la barre de la sélection, puis les champs des règles du gestionnaire (TAGM-15.5).
// Clavier, comme pour du texte (choix des 24 et 25/10) :
// - on tape n'importe où, entre deux pastilles comprises ; Entrée change le texte où est le curseur en
//   pastille (`resolve`) ; la liste de suggestions suit ce texte ; les tags déjà là y sont grisés, avec
//   leur bulle (`taken` et les pastilles du champ, SRCH-29) ;
// - ← / → (Ctrl : mot par mot), Début / Fin, Maj pour sélectionner ; une pastille compte comme un
//   caractère ; Retour arrière / Suppr effacent la sélection, sinon le caractère ou la pastille voisine ;
// - Ctrl + A : le texte où est le curseur, puis tout le champ (tout de suite hors d'un texte) ;
// - Ctrl + Z / Ctrl + Y : historique ; Ctrl + C / X / V : les pastilles restent des pastilles
//   (pillClipboard.ts) ; Entrée sans aucun texte tapé : `onSubmit`.
// Souris : pillMouse.ts. Pastilles sélectionnées : même aspect qu'un texte surligné (`data-choisie`).

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import type { Pills } from "@/hooks/usePills";
import type { TagInfo } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { bounds, caretAt, covers, endOf, isCollapsed, isRaw, sameSel, START, step, textAt } from "@/lib/pillText";
import { normalizeTag } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { copyPiece, pastedPiece, type ClipPill } from "./pillClipboard";
import { pillCommands } from "./pillCommands";
import { applySelection, EMPTY_TEXT, readSelection } from "./pillDom";
import { usePillListeners, type PillHandlers } from "./pillListeners";
import { pillMouseDown } from "./pillMouse";
import { PillOverflowParts, usePillOverflow } from "./pillOverflow";
import { IN_FIELD } from "./TagInput";
import { moveHighlight, SuggestionList, useTagSuggestions, type Dropdown, type Taken } from "./TagSuggestions";

type Props<T> = {
  zone: string;
  pills: Pills<T>;
  pillKey: (item: T) => string | number;
  /** Pastille ; `remove` l'efface (croix). */
  renderPill: (item: T, remove: () => void) => ReactNode;
  /** Texte validé par Entrée : sa pastille, ou `null` (le texte reste). */
  resolve: (text: string) => T | null | Promise<T | null>;
  /** Suggestion choisie → pastille. */
  toItem: (tag: TagInfo) => T;
  /** Pastille copiée / collée (pillClipboard.ts) ; `null` : elle n'a pas de sens ici. */
  toClip: (item: T) => ClipPill;
  fromClip: (c: ClipPill) => T | null;
  source?: TagInfo[];
  /** Tags déjà là (grisés, avec leur bulle) en plus des pastilles du champ. */
  taken?: Taken;
  onSubmit?: (items: T[]) => void;
  placeholder: string;
  dropdown?: Dropdown;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  editorRef?: (el: HTMLDivElement | null) => void;
  /** Lignes de pastilles au plus ; au-delà, « +N » et une ligne d'écriture à part (pillOverflow.tsx). */
  maxLines?: number;
};

/** Collage sur une seule ligne. */
const oneLine = (text: string) => text.replace(/\s*\r?\n\s*/g, " ");

export function PillField<T>(props: Props<T>) {
  const { zone, pills, pillKey, renderPill, toItem, toClip, source, placeholder, dropdown = "top", className } = props;
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
  const latest = useRef(pills);
  const cmd = pillCommands(pills, props);

  // Texte où se trouve le curseur, et ses suggestions (tags déjà là grisés, SRCH-29).
  const current = textAt(sel);
  const typed = current === null ? "" : normalizeTag(doc.texts[current]);
  const written = doc.pills.map((item) => toClip(item).name);
  const taken: Taken = (tag) => (written.includes(tag.name) ? IN_FIELD : (props.taken?.(tag) ?? null));
  const suggestions = useTagSuggestions(typed, source);
  const open = focused && !dismissed && typed !== "" && suggestions.length > 0;
  useEscape(open, () => setDismissed(true), { escapeOnly: true });
  useEffect(() => {
    setDismissed(false);
    setHighlight(-1);
  }, [current, typed]);

  useLayoutEffect(() => {
    latest.current = pills;
    const el = editor.current;
    if (el && document.activeElement === el && !composing.current) applySelection(el, doc, sel);
  });
  useLayoutEffect(() => {
    const span = current === null ? null : editor.current?.querySelector(`[data-texte="${current}"]`);
    if (open && span && box.current) setListLeft(span.getBoundingClientRect().left - box.current.getBoundingClientRect().left);
  }, [open, current, doc]);

  const pick = (tag: TagInfo) => current !== null && cmd.validate(current, toItem(tag));
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.altKey) return;
    if (open && moveHighlight(e, suggestions, dropdown, setHighlight, taken)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const take = (fn: () => void) => {
      e.preventDefault();
      fn();
    };
    if (e.key === "Enter") {
      return take(() => {
        if (open && highlight >= 0) pick(suggestions[highlight]);
        else if (current !== null && isRaw(doc.texts[current])) cmd.validate(current);
        else if (!pills.hasText) props.onSubmit?.(pills.list);
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

  /** Texte collé : un morceau copié dans un champ à pastilles redevient des pastilles. */
  const paste = (text: string, data: DataTransfer | null) => {
    const piece = pastedPiece(data, text);
    if (piece) cmd.pastePiece(piece);
    else if (text) cmd.typeText(oneLine(text), null);
  };
  const onCompositionEnd = () => {
    composing.current = false;
    const el = editor.current;
    const selection = window.getSelection();
    const span = selection?.anchorNode?.parentElement?.closest<HTMLElement>("[data-texte]");
    if (!el || !span || !el.contains(span)) return;
    const t = Number(span.dataset.texte);
    const before = (selection?.anchorNode?.textContent ?? "").slice(0, selection?.anchorOffset ?? 0).replaceAll(EMPTY_TEXT, "");
    const text = (span.textContent ?? "").replaceAll(EMPTY_TEXT, "");
    pills.edit((d) => ({ doc: { texts: d.texts.map((x, i) => (i === t ? text : x)), pills: d.pills }, sel: caretAt({ t, o: before.length }) }), "taper");
    setVersion((v) => v + 1);
  };

  // Ce que le navigateur ferait seul (taper, défaire, effacer…) passe par le contenu ; seule la
  // composition d'un caractère (touche morte, saisie asiatique) le laisse écrire, relu à la fin.
  const handlers = useRef<PillHandlers>(null as unknown as PillHandlers);
  handlers.current = {
    beforeInput: (e) => {
      if (e.inputType === "insertCompositionText") {
        composing.current = true;
        return;
      }
      e.preventDefault();
      const data = e.data ?? e.dataTransfer?.getData("text/plain") ?? "";
      if (e.inputType === "insertText" || e.inputType === "insertReplacementText") cmd.typeText(data);
      else if (e.inputType === "insertFromPaste") paste(data, e.dataTransfer);
      else if (e.inputType === "historyUndo") pills.undo();
      else if (e.inputType === "historyRedo") pills.redo();
      else if (e.inputType.startsWith("delete")) cmd.erase(e.inputType.includes("Forward") ? 1 : -1, e.inputType.includes("Word"));
    },
    selectionChange: () => {
      const el = editor.current;
      if (!el || document.activeElement !== el || composing.current || dragging.current) return;
      const read = readSelection(el, doc);
      if (read && !sameSel(read, sel)) pills.select(read);
    },
    edit: {
      canUndo: () => pills.canUndo,
      undo: pills.undo,
      hasSelection: () => !isCollapsed(sel),
      isEmpty: () => pills.list.length === 0 && !doc.texts.some(Boolean),
      copy: () => document.execCommand("copy"),
      cut: () => document.execCommand("cut"),
      paste: (text) => paste(text, null),
      erase: cmd.eraseSelection,
      selectAll: cmd.selectAll,
    },
  };
  usePillListeners(editor, handlers);
  const over = usePillOverflow({ maxLines: props.maxLines, doc, sel, focused, listOpen: open, root: box, editor });

  const last = doc.texts.length - 1;
  return (
    <div
      ref={box}
      data-zone={zone}
      data-champ-pastilles
      onMouseDown={(e) => editor.current && pillMouseDown(e, editor.current, { pills, cmd, dragging, latest: () => latest.current })}
      // Dépliées : le champ garde sa hauteur, les pastilles passent par-dessus ce qui est dessous.
      style={over.unfolded ? { height: over.foldedHeight } : undefined}
      className={cn("relative cursor-text", className, over.unfolded && "z-30 !items-start")}
    >
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
          if (!isCollapsed(sel)) copyPiece(e.clipboardData, doc, sel, toClip);
        }}
        onCut={(e) => {
          e.preventDefault();
          if (isCollapsed(sel)) return;
          copyPiece(e.clipboardData, doc, sel, toClip);
          cmd.eraseSelection();
        }}
        onPaste={(e) => {
          e.preventDefault();
          paste(e.clipboardData.getData("text/plain"), e.clipboardData);
        }}
        onCompositionEnd={onCompositionEnd}
        onDragStart={(e) => e.preventDefault()}
        className="min-h-7 min-w-0 flex-1 text-sm leading-7 break-words whitespace-pre-wrap text-foreground outline-none"
      >
        {doc.texts.flatMap((text, t) => [
          // Pastilles au-delà de `maxLines` lignes : la ligne d'écriture passe dessous, seule.
          t === last && props.maxLines && <span key="saut" data-saut contentEditable={false} className={over.overflow ? "block" : "hidden"} />,
          // Texte vide : 4 px entre deux pastilles ; texte tapé : 4 px de chaque côté.
          <span key={`t:${t}:${version}`} data-texte={t} className={cn(text ? "px-1" : "px-0.5", !text && t < last && over.isHidden(t) && "hidden")}>
            {text || EMPTY_TEXT}
          </span>,
          t < doc.pills.length && (
            <span
              key={`p:${pillKey(doc.pills[t])}`}
              data-pastille={t}
              data-choisie={focused && covers(sel, t) ? "" : undefined}
              contentEditable={false}
              // Hauteur d'une ligne, pastille centrée dedans (avec `align-middle`, elle tombait 1,5 px trop bas) ;
              // jamais plus large que le champ, l'espace de 4 px qui la précède compris (nom coupé par « … »,
              // retouches de R3).
              className={cn("inline-flex h-7 max-w-[calc(100%-4px)] items-center align-top select-none", over.isHidden(t) && "hidden")}
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
      {props.maxLines && <PillOverflowParts count={over.hidden.size} unfolded={over.unfolded} focused={focused} plus={over.plus} layer={over.layer} />}
      {open && current !== null && (
        <SuggestionList
          zone={`${zone}.champ`}
          suggestions={suggestions}
          highlight={highlight}
          setHighlight={setHighlight}
          dropdown={dropdown}
          onPick={pick}
          taken={taken}
          className="max-w-[28rem] min-w-56"
          style={{ left: listLeft }}
        />
      )}
    </div>
  );
}
