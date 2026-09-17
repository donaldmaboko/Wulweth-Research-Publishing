import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Wulweth Research & Publishing — research support, professional onboarding, integrity reports and general enquiries.",
};

const CHANNELS = [
  { title: "Research support", body: "Scope a project, ask about services, or plan an engagement.", email: "support@wulweth.example" },
  { title: "Professional onboarding", body: "Questions about verification, profiles and working with Wulweth.", email: "professionals@wulweth.example" },
  { title: "Research integrity & copyright", body: "Report a concern about content or conduct on the platform.", email: "integrity@wulweth.example" },
  { title: "Privacy & data protection", body: "Data access, correction, export and deletion requests.", email: "privacy@wulweth.example" },
];

export default function ContactPage() {
  return (
    <>
      <section className="bg-ink-600 py-16 text-white">
        <div className="container-w max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Contact</p>
          <h1 className="mt-3 font-display text-[34px] font-semibold sm:text-[42px]">Talk to the Wulweth desk</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-100/90">
            The fastest way to start a project is a research request from your workspace — it
            reaches the whole desk with full context. For everything else, reach the right team
            directly.
          </p>
        </div>
      </section>

      <div className="container-w max-w-4xl py-14">
        <div className="grid gap-5 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <div key={c.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
              <h2 className="text-[16px] font-semibold text-ink-600">{c.title}</h2>
              <p className="mt-1.5 text-[13.5px] text-slate-500">{c.body}</p>
              <a href={`mailto:${c.email}`} className="mt-3 inline-block text-[13.5px] font-semibold text-teal-700 hover:underline">{c.email}</a>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-[13.5px] leading-relaxed text-slate-500">
          <p className="font-semibold text-ink-600">Registered office</p>
          <p className="mt-1">Wulweth Research &amp; Publishing · Gaborone, Botswana</p>
          <p className="mt-3 font-semibold text-ink-600">Response times</p>
          <p className="mt-1">Research support: within 1 business day · Integrity reports: prioritised review</p>
        </div>
      </div>
    </>
  );
}
