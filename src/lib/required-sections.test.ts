/**
 * Unit tests for the sign-off requirement helper — pure, no I/O.
 */
import { describe, it, expect } from "vitest";

import {
  REQUIRED_SECTION_IDS,
  requiredSectionsComplete,
} from "./required-sections";

/** The checkpoint ids for the three required sections. */
const ALL_REQUIRED = REQUIRED_SECTION_IDS.map((id) => `section-${id}`);

describe("requiredSectionsComplete", () => {
  it("is true when every required section's checkpoint is passed", () => {
    expect(requiredSectionsComplete(new Set(ALL_REQUIRED))).toBe(true);
  });

  it("accepts a plain array (not only a Set)", () => {
    expect(requiredSectionsComplete(ALL_REQUIRED)).toBe(true);
  });

  it("is false when any one required checkpoint is missing", () => {
    for (const missing of ALL_REQUIRED) {
      const passed = ALL_REQUIRED.filter((id) => id !== missing);
      expect(requiredSectionsComplete(passed)).toBe(false);
    }
  });

  it("is false with no checkpoints passed", () => {
    expect(requiredSectionsComplete([])).toBe(false);
  });

  it("ignores unrelated passed checkpoints", () => {
    const passed = [...ALL_REQUIRED, "section-branding", "section-faqs"];
    expect(requiredSectionsComplete(passed)).toBe(true);
    expect(requiredSectionsComplete(["section-branding", "section-faqs"])).toBe(
      false,
    );
  });
});
