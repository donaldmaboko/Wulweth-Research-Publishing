import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// SQLite (via node:sqlite) for the MVP runtime. The relational shape is
// identical to the production PostgreSQL schema — see docs/01-database-schema.md
// and db/schema.sql. Swapping to Postgres later means replacing this file with
// a `pg`/`postgres.js` pool; every call site uses the helpers below.
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), ".data");
const DB_PATH = join(DATA_DIR, "wulweth.db");

declare global {
  // eslint-disable-next-line no-var
  var __wulwethDb: DatabaseSync | undefined;
}

function createDb(): DatabaseSync {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  // Auto-apply schema on first boot (idempotent CREATE IF NOT EXISTS).
  const hasUsers = db.prepare("SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name='users'").get() as { c: number };
  if (!hasUsers.c) {
    const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
    db.exec(schema);
  }
  return db;
}

export const db: DatabaseSync = globalThis.__wulwethDb ?? createDb();
globalThis.__wulwethDb = db;

// --------------------------------------------------------------- row helpers

export type Row = Record<string, unknown>;

// node:sqlite returns null-prototype rows; spread them into plain objects so
// rows are safely serializable across the server → client component boundary.
export function all<T = Row>(sql: string, ...params: (string | number | null)[]): T[] {
  return (db.prepare(sql).all(...params) as T[]).map((r) => ({ ...r }));
}

export function get<T = Row>(sql: string, ...params: (string | number | null)[]): T | undefined {
  const row = db.prepare(sql).get(...params) as T | undefined;
  return row ? { ...row } : undefined;
}

export function run(sql: string, ...params: (string | number | null)[]): void {
  db.prepare(sql).run(...params);
}

// Transactions: node:sqlite has no begin/commit helper — emulate synchronously.
export function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ------------------------------------------------------------------ id utils

export function newId(prefix = "id"): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function newTrackingId(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = crypto.randomBytes(5);
  for (let i = 0; i < 5; i++) s += alphabet[bytes[i] % alphabet.length];
  return `WRP-${new Date().getFullYear()}-${s}`;
}

export function newRef(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

export function nextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const row = get<{ c: number }>(
    "SELECT count(*) AS c FROM invoices WHERE number LIKE ?",
    `WRP-INV-${year}-%`
  );
  const seq = (row?.c ?? 0) + 1;
  return `WRP-INV-${year}-${String(seq).padStart(4, "0")}`;
}

export function newQuoteRef(): string {
  return `WRP-Q-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}
