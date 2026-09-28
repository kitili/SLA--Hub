import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("keeps commas and newlines inside quoted Google Form cells", () => {
    const csv = [
      'Full Name,Preferred Email Address,What is your most relevant experience to the role that you are applying for at Silverleaf Academy?',
      '"Jane Doe","jane@example.com","Led a team, then moved.\nSecond paragraph."',
      "John Doe,john@example.com,One line",
    ].join("\n");

    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual([
      "Jane Doe",
      "jane@example.com",
      "Led a team, then moved.\nSecond paragraph.",
    ]);
    expect(rows[2]?.[0]).toBe("John Doe");
  });

  it("strips a BOM and ignores blank lines", () => {
    const rows = parseCsv("\uFEFFa,b\n\n1,2\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
