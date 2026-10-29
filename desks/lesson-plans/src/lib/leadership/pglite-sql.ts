import type { PGlite } from "@electric-sql/pglite";

import type { LeadershipSql } from "./store";

/** Test helper: the Neon tagged-template + transaction surface, over PGlite. */
export function pgliteSql(db: PGlite): LeadershipSql {
  type Query = PromiseLike<unknown[]> & { text: string; values: unknown[] };
  const build = (strings: TemplateStringsArray, values: unknown[]): Query => {
    const text = strings.reduce((acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""), "");
    const run = async () => (await db.query(text, values as unknown[])).rows as unknown[];
    return {
      text,
      values,
      then: (resolve, reject) => run().then(resolve, reject),
    } as Query;
  };
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => build(strings, values)) as unknown as LeadershipSql;
  sql.transaction = async (queries) => {
    const list = queries as unknown as Query[];
    return db.transaction(async (tx) => {
      const out: unknown[] = [];
      for (const q of list) out.push((await tx.query(q.text, q.values as unknown[])).rows);
      return out;
    });
  };
  return sql;
}
