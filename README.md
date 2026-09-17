# Wulweth Research & Publishing

**Where boundless curiosity meets limitless potential.**

A production-grade platform that connects clients — individuals, companies, NGOs, universities,
government and healthcare organizations — with verified professional research expertise.
Wulweth is a managed professional-services platform, not a marketplace: every engagement is
scoped, quoted, quality-controlled and released by the Wulweth desk.

## Stack

| Layer     | Technology                                                            |
|-----------|-----------------------------------------------------------------------|
| Frontend  | Next.js 14 (App Router, TypeScript, Tailwind CSS) — `frontend/`       |
| Backend   | FastAPI (Python 3.11, SQLAlchemy 2) — `backend/`                      |
| Database  | PostgreSQL (SQLite fallback for local dev)                            |
| Storage   | Private document storage with signed, expiring download URLs          |

## Running locally

```bash
# backend (port 8000)
cd backend && ../.venv/bin/python -m uvicorn app.main:app --reload --port 8000

# frontend (port 3000, proxies /api/* to the backend)
cd frontend && npm run dev
```

Seed demo data: `cd backend && ../.venv/bin/python scripts/seed.py`

## Demo accounts (password `wulweth-demo`)

| Role                | Email                        |
|---------------------|------------------------------|
| Client              | client@wulweth.example       |
| Organization admin  | org.admin@kdi.example        |
| Professional        | lerato@wulweth.example       |
| Professional (stats)| naledi.stats@wulweth.example |
| Manager             | manager@wulweth.example      |
| QC reviewer         | qc@wulweth.example           |
| Finance             | finance@wulweth.example      |
| Admin               | admin@wulweth.example        |

## Platform flow

1. Client submits a structured research request (drafts + tracking ID `WUL-YYYY-NNNNN`).
2. Desk reviews scope and research-integrity compliance (automated screen → human review).
3. Transparent quote → client approval → invoice → payment confirmation.
4. Desk matches and assigns a verified professional.
5. Work is delivered through versioned deliverables (V1 → QC → Revision → V2 → Approved).
6. Funds release to the professional as a recorded payout (fee-configurable, fully audited).

## Principles

- Research integrity first: contract cheating, plagiarism and fabricated data are blocked at
  intake; legitimate statistical, data and manuscript support is fully supported.
- Real data only: every figure shown in the product is computed from live system records.
- Privacy by design: documents are private, access-controlled, malware-scanned and audited.
