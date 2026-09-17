"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth";
import { LogoMark } from "@/components/logo-mark";
import { Avatar } from "@/components/ui";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/expertise", label: "Research Expertise" },
  { href: "/opportunities", label: "Research Opportunities" },
  { href: "/feed", label: "Research Feed" },
  { href: "/research-integrity", label: "Research Integrity" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="Wulweth Research & Publishing — home">
      <LogoMark light={light} className="h-[30px] w-auto shrink-0 transition-transform group-hover:-translate-y-px" />
      {!compact && (
        <span className="leading-tight">
          <span className={`block font-display text-[17px] font-semibold ${light ? "text-white" : "text-ink-600"}`}>Wulweth</span>
          <span className={`block text-[10px] font-semibold uppercase tracking-[0.14em] ${light ? "text-teal-200" : "text-teal-600"}`}>Research &amp; Publishing</span>
        </span>
      )}
    </Link>
  );
}

export default function PublicHeader() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100/80 bg-white/95 backdrop-blur no-print">
      <div className="container-w flex h-[68px] items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {NAV.slice(1).map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors ${active ? "bg-ink-50 text-ink-600" : "text-slate-600 hover:bg-slate-50 hover:text-ink-600"}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2.5 lg:flex">
          {loading ? null : user ? (
            <>
              <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg border border-ink-200 py-1.5 pl-1.5 pr-3.5 transition-colors hover:border-ink-300 hover:bg-ink-50">
                <Avatar name={user.full_name} className="h-7 w-7 text-[11px]" />
                <span className="text-left leading-tight">
                  <span className="block text-[13px] font-semibold text-ink-600">{user.full_name.split(" ")[0]}&rsquo;s workspace</span>
                </span>
              </Link>
            </>
          ) : (
            <>
              <Link href="/signin" className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink-600 hover:bg-ink-50">Sign In</Link>
              <Link href="/register" className="rounded-lg bg-ink-600 px-4 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-ink-700">
                Create Account
              </Link>
            </>
          )}
        </div>
        <button className="rounded-md p-2 text-ink-600 lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle navigation menu">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
        </button>
      </div>
      {open && (
        <nav className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 lg:hidden" aria-label="Mobile">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-ink-50">{item.label}</Link>
          ))}
          <div className="mt-2 flex gap-2 border-t border-slate-100 pt-3">
            {user ? (
              <Link href="/dashboard" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-ink-600 px-4 py-2.5 text-center text-sm font-medium text-white">Go to workspace</Link>
            ) : (
              <>
                <Link href="/signin" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-ink-200 px-4 py-2.5 text-center text-sm font-medium text-ink-600">Sign In</Link>
                <Link href="/register" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-ink-600 px-4 py-2.5 text-center text-sm font-medium text-white">Create Account</Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
