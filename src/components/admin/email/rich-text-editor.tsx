"use client";

import * as React from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Bold,
  CodeXml,
  Columns3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  MousePointerClick,
  Redo2,
  RemoveFormatting,
  Rows3,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  UnfoldVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { iconButtonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { CtaDialog, ImageDialog, LinkDialog, TableDialog, type CtaValue, type ImageValue, type LinkValue, type TableValue } from "@/components/admin/email/editor-dialogs";
import { cleanEditorHtml, escapeHtml, formatHtmlSource, isHtmlEmpty } from "@/components/admin/email/html-tools";
import { EMAIL_PROSE } from "@/components/admin/email/prose";

/*
 * Rich-text editor for Admin → Send Email. No dependencies: a contenteditable surface driven by
 * `document.execCommand` (still the only cross-browser editing API with a native undo stack), plus a
 * handful of DOM operations for what execCommand cannot express in email-safe markup (font size as an
 * inline style, line height, table rows/columns).
 *
 *   Toolbar   role="toolbar" with a roving tab stop: Tab enters/leaves it, ←/→/Home/End move between
 *             controls. Toggle buttons expose aria-pressed. Mouse presses never steal the editor's
 *             selection (mousedown is cancelled); keyboard presses restore it before acting.
 *   Output    an HTML string through `onChange`. Everything the editor produces uses inline styles and
 *             the tags the server's sanitiser keeps, and the server sanitises it again anyway.
 *   Safety    pasted / dropped / source-edited HTML is cleaned in an inert document before it reaches
 *             the live DOM; inline data:/blob: images are refused in favour of an upload.
 *   Source    the "HTML" toggle swaps the surface for a textarea and back (round-trips).
 */

type Align = "left" | "center" | "right" | "justify";

interface ToolState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  ul: boolean;
  ol: boolean;
  block: string;
  align: Align;
  link: boolean;
  table: boolean;
}

const INITIAL_TOOLS: ToolState = { bold: false, italic: false, underline: false, strike: false, ul: false, ol: false, block: "p", align: "left", link: false, table: false };

const BLOCKS = [
  { value: "p", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
];

const FONT_SIZES = [
  { value: "13px", label: "Small" },
  { value: "15px", label: "Normal" },
  { value: "18px", label: "Large" },
  { value: "22px", label: "Larger" },
  { value: "28px", label: "Huge" },
];

const LINE_HEIGHTS = [
  { value: "1.2", label: "Tight (1.2)" },
  { value: "1.6", label: "Normal (1.6)" },
  { value: "1.8", label: "Relaxed (1.8)" },
  { value: "2", label: "Double (2)" },
];

const BLOCK_SELECTOR = "p,h1,h2,h3,h4,li,blockquote,div,td,th,pre";
const CELL_STYLE = "border:1px solid #e5e7eb;padding:8px;vertical-align:top";
const HEAD_STYLE = "border:1px solid #e5e7eb;padding:8px;background-color:#f4f6fb;text-align:left;font-weight:600";

type DialogState = { kind: "link"; initial: LinkValue; editing: boolean } | { kind: "image"; file: File | null } | { kind: "table" } | { kind: "cta" };

export interface RichTextEditorProps {
  /** HTML. A value that differs from what the editor last emitted (e.g. a template was applied) replaces the content. */
  value: string;
  onChange: (html: string) => void;
  /** Id on the editable surface (error summaries focus it). */
  id?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  invalid?: boolean;
  placeholder?: string;
  /** Allow "Insert image → Upload" (POST /api/admin/uploads). Default true. */
  allowImageUpload?: boolean;
  className?: string;
}

function sameTools(a: ToolState, b: ToolState) {
  return (Object.keys(a) as (keyof ToolState)[]).every((k) => a[k] === b[k]);
}

function queryState(cmd: string): boolean {
  try {
    return document.queryCommandState(cmd);
  } catch {
    return false;
  }
}

function elementOf(node: Node | null | undefined): Element | null {
  if (!node) return null;
  return node instanceof Element ? node : node.parentElement;
}

/* ───────────── Toolbar controls ───────────── */

const TOOL_CLASS = "aria-pressed:bg-lavender aria-pressed:text-navy";

function ToolButton({ label, icon, pressed, onClick, disabled, shortcut }: { label: string; icon: React.ReactNode; pressed?: boolean; onClick: () => void; disabled?: boolean; shortcut?: string }) {
  return (
    <button
      type="button"
      data-tool=""
      aria-label={label}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      title={shortcut ? `${label} (${shortcut.replace("Control", "Ctrl")})` : label}
      disabled={disabled}
      // Keeps focus (and the selection) in the editor when the button is clicked or tapped.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(iconButtonClasses({ size: "sm" }), TOOL_CLASS)}
    >
      {icon}
    </button>
  );
}

function ToolSelect({ label, value, placeholder, options, onChange, disabled, className }: { label: string; value: string; placeholder?: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean; className?: string }) {
  return (
    <select
      data-tool=""
      aria-label={label}
      title={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "ring-focus h-11 shrink-0 cursor-pointer rounded-md border border-line bg-white px-2 text-base text-ink focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:text-sm pointer-coarse:h-11",
        className
      )}
    >
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Native colour picker. It applies on the input's native `change` (fired once the picker closes),
 * not on every `input` while the user drags around the palette.
 */
function ColorTool({ label, icon, initial, onPick, disabled }: { label: string; icon: React.ReactNode; initial: string; onPick: (color: string) => void; disabled?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [color, setColor] = React.useState(initial);
  const onPickRef = React.useRef(onPick);
  React.useEffect(() => {
    onPickRef.current = onPick;
  });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = () => {
      setColor(el.value);
      onPickRef.current(el.value);
    };
    el.addEventListener("change", handle);
    return () => el.removeEventListener("change", handle);
  }, []);
  return (
    <label
      title={label}
      className={cn(iconButtonClasses({ size: "sm" }), "cursor-pointer has-focus-visible:ring-2 has-focus-visible:ring-orange has-focus-visible:ring-offset-2", disabled && "pointer-events-none opacity-50")}
    >
      <span className="flex flex-col items-center" aria-hidden>
        {icon}
        <span className="mt-0.5 h-1 w-5 rounded-full border border-line" style={{ background: color }} />
      </span>
      <input ref={ref} data-tool="" type="color" aria-label={label} defaultValue={initial} disabled={disabled} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
  );
}

function Sep() {
  return <span className="mx-0.5 h-6 w-px shrink-0 self-center bg-line" aria-hidden />;
}

/* ───────────── Editor ───────────── */

export function RichTextEditor({ value, onChange, id, "aria-labelledby": labelledBy, "aria-describedby": describedBy, invalid, placeholder = "Write your message…", allowImageUpload = true, className }: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const sourceRef = React.useRef<HTMLTextAreaElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const savedRange = React.useRef<Range | null>(null);
  const lastEmitted = React.useRef<string | null>(null);
  const linkTarget = React.useRef<HTMLAnchorElement | null>(null);
  const internalDrag = React.useRef(false);
  const roving = React.useRef(0);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [mode, setMode] = React.useState<"visual" | "source">("visual");
  const [tools, setTools] = React.useState<ToolState>(INITIAL_TOOLS);
  const [dialog, setDialog] = React.useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogKey, setDialogKey] = React.useState(0);
  const sourceId = React.useId();
  const source = mode === "source";

  const markEmpty = (el: HTMLElement) => {
    el.dataset.empty = isHtmlEmpty(el.innerHTML) ? "true" : "false";
  };

  /** Publishes the current HTML (after dropping any inline data:/blob: image that slipped in natively). */
  const emit = React.useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const inline = el.querySelectorAll('img[src^="data:"], img[src^="blob:"]');
    if (inline.length) {
      inline.forEach((n) => n.remove());
      toast.warning("Inline images were removed", "Pasted or dropped images cannot be embedded. Use Insert image → Upload instead.");
    }
    const html = isHtmlEmpty(el.innerHTML) ? "" : el.innerHTML;
    el.dataset.empty = html ? "false" : "true";
    lastEmitted.current = html;
    onChangeRef.current(html);
  }, []);

  /** Remembers the selection and reflects the formatting under the caret in the toolbar. */
  const refreshTools = React.useCallback(() => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return;
    savedRange.current = sel.getRangeAt(0).cloneRange();
    let block = "p";
    try {
      block = String(document.queryCommandValue("formatBlock") || "p").toLowerCase().replace(/[<>]/g, "");
    } catch {
      block = "p";
    }
    const node = elementOf(sel.anchorNode);
    const anchor = node?.closest("a");
    const cell = node?.closest("td,th");
    const next: ToolState = {
      bold: queryState("bold"),
      italic: queryState("italic"),
      underline: queryState("underline"),
      strike: queryState("strikeThrough"),
      ul: queryState("insertUnorderedList"),
      ol: queryState("insertOrderedList"),
      block: ["h1", "h2", "h3"].includes(block) ? block : "p",
      align: queryState("justifyCenter") ? "center" : queryState("justifyRight") ? "right" : queryState("justifyFull") ? "justify" : "left",
      link: !!anchor && el.contains(anchor),
      table: !!cell && el.contains(cell),
    };
    setTools((prev) => (sameTools(prev, next) ? prev : next));
  }, []);

  // External value → DOM (initial content, a template, a loaded draft). Never echoes our own emits.
  React.useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const el = editorRef.current;
    if (el) {
      el.innerHTML = cleanEditorHtml(value).html;
      markEmpty(el);
    }
    if (sourceRef.current) sourceRef.current.value = formatHtmlSource(value);
  }, [value]);

  React.useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* older engines: Enter creates <div>, which is fine too */
    }
    document.addEventListener("selectionchange", refreshTools);
    return () => document.removeEventListener("selectionchange", refreshTools);
  }, [refreshTools]);

  // Roving tab stop for the toolbar (attributes only; React never renders tabIndex on the tools).
  React.useEffect(() => {
    const items = Array.from(toolbarRef.current?.querySelectorAll<HTMLElement>("[data-tool]:not([disabled])") ?? []);
    if (!items.length) return;
    const current = Math.min(roving.current, items.length - 1);
    items.forEach((it, i) => {
      it.tabIndex = i === current ? 0 : -1;
    });
  });

  const toolbarItems = () => Array.from(toolbarRef.current?.querySelectorAll<HTMLElement>("[data-tool]:not([disabled])") ?? []);

  const onToolbarKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const items = toolbarItems();
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    roving.current = next;
    items.forEach((it, j) => {
      it.tabIndex = j === next ? 0 : -1;
    });
    items[next]?.focus();
  };

  const onToolbarFocus = (e: React.FocusEvent) => {
    const items = toolbarItems();
    const i = items.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    roving.current = i;
    items.forEach((it, j) => {
      it.tabIndex = j === i ? 0 : -1;
    });
  };

  /** Focuses the editor and puts back the last selection inside it (or the end of the content). */
  const restore = (): Selection | null => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel) return null;
    el.focus({ preventScroll: true });
    const r = savedRange.current;
    if (r && el.contains(r.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(r);
    } else if (!sel.rangeCount || !el.contains(sel.anchorNode)) {
      const end = document.createRange();
      end.selectNodeContents(el);
      end.collapse(false);
      sel.removeAllRanges();
      sel.addRange(end);
    }
    return sel;
  };

  const placeCaret = (node: Node | null, atEnd = false) => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel) return;
    el.focus({ preventScroll: true });
    const r = document.createRange();
    r.selectNodeContents(node && el.contains(node) ? node : el);
    r.collapse(!atEnd && !!node);
    sel.removeAllRanges();
    sel.addRange(r);
    savedRange.current = r.cloneRange();
  };

  const exec = (cmd: string, arg?: string) => {
    if (!restore()) return;
    document.execCommand(cmd, false, arg);
    emit();
    refreshTools();
  };

  const insertHtml = (html: string) => {
    const sel = restore();
    if (!sel) return;
    const ok = document.execCommand("insertHTML", false, html);
    if (!ok && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(range.createContextualFragment(html));
    }
    emit();
    refreshTools();
  };

  const applyColor = (cmd: "foreColor" | "hiliteColor", color: string) => {
    if (!restore()) return;
    document.execCommand("styleWithCSS", false, "true");
    const ok = document.execCommand(cmd, false, color);
    if (!ok && cmd === "hiliteColor") document.execCommand("backColor", false, color);
    document.execCommand("styleWithCSS", false, "false");
    emit();
  };

  /** execCommand only knows the 1–7 <font size> scale; swap its output for an inline px size. */
  const applyFontSize = (px: string) => {
    const el = editorRef.current;
    const sel = restore();
    if (!el || !sel) return;
    if (sel.isCollapsed) {
      toast.info("Select some text first", "The font size applies to the selected text.");
      return;
    }
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("fontSize", false, "7");
    el.querySelectorAll('font[size="7"]').forEach((font) => {
      const span = document.createElement("span");
      span.style.fontSize = px;
      while (font.firstChild) span.appendChild(font.firstChild);
      span.querySelectorAll<HTMLElement>("[style*='font-size']").forEach((n) => n.style.removeProperty("font-size"));
      font.replaceWith(span);
    });
    el.querySelectorAll<HTMLElement>("span[style*='xxx-large']").forEach((s) => {
      s.style.fontSize = px;
    });
    emit();
  };

  const selectedBlocks = (el: HTMLElement, range: Range) => Array.from(el.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)).filter((b) => range.intersectsNode(b) && !b.querySelector(BLOCK_SELECTOR));

  const applyLineHeight = (lh: string) => {
    const el = editorRef.current;
    const sel = restore();
    if (!el || !sel || !sel.rangeCount) return;
    let blocks = selectedBlocks(el, sel.getRangeAt(0));
    if (!blocks.length) {
      // Bare text at the top level: wrap it in a paragraph first.
      document.execCommand("formatBlock", false, "<p>");
      if (sel.rangeCount) blocks = selectedBlocks(el, sel.getRangeAt(0));
    }
    blocks.forEach((b) => {
      b.style.lineHeight = lh;
    });
    emit();
  };

  /* ── Dialogs ── */

  const openDialog = (d: DialogState) => {
    setDialog(d);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };
  const closeDialog = () => setDialogOpen(false);
  /** Closes the dialog, lets its focus trap hand focus back, then edits with the editor focused again. */
  const afterDialog = (fn: () => void) => {
    setDialogOpen(false);
    window.setTimeout(fn, 0);
  };

  const openLink = () => {
    const el = editorRef.current;
    const r = savedRange.current;
    const inside = !!el && !!r && el.contains(r.commonAncestorContainer);
    const anchor = inside ? elementOf(r!.startContainer)?.closest("a") : null;
    if (anchor && el!.contains(anchor)) {
      linkTarget.current = anchor as HTMLAnchorElement;
      openDialog({ kind: "link", editing: true, initial: { url: anchor.getAttribute("href") ?? "", text: anchor.textContent ?? "" } });
    } else {
      linkTarget.current = null;
      openDialog({ kind: "link", editing: false, initial: { url: "", text: inside ? r!.toString() : "" } });
    }
  };

  const submitLink = ({ url, text }: LinkValue) =>
    afterDialog(() => {
      const a = linkTarget.current;
      if (a && editorRef.current?.contains(a)) {
        a.setAttribute("href", url);
        if (text && text !== a.textContent) a.textContent = text;
        placeCaret(a, true);
        emit();
        return;
      }
      const sel = restore();
      if (!sel) return;
      const selected = sel.toString();
      if (selected && (!text || text === selected)) {
        document.execCommand("createLink", false, url);
        emit();
        refreshTools();
        return;
      }
      insertHtml(`<a href="${escapeHtml(url)}">${escapeHtml(text || selected || url.replace(/^mailto:/i, ""))}</a>&nbsp;`);
    });

  const removeLink = () =>
    afterDialog(() => {
      const a = linkTarget.current;
      if (!a || !editorRef.current?.contains(a)) return;
      const parent = a.parentNode;
      a.replaceWith(...Array.from(a.childNodes));
      placeCaret(parent, true);
      emit();
      refreshTools();
    });

  const submitImage = ({ src, alt, width, align }: ImageValue) =>
    afterDialog(() => {
      const size = width ? ` width="${width}"` : "";
      const style = `max-width:100%;height:auto;${width ? `width:${width}px;` : ""}`;
      insertHtml(`<p style="text-align:${align};margin:12px 0"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${size} style="${style}"></p><p><br></p>`);
    });

  const submitTable = ({ rows, cols, header }: TableValue) =>
    afterDialog(() => {
      const head = header ? `<tr>${Array.from({ length: cols }, (_, i) => `<th style="${HEAD_STYLE}">Heading ${i + 1}</th>`).join("")}</tr>` : "";
      const body = Array.from({ length: header ? Math.max(1, rows - 1) : rows }, () => `<tr>${Array.from({ length: cols }, () => `<td style="${CELL_STYLE}">&nbsp;</td>`).join("")}</tr>`).join("");
      insertHtml(`<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:12px 0"><tbody>${head}${body}</tbody></table><p><br></p>`);
    });

  const submitCta = ({ text, url, background, color, align }: CtaValue) =>
    afterDialog(() => {
      insertHtml(
        `<p style="margin:24px 0;text-align:${align}"><a href="${escapeHtml(url)}" style="display:inline-block;background-color:${background};color:${color};padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(text)}</a></p><p><br></p>`
      );
    });

  const offerImageUpload = (file: File) => {
    if (!allowImageUpload) {
      toast.info("Images cannot be pasted", "Insert an image by its https:// address instead.");
      return;
    }
    openDialog({ kind: "image", file });
  };

  /* ── Table operations (caret inside a cell) ── */

  const cellContext = () => {
    const el = editorRef.current;
    const r = savedRange.current;
    if (!el || !r) return null;
    const cell = elementOf(r.startContainer)?.closest("td,th") as HTMLTableCellElement | null;
    if (!cell || !el.contains(cell)) return null;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = cell.closest("table") as HTMLTableElement;
    return { cell, row, table };
  };

  const newCell = (like: HTMLTableCellElement | undefined, tag: "td" | "th" = "td") => {
    const c = document.createElement(tag);
    c.setAttribute("style", like?.getAttribute("style") ?? (tag === "th" ? HEAD_STYLE : CELL_STYLE));
    c.innerHTML = "&nbsp;";
    return c;
  };

  const tableOp = (op: "row" | "col" | "delRow" | "delCol" | "delTable") => {
    const ctx = cellContext();
    if (!ctx) return;
    const { cell, row, table } = ctx;
    const index = cell.cellIndex;
    if (op === "row") {
      const tr = document.createElement("tr");
      const like = Array.from(row.cells).find((c) => c.tagName === "TD");
      for (let i = 0; i < row.cells.length; i++) tr.appendChild(newCell(like));
      row.after(tr);
      placeCaret(tr.cells[index] ?? tr.cells[0] ?? null);
    } else if (op === "col") {
      for (const tr of Array.from(table.rows)) {
        const ref = tr.cells[Math.min(index, tr.cells.length - 1)];
        const c = newCell(ref, ref?.tagName === "TH" ? "th" : "td");
        if (ref) ref.after(c);
        else tr.appendChild(c);
      }
      placeCaret(row.cells[index + 1] ?? null);
    } else if (op === "delRow") {
      const sibling = (row.nextElementSibling ?? row.previousElementSibling) as HTMLTableRowElement | null;
      row.remove();
      if (!table.rows.length) {
        const after = table.nextSibling;
        table.remove();
        placeCaret(after, true);
      } else placeCaret(sibling?.cells[Math.min(index, sibling.cells.length - 1)] ?? null);
    } else if (op === "delCol") {
      for (const tr of Array.from(table.rows)) tr.cells[index]?.remove();
      if (!table.rows[0]?.cells.length) {
        const after = table.nextSibling;
        table.remove();
        placeCaret(after, true);
      } else placeCaret(row.cells[Math.max(0, index - 1)] ?? null);
    } else {
      const after = table.nextSibling;
      table.remove();
      placeCaret(after, true);
    }
    emit();
    refreshTools();
    if (op === "delTable") setTools((t) => ({ ...t, table: false }));
  };

  /* ── Source view ── */

  const toggleSource = () => {
    const el = editorRef.current;
    const ta = sourceRef.current;
    if (!el || !ta) return;
    if (!source) {
      ta.value = formatHtmlSource(isHtmlEmpty(el.innerHTML) ? "" : el.innerHTML);
      setMode("source");
      window.requestAnimationFrame(() => ta.focus());
      return;
    }
    const { html, removedImages } = cleanEditorHtml(ta.value);
    if (removedImages) toast.warning("Some images were removed", "Inline (data:) images cannot be sent. Upload them with Insert image.");
    el.innerHTML = html;
    setMode("visual");
    emit();
    window.requestAnimationFrame(() => placeCaret(null, true));
  };

  /* ── Paste / drop / keys ── */

  const insertCleaned = (raw: string) => {
    const { html, removedImages } = cleanEditorHtml(raw);
    if (removedImages) toast.warning("Embedded images were removed", "Upload images with Insert image instead.");
    if (html) insertHtml(html);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const dt = e.clipboardData;
    const image = Array.from(dt.files ?? []).find((f) => f.type.startsWith("image/"));
    if (image) {
      e.preventDefault();
      offerImageUpload(image);
      return;
    }
    const html = dt.getData("text/html");
    if (html) {
      e.preventDefault();
      insertCleaned(html);
    }
    // Plain text: the browser's own paste is already safe.
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (internalDrag.current) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    const image = files.find((f) => f.type.startsWith("image/"));
    if (image) {
      e.preventDefault();
      offerImageUpload(image);
      return;
    }
    if (files.length) {
      e.preventDefault();
      toast.info("Add documents as attachments", "Use the Attachments section below the message.");
      return;
    }
    const html = e.dataTransfer.getData("text/html");
    if (html) {
      e.preventDefault();
      const r = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      if (r) savedRange.current = r;
      insertCleaned(html);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      refreshTools();
      openLink();
    }
  };

  const off = source;

  return (
    <div className={cn("overflow-hidden rounded-md border bg-white transition-colors duration-micro focus-within:ring-2 motion-reduce:transition-none", invalid ? "border-danger focus-within:ring-danger/20" : "border-line focus-within:border-navy focus-within:ring-navy/20", className)}>
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Formatting"
        aria-controls={source ? sourceId : id}
        onKeyDown={onToolbarKeyDown}
        onFocus={onToolbarFocus}
        className="scrollbar-thin relative flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-line bg-surface/60 px-1.5 py-1.5 sm:flex-wrap sm:overflow-x-visible"
      >
        <ToolButton label="Undo" shortcut="Control+Z" icon={<Undo2 className="h-4 w-4" />} onClick={() => exec("undo")} disabled={off} />
        <ToolButton label="Redo" shortcut="Control+Y" icon={<Redo2 className="h-4 w-4" />} onClick={() => exec("redo")} disabled={off} />
        <Sep />
        <ToolSelect label="Text style" value={tools.block} options={BLOCKS} onChange={(v) => exec("formatBlock", `<${v}>`)} disabled={off} className="w-32" />
        <ToolSelect label="Font size" value="" placeholder="Size" options={FONT_SIZES} onChange={applyFontSize} disabled={off} className="w-24" />
        <Sep />
        <ToolButton label="Bold" shortcut="Control+B" pressed={tools.bold} icon={<Bold className="h-4 w-4" />} onClick={() => exec("bold")} disabled={off} />
        <ToolButton label="Italic" shortcut="Control+I" pressed={tools.italic} icon={<Italic className="h-4 w-4" />} onClick={() => exec("italic")} disabled={off} />
        <ToolButton label="Underline" shortcut="Control+U" pressed={tools.underline} icon={<Underline className="h-4 w-4" />} onClick={() => exec("underline")} disabled={off} />
        <ToolButton label="Strikethrough" pressed={tools.strike} icon={<Strikethrough className="h-4 w-4" />} onClick={() => exec("strikeThrough")} disabled={off} />
        <ColorTool label="Text colour" icon={<Baseline className="h-4 w-4" />} initial="#12357a" onPick={(c) => applyColor("foreColor", c)} disabled={off} />
        <ColorTool label="Highlight colour" icon={<Highlighter className="h-4 w-4" />} initial="#fff3a3" onPick={(c) => applyColor("hiliteColor", c)} disabled={off} />
        <Sep />
        <ToolButton label="Align left" pressed={tools.align === "left"} icon={<AlignLeft className="h-4 w-4" />} onClick={() => exec("justifyLeft")} disabled={off} />
        <ToolButton label="Align centre" pressed={tools.align === "center"} icon={<AlignCenter className="h-4 w-4" />} onClick={() => exec("justifyCenter")} disabled={off} />
        <ToolButton label="Align right" pressed={tools.align === "right"} icon={<AlignRight className="h-4 w-4" />} onClick={() => exec("justifyRight")} disabled={off} />
        <ToolButton label="Justify" pressed={tools.align === "justify"} icon={<AlignJustify className="h-4 w-4" />} onClick={() => exec("justifyFull")} disabled={off} />
        <Sep />
        <ToolButton label="Bulleted list" pressed={tools.ul} icon={<List className="h-4 w-4" />} onClick={() => exec("insertUnorderedList")} disabled={off} />
        <ToolButton label="Numbered list" pressed={tools.ol} icon={<ListOrdered className="h-4 w-4" />} onClick={() => exec("insertOrderedList")} disabled={off} />
        <Sep />
        <ToolButton label={tools.link ? "Edit link" : "Insert link"} shortcut="Control+K" pressed={tools.link} icon={<Link2 className="h-4 w-4" />} onClick={openLink} disabled={off} />
        <ToolButton label="Insert image" icon={<ImagePlus className="h-4 w-4" />} onClick={() => openDialog({ kind: "image", file: null })} disabled={off} />
        <ToolButton label="Insert table" icon={<Table2 className="h-4 w-4" />} onClick={() => openDialog({ kind: "table" })} disabled={off} />
        <ToolButton label="Insert button (call to action)" icon={<MousePointerClick className="h-4 w-4" />} onClick={() => openDialog({ kind: "cta" })} disabled={off} />
        <ToolButton label="Insert divider" icon={<Minus className="h-4 w-4" />} onClick={() => insertHtml('<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0"><p><br></p>')} disabled={off} />
        <Sep />
        <ToolSelect label="Line spacing" value="" placeholder="Spacing" options={LINE_HEIGHTS} onChange={applyLineHeight} disabled={off} className="w-28" />
        <ToolButton label="Insert blank space" icon={<UnfoldVertical className="h-4 w-4" />} onClick={() => insertHtml('<div style="height:24px;line-height:24px">&nbsp;</div>')} disabled={off} />
        <Sep />
        <ToolButton label="Clear formatting" icon={<RemoveFormatting className="h-4 w-4" />} onClick={() => exec("removeFormat")} disabled={off} />
        <ToolButton label="Edit HTML source" pressed={source} icon={<CodeXml className="h-4 w-4" />} onClick={toggleSource} />

        {tools.table && !source && (
          <div role="group" aria-label="Table" className="flex shrink-0 items-center gap-1 sm:basis-full sm:border-t sm:border-line sm:pt-1.5">
            <Sep />
            <span className="shrink-0 px-1 text-caption font-semibold text-muted">Table</span>
            <ToolButton label="Add row below" icon={<BetweenHorizontalStart className="h-4 w-4" />} onClick={() => tableOp("row")} />
            <ToolButton label="Add column to the right" icon={<BetweenVerticalStart className="h-4 w-4" />} onClick={() => tableOp("col")} />
            <ToolButton label="Delete row" icon={<Rows3 className="h-4 w-4" />} onClick={() => tableOp("delRow")} />
            <ToolButton label="Delete column" icon={<Columns3 className="h-4 w-4" />} onClick={() => tableOp("delCol")} />
            <ToolButton label="Delete table" icon={<Trash2 className="h-4 w-4" />} onClick={() => tableOp("delTable")} />
          </div>
        )}
      </div>

      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        contentEditable={!source}
        suppressContentEditableWarning
        spellCheck
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragStart={() => {
          internalDrag.current = true;
        }}
        onDragEnd={() => {
          internalDrag.current = false;
        }}
        onKeyDown={onKeyDown}
        className={cn(
          source && "hidden",
          "relative max-h-[70vh] min-h-72 overflow-y-auto px-4 py-3 text-base outline-none sm:text-[15px]",
          "before:pointer-events-none before:absolute before:top-3 before:left-4 before:text-muted/70 data-[empty=true]:before:content-[attr(data-placeholder)]",
          EMAIL_PROSE
        )}
      />
      <label htmlFor={sourceId} className="sr-only">
        HTML source
      </label>
      <textarea
        ref={sourceRef}
        id={sourceId}
        spellCheck={false}
        aria-describedby={describedBy}
        onChange={(e) => {
          lastEmitted.current = e.target.value;
          onChangeRef.current(e.target.value);
        }}
        className={cn(source ? "block" : "hidden", "max-h-[70vh] min-h-72 w-full resize-y bg-[#0f1b33] px-4 py-3 font-mono text-[13px] leading-relaxed text-[#e5ecff] outline-none")}
      />
      {source && <p className="border-t border-line bg-surface/60 px-4 py-2 text-caption text-muted">Scripts, forms, embedded frames and event handlers are always removed when the email is previewed, saved or sent.</p>}

      {dialog?.kind === "link" && <LinkDialog key={dialogKey} open={dialogOpen} onClose={closeDialog} initial={dialog.initial} editing={dialog.editing} onSubmit={submitLink} onRemove={removeLink} />}
      {dialog?.kind === "image" && <ImageDialog key={dialogKey} open={dialogOpen} onClose={closeDialog} initialFile={dialog.file} onSubmit={submitImage} />}
      {dialog?.kind === "table" && <TableDialog key={dialogKey} open={dialogOpen} onClose={closeDialog} onSubmit={submitTable} />}
      {dialog?.kind === "cta" && <CtaDialog key={dialogKey} open={dialogOpen} onClose={closeDialog} onSubmit={submitCta} />}
    </div>
  );
}
