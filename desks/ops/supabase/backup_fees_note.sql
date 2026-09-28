-- Optional: snapshot helper notes for fee sync backup (Day 15)
-- Prefer exporting fee_balances from Supabase dashboard or:
--   copy (select * from fee_balances) to stdout with csv header;
-- Keep a dated CSV under data/fees/backups/ locally (gitignored if sensitive).

-- Mark a successful manual backup row for audit trail when ops exports CSV
insert into public.fee_sync_runs (source, status, rows_upserted, rows_skipped, error_message, finished_at)
values (
  'manual-backup-note',
  'success',
  0,
  0,
  'Remember to export fee_balances CSV before major EdAdmin cutovers',
  now()
);
