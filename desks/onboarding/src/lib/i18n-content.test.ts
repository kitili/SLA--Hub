/**
 * Unit tests for resolveLocalized() — the bilingual column resolver.
 *
 * Verifies: SW-present, EN-fallback on null/empty SW, and edge cases.
 */
import { describe, it, expect } from "vitest";
import { resolveLocalized } from "./i18n-content";

describe("resolveLocalized", () => {
  const row = {
    title_en: "Welcome",
    title_sw: "Karibu",
    description_en: "The intro section",
    description_sw: null,
  };

  it("returns the SW value when present and non-empty", () => {
    expect(resolveLocalized(row, "title", "sw")).toBe("Karibu");
  });

  it("returns the EN value when locale is en", () => {
    expect(resolveLocalized(row, "title", "en")).toBe("Welcome");
  });

  it("falls back to EN when SW is null", () => {
    // description_sw is null → should return description_en
    expect(resolveLocalized(row, "description", "sw")).toBe("The intro section");
  });

  it("falls back to EN when SW is an empty string", () => {
    const r = { title_en: "Hello", title_sw: "" };
    expect(resolveLocalized(r, "title", "sw")).toBe("Hello");
  });

  it("returns undefined when both EN and SW are null", () => {
    const r = { note_en: null, note_sw: null };
    expect(resolveLocalized(r, "note", "sw")).toBeUndefined();
  });

  it("returns undefined when both EN and SW are empty strings", () => {
    const r = { note_en: "", note_sw: "" };
    expect(resolveLocalized(r, "note", "sw")).toBeUndefined();
  });

  it("returns undefined when the field columns are absent from the row", () => {
    const r = {};
    expect(resolveLocalized(r, "title", "sw")).toBeUndefined();
  });

  it("returns EN when EN is present and SW is undefined (key missing)", () => {
    const r = { title_en: "Only English" };
    expect(resolveLocalized(r, "title", "sw")).toBe("Only English");
  });

  it("returns SW even when EN is null (SW is authoritative if provided)", () => {
    const r = { title_en: null, title_sw: "Karibu" } as unknown as {
      title_en: string;
      title_sw: string | null;
    };
    // SW is non-null and non-empty → return it regardless of EN
    expect(resolveLocalized(r, "title", "sw")).toBe("Karibu");
  });
});
