/**
 * Tests for the OpenRouter model catalogue parsing in model.ts.
 *
 * `listModels` is the one impure export (it fetches /models), so we stub
 * `global.fetch` and assert the capability-flag derivation + price/context
 * normalisation. `server-only` is shimmed by the Vitest config.
 *
 * `listModels` caches its result in-module for ~1h, so each test re-imports the
 * module via `vi.resetModules()` + dynamic import to start from a cold cache.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Build a fake /models response with the real OpenRouter field shape. */
function fakeModelsResponse(data: unknown[]): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data }),
  } as unknown as Response;
}

/** Re-import model.ts with a cold module cache (so listModels re-fetches). */
async function freshListModels() {
  vi.resetModules();
  const mod = await import("./model");
  return mod.listModels;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("listModels", () => {
  it("derives capability flags and normalises pricing/context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeModelsResponse([
          {
            id: "vendor/vision-structured",
            name: "Vision Structured",
            context_length: 200000,
            pricing: { prompt: "0.000001", completion: "0.000002" },
            architecture: { input_modalities: ["text", "image"] },
            supported_parameters: ["response_format", "tools"],
          },
          {
            id: "vendor/text-only",
            name: "Text Only",
            context_length: null,
            pricing: { prompt: "", completion: "" },
            architecture: { input_modalities: ["text"] },
            supported_parameters: ["temperature"],
          },
        ]),
      ),
    );

    const listModels = await freshListModels();
    const models = await listModels();
    const byId = new Map(models.map((m) => [m.id, m]));

    const vision = byId.get("vendor/vision-structured");
    expect(vision).toBeDefined();
    expect(vision?.supportsVision).toBe(true);
    expect(vision?.supportsStructured).toBe(true);
    expect(vision?.contextLength).toBe(200000);
    expect(vision?.promptPrice).toBeCloseTo(0.000001);
    expect(vision?.completionPrice).toBeCloseTo(0.000002);

    const text = byId.get("vendor/text-only");
    expect(text).toBeDefined();
    expect(text?.supportsVision).toBe(false);
    expect(text?.supportsStructured).toBe(false);
    expect(text?.contextLength).toBe(0);
    expect(text?.promptPrice).toBe(0);
  });

  it("treats structured_outputs as a structured-capable signal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeModelsResponse([
          {
            id: "vendor/structured-outputs",
            name: "Structured Outputs",
            supported_parameters: ["structured_outputs"],
            architecture: { input_modalities: ["text"] },
          },
        ]),
      ),
    );

    const listModels = await freshListModels();
    const models = await listModels();
    expect(models[0]?.supportsStructured).toBe(true);
  });
});
