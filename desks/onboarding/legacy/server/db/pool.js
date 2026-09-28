import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let pool = null;

function buildPoolConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  // Unix socket form: postgresql:///dbname (local peer auth)
  const socketMatch = url.match(/^postgres(?:ql)?:\/\/\/([^?]+)/);
  if (socketMatch) {
    return {
      host: process.env.PG_SOCKET_DIR || '/var/run/postgresql',
      database: socketMatch[1],
      user: process.env.PGUSER || process.env.USER,
    };
  }

  return {
    connectionString: url,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
}

export function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new pg.Pool(buildPoolConfig());
  }
  return pool;
}

export async function initDb() {
  const db = getPool();
  if (!db) {
    console.warn('DATABASE_URL not set — running without PostgreSQL (localStorage only on client)');
    return false;
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await db.query(schema);
  await db.query('ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE');
  console.log('PostgreSQL connected and schema ready');
  return true;
}

export async function query(text, params) {
  const db = getPool();
  if (!db) throw new Error('Database not configured');
  return db.query(text, params);
}
