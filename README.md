# Wulweth Research & Publishing — Platform

**Where boundless curiosity meets limitless potential.**

A managed marketplace **exclusively for research work** — literature reviews,
statistical analysis, journal publication support, thesis support and more.
Clients post needs, the Wulweth desk quotes and matches vetted researchers,
clients pay into **escrow**, deliverables pass **quality control**, and
researchers are paid out minus the company service fee.

> This repository contains the full MVP implementation (all three portals + the
> public marketing site) plus the five architecture deliverables in [`docs/`](docs).

---

## Quickstart

```bash
npm install
npm run setup     # applies db/schema.sql + seeds a rich demo dataset
npm run dev       # http://localhost:3000
```

Requires Node 22.5+ (uses the built-in `node:sqlite` module — no native deps).

### Demo accounts (password: `password123`)

| Role | Email | Sees |
|---|---|---|
| Admin (desk) | `admin@demo.io` | requests, matching, QC queue, finance & payouts, feed, users |
| Client | `client@demo.io` | active projects (incl. one in QC), quote to approve, invoices, escrow receipts |
| Client | `client2@demo.io` | unpaid invoice, revision loop, payout-ready project, open job claim |
| Researcher | `researcher@demo.io` | vetted — active work, QC note to address, earnings ledger |
| Researcher | `researcher2@demo.io` | vetted — completed + assigned work |
| Researcher | `researcher3@demo.io` | unvetted — revision in progress |

Try the full money loop: client requests → admin quotes & assigns → client
generates an invoice → pays (simulated card/bank) → researcher submits v1 →
admin QC (approve/revise) → admin triggers payout (fee split) → receipt +
earnings ledger update.

## The business model, encoded

```
Client pays → Wulweth holds (ESCROW) → desk matches vetted researcher →
researcher delivers (versioned) → QC approves → payout = gross − service fee
```

- Service fees are configurable **per service** (percent or fixed) in
  Admin → Finance, and are snapshotted on every payout for audit.
- A payout can only be triggered for a QC-approved project whose payment is
  still in escrow — the platform never pays from uncollected funds.

## Architecture deliverables

| Doc | Contents |
|---|---|
| [`docs/01-database-schema.md`](docs/01-database-schema.md) | ERD, table-by-table outline, PostgreSQL DDL, money-integrity invariants |
| [`docs/02-user-flows.md`](docs/02-user-flows.md) | text-based flow diagrams: payment → assignment → work → QC → payout (+ intake, claim, revision loops) |
| [`docs/03-feature-prioritization.md`](docs/03-feature-prioritization.md) | MVP vs Phase 2/3 with rationale |
| [`docs/04-tech-stack-justification.md`](docs/04-tech-stack-justification.md) | stack choices, Stripe Connect mapping, security/GDPR, scalability path |
| [`docs/05-usp-implementation.md`](docs/05-usp-implementation.md) | how "research-only" is enforced in UI/UX and data |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
SQLite (`node:sqlite`) dev runtime with PostgreSQL-shaped schema ·
bcrypt + HMAC session cookies · S3-shaped file storage behind authorized
downloads · simulated payment gateway designed as a drop-in for Stripe Connect.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | dev server on `0.0.0.0:3000` |
| `npm run setup` | apply schema + seed demo data |
| `npm run db:reset` | drop all tables, re-apply schema, re-seed |

## Notes

- Payments are **simulated** (no card is charged). The ledger states
  (`ESCROWED → RELEASED`) mirror Stripe Connect 1:1 — see doc 04 for the mapping.
- The SQLite runtime keeps the demo zero-dependency; production uses PostgreSQL
  (same schema — native enums/arrays, DDL in doc 01).
- Uploaded deliverables live in `.data/uploads/` (gitignored) and are served
  only through the authorized `/api/deliverables/[id]/file` route.

© Wulweth Research & Publishing — MVP demonstration build.
