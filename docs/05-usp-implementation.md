# 05 · USP Implementation — "Only research. Nothing else."

> The unique selling point: Wulweth is **exclusively a research marketplace**.
> Every screen must make a client feel *"these people know what a methods
> section is"* and a researcher feel *"this work is my discipline, not a gig."*
> This doc maps the USP to concrete UI/UX and data decisions in the build.

---

## 1. The research-only taxonomy is the spine of the product

Generalist marketplaces categorize by deliverable ("logo", "voiceover").
Wulweth categorizes by **discipline and research method**:

- **Disciplines** (8, fixed taxonomy): Medical & Health Research · Social
  Sciences · STEM · Data Visualization & Analytics · Humanities & Literature ·
  Business & Economics · Environmental Studies · Education Research
  → `DISCIPLINES` in `src/lib/types.ts`; a **required field** on every project,
  every quote brief, and every researcher profile.
- **Services** are research *methods*, not generic gigs: Systematic Literature
  Review, Statistical Analysis, Qualitative Coding & Thematic Analysis,
  Journal Submission Support, Thesis & Dissertation Support, Academic Editing,
  Data Visualization & Dashboards, Research Proposal Development
  → the entire `services` catalog, grouped by `category`
  (Publication · Analysis · Thesis & Academia · Data & Visualization).

**Where it shows up:**
| Surface | USP mechanism |
|---|---|
| Home hero | "The marketplace built exclusively for research" + the 8-discipline grid ("Research is not a gig category. It's the whole platform.") |
| Service catalog | method-based cards with turnaround and from-prices — no custom gigs |
| Request & quote forms | discipline is a required select, service is method-based |
| Admin matching | researchers ranked **by discipline match first**, vetted second (★ sort in the assign panel) |
| Researcher profile | multi-discipline selection drives matching |
| Feed | showcases read like case studies ("23-study random-effects meta-analysis…"), not gigs |

## 2. Academic voice & visual language

- **Scholarly palette & type**: deep ink navy + warm parchment + brass gold,
  serif display headings (`font-display`) — reads "university press", not
  "startup landing page" (`src/app/globals.css` theme tokens).
- **Language**: "brief", "desk officer", "QC rubric", "deliverable",
  "engagement" — never "gig", "seller", "buyer". Status vocabulary mirrors an
  editorial pipeline (Pending → Quoted → Assigned → In progress → Under review
  → Completed → Paid out).
- **Methodology-literate copy**: the QC rubric names *methodology, sourcing,
  statistics, style*; PRISMA/STROBE/Braun-&-Clarke appear in service
  descriptions and seed data. Clients self-select by recognition.

## 3. Trust indicators — quantified and specific

| Indicator | Implementation |
|---|---|
| **Vetted researchers** | `users.verified` → "✔ Vetted" badge on projects, roster, dashboards; vetting checklist published in Admin → Users; vets are *managed* by admins, not self-claimed |
| **Credentials, verifiable** | researcher ORCID iD + affiliation captured and displayed; portfolio links (DOIs) in bio |
| **Escrow, always visible** | client payment panel literally says "🔒 Escrow protected… released only after QC approval"; escrow totals are live stats on the home hero and client dashboard |
| **QC as a process, not a promise** | status "Under review — our QA team is reviewing before sign-off"; QC notes visible on every deliverable version |
| **Publication success (feed)** | COMPLETED_PROJECT showcases quantify outcomes ("passed peer review with no statistical comments") |
| **Data security** | footer + trust section: encrypted storage, least-privilege access, GDPR-aligned handling, anonymized case studies by default (`feed_posts.anonymized`) |

## 4. Managed-marketplace UX (the anti-Upwork stance)

| Generalist pattern | Wulweth pattern (implemented) |
|---|---|
| Bidding chaos | **Fixed quotes from the desk**; client approves a price, no haggling UI exists |
| Direct hire of strangers | **Desk matches** the researcher (discipline + vetting), or an open *engagement* is posted and claimed |
| Chat-first scope creep | Structured **briefs** (research questions, data, citation style) are the intake contract |
| Escrow as optional add-on | **Escrow is the only path** — invoices fund custody; payouts exist only after QC (enforced in code) |
| Rating theater | One review per project, tied to a real completed engagement, powers anonymized showcases |

## 5. Domain-aware product details (the "we get research" tells)

- **Tracking IDs in the client's language** (`WRP-2026-KM74P`) shown in invoices,
  deliverable filenames, and payout ledgers — procurement- and IRB-friendly.
- **Deliverable versioning with change notes** mirrors manuscript revisions
  (v1 → QC note → v2), exactly how paper revisions work.
- **Bank-transfer support** because universities and NGOs frequently pay on PO
  cycles, not cards.
- **Quote-request → project conversion** handles the "I don't have an account, I
  just need a systematic review" reality of academic inbound.
- **Ethics statement** on the quote page: research *assistance*, client keeps
  authorship responsibility — the integrity line serious institutions expect.
- **Fee transparency for researchers** — gross / service fee / net shown on
  every assignment and the earnings ledger; escrow-before-work is stated as a
  payment guarantee in the researcher workspace.

## 6. USP checklist for future features (guardrail)

Before adding anything, ask: *does this still make sense if the platform were
only used by a university department?* If a feature only makes sense for
general freelancing (gig extras, bidding, tips), it erodes the USP — defer it.
