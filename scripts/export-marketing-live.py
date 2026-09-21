#!/usr/bin/env python3
"""Dump live Marketing (Supabase public schema) as-is into data/marketing-live-export."""

from __future__ import annotations

import csv
import datetime as dt
import decimal
import io
import json
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "marketing-live-export"
ENV_CANDIDATES = [
    Path("/home/kiki/Documents/marketing-and-student-experience-main/backend/.env"),
    ROOT / "desks/marketing/backend/.env",
    Path(os.environ.get("MARKETING_ENV_FILE", "")),
]


def load_database_url() -> str:
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    for path in ENV_CANDIDATES:
        if not path or not path.exists():
            continue
        for line in path.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DATABASE_URL not found (set it or add desks/marketing/backend/.env)")


def json_default(value):
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, memoryview):
        return bytes(value).hex()
    if isinstance(value, (bytes, bytearray)):
        return bytes(value).hex()
    return str(value)


def connect(url: str):
    parsed = urlparse(url)
    conn = psycopg2.connect(url, sslmode="require", connect_timeout=30)
    conn.set_session(readonly=True, autocommit=True)
    return conn, parsed


def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def dump_schema(cur) -> str:
    parts: list[str] = [
        "-- Live Marketing public schema snapshot",
        "-- Generated from production (as-is). Do not commit if it contains live PII.",
        "BEGIN;",
        'CREATE SCHEMA IF NOT EXISTS public;',
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
        'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
        "",
    ]

    cur.execute(
        """
        SELECT t.typname, e.enumlabel, e.enumsortorder
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        ORDER BY t.typname, e.enumsortorder
        """
    )
    enums: dict[str, list[str]] = {}
    for typname, label, _order in cur.fetchall():
        enums.setdefault(typname, []).append(label)
    for typname, labels in enums.items():
        quoted = ", ".join("'" + x.replace("'", "''") + "'" for x in labels)
        parts.append(f"DO $$ BEGIN CREATE TYPE {qident(typname)} AS ENUM ({quoted}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;")
    if enums:
        parts.append("")

    cur.execute(
        """
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname
        """
    )
    tables = [row[0] for row in cur.fetchall()]

    for table in tables:
        cur.execute(
            """
            SELECT a.attname,
                   pg_catalog.format_type(a.atttypid, a.atttypmod) AS typ,
                   a.attnotnull,
                   pg_get_expr(ad.adbin, ad.adrelid) AS def
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_attrdef ad
              ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
            WHERE n.nspname = 'public'
              AND c.relname = %s
              AND a.attnum > 0
              AND NOT a.attisdropped
            ORDER BY a.attnum
            """,
            (table,),
        )
        cols = []
        for name, typ, notnull, default in cur.fetchall():
            piece = f"  {qident(name)} {typ}"
            if default is not None:
                piece += f" DEFAULT {default}"
            if notnull:
                piece += " NOT NULL"
            cols.append(piece)
        parts.append(f"CREATE TABLE IF NOT EXISTS {qident(table)} (\n" + ",\n".join(cols) + "\n);")
        parts.append("")

    cur.execute(
        """
        SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid), contype
        FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace
          AND contype IN ('p','u','f','c')
        ORDER BY CASE contype WHEN 'p' THEN 1 WHEN 'u' THEN 2 WHEN 'c' THEN 3 ELSE 4 END, conname
        """
    )
    for rel, conname, cdef, _ctype in cur.fetchall():
        parts.append(
            f"DO $$ BEGIN ALTER TABLE {rel} ADD CONSTRAINT {qident(conname)} {cdef}; "
            "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
        )
    parts.append("")

    cur.execute(
        """
        SELECT pg_get_indexdef(i.indexrelid)
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND NOT i.indisprimary
        ORDER BY pg_get_indexdef(i.indexrelid)
        """
    )
    for (indexdef,) in cur.fetchall():
        if indexdef.lower().startswith("create "):
            parts.append(indexdef.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS", 1)
                         .replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS", 1) + ";")
        else:
            parts.append(indexdef + ";")
    parts.append("")

    cur.execute(
        """
        SELECT c.relname, pg_get_viewdef(c.oid, true)
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'v'
        ORDER BY c.relname
        """
    )
    for name, viewdef in cur.fetchall():
        parts.append(f"CREATE OR REPLACE VIEW {qident(name)} AS\n{viewdef};")
        parts.append("")

    cur.execute(
        """
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        ORDER BY p.proname, p.oid
        """
    )
    for (oid,) in cur.fetchall():
        cur.execute("SELECT pg_get_functiondef(%s)", (oid,))
        body = cur.fetchone()[0]
        if body:
            parts.append(body + ";")
            parts.append("")

    cur.execute(
        """
        SELECT pg_get_triggerdef(t.oid, true)
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND NOT t.tgisinternal
        ORDER BY c.relname, t.tgname
        """
    )
    for (trig,) in cur.fetchall():
        parts.append(trig + ";")
    parts.append("")
    parts.append("COMMIT;")
    return "\n".join(parts) + "\n"


def dump_table_copy(cur, table: str) -> str:
    buf = io.StringIO()
    cur.copy_expert(
        f"COPY public.{qident(table)} TO STDOUT WITH CSV HEADER NULL '\\N'",
        buf,
    )
    return buf.getvalue()


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return "'" + value.isoformat().replace("'", "''") + "'"
    if isinstance(value, uuid.UUID):
        return "'" + str(value) + "'"
    if isinstance(value, list):
        # postgres text[] / json-ish arrays
        inner = ",".join(sql_literal(v) for v in value)
        return f"ARRAY[{inner}]"
    if isinstance(value, dict):
        return "'" + json.dumps(value, default=json_default).replace("'", "''") + "'::jsonb"
    text = json_default(value)
    return "'" + str(text).replace("'", "''") + "'"


def main() -> None:
    url = load_database_url()
    conn, parsed = connect(url)
    cur = conn.cursor()
    dict_cur = conn.cursor(cursor_factory=RealDictCursor)

    (OUT / "tables").mkdir(parents=True, exist_ok=True)
    (OUT / "sql").mkdir(parents=True, exist_ok=True)

    cur.execute("SELECT current_database(), current_user, version()")
    database, user, version = cur.fetchone()

    schema_sql = dump_schema(cur)
    (OUT / "sql" / "00-public-schema.sql").write_text(schema_sql)

    cur.execute(
        """
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname
        """
    )
    tables = [row[0] for row in cur.fetchall()]

    objects = []
    insert_parts = ["BEGIN;", "SET session_replication_role = replica;", ""]
    total_rows = 0

    for table in tables:
        cur.execute(f"SELECT COUNT(*) FROM public.{qident(table)}")
        count = cur.fetchone()[0]
        csv_text = dump_table_copy(cur, table)
        csv_path = OUT / "tables" / f"{table}.csv"
        csv_path.write_text(csv_text)

        dict_cur.execute(f"SELECT * FROM public.{qident(table)}")
        rows = dict_cur.fetchall()
        json_path = OUT / "tables" / f"{table}.json"
        json_path.write_text(json.dumps(rows, indent=2, default=json_default) + "\n")

        if rows:
            columns = list(rows[0].keys())
            col_sql = ", ".join(qident(c) for c in columns)
            insert_parts.append(f"-- {table} ({count} rows)")
            for row in rows:
                values = ", ".join(sql_literal(row[c]) for c in columns)
                insert_parts.append(
                    f"INSERT INTO {qident(table)} ({col_sql}) VALUES ({values});"
                )
            insert_parts.append("")

        objects.append(
            {
                "schema": "public",
                "name": table,
                "kind": "table",
                "rows": count,
                "csv": f"tables/{table}.csv",
                "json": f"tables/{table}.json",
            }
        )
        total_rows += count
        print(f"exported {table}: {count} rows", flush=True)

    cur.execute(
        """
        SELECT n.nspname, c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S'
        ORDER BY c.relname
        """
    )
    sequences = []
    for schema, name in cur.fetchall():
        cur.execute(f"SELECT last_value, is_called FROM {qident(schema)}.{qident(name)}")
        last_value, is_called = cur.fetchone()
        sequences.append({"name": name, "last_value": last_value, "is_called": is_called})
        insert_parts.append(
            f"SELECT setval({sql_literal(schema + '.' + name)}, {last_value}, {'TRUE' if is_called else 'FALSE'});"
        )
    insert_parts.append("SET session_replication_role = DEFAULT;")
    insert_parts.append("COMMIT;")
    (OUT / "sql" / "01-public-data.sql").write_text("\n".join(insert_parts) + "\n")

    host = parsed.hostname
    manifest = {
        "source": "live Marketing production Postgres (same DB as sla-marketing-api / sla-marketing-web)",
        "liveWeb": "https://sla-marketing-web.vercel.app",
        "liveApi": "https://sla-marketing-api.vercel.app",
        "exportedAt": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "database": database,
        "user": user,
        "host": host,
        "serverVersion": version,
        "publicTableCount": len(tables),
        "publicRowTotal": total_rows,
        "objects": objects,
        "sequences": sequences,
        "files": {
            "schema": "sql/00-public-schema.sql",
            "dataInserts": "sql/01-public-data.sql",
            "tablesDir": "tables/",
        },
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    verify_rows = []
    for obj in objects:
        csv_path = OUT / obj["csv"]
        with csv_path.open() as fh:
            n = max(sum(1 for _ in csv.reader(fh)) - 1, 0)
        json_n = len(json.loads((OUT / obj["json"]).read_text()))
        ok = n == obj["rows"] == json_n
        verify_rows.append({"table": obj["name"], "live": obj["rows"], "csv": n, "json": json_n, "ok": ok})
        if not ok:
            print(f"VERIFY MISMATCH {obj['name']}: live={obj['rows']} csv={n} json={json_n}", flush=True)

    (OUT / "verify.json").write_text(
        json.dumps(
            {
                "ok": all(r["ok"] for r in verify_rows),
                "publicRowTotal": total_rows,
                "tables": verify_rows,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"done: {len(tables)} tables, {total_rows} rows -> {OUT}", flush=True)
    conn.close()
    if not all(r["ok"] for r in verify_rows):
        raise SystemExit(3)


if __name__ == "__main__":
    main()
