import "server-only";

/**
 * AI model wiring for the AI Studio vertical.
 *
 * The provider model is built lazily (per call) from environment so importing
 * this module never throws when the key is absent — the route handler and UI
 * degrade gracefully instead. We talk to OpenRouter via the AI SDK provider so
 * the rest of the code uses the standard `ai` core functions (`streamObject`,
 * `generateObject`).
 *
 * This module is `server-only`: it reads `OPENROUTER_API_KEY` at call time and
 * is imported only from steps / route handlers (full Node access), never from a
 * workflow body or a Client Component.
 *
 * Env:
 *   OPENROUTER_API_KEY — required to actually generate (see {@link hasApiKey}).
 *   AI_MODEL_ID        — optional override for the OpenRouter text model slug.
 *   AI_OCR_MODEL_ID    — optional override for the OpenRouter vision/OCR slug.
 */
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

import { env } from "@/lib/env";

/**
 * Default text-model slug. DeepSeek V4 Pro on OpenRouter supports structured
 * outputs / tools (the path `streamObject`/`generateObject` rely on), has a
 * 1M-token context window and is inexpensive. Override with the AI_MODEL_ID env
 * var to point at any other structured-output-capable OpenRouter model (e.g.
 * deepseek/deepseek-v4-flash for cheaper batch runs, or anthropic/claude-opus-4.8
 * for max quality).
 *
 * This is the FALLBACK, not the last word: an admin can pick a model in AI
 * Studio → Settings, which wins. Generation resolves the effective slug through
 * `resolveGenerationModelId` (`./modelSetting`) — use that, not this const,
 * anywhere the model actually matters.
 *
 * NOTE: DEPLOYMENT.md and .env.example state this default by name — update
 * them when changing the slug here.
 */
export const MODEL_ID: string =
  env.AI_MODEL_ID || "deepseek/deepseek-v4-pro";

/**
 * Default vision/OCR-model slug. Gemini 3.5 Flash is a cheap, fast multimodal
 * model with strong document-OCR quality and structured-output support, which
 * the {@link ../ai/ocr} page extractor relies on. Override with AI_OCR_MODEL_ID.
 */
export const OCR_MODEL_ID: string =
  env.AI_OCR_MODEL_ID || "google/gemini-3.5-flash";

/** True when an OpenRouter key is configured. Cheap, no network. */
export function hasApiKey(): boolean {
  return Boolean(env.OPENROUTER_API_KEY);
}

/**
 * Does a provider/model error message look like a rate limit? OpenRouter (and
 * the upstream providers it proxies) report rate limits as message text rather
 * than a typed error, so callers sniff the message to decide between their
 * retry mechanisms (HTTP 429 in the batch route, `RetryableError` in the
 * textbook-ingest workflow). Shared here so the heuristic can't drift.
 */
export function isRateLimitMessage(message: string): boolean {
  return /rate.?limit|429|too many requests/i.test(message);
}

/**
 * Static metadata for a curated model, used as a fallback before (or without) a
 * live OpenRouter catalogue. Context/price here are indicative — when a key is
 * configured the live catalogue overrides them with the real account-scoped
 * values (see {@link listCuratedModels}).
 */
interface CuratedModelSeed {
  id: string;
  name: string;
  contextLength: number;
  promptPrice: number;
  completionPrice: number;
}

/**
 * A short, hand-picked list of modern OpenRouter models that all support
 * structured outputs (so they're safe for `streamObject`/`generateObject`).
 * This is what the AI Studio model-picker offers instead of OpenRouter's full
 * ~300-model catalogue: a few good choices the user actually wants to pick
 * between. {@link MODEL_ID} (the default) is included so the pre-selected model
 * is always present. Prices are per-token USD (× 1e6 for the per-M labels).
 */
export const CURATED_MODELS: readonly CuratedModelSeed[] = [
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek: V4 Pro",
    contextLength: 1_000_000,
    promptPrice: 0.0000004,
    completionPrice: 0.0000012,
  },
  {
    id: "deepseek/deepseek-v4-flash",
    name: "DeepSeek: V4 Flash",
    contextLength: 1_000_000,
    promptPrice: 0.0000001,
    completionPrice: 0.0000003,
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Anthropic: Claude Sonnet 4.6",
    contextLength: 200_000,
    promptPrice: 0.000003,
    completionPrice: 0.000015,
  },
  {
    id: "anthropic/claude-opus-4.8",
    name: "Anthropic: Claude Opus 4.8",
    contextLength: 200_000,
    promptPrice: 0.000005,
    completionPrice: 0.000025,
  },
  {
    id: "google/gemini-3.5-pro",
    name: "Google: Gemini 3.5 Pro",
    contextLength: 1_000_000,
    promptPrice: 0.00000125,
    completionPrice: 0.00001,
  },
  {
    id: "openai/gpt-5.1",
    name: "OpenAI: GPT-5.1",
    contextLength: 400_000,
    promptPrice: 0.00000125,
    completionPrice: 0.00001,
  },
];

/**
 * Build an OpenRouter provider model for an arbitrary slug (defaults to
 * {@link MODEL_ID}).
 *
 * Throws if called without a key — callers MUST gate on {@link hasApiKey} first
 * (the route handler returns a friendly 400 in that case).
 *
 * @param modelId Optional OpenRouter slug; falls back to {@link MODEL_ID}.
 */
export function getModel(modelId: string = MODEL_ID): LanguageModel {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set");
  }
  const openrouter = createOpenRouter({ apiKey });
  return openrouter(modelId);
}

/**
 * Build an OpenRouter provider model for vision/OCR work (defaults to
 * {@link OCR_MODEL_ID}). Same lazy/throw semantics as {@link getModel}; the
 * returned model is a normal `LanguageModel` — the multimodal capability is a
 * property of the chosen slug, not a different SDK surface.
 *
 * @param modelId Optional OpenRouter slug; falls back to {@link OCR_MODEL_ID}.
 */
export function getVisionModel(modelId: string = OCR_MODEL_ID): LanguageModel {
  return getModel(modelId);
}

/**
 * A normalised view of an OpenRouter catalogue entry, with the two capability
 * flags the AI Studio UI cares about derived up front so callers never have to
 * re-parse OpenRouter's raw `/models` shape.
 */
export interface OpenRouterModel {
  /** Slug, e.g. "deepseek/deepseek-v4-pro". */
  id: string;
  /** Human label, e.g. "DeepSeek: V4 Pro". */
  name: string;
  /** Maximum context window in tokens (0 if unknown). */
  contextLength: number;
  /** USD price per prompt token (as reported; "" → 0). */
  promptPrice: number;
  /** USD price per completion token (as reported; "" → 0). */
  completionPrice: number;
  /** Supports structured outputs / tool calling (safe for `generateObject`). */
  supportsStructured: boolean;
  /** Accepts image inputs (safe as an OCR/vision model). */
  supportsVision: boolean;
}

/** Raw shape of one entry in OpenRouter's GET /api/v1/models response. */
interface RawOpenRouterModel {
  id?: string;
  name?: string;
  context_length?: number | null;
  pricing?: {
    prompt?: string | number | null;
    completion?: string | number | null;
  } | null;
  architecture?: {
    input_modalities?: string[] | null;
    modality?: string | null;
  } | null;
  supported_parameters?: string[] | null;
}

/** Module-level cache for the model catalogue (~1h TTL). */
let modelCache: { at: number; models: OpenRouterModel[] } | null = null;

/** How long a fetched catalogue is reused before re-fetching. */
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Parse OpenRouter's stringy price into a number; "" / null → 0. */
function toPrice(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Normalise one raw catalogue entry, deriving the capability flags. */
function normaliseModel(raw: RawOpenRouterModel): OpenRouterModel | null {
  if (!raw.id) return null;

  const params = (raw.supported_parameters ?? []).map((p) => p.toLowerCase());
  const supportsStructured =
    params.includes("response_format") ||
    params.includes("structured_outputs") ||
    params.includes("tools");

  const modalities = (raw.architecture?.input_modalities ?? []).map((m) =>
    m.toLowerCase(),
  );
  const supportsVision = modalities.includes("image");

  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    contextLength: raw.context_length ?? 0,
    promptPrice: toPrice(raw.pricing?.prompt),
    completionPrice: toPrice(raw.pricing?.completion),
    supportsStructured,
    supportsVision,
  };
}

/**
 * Fetch and cache the OpenRouter model catalogue (GET /api/v1/models).
 *
 * Sends the OpenRouter key as a Bearer token when present (the endpoint is
 * public, but an authed call returns account-scoped availability). The result
 * is cached in-module for ~1h; `Date.now()` is fine here because this runs at
 * runtime (route handler / RSC), never inside the deterministic workflow body.
 *
 * On a network/HTTP error a stale cache is returned if available, otherwise the
 * error propagates so the caller can surface it.
 */
export async function listModels(): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (modelCache && now - modelCache.at < MODEL_CACHE_TTL_MS) {
    return modelCache.models;
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = env.OPENROUTER_API_KEY;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let models: OpenRouterModel[];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers,
    });
    if (!res.ok) {
      throw new Error(`OpenRouter /models returned ${res.status}`);
    }
    const json = (await res.json()) as { data?: RawOpenRouterModel[] };
    const raw = Array.isArray(json.data) ? json.data : [];
    models = raw
      .map(normaliseModel)
      .filter((m): m is OpenRouterModel => m !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    // Serve a stale catalogue rather than failing the whole UI if we have one.
    if (modelCache) return modelCache.models;
    throw err;
  }

  modelCache = { at: now, models };
  return models;
}

/**
 * The model list the AI Studio picker should show: the curated {@link
 * CURATED_MODELS} shortlist, enriched with live context/price data when an
 * OpenRouter key is configured.
 *
 * - With a key: fetch the live catalogue and return the curated slugs that
 *   actually exist and still support structured outputs, using their real
 *   account-scoped context/pricing. If none match (e.g. all renamed) or the
 *   fetch fails, fall back to the static seeds so the picker is never empty.
 * - Without a key: return the static seeds (generation is disabled, but the
 *   user can still see and choose between the modern options).
 *
 * Unlike {@link listModels}, this never returns an empty array.
 */
export async function listCuratedModels(): Promise<OpenRouterModel[]> {
  if (hasApiKey()) {
    try {
      const live = await listModels();
      const byId = new Map(live.map((m) => [m.id, m]));
      const matched = CURATED_MODELS.map((seed) => byId.get(seed.id)).filter(
        (m): m is OpenRouterModel => m != null && m.supportsStructured,
      );
      if (matched.length > 0) return matched;
    } catch {
      // Fall through to the static seeds below.
    }
  }

  return CURATED_MODELS.map((seed) => ({
    ...seed,
    supportsStructured: true,
    supportsVision: false,
  }));
}
