/**
 * Majundo soft-launch demo route — fixed IDs matching
 * `supabase/seed_majundo_demo_route.sql`.
 *
 * Run order: schema_week2 → seed_silverleaf → seed_routes → seed_majundo_demo_route.
 * Deliberately suboptimal stop order so optimize shows a clear before/after win.
 * Demo uses e200…/f200… IDs so it never collides with real fleet routes (e100…).
 */

export const MAJUNDO_DEMO_ROUTE_ID =
  "e2000000-0000-4000-8000-000000000001" as const;

export const MAJUNDO_DEMO_ROUTE_NAME = "Majundo Soft-Launch Demo AM";

export const MAJUNDO_DEMO_SEED_PATH =
  "supabase/seed_majundo_demo_route.sql" as const;
