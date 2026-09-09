# 03 · Feature Prioritization — MVP vs Phase 2+

> Principle: the MVP must prove the **managed-marketplace money loop** —
> request → fixed quote → escrow → match → QC → split payout — because that loop
> is the business. Everything that doesn't break it if missing (chat, reviews
> moderation, self-serve pricing) is deferred.

Status legend: ✅ **built in this repo** · 🟡 Phase 2 · 🔵 Phase 3

---

## MVP — shipped here (the transactional core)

| # | Capability | Why it's MVP | Where |
|---|---|---|---|
| 1 | **Three-role auth** (client / researcher / admin) with vetted badges | trust model is the product | `src/lib/auth.ts`, signup flow |
| 2 | **Service catalog** — research-only services with from-prices & turnaround | defines the marketplace's supply/demand contract | `/services`, `services` table |
| 3 | **Dual intake**: portal requests + public "Get a Quote" (guest briefs, auto account on conversion) | both funnels feed the same desk queue | `/portal/new`, `/quote`, `/api/quotes` |
| 4 | **Fixed quotes + pricing by the desk** (admin sets agreed price) | managed marketplace ≠ bidding chaos; price control is the differentiation | `/admin/requests`, assign panel |
| 5 | **Invoice generation incl. multi-project bundles** + printable receipts | explicit client requirement | `/portal/invoices`, invoice detail |
| 6 | **Mock payment gateway** — card (instant) & bank transfer (desk-confirmed), funds land in **escrow state** | the escrow mechanic must exist end-to-end before a real PSP is wired | `/api/invoices/[id]/pay`, payments ledger |
| 7 | **Project dispersion** — admin assigns by discipline match (vetted-first sort) or posts to the claim pool | "admin matches" is the model's core | `/api/projects/[id]/assign`, QC/requests pages |
| 8 | **Version-controlled submissions** with QC status per version | researchers iterate; clients get audit trail | `/researcher/projects/[id]`, `deliverables` |
| 9 | **QC dashboard** — approve / request revision with rubric notes; queue + history | funds only move after QC — the platform's quality promise | `/admin/qc` |
| 10 | **Fee management** per service (percent or fixed), snapshotted at payout | the revenue model must be operable, not hardcoded | `/admin/finance`, `services.fee_*` |
| 11 | **Payout engine + ledgers** — payout-ready queue, gross/fee/net split, processing→settled | explicit client requirement | `/admin/finance`, `/researcher/earnings` |
| 12 | **Company feed** (public) — announcements, trends, anonymized showcases, claimable JOBs; admin composer with drafts | marketing + open-supply recruiting | `/feed`, `/admin/feed` |
| 13 | **Tracking IDs + status timeline** on every project | explicit client requirement (Pending → … → Paid out) | project pages, `PROJECT_STATUS_META` |
| 14 | **Reviews (1–5)** on completed projects | trust flywheel input for matching | `/api/reviews` |
| 15 | **Researcher profiles/portfolio** (disciplines, ORCID, affiliation, bio links) | matching quality + trust | `/researcher/profile` |
| 16 | **Earnings dashboard** — paid / processing / pipeline with fee transparency | freelancer retention depends on payment clarity | `/researcher/earnings` |

## 🟡 Phase 2 — operational hardening & growth (next 1–2 quarters)

| Capability | Rationale |
|---|---|
| **Real Stripe Connect** destination charges + transfers (replace mock gateway behind the same ledger states) | compliance-grade money movement; escrow states already map 1:1 |
| **Milestones** — split a project into multiple escrowed milestones (thesis chapters, multi-study reviews) | large engagements need partial release |
| **Messaging threads** (client ↔ researcher, desk in copy) | remove off-platform email; keep audit trail |
| **Email notifications** (quote ready, deliverable submitted, QC decision, payout) | the desk currently works in-app |
| **Plagiarism / AI-content screening** in the QC pipeline (Turnitin API, GPTZero) | differentiator for academic integrity |
| **Dispute flow** — client opens dispute on QC-approved work; admin arbitration with partial refunds (`payments.REFUNDED` states exist) | trust safety-net at scale |
| **Researcher self-serve onboarding exams** (writing sample upload, discipline quiz) | vetting at scale without desk bottleneck |
| **NDA / DPA e-signature** on dataset projects | GDPR/data-processing formality |
| **Public researcher profiles** with anonymized portfolio pages (SEO landing pages) | supply-side marketing |
| **CSV/PDF financial exports** for client procurement departments | university/NGO purchasing reality |

## 🔵 Phase 3 — scale & platform leverage

| Capability | Rationale |
|---|---|
| **Algorithmic matching** — ranking model over discipline fit, past QC scores, on-time rate, load | desk efficiency at hundreds of concurrent projects |
| **Publication success analytics** — acceptance-rate cohorts per researcher/service (trust indicator) | unique data moat; powers marketing claims |
| **Subscription retainers** for departments/clinics (pooled escrow balance) | recurring revenue beyond take-rate |
| **Multi-currency + regional payment rails** (SEPA instant, M-Pesa for the African researcher base) | market expansion |
| **Mobile app / PWA** for researcher submissions | field researchers |
| **SSO (SAML/OIDC)** for institutional clients | procurement gatekeeper at universities |
| **ISO 27001 / SOC 2 certification program** | enterprise trust requirement |
| **Marketplace API + webhooks** (create projects from LMS/IR systems) | integrations moat |

---

## Explicitly de-scoped (with reasons)

- **Open bidding on prices** — contradicts the managed-market premise; the desk
  prices work and researchers accept assignments.
- **Direct client→freelancer contracting** — payment must flow through escrow or
  the QC/fee model collapses.
- **General freelance categories** — the USP is *research only*; adding "logo
  design" would destroy positioning (see `docs/05-usp-implementation.md`).

## Sequencing logic

```
MVP (loop works, simulated money)
 └─► Phase 2a: Stripe Connect live + email notifications   ← money becomes real
 └─► Phase 2b: milestones + disputes                        ← larger tickets, safer
 └─► Phase 2c: integrity screening + self-serve vetting     ← quality at scale
      └─► Phase 3: algorithmic matching + analytics moat    ← leverage
```
