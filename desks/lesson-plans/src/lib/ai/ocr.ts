import "server-only";

/**
 * Vision OCR for textbook pages (AI Studio v2).
 *
 * Given a rendered page image (PNG/JPEG bytes), extract the verbatim page text
 * plus light structure (chapter, heading, keywords) using a multimodal model
 * via the AI SDK's `generateObject`. The model is the OpenRouter vision slug
 * resolved by {@link getVisionModel} (default {@link OCR_MODEL_ID}); the caller
 * receives the model id actually used so it can persist `ocrModel`.
 *
 * This module is `server-only`: it builds a provider model from env and is only
 * ever called from an ingest STEP (full Node access), never the workflow body.
 *
 * @see ./model.ts
 * @see ../textbook/ingest.ts
 */
import { generateObject } from "ai";
import { z } from "zod";

import { getVisionModel, OCR_MODEL_ID } from "./model";

/** Structured result of OCR-ing a single textbook page. */
export interface OcrPageResult {
  /** Verbatim page text. */
  content: string;
  /** Chapter title if visible on the page, else null. */
  chapter: string | null;
  /** Page/section heading if visible, else null. */
  heading: string | null;
  /** 3-8 salient keywords for search / disambiguation. */
  keywords: string[];
}

/** Zod schema mirroring {@link OcrPageResult} for `generateObject`. */
const ocrPageSchema = z.object({
  content: z
    .string()
    .describe("Verbatim text of the page, preserving reading order."),
  chapter: z
    .string()
    .nullable()
    .describe("Chapter title if visible on the page, otherwise null."),
  heading: z
    .string()
    .nullable()
    .describe("Page or section heading if visible, otherwise null."),
  keywords: z
    .array(z.string())
    .describe("3-8 salient keywords summarising the page's topic."),
});

/** A page image to OCR, in a runtime-portable shape (no web `File`). */
export interface OcrImageInput {
  /** Raw image bytes (e.g. a rendered page PNG). */
  data: Buffer | Uint8Array;
  /** IANA media type, e.g. "image/png". */
  mediaType: string;
}

const OCR_INSTRUCTION =
  "Extract this textbook page. " +
  "`content` = verbatim page text; " +
  "`chapter` = chapter title if visible else null; " +
  "`heading` = page/section heading if visible else null; " +
  "`keywords` = 3-8 salient keywords.";

/**
 * OCR a single page image into structured {@link OcrPageResult} text.
 *
 * Uses `generateObject` with a vision model and a user message that pairs the
 * extraction instruction (text part) with the page image (image part, AI SDK v6
 * `{ type: "image", image, mediaType }` shape). Returns the parsed object plus
 * the resolved model id so the caller can record provenance.
 *
 * Errors (model/network) propagate to the caller, which — inside an ingest STEP
 * — gets the workflow's retry semantics for free. Gate on `hasApiKey()` first.
 *
 * @param image The page image bytes + media type.
 * @param opts.modelId Optional OpenRouter vision slug override.
 */
export async function ocrPage(
  image: OcrImageInput,
  opts?: { modelId?: string },
): Promise<OcrPageResult & { modelId: string }> {
  const modelId = opts?.modelId ?? OCR_MODEL_ID;

  const { object } = await generateObject({
    model: getVisionModel(modelId),
    schema: ocrPageSchema,
    schemaName: "textbook_page",
    schemaDescription: "Structured OCR of a single textbook page.",
    system:
      "You are a meticulous OCR engine for school textbooks. Transcribe the " +
      "page exactly as printed, preserving reading order. Do not summarise, " +
      "translate, or invent content. If a field is not visible on the page, " +
      "return null for it.",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: OCR_INSTRUCTION },
          { type: "image", image: image.data, mediaType: image.mediaType },
        ],
      },
    ],
  });

  return {
    content: object.content,
    chapter: object.chapter,
    heading: object.heading,
    keywords: object.keywords,
    modelId,
  };
}
