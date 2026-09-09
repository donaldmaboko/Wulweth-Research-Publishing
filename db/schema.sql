-- =============================================================================
-- Wulweth Research & Publishing — runtime schema (SQLite dialect)
-- Production PostgreSQL DDL (native enums, text[], numeric money):
--   see docs/01-database-schema.md
-- Applied idempotently on boot by db/init.mjs / src/lib/db.ts
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('CLIENT','FREELANCER','ADMIN')),
  headline      TEXT,
  bio           TEXT,
  disciplines   TEXT,             -- comma-separated list (PG: text[])
  affiliation   TEXT,
  orcid         TEXT,
  verified      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  tagline         TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL,
  from_price_cents INTEGER NOT NULL DEFAULT 0,
  eta_days        INTEGER,
  active          INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  fee_mode        TEXT NOT NULL DEFAULT 'PERCENT' CHECK (fee_mode IN ('PERCENT','FIXED')),
  fee_value       INTEGER NOT NULL DEFAULT 15
);

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  tracking_id   TEXT NOT NULL UNIQUE,
  client_id     TEXT NOT NULL REFERENCES users(id),
  researcher_id TEXT REFERENCES users(id),
  service_id    TEXT NOT NULL REFERENCES services(id),
  discipline    TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN
                  ('PENDING','QUOTED','ASSIGNED','IN_PROGRESS','UNDER_REVIEW','COMPLETED','PAID_OUT','CANCELLED')),
  deadline      TEXT,
  budget_cents  INTEGER,
  agreed_cents  INTEGER,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_client     ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_researcher ON projects(researcher_id);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects(status);

CREATE TABLE IF NOT EXISTS quote_requests (
  id           TEXT PRIMARY KEY,
  ref          TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  organisation TEXT,
  service_id   TEXT REFERENCES services(id),
  discipline   TEXT NOT NULL,
  details      TEXT NOT NULL,
  budget_cents INTEGER,
  deadline     TEXT,
  status       TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','CONVERTED','ARCHIVED')),
  project_id   TEXT REFERENCES projects(id),
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id             TEXT PRIMARY KEY,
  number         TEXT NOT NULL UNIQUE,
  client_id      TEXT NOT NULL REFERENCES users(id),
  status         TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ISSUED','PAID','VOID')),
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  total_cents    INTEGER NOT NULL DEFAULT 0,
  due_date       TEXT,
  paid_at        TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id           TEXT PRIMARY KEY,
  invoice_id   TEXT NOT NULL REFERENCES invoices(id),
  project_id   TEXT UNIQUE REFERENCES projects(id),
  description  TEXT NOT NULL,
  amount_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
  invoice_id   TEXT NOT NULL UNIQUE REFERENCES invoices(id),
  method       TEXT NOT NULL CHECK (method IN ('CARD','BANK_TRANSFER')),
  amount_cents INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'ESCROWED' CHECK (status IN ('ESCROWED','RELEASED','REFUNDED')),
  reference    TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliverables (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id),
  version       INTEGER NOT NULL,
  filename      TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  mime          TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','APPROVED','REVISION_REQUESTED')),
  reviewer_note TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deliverables_project ON deliverables(project_id);

CREATE TABLE IF NOT EXISTS payouts (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL UNIQUE REFERENCES projects(id),
  researcher_id TEXT NOT NULL REFERENCES users(id),
  gross_cents   INTEGER NOT NULL,
  fee_cents     INTEGER NOT NULL,
  net_cents     INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING','PAID')),
  reference     TEXT NOT NULL UNIQUE,
  paid_at       TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payouts_researcher ON payouts(researcher_id);

CREATE TABLE IF NOT EXISTS feed_posts (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('ANNOUNCEMENT','TREND','JOB','COMPLETED_PROJECT')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  published   INTEGER NOT NULL DEFAULT 0,
  anonymized  INTEGER NOT NULL DEFAULT 1,
  project_id  TEXT REFERENCES projects(id),
  author_id   TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feed_claims (
  id      TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES feed_posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  message TEXT,
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
  client_id  TEXT NOT NULL REFERENCES users(id),
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
