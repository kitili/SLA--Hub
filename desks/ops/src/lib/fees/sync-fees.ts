import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseFeeCsv } from "@/lib/fees/parse-csv";
import { createServiceClient } from "@/lib/supabase/admin";
import type { FeeSyncRun } from "@/types/database";

export type SyncFeesResult = {
  run: FeeSyncRun;
  upserted: number;
  skipped: number;
  parseErrors: string[];
};

/**
 * Day 5 stub: upsert fee_balances from CSV text (EdAdmin adapter later).
 */
export async function syncFeesFromCsv(input: {
  csv: string;
  source?: string;
  dryRun?: boolean;
}): Promise<SyncFeesResult> {
  const supabase = createServiceClient();
  const source = input.source ?? "csv";
  const dryRun = Boolean(input.dryRun);

  // Reject overlapping runs (last 30 minutes still "running")
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: active } = await supabase
    .from("fee_sync_runs")
    .select("id, started_at")
    .eq("status", "running")
    .gte("started_at", cutoff)
    .limit(1)
    .maybeSingle();

  if (active) {
    throw new Error(
      `Fee sync already running (run ${active.id} since ${active.started_at})`,
    );
  }

  const { data: runRow, error: runError } = await supabase
    .from("fee_sync_runs")
    .insert({
      source: dryRun ? `${source}:dry-run` : source,
      status: "running",
    })
    .select("*")
    .single();

  if (runError || !runRow) {
    throw new Error(runError?.message ?? "Failed to start fee sync run");
  }

  const { rows, errors: parseErrors } = parseFeeCsv(input.csv);
  let upserted = 0;
  let skipped = 0;
  const runtimeErrors = [...parseErrors];

  try {
    for (const row of rows) {
      let studentId = row.studentId;

      if (!studentId && row.qrCode) {
        const { data: qr } = await supabase
          .from("qr_codes")
          .select("student_id")
          .eq("code", row.qrCode)
          .eq("active", true)
          .maybeSingle();
        studentId = qr?.student_id;
      }

      if (!studentId) {
        skipped += 1;
        continue;
      }

      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("id", studentId)
        .maybeSingle();

      if (!student) {
        skipped += 1;
        runtimeErrors.push(`Unknown student_id ${studentId}`);
        continue;
      }

      if (dryRun) {
        upserted += 1;
        continue;
      }

      const { error } = await supabase.from("fee_balances").upsert(
        {
          student_id: studentId,
          balance: row.balance,
          currency: row.currency || "TZS",
          synced_at: new Date().toISOString(),
        },
        { onConflict: "student_id" },
      );

      if (error) {
        skipped += 1;
        runtimeErrors.push(`${studentId}: ${error.message}`);
        continue;
      }

      upserted += 1;
    }

    const error_message =
      runtimeErrors.length > 0 ? runtimeErrors.slice(0, 20).join("; ") : null;

    const finalStatus =
      upserted === 0 && (rows.length > 0 || runtimeErrors.length > 0)
        ? "failed"
        : "success";

    const { data: finished, error: finishError } = await supabase
      .from("fee_sync_runs")
      .update({
        status: finalStatus,
        rows_upserted: upserted,
        rows_skipped: skipped,
        error_message: dryRun
          ? [`dry-run`, error_message].filter(Boolean).join("; ")
          : error_message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runRow.id)
      .select("*")
      .single();

    if (finishError || !finished) {
      throw new Error(finishError?.message ?? "Failed to finish fee sync run");
    }

    return {
      run: mapRun(finished),
      upserted,
      skipped,
      parseErrors: runtimeErrors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fee sync failed";
    await supabase
      .from("fee_sync_runs")
      .update({
        status: "failed",
        rows_upserted: upserted,
        rows_skipped: skipped,
        error_message: message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runRow.id);
    throw err;
  }
}

export async function loadDefaultFeeCsv(): Promise<string> {
  const filePath = path.join(
    process.cwd(),
    "data/fees/sample-fee-balances.csv",
  );
  return readFile(filePath, "utf8");
}

function mapRun(row: {
  id: string;
  source: string;
  status: string;
  rows_upserted: number;
  rows_skipped: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}): FeeSyncRun {
  return {
    id: row.id,
    source: row.source,
    status: row.status as FeeSyncRun["status"],
    rows_upserted: row.rows_upserted,
    rows_skipped: row.rows_skipped,
    error_message: row.error_message,
    started_at: row.started_at,
    finished_at: row.finished_at,
  };
}
