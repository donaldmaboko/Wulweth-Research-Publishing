import Link from "next/link";
import { requireRole } from "@/lib/auth";

const tabs = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/requests", label: "Requests & quotes" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/qc", label: "Quality control" },
  { href: "/admin/finance", label: "Finance & payouts" },
  { href: "/admin/feed", label: "Company feed" },
  { href: "/admin/users", label: "Users" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-gold-700">Wulweth desk — admin console</div>
          <div className="font-display text-xl font-bold text-ink-950">{user.name}</div>
        </div>
      </div>
      <nav className="mb-8 flex flex-wrap gap-1 rounded-lg bg-white p-1 ring-1 ring-ink-900/10">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-parchment hover:text-ink-950">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
