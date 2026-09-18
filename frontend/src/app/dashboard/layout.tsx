"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { Logo } from "@/components/public-header";
import { Avatar, Spinner } from "@/components/ui";
import { fetchMe, get, isStaff, isProfessional, isAdmin, roleLabel, SessionUser } from "@/lib/api";

type NavItem = { href: string; label: string; icon: string };

const ICONS: Record<string, string> = {
  home: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75",
  requests: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  projects: "M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z",
  finance: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z",
  opportunities: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0",
  profile: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  qc: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  moderation: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  admin: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  notifications: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
  organization: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
};

function nav(user: SessionUser): NavItem[] {
  const items: NavItem[] = [{ href: "/dashboard", label: "Overview", icon: "home" }];
  if (isStaff(user) || user.role === "CLIENT" || user.role === "ORGANIZATION") {
    items.push({ href: "/dashboard/requests", label: "Research Requests", icon: "requests" });
  }
  items.push({ href: "/dashboard/projects", label: "Projects", icon: "projects" });
  items.push({ href: "/dashboard/finance", label: isProfessional(user) ? "Earnings & Payouts" : "Quotes, Invoices & Payments", icon: "finance" });
  if (!isStaff(user)) {
    items.push({ href: "/dashboard/opportunities", label: "Research Opportunities", icon: "opportunities" });
  } else {
    items.push({ href: "/dashboard/opportunities", label: "Opportunities", icon: "opportunities" });
  }
  if (user.role === "QC_REVIEWER" || isStaff(user)) items.push({ href: "/dashboard/qc", label: "Quality Control", icon: "qc" });
  if (isStaff(user)) items.push({ href: "/dashboard/moderation", label: "Moderation & Integrity", icon: "moderation" });
  if (isAdmin(user)) items.push({ href: "/dashboard/admin", label: "Administration", icon: "admin" });
  if (user.role === "ORGANIZATION") items.push({ href: "/dashboard/organization", label: "Organization", icon: "organization" });
  items.push({ href: "/dashboard/profile", label: "My Profile", icon: "profile" });
  items.push({ href: "/dashboard/notifications", label: "Notifications", icon: "notifications" });
  return items;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, refresh } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    let active = true;
    const poll = () => get("/notifications/unread-count").then((d) => { if (active) setUnread(d.count ?? 0); }).catch(() => {});
    poll();
    const t = setInterval(poll, 20000);
    return () => { active = false; clearInterval(t); };
  }, [pathname]);

  useEffect(() => {
    if (!loading && !user) router.replace("/signin?next=" + encodeURIComponent(pathname));
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-ink-400"><Spinner className="h-8 w-8" /></div>;
  }

  const items = nav(user);

  return (
    <div className="flex min-h-screen bg-slate-50/80">
      {/* sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex no-print">
        <div className="flex h-[68px] items-center border-b border-slate-100 px-5">
          <Logo compact />
          <span className="ml-2 font-display text-[15px] font-semibold text-ink-600">Wulweth</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 scrollbar-thin" aria-label="Workspace">
          {items.map((item) => {
            const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                  active ? "bg-ink-600 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-ink-600"}`}>
                <svg className="h-[18px] w-[18px] flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={ICONS[item.icon]} />
                </svg>
                {item.label}
                {item.icon === "notifications" && unread > 0 && (
                  <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${active ? "bg-white/20 text-white" : "bg-teal-600 text-white"}`}>{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <Link href="/" className="block rounded-lg px-3 py-2 text-[12.5px] font-medium text-slate-400 hover:bg-slate-50 hover:text-ink-600">
            ← Back to public website
          </Link>
        </div>
      </aside>

      {/* topbar + content */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 no-print">
          <div className="flex items-center gap-3 lg:hidden">
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" aria-expanded={menuOpen} className="rounded-md p-2 text-ink-600 hover:bg-slate-100">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <Logo compact />
          </div>
          <div className="hidden lg:block">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{roleLabel(user.role)} workspace</p>
            <p className="text-[14px] font-semibold text-ink-600">{user.full_name}</p>
          </div>
          <form action="/dashboard/search" className="hidden max-w-xs flex-1 md:block" role="search">
            <input name="q" placeholder="Search projects, requests, services…" aria-label="Global search"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-[13px] outline-none transition-colors placeholder:text-slate-400 focus:border-teal-400 focus:bg-white" />
          </form>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink-600" aria-label={`Notifications (${unread} unread)`}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS.notifications} /></svg>
              {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[9.5px] font-bold text-white">{unread}</span>}
            </Link>
            {!user.email_verified && (
              <Link href="/dashboard/profile" className="hidden rounded-lg bg-gold-100/70 px-3 py-1.5 text-[12px] font-semibold text-gold-600 ring-1 ring-gold-400/40 sm:block">
                Verify your email
              </Link>
            )}
            <button onClick={signOut} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50">
              Sign out
            </button>
          </div>
        </header>

        {menuOpen && (
          <nav className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden" aria-label="Mobile workspace">
            {items.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-slate-600 hover:bg-slate-100">{item.label}</Link>
            ))}
          </nav>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
