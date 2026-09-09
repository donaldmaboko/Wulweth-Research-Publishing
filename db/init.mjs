#!/usr/bin/env node
// Applies db/schema.sql to the runtime SQLite database. Idempotent.
// --reset drops all tables first.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, ".data");
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, "wulweth.db"));

if (process.argv.includes("--reset")) {
  const tables = [
    "reviews", "feed_claims", "feed_posts", "payouts", "deliverables",
    "payments", "invoice_items", "invoices", "quote_requests", "projects",
    "services", "users",
  ];
  db.exec("PRAGMA foreign_keys = OFF");
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS ${t}`);
  db.exec("PRAGMA foreign_keys = ON");
  console.log("Dropped existing tables.");
}

const schema = readFileSync(join(root, "db", "schema.sql"), "utf8");
db.exec(schema);
console.log("Schema applied → .data/wulweth.db");
