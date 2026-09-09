# 04 · Tech Stack Justification

> Chosen for a **managed research marketplace**: SEO-critical marketing surface,
> transactional ledgers, document-heavy workflows, and an eventual need for
> heavier data processing (matching, analytics) without a rewrite.

---

## The stack at a glance

| Layer | Choice | Production note |
|---|---|---|
| Frontend + SSR | **Next.js 15 (App Router, React 19, TypeScript)** | edge-cacheable marketing pages, RSC for portal data |
| Styling | **Tailwind CSS 4** with a custom brand theme | design tokens in `globals.css` |
| Backend | **Next.js Route Handlers (Node runtime)** — a modular-monolith API | extract to NestJS services when teams split (contract-compatible) |
| Data layer | **typed repository over SQL** (`src/lib/db.ts`) | SQLite in this MVP build → **PostgreSQL 16** in production (schema identical, see doc 01) |
| Files | local `.data/uploads` now | **S3 + SSE-KMS**, presigned multipart uploads (25 MB+), keys already stored as `stored_name` |
| Payments | **mock gateway behind the escrow ledger** | **Stripe Connect** destination charges + separate transfers & application fees |
| Auth | HMAC-signed httpOnly session cookie, bcrypt passwords | swap to Auth.js/NextAuth with MFA; the `getCurrentUser/requireRole` surface is unchanged |
| Queue (prod) | Postgres-backed jobs (pg-boss) for emails/webhooks/AV scans | async-ify notifications first |
| Observability | structured logs now | OpenTelemetry + Sentry + dashboards |

---

## Why Next.js for frontend *and* API

1. **SEO is a product requirement.** The marketing face (home, `/services`, `/feed`,
   `/quote`) must rank against incumbents' content pages. Server-rendered pages with
   per-route metadata, semantic HTML, and canonical URLs are built in — this repo
   ships them (`metadata` exports, SSR by default).
2. **One deployable, two speeds.** Marketing pages are static/edge-cacheable;
   portal pages are per-user dynamic. A single framework covers both, with
   React Server Components keeping client JS small on data-heavy dashboards.
3. **Typed end-to-end.** TypeScript across pages, API handlers and the data layer
   matters here: money math (integer cents), status machines, and role guards are
   exactly where untyped code rots.
4. **React 19 ecosystem** gives a deep hiring pool and component library options —
   relevant for a product team that will iterate on portal UX for years.

*When to split:* if the platform team grows past ~8 engineers or needs
independent scaling, extract the API into **NestJS** (same TypeScript domain
model — `src/lib/*` ports directly) while keeping Next.js for SSR.

## Why a relational database (PostgreSQL) — non-negotiable here

- **Transactions are the product.** "Client pays → escrow → QC → payout" must be
  atomic: the payout routine runs in a transaction that moves `payments →
  RELEASED`, inserts the fee-split `payouts` row, and flips project status
  together (`tx()` in this codebase; a DB transaction in prod).
- **Money integrity via constraints.** UNIQUE constraints (`payouts.project_id`,
  `invoice_items.project_id`, `payments.invoice_id`) and CHECK constraints
  (`net = gross − fee`) enforce invariants the application can't guarantee under
  concurrency.
- **Relational queries are the app.** Admin queues ("COMPLETED projects with
  escrowed funds and no payout") are single indexed SQL queries — trivially
  correct, trivially tunable.
- SQLite is used in this build **only** as a zero-dependency dev/demo runtime
  (via Node's built-in `node:sqlite`) so the repo boots anywhere; the schema and
  all SQL are portable (documented dialect deltas in doc 01 §5).

## Why Python isn't the first service (yet)

The brief prefers Python "if heavy data processing is involved later." Analysis:
- The *marketplace* workload is CRUD + ledger transactions + document flow —
  Node/TS handles it with one language across the stack.
- The *heavy* parts (algorithmic matching, bibliometric analysis, NLP
  screening) are **Phase 3** and cleanly separable as a **FastAPI** service behind
  the queue, consuming Postgres + S3 directly. Nothing in the MVP couples us away
  from that path — we deliberately kept business logic in a thin, framework-free
  data layer (`src/lib/*`) so a Python sibling service can share the same schema.
- Running Python *now* would mean a second runtime, deployment pipeline and team
  skill-set before the product has proven demand for it.

## Why Stripe Connect (and how the mock maps 1:1)

The escrow ledger in this repo was designed as Stripe's state machine:

| Ledger state (this repo) | Stripe Connect primitive |
|---|---|
| Invoice issued | `PaymentIntent` created, `transfer_group = invoice.id`, `on_behalf_of` unset |
| `payments.ESCROWED` | charge settles on the **platform balance** (destination charge / manual capture) |
| `payouts.PROCESSING` | `Transfer` to the researcher's **connected account** with `source_transaction` tied to the original charge |
| `payouts.PAID` + `payments.RELEASED` | transfer `paid_out`; `application_fee_amount` = company service fee (snapshot) |
| `payments.REFUNDED` | `Refund` on the PaymentIntent (Phase 2 dispute flow) |

Why Connect over PayPal Marketplace: superior connected-account onboarding
(KYC embedded), `source_transaction` payouts that keep the platform compliant
(pay only from collected funds — our payout guard enforces the same rule), and
first-class split/fee semantics. Bank transfers remain a first-class rail via
Stripe's ACH/SEPA debit or manual reconciliation (the admin "confirm transfer"
action exists for exactly that).

## Storage: S3-shaped from day one

- Deliverables are stored by opaque `stored_name` keys (`TRACKING_ID/vN-id.pdf`)
  and served **only through an authorized route** (`/api/deliverables/[id]/file`)
  that checks requester ∈ {project client, assigned researcher, admin}.
- Moving to production = S3 + SSE-KMS + presigned multipart PUTs (the 25 MB cap
  and the allow-list of MIME types already live in the upload handler).
- Manuscripts and datasets are the crown-jewel data of this platform; private
  buckets + per-object encryption + signed URLs (short TTL) are the baseline.

## Security & GDPR posture

**Implemented in this build**
- bcrypt password hashing (cost 10), HMAC-signed **httpOnly/SameSite** session cookies, timing-safe token comparison.
- **Role guards on every API route** (`apiUser(…roles)`) and every page (`requireRole`) — verified: anonymous file access → 401, client triggering admin payout → 403.
- Least-privilege downloads; `Cache-Control: private, no-store` on deliverables.
- Server-side validation of every write (amounts, statuses, MIME types, sizes, ownership).
- Parameterized SQL everywhere (no string-built queries).

**Production checklist (next hardening sprint)**
- Encryption at rest (disk + S3-KMS) and TLS 1.3 everywhere; secrets in a managed vault.
- GDPR: DSAR export/delete jobs, retention policy per data class, DPA templates for dataset projects, EU region hosting, signed NDAs (Phase 2).
- Rate limiting + bot protection at the edge (WAF), 2FA for admin logins, audit log for every money-state transition (the ledger already records who/when).
- Dependency scanning (Dependabot + `npm audit` in CI), CSP headers, CSRF token on cookie-auth mutations (SameSite=Lax + JSON content-type is the MVP mitigation).

## Scalability path (to thousands of concurrent users)

```
[CloudFront/CDN]──static & ISR marketing pages          (90% of traffic, cache hits)
      │
[Next.js SSR pods — stateless, autoscaled]              (portals, API)
      │                    │
[Postgres primary]──[read replicas]                      (queues, dashboards)
      │
[S3 + KMS]   [pg-boss queue]──[workers: emails, AV/QR scans, payouts reconciliation]
```

- The app tier is stateless (session = signed cookie), so scaling = adding pods.
- Admin dashboards read from replicas; ledger writes stay on the primary.
- Per-project upload paths fan out to S3 — app pods never stream large files twice.
- No coupling to anything that can't be replaced per the table above; every
  production swap (Stripe, S3, Postgres, Auth.js) is a local change behind an
  existing seam.

## Repository topology (this build)

```
db/schema.sql          runtime schema (SQLite dialect)      → Postgres DDL in docs/01
db/init.mjs, seed.mjs  idempotent setup + demo dataset
src/lib/               db, auth, domain types, formatting, api helpers  (the "core")
src/app/(public)       SEO marketing surface
src/app/portal         client portal
src/app/admin          desk: requests, projects, QC, finance, feed, users
src/app/researcher     researcher studio
src/app/api            17 route handlers (auth, quotes, projects, invoices,
                       payments, deliverables, QC, payouts, feed, fees, users)
docs/                  the five architecture deliverables
```
