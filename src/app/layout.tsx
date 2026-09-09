import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser, homeForRole } from "@/lib/auth";
import { WulwethMark } from "@/components/ui";

export const metadata: Metadata = {
  title: {
    default: "Wulweth Research & Publishing — The Research-Only Marketplace",
    template: "%s · Wulweth Research & Publishing",
  },
  description:
    "Where boundless curiosity meets limitless potential. Wulweth is the managed marketplace exclusively for research: literature reviews, statistical analysis, journal publication support, thesis help and more — delivered by vetted researchers under QC and escrow protection.",
  keywords: [
    "research marketplace", "academic research services", "literature review service",
    "statistical analysis", "journal publication support", "thesis support",
    "research consultancy",
  ],
  openGraph: {
    title: "Wulweth Research & Publishing",
    description:
      "The managed marketplace exclusively for research. Vetted researchers, escrow-protected payments, QC on every deliverable.",
    type: "website",
  },
};

const portalLinks: Record<string, { href: string; label: string }> = {
  ADMIN: { href: "/admin", label: "Admin console" },
  FREELANCER: { href: "/researcher", label: "Researcher studio" },
  CLIENT: { href: "/portal", label: "My projects" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const portal = user ? portalLinks[user.role] : null;

  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 border-b border-ink-900/10 bg-parchment/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <WulwethMark className="h-9 w-9" />
              <span className="leading-tight">
                <span className="block font-display text-[17px] font-bold tracking-tight text-ink-950">
                  Wulweth
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-700">
                  Research &amp; Publishing
                </span>
              </span>
            </Link>

            <nav className="ml-2 hidden items-center gap-5 text-sm font-medium text-ink-700 md:flex">
              <Link href="/services" className="hover:text-ink-950">Services</Link>
              <Link href="/feed" className="hover:text-ink-950">Company feed</Link>
              <Link href="/#how-it-works" className="hover:text-ink-950">How it works</Link>
              <Link href="/#trust" className="hover:text-ink-950">Why Wulweth</Link>
            </nav>

            <div className="ml-auto flex items-center gap-2.5">
              {user && portal ? (
                <>
                  <Link href={portal.href} className="btn-secondary btn-sm hidden sm:inline-flex">
                    {portal.label}
                  </Link>
                  <span className="hidden text-xs text-ink-500 lg:inline">
                    {user.name} · {user.role.toLowerCase()}
                  </span>
                  <form action="/api/auth/signout" method="post">
                    <button className="btn-secondary btn-sm" type="submit">Sign out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/signin" className="btn-secondary btn-sm">Sign in</Link>
                  <Link href="/signup" className="btn-gold btn-sm">Get started</Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-16rem)]">{children}</main>

        <footer className="mt-16 border-t border-ink-900/10 bg-ink-950 text-ink-200">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <WulwethMark className="h-9 w-9" />
                <span className="font-display text-lg font-bold text-white">Wulweth Research &amp; Publishing</span>
              </div>
              <p className="mt-3 max-w-md text-sm leading-6 text-ink-300">
                Where boundless curiosity meets limitless potential. The managed marketplace
                built exclusively for research — every project matched to a vetted researcher,
                quality-controlled by our editors, and protected by escrow until you approve.
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-gold-300">Platform</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/services" className="hover:text-white">Service catalog</Link></li>
                <li><Link href="/quote" className="hover:text-white">Get a quote</Link></li>
                <li><Link href="/feed" className="hover:text-white">Company feed</Link></li>
                <li><Link href="/signup" className="hover:text-white">Join as a researcher</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-gold-300">Trust &amp; compliance</div>
              <ul className="mt-3 space-y-2 text-sm text-ink-300">
                <li>GDPR-aligned data handling</li>
                <li>Escrow-protected payments</li>
                <li>Anonymized case studies</li>
                <li>hello@wulweth.example</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 py-5 text-center text-xs text-ink-400">
            © {new Date().getFullYear()} Wulweth Research &amp; Publishing. MVP demonstration build — payments are simulated.
          </div>
        </footer>
      </body>
    </html>
  );
}
