/**
 * CLI: import a Google Form / Sheet CSV onto the hiring board.
 *
 *   npm run hiring:import-csv -- path/to/responses.csv
 */
import fs from "node:fs";
import path from "node:path";

import { importCandidatesFromCsv } from "../../hiring/pipeline";

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    throw new Error("Usage: npm run hiring:import-csv -- path/to/form-responses.csv");
  }
  const csvText = fs.readFileSync(path.resolve(file), "utf8");
  const result = await importCandidatesFromCsv(csvText);
  console.log(
    `[hiring:import-csv] imported=${result.imported} skipped=${result.skipped} errors=${result.errors.length}`,
  );
  for (const err of result.errors) console.error(" ", err);
  if (result.errors.length && result.imported === 0) process.exit(1);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[hiring:import-csv] failed:", err);
  process.exit(1);
});
