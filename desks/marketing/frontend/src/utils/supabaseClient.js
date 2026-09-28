// Browser-side Supabase client, used only for Realtime subscriptions (replaces
// socket.io-client). Uses the public anon key — safe to expose, RLS/broadcast auth
// is handled on Supabase's side, and the app never queries the DB directly from here.
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
