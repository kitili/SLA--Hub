const { Pool } = require('pg');

// On Vercel, each serverless invocation can spin up its own pool — a high `max` here
// multiplied across many concurrent invocations will exhaust Postgres's connection
// limit fast. Point DATABASE_URL at Supabase's transaction-mode pooler (port 6543,
// not the direct connection) and keep this pool small; the pooler absorbs the real
// concurrency upstream. Locally (Docker Postgres, one long-running process) a small
// max is still fine since there's only ever one pool.
const connectionString = process.env.DATABASE_URL || '';
const needsSsl =
  process.env.NODE_ENV === 'production' ||
  /supabase\.co|pooler\.supabase/i.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: process.env.NODE_ENV === 'production' ? 3 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB client error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
