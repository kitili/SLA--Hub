/**
 * Minimal, safe markdown → React elements (the plan page's fallback renderer).
 *
 * Supported, deliberately small: ATX headings (`#`, `##`, `###`), unordered
 * list items (`- ` / `* `), blank-line-separated paragraphs, and the inline
 * `**bold**` / `*italic*` emphasis that `renderLessonMarkdown` (the writer
 * this fallback must round-trip) emits. Everything renders as React nodes —
 * never via dangerouslySetInnerHTML — so any raw HTML / script in the source
 * is shown verbatim, not executed. Other syntax (links, code, …) is left as
 * plain text by design.
 *
 * This is what teachers see whenever `content_json` does not parse as a
 * `StructuredLessonPlan` (see src/app/[locale]/plans/[slug]/page.tsx), so it
 * must at minimum render the writer's own dialect without visible markers.
 *
 * Pure module (no `server-only`, no DB) so it is unit-testable; class names
 * are injected by the caller because styling lives in the page's CSS module.
 */
import type { ReactNode } from "react";

/** Optional CSS-module class names applied to the produced blocks. */
export interface MarkdownClassNames {
  paragraph?: string;
  h2?: string;
  h3?: string;
  h4?: string;
  list?: string;
}

/**
 * Matches one inline emphasis run: `**bold**` first (so its `*`s aren't eaten
 * by the italic branch), then `*italic*`. Kept as a capture group so
 * `String.split` returns the matched tokens interleaved with plain text.
 */
const INLINE_EMPHASIS = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

/** Render `**bold**` / `*italic*` runs inside a line as <strong>/<em>. */
function renderInline(text: string): ReactNode {
  const parts = text.split(INLINE_EMPHASIS);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

/** Transform a markdown string into a list of safe React block elements. */
export function markdownToReact(
  markdown: string,
  classes: MarkdownClassNames = {},
): ReactNode {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  // Buffers for the block currently being accumulated.
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      blocks.push(
        <p key={`p-${blocks.length}`} className={classes.paragraph}>
          {renderInline(text)}
        </p>,
      );
    }
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className={classes.list}>
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    // Blank line → block boundary.
    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    // Headings: ###, ##, # (check the most specific first).
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1]!.length;
      const text = heading[2]!.trim();
      // Map level 1 → h2, level 2 → h3, deeper → h4 (page already owns the h1).
      if (level <= 1) {
        blocks.push(
          <h2 key={`h-${blocks.length}`} className={classes.h2}>
            {renderInline(text)}
          </h2>,
        );
      } else if (level === 2) {
        blocks.push(
          <h3 key={`h-${blocks.length}`} className={classes.h3}>
            {renderInline(text)}
          </h3>,
        );
      } else {
        blocks.push(
          <h4 key={`h-${blocks.length}`} className={classes.h4}>
            {renderInline(text)}
          </h4>,
        );
      }
      continue;
    }

    // Unordered list items: "- " or "* ".
    const listItem = /^[-*]\s+(.*)$/.exec(trimmed);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]!.trim());
      continue;
    }

    // Otherwise: paragraph text (a list run ends here).
    flushList();
    paragraph.push(trimmed);
  }

  // Flush trailing buffers.
  flushParagraph();
  flushList();

  if (blocks.length === 0) {
    return <p className={classes.paragraph}>{markdown}</p>;
  }

  return blocks;
}
