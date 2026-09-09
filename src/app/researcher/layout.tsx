import Link from "next/link";
import { requireRole } from "@/lib/auth";

const tabs = [
  { href: "/researcher", label: "My assignments" },
  { href: "/researcher/jobs", label: "Job feed" },
  { href: "/researcher/earnings", label: "Earnings" },
  { href: "/researcher/profile", label: "Profile & portfolio" },
];

export default async function ResearcherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("FREELANCER");
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-gold-700">Researcher studio</div>
          <div className="flex items-center gap-2 font-display text-xl font-bold text-ink-950">
            {user.name}
            {user.verified ? <span className="pill bg-emerald-50 text-emerald-800 ring-emerald-300">✔ Vetted</span> : null}
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-lg bg-white p-1 ring-1 ring-ink-900/10">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-parchment hover:text-ink-950">
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
