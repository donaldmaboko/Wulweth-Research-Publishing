import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Policy = { title: string; description: string; updated: string; sections: { heading: string; body: string[] }[] };

const POLICIES: Record<string, Policy> = {
  privacy: {
    title: "Privacy Policy",
    description: "How Wulweth Research & Publishing collects, uses, protects and shares personal data.",
    updated: "17 September 2026",
    sections: [
      { heading: "1. Who we are", body: [
        "Wulweth Research & Publishing (“Wulweth”, “we”) operates a professional platform connecting research needs with research expertise. For data-protection purposes, Wulweth is the controller of personal data processed through the platform.",
      ]},
      { heading: "2. Data we collect", body: [
        "Account data: name, email address, password (stored only as a bcrypt hash), role, country and optional profile details.",
        "Professional profile data: qualifications, publications, portfolio items, expertise declarations, verification records and uploaded qualification documents.",
        "Platform activity: research requests, quotes, invoices, payments, messages, notifications, feed contributions, moderation records and audit logs.",
        "Technical data: IP address, user agent and session identifiers, collected for security and fraud prevention.",
      ]},
      { heading: "3. Why we process data", body: [
        "To provide the platform: operating accounts, coordinating projects, processing quotes, invoices, payments and payouts, and delivering messages and notifications (performance of our contract with you).",
        "To keep the platform safe: research integrity screening, moderation, copyright protection, rate limiting and audit logging (legitimate interests and legal obligations).",
        "To communicate: transactional emails about your projects and account. Marketing emails, if ever introduced, will be consent-based and optional.",
      ]},
      { heading: "4. Lawful bases and GDPR principles", body: [
        "Where the GDPR or similar regimes apply, we rely on performance of a contract, legitimate interests, legal obligation and consent as appropriate. We apply data-minimisation, purpose limitation, storage limitation and integrity/confidentiality principles throughout.",
      ]},
      { heading: "5. Sharing", body: [
        "We share data only as needed to run the platform: with the professional assigned to your project (project brief and documents), with payment providers for payment processing, with infrastructure providers under contract, and with authorities where required by law. We never sell personal data.",
      ]},
      { heading: "6. International transfers", body: [
        "Where data is transferred across borders, we use appropriate safeguards such as contractual clauses and provider certifications.",
      ]},
      { heading: "7. Retention", body: [
        "See the Data Retention Policy for category-specific periods. Financial records are retained as required by law; moderation and audit records are retained for accountability.",
      ]},
      { heading: "8. Your rights", body: [
        "You may request access, correction, export or deletion of your personal data, and manage email preferences from your workspace. Sign in and use Profile → Privacy, or write to privacy@wulweth.example. You may also lodge a complaint with your local data-protection authority.",
      ]},
      { heading: "9. Security", body: [
        "Encryption in transit and at rest for documents, hashed passwords, role-based access control, signed download links, audit logging and least-privilege access by platform staff.",
      ]},
    ],
  },
  terms: {
    title: "Terms of Service",
    description: "The terms governing use of the Wulweth Research & Publishing platform.",
    updated: "17 September 2026",
    sections: [
      { heading: "1. The service", body: [
        "Wulweth provides a professional platform through which clients submit research requests, Wulweth scopes and quotes the work, and verified research professionals deliver it under Wulweth's coordination and quality control. Wulweth manages matching and assignment; it is not an open bidding marketplace.",
      ]},
      { heading: "2. Accounts and roles", body: [
        "You must provide accurate information and keep credentials secure. Roles (client, professional, organization, staff) determine what you may do on the platform. Professional accounts are subject to qualification verification.",
      ]},
      { heading: "3. Research integrity", body: [
        "Our Research Integrity Policy forms part of these terms. We do not facilitate academic misconduct, fabricated data or references, forged documents, or detection evasion. Requests that conflict with the policy are refused.",
      ]},
      { heading: "4. Quotes, payment and payouts", body: [
        "Quotes are valid for the stated period. Invoices are payable by the stated due date. Professionals are paid from confirmed project funds after quality control approval, less Wulweth's service fee and any processing costs. The platform does not present itself as a regulated escrow service.",
      ]},
      { heading: "5. Intellectual property and copyright", body: [
        "You confirm you hold the rights to materials you upload. Deliverable ownership transfers to the client on full payment, unless agreed otherwise. Our Copyright Policy governs reports and takedowns.",
      ]},
      { heading: "6. Confidentiality", body: [
        "Project materials are shared only with the client, the assigned professional and authorized Wulweth staff. Confidentiality requirements declared in a request bind the engagement.",
      ]},
      { heading: "7. Suspension and termination", body: [
        "Accounts may be suspended or terminated for policy violations, including integrity and copyright breaches. You may close your account at any time; records we must keep by law are retained.",
      ]},
      { heading: "8. Liability", body: [
        "The platform is provided with professional care but without warranty of specific research outcomes. To the extent permitted by law, Wulweth's aggregate liability is limited to the fees paid for the engagement giving rise to the claim.",
      ]},
      { heading: "9. Governing law", body: [
        "These terms are governed by the laws of Botswana, without prejudice to mandatory consumer protections in your country of residence.",
      ]},
    ],
  },
  copyright: {
    title: "Copyright Policy",
    description: "How Wulweth protects copyright and handles reports of unauthorized reproduction.",
    updated: "17 September 2026",
    sections: [
      { heading: "1. Our commitment", body: [
        "Wulweth does not facilitate unauthorized reproduction of copyrighted research, books, articles, datasets, images, software or any other material.",
      ]},
      { heading: "2. What uploaders confirm", body: [
        "Before uploading any material you confirm that you: own the material; have permission to use it; have a valid licence; are using public-domain material; or are otherwise authorized to provide it.",
      ]},
      { heading: "3. Reporting", body: [
        "Signed-in users can report suspected infringement from any content. Reports go directly to the moderation desk with a full audit trail. You may also email copyright@wulweth.example.",
      ]},
      { heading: "4. Review and action", body: [
        "Reported material is reviewed promptly. Where infringement is likely, the material is removed or restricted and the uploader is notified with reasons. Repeat infringement leads to account restriction.",
      ]},
      { heading: "5. Counter-notification", body: [
        "If you believe material was removed in error, contact us with the reasons and any evidence of rights; we will review the decision and reinstate material where justified.",
      ]},
    ],
  },
  cookies: {
    title: "Cookie Policy",
    description: "How Wulweth uses cookies and similar technologies.",
    updated: "17 September 2026",
    sections: [
      { heading: "1. Essential cookies only", body: [
        "Wulweth uses a single first-party, httpOnly session cookie to keep you signed in securely. It is set only when you sign in and expires with your session. We do not use advertising or cross-site tracking cookies.",
      ]},
      { heading: "2. Managing cookies", body: [
        "You can clear or block cookies in your browser settings. Blocking the session cookie will prevent you from signing in.",
      ]},
      { heading: "3. Local storage", body: [
        "The interface stores no personal data in browser local storage beyond interface preferences.",
      ]},
    ],
  },
  "data-retention": {
    title: "Data Retention Policy",
    description: "How long Wulweth retains different categories of data.",
    updated: "17 September 2026",
    sections: [
      { heading: "1. Account and profile data", body: [
        "Retained while your account is active. After account closure, profile data is deactivated within 30 days; financial and audit records are retained as described below.",
      ]},
      { heading: "2. Project, quote and messaging records", body: [
        "Retained for 7 years after project completion to support dispute resolution, quality review and legal obligations.",
      ]},
      { heading: "3. Financial records", body: [
        "Invoices, payments, payouts and the immutable financial ledger are retained as required by tax and accounting law (typically 5–10 years depending on jurisdiction).",
      ]},
      { heading: "4. Verification records", body: [
        "Qualification verification outcomes are retained while a professional account is active and for 3 years after closure, to support platform trust decisions.",
      ]},
      { heading: "5. Moderation, reports and audit logs", body: [
        "Retained for 5 years for accountability, integrity enforcement and lawful request handling.",
      ]},
      { heading: "6. Deletion requests", body: [
        "Write to privacy@wulweth.example or use Profile → Privacy → Data controls in your workspace. We will action requests within 30 days, subject to legally required retention.",
      ]},
    ],
  },
  integrity: {
    title: "Research Integrity Policy",
    description: "The full policy defining legitimate research support and prohibited conduct on Wulweth.",
    updated: "17 September 2026",
    sections: [
      { heading: "1. Purpose", body: [
        "This policy defines how Wulweth supports legitimate research while refusing to facilitate research or academic misconduct in any form. It applies to all content and conduct on the platform.",
      ]},
      { heading: "2. Legitimate support", body: [
        "Statistical consultation and analysis; data cleaning, management and visualization; research design and methodology consultation; questionnaire and survey development; sampling consultation and power analysis; literature searching and evidence mapping; research editing, proofreading, formatting and journal preparation; research reporting and presentation support.",
      ]},
      { heading: "3. Prohibited requests and content", body: [
        "Plagiarism; contract cheating; completing assignments or examinations for dishonest submission; ghostwriting theses or dissertations intended for submission as another person's own work; fabricating datasets, results or references; falsifying or manipulating findings; forging academic documents; impersonation; copyright infringement; circumventing plagiarism or AI detection; and any other research or academic misconduct.",
      ]},
      { heading: "4. How we assess requests", body: [
        "We assess the purpose and intended use of each request, not just its wording. Automated screening flags risk; the moderation desk reviews flagged content and can approve, reject, restrict or request clarification. All actions are recorded.",
      ]},
      { heading: "5. Professional obligations", body: [
        "Professionals must deliver honest, documented work, must not misrepresent qualifications, and must decline requests that conflict with this policy — reporting them to the Wulweth desk.",
      ]},
      { heading: "6. Consequences", body: [
        "Violations lead to content removal, project cancellation, account suspension and, where warranted, reports to institutions or authorities.",
      ]},
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const policy = POLICIES[params.slug];
  if (!policy) return {};
  return { title: policy.title, description: policy.description };
}

export default function PolicyPage({ params }: { params: { slug: string } }) {
  const policy = POLICIES[params.slug];
  if (!policy) notFound();
  return (
    <>
      <section className="bg-ink-600 py-14 text-white">
        <div className="container-w max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Platform Policies</p>
          <h1 className="mt-3 font-display text-[32px] font-semibold sm:text-[40px]">{policy.title}</h1>
          <p className="mt-3 text-[13px] text-ink-200">Last updated: {policy.updated}</p>
        </div>
      </section>
      <div className="container-w max-w-3xl py-12">
        <div className="prose-w text-[14.5px] text-slate-600">
          {policy.sections.map((s) => (
            <section key={s.heading} className="mb-8">
              <h2 className="mb-2 font-display text-[19px] font-semibold text-ink-600">{s.heading}</h2>
              {s.body.map((p, i) => <p key={i}>{p}</p>)}
            </section>
          ))}
        </div>
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-[13px] text-slate-500">
          Questions about this policy? Write to <a className="link" href="mailto:privacy@wulweth.example">privacy@wulweth.example</a>.
        </p>
      </div>
    </>
  );
}
