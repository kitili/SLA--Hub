/**
 * parsePartial — best-effort parse of a partially-streamed JSON object.
 *
 * The load-bearing half of the streaming contract with `/api/ai/generate`: the
 * route streams the raw `streamObject` text and the Studio client re-parses the
 * accumulated buffer after every chunk so the preview can fill in
 * field-by-field. Repairs the usual truncation artefacts — a dangling string is
 * closed, a trailing comma dropped, and every unclosed `{`/`[` closed in stack
 * order. Returns `null` until the (repaired) buffer parses, so callers simply
 * keep the previous draft on screen.
 *
 * Escape handling matters: a `\"` inside a streamed string must not flip the
 * in-string state, otherwise brackets inside prose would corrupt the stack and
 * blank the preview. Truncation in the middle of an escape sequence is not
 * repairable — the attempt below yields invalid JSON and the function returns
 * null for that chunk (the next chunk completes the sequence).
 *
 * Pure module (no React, no `server-only`) so the client can import it and
 * vitest can exercise it directly.
 */
import type { StructuredLessonPlan } from "./structuredSchema";

export function parsePartial(text: string): Partial<StructuredLessonPlan> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Partial<StructuredLessonPlan>;
  } catch {
    /* repair below */
  }
  let repaired = trimmed;
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  for (let i = 0; i < repaired.length; i += 1) {
    const ch = repaired[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inString) repaired += '"';
  repaired = repaired.replace(/,\s*$/, "");
  while (stack.length) repaired += stack.pop();
  try {
    return JSON.parse(repaired) as Partial<StructuredLessonPlan>;
  } catch {
    return null;
  }
}
