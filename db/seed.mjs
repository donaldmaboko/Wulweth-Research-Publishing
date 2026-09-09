#!/usr/bin/env node
// Seeds the Wulweth demo dataset. Run `npm run setup` (init + seed).
// Use `node db/seed.mjs --force` to re-seed over existing data.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = new DatabaseSync(join(root, ".data", "wulweth.db"));
db.exec("PRAGMA foreign_keys = ON");

const existing = db.prepare("SELECT count(*) AS c FROM users").get();
if (existing.c > 0 && !process.argv.includes("--force")) {
  console.log("Database already seeded — skipping (use --force to re-seed).");
  process.exit(0);
}

// ------------------------------------------------------------------ helpers
const DAY = 86_400_000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const daysAgo = (d) => iso(now - d * DAY);
const daysAhead = (d) => iso(now + d * DAY);
const id = (p) => `${p}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
const hash = bcrypt.hashSync("password123", 10);

/** Minimal but valid single-page PDF generator (correct xref offsets). */
function makePdf(lines) {
  const esc = (s) => s.replace(/([()\\])/g, "\\$1");
  const content = [
    "BT /F1 12 Tf 56 760 Td 16 TL",
    ...lines.map((l, i) => (i === 0 ? `(${esc(l)}) Tj T*` : `(${esc(l)}) Tj T*`)),
    "ET",
  ].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets = [0];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

const UPLOADS = join(root, ".data", "uploads");
function storeDeliverable(trackingId, filename, lines) {
  const rel = `${trackingId}/${filename}`;
  const dir = join(UPLOADS, trackingId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), makePdf(lines));
  return rel;
}

// ----------------------------------------------------------------- services
const services = [
  ["Systematic & Narrative Literature Reviews", "Publication", 45000, 14, "PRISMA-guided synthesis", "Protocol (PROSPERO-ready), searches across databases, screening, synthesis matrix and a written review chapter with full bibliography."],
  ["Statistical Analysis", "Analysis", 38000, 10, "From raw data to results", "Analysis plan, data cleaning, modelling (regression, mixed models, survival), assumptions checking and a results narrative with tables."],
  ["Qualitative Coding & Thematic Analysis", "Analysis", 34000, 10, "Rigorous thematic work", "Codebook development, double-coding on a sample, inter-coder reliability, reflexive thematic analysis (Braun & Clarke) with memo trail."],
  ["Data Visualization & Dashboards", "Data & Visualization", 29000, 7, "Figures reviewers love", "Journal-grade figures, effect plots, dashboards and reproducible chart code (ggplot2/matplotlib) following your target style."],
  ["Journal Submission Support", "Publication", 32000, 12, "From manuscript to submission", "Formatting to journal guidelines, cover letter, response-to-reviewer letters, ORCID setup and submission-portal handling."],
  ["Thesis & Dissertation Support", "Thesis & Academia", 52000, 21, "Chapter-level scaffolding", "Literature matrices, methods chapters, results interpretation, discussion mapping and defence-prep briefs — you stay the author."],
  ["Academic Editing & Proofreading", "Publication", 18000, 5, "Publication-ready English", "Copy-editing for clarity and register, reference cleanup (APA/Vancouver/Chicago), similarity-check guidance."],
  ["Research Proposal Development", "Thesis & Academia", 41000, 12, "Funding-grade proposals", "Problem framing, gap analysis, work packages, budget narratives and a logic model aligned to funder templates."],
];
const svc = {};
services.forEach(([name, category, price, eta, tag, desc], i) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
  const sid = id("svc");
  svc[name] = sid;
  db.prepare(
    `INSERT INTO services (id, slug, name, tagline, description, category, from_price_cents, eta_days, active, sort_order, fee_mode, fee_value)
     VALUES (?,?,?,?,?,?,?,?,'1',?, 'PERCENT', ?)`
  ).run(sid, slug, name, tag, desc, category, price, eta, i, 15);
});
// A fixed-fee example for fee-management demo
db.prepare("UPDATE services SET fee_mode='FIXED', fee_value=5000 WHERE id=?").run(svc["Academic Editing & Proofreading"]);

// -------------------------------------------------------------------- users
const users = {
  admin: [id("usr"), "Nadia Okafor", "admin@demo.io", "ADMIN", "Desk lead & managing editor", null, null, "Wulweth Editorial Desk", null, 1],
  dana: [id("usr"), "Dana Whitfield", "client@demo.io", "CLIENT", null, null, null, "BrightPath Health NGO", null, 0],
  mwangi: [id("usr"), "Prof. James Mwangi", "client2@demo.io", "CLIENT", null, null, null, "University of Nairobi — School of Education", null, 0],
  amara: [id("usr"), "Dr. Amara Okoye", "researcher@demo.io", "FREELANCER", "Epidemiologist · systematic reviews & meta-analysis", "Co-author on 18 peer-reviewed papers. I run PRISMA-2020 systematic reviews, network meta-analyses and clinical evidence syntheses. Portfolio: doi.org/10.1000/example-01, doi.org/10.1000/example-02", "Medical & Health Research,Social Sciences", "LSHTM", "0000-0002-1825-0097", 1],
  lukas: [id("usr"), "Dr. Lukas Brenner", "researcher2@demo.io", "FREELANCER", "Biostatistician · data viz & dashboards", "Statistics for clinical trials and observational studies; reproducible analysis pipelines; publication-grade figures. Portfolio: github.com/example/lukas-figures", "STEM,Data Visualization & Analytics", "Charité Berlin", "0000-0001-5109-3700", 1],
  sofia: [id("usr"), "Sofía Ramírez", "researcher3@demo.io", "FREELANCER", "Qualitative researcher · education & society", "Reflexive thematic analysis, interview study design, focus-group facilitation across Spanish/English corpora.", "Social Sciences,Education Research", "Universidad de Chile", null, 0],
};
for (const u of Object.values(users)) {
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, headline, bio, disciplines, affiliation, orcid, verified, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(u[0], u[1], u[2], hash, u[3], u[4], u[5], u[6], u[7], u[8], u[9], daysAgo(120));
}

// ----------------------------------------------------------------- projects
function addProject(o) {
  const pid = id("prj");
  db.prepare(
    `INSERT INTO projects (id, tracking_id, client_id, researcher_id, service_id, discipline, title, description,
       status, deadline, budget_cents, agreed_cents, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(pid, o.tracking, o.client, o.researcher ?? null, o.service, o.discipline, o.title, o.description,
    o.status, o.deadline ?? null, o.budget ?? null, o.agreed ?? null, o.created, o.updated ?? o.created);
  return pid;
}
function addInvoice(o) {
  const iid = id("inv");
  const num = o.number;
  db.prepare(
    `INSERT INTO invoices (id, number, client_id, status, subtotal_cents, total_cents, due_date, paid_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(iid, num, o.client, o.status, o.amount, o.amount, o.due ?? null, o.paidAt ?? null, o.created);
  db.prepare(
    "INSERT INTO invoice_items (id, invoice_id, project_id, description, amount_cents) VALUES (?,?,?,?,?)"
  ).run(id("itm"), iid, o.project, o.desc, o.amount);
  if (o.payment) {
    db.prepare(
      `INSERT INTO payments (id, invoice_id, method, amount_cents, status, reference, created_at)
       VALUES (?,?,?,?,?,?,?)`
    ).run(id("pay"), iid, o.payment.method, o.amount, o.payment.status, o.payment.ref, o.paidAt ?? o.created);
  }
  return iid;
}
function addDeliverable(o) {
  const stored = storeDeliverable(o.tracking, o.filename, o.lines);
  db.prepare(
    `INSERT INTO deliverables (id, project_id, version, filename, stored_name, mime, size_bytes, note, status, reviewer_note, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id("dlv"), o.project, o.version, o.filename, stored, "application/pdf",
    makePdf(o.lines).length, o.note ?? null, o.status, o.reviewerNote ?? null, o.created);
}

let invSeq = 0;
const invNum = () => `WRP-INV-2026-${String(++invSeq).padStart(4, "0")}`;

// 1 — Dana · UNDER_REVIEW with v2 in the QC queue (hero story)
const p1 = addProject({
  tracking: "WRP-2026-KM74P", client: users.dana[0], researcher: users.amara[0],
  service: svc["Systematic & Narrative Literature Reviews"], discipline: "Medical & Health Research",
  title: "Systematic review — telehealth interventions for type-2 diabetes self-management",
  description: "PRISMA 2020 systematic review of telehealth/self-monitoring interventions for adults with T2D. Need: PROSPERO-ready protocol, PubMed/Embase/CINAHL searches, dual screening, risk-of-bias (RoB 2), narrative synthesis + forest plots where possible. Output for a target journal in digital health. APA 7.",
  status: "UNDER_REVIEW", deadline: daysAhead(6), budget: 500000, agreed: 420000,
  created: daysAgo(24), updated: daysAgo(1),
});
addDeliverable({
  project: p1, tracking: "WRP-2026-KM74P", version: 1, created: daysAgo(10),
  filename: "KM74P-telehealth-review-v1.pdf", status: "REVISION_REQUESTED",
  note: "First full draft — synthesis matrix included.",
  reviewerNote: "RoB-2 judgements need justification quotes per study; PRISMA flow counts don't match the screening log (n=1,412 vs 1,382). Please reconcile and add effect sizes for the three RCT clusters.",
  lines: ["Telehealth for T2D Self-Management — Systematic Review (v1)", "Dr. A. Okoye — Wulweth Research & Publishing", "", "1. Protocol and search strategy", "2. Screening results (PRISMA flow)", "3. Risk of bias assessment", "4. Narrative synthesis", "5. Bibliography (APA 7)"],
});
addDeliverable({
  project: p1, tracking: "WRP-2026-KM74P", version: 2, created: daysAgo(1),
  filename: "KM74P-telehealth-review-v2.pdf", status: "SUBMITTED",
  note: "RoB quotes added per study; PRISMA counts reconciled with screening log; forest plots for 3 RCT clusters.",
  lines: ["Telehealth for T2D Self-Management — Systematic Review (v2, revised)", "Dr. A. Okoye — Wulweth Research & Publishing", "", "Revisions in this version:", "- RoB-2 justification quotes added", "- PRISMA flow reconciled (n=1,412)", "- Forest plots added for 3 RCT clusters"],
});
addInvoice({
  number: invNum(), client: users.dana[0], project: p1, amount: 420000, status: "PAID",
  desc: "WRP-2026-KM74P — Systematic review: telehealth interventions for type-2 diabetes",
  due: daysAgo(18), paidAt: daysAgo(20), created: daysAgo(21),
  payment: { method: "CARD", status: "ESCROWED", ref: "pay_9f3ce1a84b7d2c05" },
});

// 2 — Dana · QUOTED, uninvoiced (bundle demo)
const p2 = addProject({
  tracking: "WRP-2026-QX18D", client: users.dana[0], researcher: users.lukas[0],
  service: svc["Statistical Analysis"], discipline: "STEM",
  title: "Statistical re-analysis of RCT dataset (n=412) with STROBE-compliant tables",
  description: "De-identified RCT export (CSV, 412 rows) needs intention-to-treat re-analysis: mixed-effects model with site random effects, sensitivity analysis per protocol, STROBE participant-flow figure and results narrative. SAS outputs exist but reviewer asked for reproducible R code.",
  status: "QUOTED", deadline: daysAhead(15), budget: 400000, agreed: 380000,
  created: daysAgo(5), updated: daysAgo(3),
});

// 3 — Dana · PENDING (admin request queue)
const p3 = addProject({
  tracking: "WRP-2026-B4T2R", client: users.dana[0],
  service: svc["Research Proposal Development"], discipline: "Medical & Health Research",
  title: "Evidence synthesis for Horizon Europe grant proposal (work package 2)",
  description: "We are lead partner on a Horizon Europe bid (digital health). Need a rapid evidence synthesis + gap analysis for WP2 background, plus logic-model support. Funder template provided. Would like to discuss on a call.",
  status: "PENDING", deadline: daysAhead(30), budget: 300000, agreed: null,
  created: daysAgo(1), updated: daysAgo(1),
});

// 4 — Dana · PAID_OUT with review + feed showcase (settled story)
const p4 = addProject({
  tracking: "WRP-2026-J2M9C", client: users.dana[0], researcher: users.amara[0],
  service: svc["Systematic & Narrative Literature Reviews"], discipline: "Social Sciences",
  title: "Meta-analysis — school-based mindfulness interventions and adolescent anxiety",
  description: "Random-effects meta-analysis of school-based mindfulness RCTs (k=23 studies, dataset provided in CSV). Hedges' g, heterogeneity, publication-bias checks (funnel/Egger), subgroup by dose. Written up for an education-psychology journal.",
  status: "PAID_OUT", deadline: daysAgo(4), budget: 550000, agreed: 520000,
  created: daysAgo(60), updated: daysAgo(6),
});
addDeliverable({
  project: p4, tracking: "WRP-2026-J2M9C", version: 1, created: daysAgo(12),
  filename: "J2M9C-mindfulness-meta.pdf", status: "APPROVED",
  note: "Final version with reviewer-letters addendum.",
  reviewerNote: "Excellent — forest plots publication-quality, Egger's test correctly interpreted. Approved for client release.",
  lines: ["School-Based Mindfulness and Adolescent Anxiety — Meta-Analysis (final)", "Dr. A. Okoye — Wulweth Research & Publishing", "", "23 studies · Hedges' g = 0.38 [0.24, 0.52]", "Subgroup: dose-response confirmed", "Funnel plot & Egger's regression included", "Full coded dataset appendix (CSV)"],
});
addInvoice({
  number: invNum(), client: users.dana[0], project: p4, amount: 520000, status: "PAID",
  desc: "WRP-2026-J2M9C — Meta-analysis: school-based mindfulness interventions",
  due: daysAgo(50), paidAt: daysAgo(52), created: daysAgo(55),
  payment: { method: "CARD", status: "RELEASED", ref: "pay_7b21fd904ae6c831" },
});
db.prepare(
  `INSERT INTO payouts (id, project_id, researcher_id, gross_cents, fee_cents, net_cents, status, reference, paid_at, created_at)
   VALUES (?,?,?,?,?,?, 'PAID', ?, ?, ?)`
).run(id("pot"), p4, users.amara[0], 520000, 78000, 442000, "po_31a7c9e2f40b8d66", daysAgo(6), daysAgo(7));
db.prepare(
  "INSERT INTO reviews (id, project_id, client_id, rating, comment, created_at) VALUES (?,?,?,?,?,?)"
).run(id("rev"), p4, users.dana[0], 5, "Amara's meta-analysis passed peer review at our target journal with no statistical comments. The escrow process made finance sign-off painless — funds released only after our QC read-through.", daysAgo(5));

// 5 — Mwangi · QUOTED with ISSUED unpaid invoice (pay-now demo)
const p5 = addProject({
  tracking: "WRP-2026-T8H3L", client: users.mwangi[0],
  service: svc["Journal Submission Support"], discipline: "Medical & Health Research",
  title: "Submission package — community health worker trial to Lancet Regional Health",
  description: "Manuscript accepted-pending-formatting. Need: Lancet Regional Health formatting, structured abstract, trial-registration statement, cover letter, and submission through the editorial portal on our behalf.",
  status: "QUOTED", deadline: daysAhead(10), budget: 1000000, agreed: 950000,
  created: daysAgo(6), updated: daysAgo(2),
});
addInvoice({
  number: invNum(), client: users.mwangi[0], project: p5, amount: 950000, status: "ISSUED",
  desc: "WRP-2026-T8H3L — Journal submission support (Lancet Regional Health)",
  due: daysAhead(4), created: daysAgo(2),
});

// 6 — Mwangi · IN_PROGRESS with a revision requested (QC loop demo)
const p6 = addProject({
  tracking: "WRP-2026-V5W7N", client: users.mwangi[0], researcher: users.sofia[0],
  service: svc["Qualitative Coding & Thematic Analysis"], discipline: "Social Sciences",
  title: "Thematic analysis — 40 teacher interviews on curriculum reform",
  description: "Semi-structured interviews (40, transcribed) on competency-based curriculum adoption. Need codebook, double-coding on 20% sample with kappa, reflexive thematic analysis with memo trail, and quotable extracts de-identified.",
  status: "IN_PROGRESS", deadline: daysAhead(9), budget: 360000, agreed: 340000,
  created: daysAgo(30), updated: daysAgo(4),
});
addDeliverable({
  project: p6, tracking: "WRP-2026-V5W7N", version: 1, created: daysAgo(5),
  filename: "V5W7N-thematic-analysis-v1.pdf", status: "REVISION_REQUESTED",
  note: "Draft codebook + themes with 12 extracts.",
  reviewerNote: "Themes lean on surface codes — please add the latent-level interpretation and memo trail. Kappa reported as 0.61; re-double-code the disputed 6 transcripts to reach ≥0.75 and note reflexive positionality.",
  lines: ["Thematic Analysis of Teacher Interviews (v1)", "S. Ramírez — Wulweth Research & Publishing", "", "Codebook (42 codes, 6 candidate themes)", "Inter-coder reliability: kappa = 0.61", "Extracts de-identified", "Memos: partial"],
});
addInvoice({
  number: invNum(), client: users.mwangi[0], project: p6, amount: 340000, status: "PAID",
  desc: "WRP-2026-V5W7N — Thematic analysis, 40 teacher interviews",
  due: daysAgo(24), paidAt: daysAgo(26), created: daysAgo(27),
  payment: { method: "BANK_TRANSFER", status: "ESCROWED", ref: "pay_5c8d02f7a1b94e22" },
});

// 7 — Mwangi · COMPLETED, payout-ready (finance demo)
const p7 = addProject({
  tracking: "WRP-2026-R6Y1K", client: users.mwangi[0], researcher: users.lukas[0],
  service: svc["Data Visualization & Dashboards"], discipline: "Data Visualization & Analytics",
  title: "Enrollment-trends dashboard + publication figures (ggplot2)",
  description: "Ten years of county enrollment data (CSV). Need: interactive dashboard (enrollment, gender parity, completion) and 4 publication-grade static figures for a ministry report. Reproducible R code required.",
  status: "COMPLETED", deadline: daysAhead(2), budget: 300000, agreed: 290000,
  created: daysAgo(35), updated: daysAgo(1),
});
addDeliverable({
  project: p7, tracking: "WRP-2026-R6Y1K", version: 2, created: daysAgo(1),
  filename: "R6Y1K-dashboard-and-figures-v2.pdf", status: "APPROVED",
  note: "Color-blind-safe palette applied; R code zipped alongside.",
  reviewerNote: "Figures meet the journal style. Approved — payout can be triggered.",
  lines: ["Enrollment Trends Dashboard & Figures (v2)", "Dr. L. Brenner — Wulweth Research & Publishing", "", "Fig 1. Enrollment trend 2016–2025", "Fig 2. Gender parity index by county", "Fig 3. Completion-rate heat map", "Fig 4. Projection bands (ARIMA)", "Reproducible R code included"],
});

// 8 — Mwangi · ASSIGNED, funded, not started (researcher start-work demo)
const p8 = addProject({
  tracking: "WRP-2026-C3D8F", client: users.mwangi[0], researcher: users.lukas[0],
  service: svc["Thesis & Dissertation Support"], discipline: "Education Research",
  title: "Chapter-2 literature matrix — competency-based curriculum outcomes",
  description: "Structured literature matrix (≥60 studies) for thesis chapter 2: design, sample, outcome measures, effect direction, plus a concept map of themes. APA 7.",
  status: "ASSIGNED", deadline: daysAhead(18), budget: 500000, agreed: 520000,
  created: daysAgo(8), updated: daysAgo(3),
});
addInvoice({
  number: invNum(), client: users.mwangi[0], project: p8, amount: 520000, status: "PAID",
  desc: "WRP-2026-C3D8F — Thesis support: chapter-2 literature matrix",
  due: daysAgo(1), paidAt: daysAgo(2), created: daysAgo(3),
  payment: { method: "CARD", status: "ESCROWED", ref: "pay_2e6b48c9d703fa15" },
});

// 9 — Mwangi · funded, unassigned + JOB feed post (claim flow demo)
const p9 = addProject({
  tracking: "WRP-2026-Z9P4S", client: users.mwangi[0],
  service: svc["Systematic & Narrative Literature Reviews"], discipline: "Environmental Studies",
  title: "Rapid evidence scan — urban heat exposure and maternal health outcomes",
  description: "Rapid review (2-week turnaround): urban heat exposure and pregnancy outcomes (preterm birth, LBW). Need structured search, evidence table, plain-language summary for a policy brief.",
  status: "QUOTED", deadline: daysAhead(14), budget: 320000, agreed: 300000,
  created: daysAgo(4), updated: daysAgo(2),
});
addInvoice({
  number: invNum(), client: users.mwangi[0], project: p9, amount: 300000, status: "PAID",
  desc: "WRP-2026-Z9P4S — Rapid evidence scan: urban heat & maternal health",
  due: daysAgo(1), paidAt: daysAgo(1), created: daysAgo(2),
  payment: { method: "CARD", status: "ESCROWED", ref: "pay_a81d36f5c2074be9" },
});

// ------------------------------------------------------------ quote requests
const qr1 = id("qr");
db.prepare(
  `INSERT INTO quote_requests (id, ref, name, email, organisation, service_id, discipline, details, budget_cents, deadline, status, created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?, 'NEW', ?)`
).run(qr1, "WRP-Q-8F2A61", "Elena Petrova", "e.petrova@nhs-example.org", "St. Mary's Clinical Research Unit",
  svc["Statistical Analysis"], "Medical & Health Research",
  "Registry-based cohort (n≈9,000) on post-discharge readmissions. Need propensity-score matching, Cox models, and a lagged sensitivity analysis. Output: tables for a BMJ Open submission.",
  450000, daysAhead(21), daysAgo(2));

const qr2 = id("qr");
db.prepare(
  `INSERT INTO quote_requests (id, ref, name, email, organisation, service_id, discipline, details, budget_cents, deadline, status, created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?, 'NEW', ?)`
).run(qr2, "WRP-Q-3C7B90", "Prof. James Mwangi", "client2@demo.io", "University of Nairobi",
  svc["Academic Editing & Proofreading"], "Education Research",
  "Two chapters of a monograph (~18,000 words) need copy-editing to Chicago style and reference cleanup before press. British English.",
  180000, daysAhead(12), daysAgo(1));

// ------------------------------------------------------------------ the feed
const feed = [
  ["ANNOUNCEMENT", "2026 vetted-researcher cohort is open",
    "We are onboarding 40 new vetted researchers across medical, social-science and STEM disciplines. Credential checks run weekly; accepted researchers get priority matching and the public vetted badge.",
    1, 1, null, daysAgo(9)],
  ["TREND", "PRISMA 2020 in practice: what editors now expect",
    "Living systematic reviews, ROBINS-E for non-randomized exposures, and mandatory sharing of screening logs are becoming baseline expectations at evidence-synthesis journals. Our QC rubric now mirrors this — clients get reviewer-ready methods sections by default.",
    1, 1, null, daysAgo(6)],
  ["COMPLETED_PROJECT", "Case study: meta-analysis of school-based mindfulness (education psychology)",
    "A vetted Wulweth researcher delivered a 23-study random-effects meta-analysis (Hedges' g = 0.38) that passed peer review with no statistical comments. Client identity withheld; deliverable format: journal-ready manuscript + coded dataset.",
    1, 1, p4, daysAgo(5)],
  ["JOB", "Open engagement: rapid evidence scan — urban heat & maternal health",
    "Funded and escrowed. Two-week rapid review on urban heat exposure and pregnancy outcomes for a policy brief. Best suited to an environmental-health or epidemiology background. Claim to be matched — first qualified claim wins.",
    1, 1, p9, daysAgo(2)],
  ["ANNOUNCEMENT", "Data-security upgrade: per-project encryption keys",
    "Rolling out per-project envelope encryption for stored manuscripts and datasets, ahead of our ISO 27001 readiness review in Q4. No action needed from clients or researchers.",
    0, 1, null, daysAgo(1)],
];
for (const [type, title, body, published, anonymized, projectId, created] of feed) {
  db.prepare(
    `INSERT INTO feed_posts (id, type, title, body, published, anonymized, project_id, author_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(id("fp"), type, title, body, published, anonymized, projectId, users.admin[0], created);
}

console.log("Seed complete:");
console.log("  services:        ", services.length);
console.log("  users:           ", Object.keys(users).length, "(password: password123)");
console.log("  projects:        ", 9);
console.log("  invoices:        ", invSeq);
console.log("  deliverable PDFs written to .data/uploads/");
