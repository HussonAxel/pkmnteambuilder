// Textarea for a Showdown paste, with suggestions that follow the line being typed:
// species on the first line, item after "@", abilities after "Ability:", moves after "-"…
import { cn } from "@pkmnteambuilder/ui/lib/utils";
import { useId, useLayoutEffect, useRef, useState } from "react";

import {
  PASTE_KEYWORDS,
  type PasteField,
  pasteContext,
  rankSuggestions,
  STAT_NAMES,
} from "@/lib/sets";

export type PasteOptions = Record<Exclude<PasteField, "stat" | "line">, readonly string[]> & {
  natures: readonly string[];
};

const MIN_LETTERS = 2;

type Open = { items: string[]; start: number; top: number; left: number };

export function ShowdownPaste({
  value,
  onChange,
  options,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: PasteOptions;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [open, setOpen] = useState<Open | null>(null);
  const [active, setActive] = useState(0);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  // The template stays visible, greyed, on every line not typed yet.
  const typed = value.split("\n");
  const ghost = (placeholder ?? "")
    .split("\n")
    .map((line, i) => (typed[i] ? "" : line))
    .join("\n");
  const caretAfter = useRef<number | null>(null);

  // Restore the caret after an accepted suggestion rewrote the value.
  useLayoutEffect(() => {
    if (caretAfter.current === null || !ref.current) return;
    ref.current.setSelectionRange(caretAfter.current, caretAfter.current);
    caretAfter.current = null;
  });

  const refresh = (text: string) => {
    const el = ref.current;
    if (!el || el.selectionStart !== el.selectionEnd) return setOpen(null);
    const caret = el.selectionStart;
    const ctx = pasteContext(text, caret);
    // Wait for a couple of letters so the list doesn't pop up on every key (and Enter on an
    // empty line still makes a new line). Stat names are 2–3 letters, so one is enough there.
    if (!ctx || ctx.query.trim().length < (ctx.field === "stat" ? 1 : MIN_LETTERS))
      return setOpen(null);
    const pool =
      ctx.field === "stat"
        ? STAT_NAMES
        : ctx.field === "line"
          ? [...PASTE_KEYWORDS, ...options.natures.map((n) => `${n} Nature`)]
          : options[ctx.field];
    const items = rankSuggestions(pool, ctx.query);
    if (!items.length) return setOpen(null);
    // wrap="off" + monospace: the caret sits at (line, column) on a fixed grid.
    const style = getComputedStyle(el);
    const canvas = document.createElement("canvas").getContext("2d");
    if (canvas) canvas.font = style.font;
    const charWidth = canvas?.measureText("M").width ?? 7;
    const lineHeight = Number.parseFloat(style.lineHeight) || 18;
    const lines = text.slice(0, caret).split("\n");
    const column = (lines.at(-1) ?? "").length - ctx.query.length;
    const top = Number.parseFloat(style.paddingTop) + lines.length * lineHeight - el.scrollTop + 4;
    const left = Math.min(
      Number.parseFloat(style.paddingLeft) + column * charWidth - el.scrollLeft,
      el.clientWidth - 224,
    );
    setOpen({ items, start: ctx.start, top, left: Math.max(0, left) });
    setActive(0);
  };

  const accept = (item: string) => {
    const el = ref.current;
    if (!el || !open) return;
    const caret = el.selectionStart;
    caretAfter.current = open.start + item.length;
    onChange(value.slice(0, open.start) + item + value.slice(caret));
    setOpen(null);
    el.focus();
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          refresh(e.target.value);
        }}
        onClick={() => refresh(value)}
        onBlur={() => setOpen(null)}
        onScroll={(e) => {
          setOpen(null);
          setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft });
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => (i + step + open.items.length) % open.items.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            accept(open.items[active] ?? "");
          } else if (e.key === "Escape") {
            // Close the list only, not the dialog around it.
            e.preventDefault();
            e.stopPropagation();
            setOpen(null);
          }
        }}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open !== null}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        rows={8}
        wrap="off"
        spellCheck={false}
        autoComplete="off"
        className={className}
      />
      <div
        aria-hidden
        className={cn(
          className,
          "pointer-events-none absolute inset-0 overflow-hidden bg-transparent whitespace-pre text-muted-foreground/40",
        )}
      >
        <div style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}>{ghost}</div>
      </div>
      {open && (
        <div
          id={listId}
          role="listbox"
          style={{ top: open.top, left: open.left }}
          className="absolute z-20 w-56 overflow-hidden rounded-xl border border-border bg-background p-1 shadow-lg"
        >
          {open.items.map((item, i) => (
            <div
              key={item}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the textarea keeps focus and the caret position.
              onMouseDown={(e) => {
                e.preventDefault();
                accept(item);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "cursor-pointer truncate rounded-lg px-2.5 py-1.5 text-sm",
                i === active ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              {item.trim()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
