import Link from "next/link";
import { Logo } from "@/components/public-header";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Platform",
    links: [
      { href: "/services", label: "Services" },
      { href: "/expertise", label: "Research Expertise" },
      { href: "/opportunities", label: "Research Opportunities" },
      { href: "/feed", label: "Research Feed" },
      { href: "/disciplines", label: "Research Disciplines" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/research-integrity", label: "Research Integrity" },
      { href: "/contact", label: "Contact" },
      { href: "/register", label: "Create Account" },
      { href: "/signin", label: "Sign In" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/policies/privacy", label: "Privacy Policy" },
      { href: "/policies/terms", label: "Terms of Service" },
      { href: "/policies/copyright", label: "Copyright Policy" },
      { href: "/policies/cookies", label: "Cookie Policy" },
      { href: "/policies/data-retention", label: "Data Retention Policy" },
    ],
  },
];

export default function PublicFooter() {
  return (
    <footer className="no-print bg-ink-600 text-ink-100">
      <div className="container-w grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs font-display text-[15px] italic leading-relaxed text-teal-200">
            &ldquo;Where boundless curiosity meets limitless potential&rdquo;
          </p>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ink-200/90">
            Wulweth Research &amp; Publishing connects research needs with professional research expertise —
            research services, data services, consulting and publishing support.
          </p>
          <p className="mt-5 text-[12.5px] text-ink-300">
            <a className="hover:text-white" href="mailto:hello@wulweth.example">hello@wulweth.example</a>
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-300">{col.title}</h3>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-[13.5px] text-ink-100/85 transition-colors hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-ink-500/60">
        <div className="container-w flex flex-col items-start justify-between gap-2 py-5 text-[12.5px] text-ink-300 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Wulweth Research &amp; Publishing. All rights reserved.</p>
          <p>Research · Expertise · Data · Collaboration · Quality · Integrity · Publishing</p>
        </div>
      </div>
    </footer>
  );
}
