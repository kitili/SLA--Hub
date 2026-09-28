/**
 * Tests for the plan page's markdown fallback renderer.
 *
 * The round-trip case is the load-bearing one: `renderLessonMarkdown` (the
 * writer) emits `**bold**` / `*italic*` emphasis, and this fallback is exactly
 * what a stored plan degrades to when its `content_json` no longer satisfies
 * `structuredLessonPlanSchema` — so the writer's dialect must render without
 * visible asterisks.
 *
 * No DOM: the produced React element tree is walked directly.
 */
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { renderLessonMarkdown } from "@/lib/ai/lessonPlan/renderMarkdown";
import { VALID_PLAN } from "../../../test/fixtures/structuredPlan";
import { markdownToReact } from "./markdownToReact";

/** Collect the concatenated text content of a React node tree. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return "";
}

/** Collect every element type (tag name) present in a React node tree. */
function tagsOf(node: ReactNode): string[] {
  if (node == null || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(tagsOf);
  if (isValidElement<{ children?: ReactNode }>(node)) {
    const own = typeof node.type === "string" ? [node.type] : [];
    return [...own, ...tagsOf(node.props.children)];
  }
  return [];
}

describe("markdownToReact — block structure", () => {
  it("renders headings, lists, and paragraphs", () => {
    const nodes = markdownToReact("# Title\n\n- one\n- two\n\nA paragraph.");
    const tags = tagsOf(nodes);
    expect(tags).toContain("h2"); // level 1 → h2 (page owns the h1)
    expect(tags).toContain("ul");
    expect(tags).toContain("p");
    expect(textOf(nodes)).toContain("A paragraph.");
  });
});

describe("markdownToReact — inline emphasis", () => {
  it("renders **bold** as <strong> and *italic* as <em>", () => {
    const nodes = markdownToReact("- **Lead:** *detail text*");
    expect(tagsOf(nodes)).toEqual(expect.arrayContaining(["ul", "li", "strong", "em"]));
    const text = textOf(nodes);
    expect(text).toContain("Lead:");
    expect(text).toContain("detail text");
    expect(text).not.toContain("*");
  });

  it("leaves unmatched asterisks as plain text", () => {
    expect(textOf(markdownToReact("2 * 3 = 6"))).toBe("2 * 3 = 6");
  });
});

describe("markdownToReact — round-trips renderLessonMarkdown output", () => {
  it("renders the writer's markdown without visible emphasis markers", () => {
    const md = renderLessonMarkdown(VALID_PLAN);
    // Preconditions: the writer really does emit the emphasis dialect.
    expect(md).toContain("**");
    expect(md).toContain("*Sentence frame:*");

    const nodes = markdownToReact(md);
    const text = textOf(nodes);
    expect(text).not.toContain("**");
    expect(text).not.toContain("*Sentence frame:*");
    // The emphasised content itself still renders.
    expect(text).toContain("Sentence frame:");
    expect(text).toContain(VALID_PLAN.misconceptions[0]!.misconception);
    expect(tagsOf(nodes)).toEqual(expect.arrayContaining(["strong", "em"]));
  });
});
