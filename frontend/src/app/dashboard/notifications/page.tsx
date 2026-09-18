"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { get, post, qs } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { Badge, Button, Card, CardHeader, EmptyState, Pagination, Spinner, useToast } from "@/components/ui";

const CATEGORY_LABELS: Record<string, { label: string; className: string }> = {
  REQUEST: { label: "Request", className: "bg-ink-50 text-ink-600 ring-ink-100" },
  PROJECT: { label: "Project", className: "bg-teal-50 text-teal-700 ring-teal-200" },
  QUOTE: { label: "Quote", className: "bg-gold-100/60 text-gold-600 ring-gold-400/40" },
  PAYMENT: { label: "Payment", className: "bg-teal-50 text-teal-700 ring-teal-200" },
  MESSAGE: { label: "Message", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  DELIVERABLE: { label: "Deliverable", className: "bg-ink-50 text-ink-600 ring-ink-100" },
  ASSIGNMENT: { label: "Assignment", className: "bg-teal-50 text-teal-700 ring-teal-200" },
  QC: { label: "Quality Control", className: "bg-gold-100/60 text-gold-600 ring-gold-400/40" },
  SYSTEM: { label: "System", className: "bg-slate-100 text-slate-500 ring-slate-200" },
};

export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    get(`/notifications${qs({ page, unread_only: unreadOnly || undefined, page_size: 20 })}`)
      .then((d) => { setItems(d.items ?? []); setPages(d.pages ?? 1); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [page, unreadOnly]);

  useEffect(load, [load]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold">Notifications</h1>
          <p className="mt-0.5 text-[13.5px] text-slate-500">Everything that needs your attention, in one place.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={unreadOnly ? "teal" : "secondary"} onClick={() => { setUnreadOnly(!unreadOnly); setPage(1); }}>
            {unreadOnly ? "Showing unread" : "Show unread only"}
          </Button>
          <Button size="sm" variant="secondary" onClick={async () => { await post("/notifications/read-all"); load(); }}>
            Mark all read
          </Button>
        </div>
      </div>

      <Card>
        {loading ? <div className="py-16 text-center"><Spinner /></div> : items.length === 0 ? (
          <EmptyState title="No notifications" body={unreadOnly ? "You're all caught up." : "Activity on your requests, projects and payments appears here."} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id}>
                  <button onClick={async () => { if (!n.read_at) { await post(`/notifications/${n.id}/read`); } if (n.link) location.href = n.link; else load(); }}
                    className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 ${!n.read_at ? "bg-teal-50/40" : ""}`}>
                    <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.read_at ? "bg-transparent" : "bg-teal-500"}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-[14px] ${n.read_at ? "font-medium text-slate-600" : "font-semibold text-ink-600"}`}>{n.title}</span>
                        {n.type && CATEGORY_LABELS[n.type] && (
                          <Badge className={`text-[10px] ${CATEGORY_LABELS[n.type].className}`}>{CATEGORY_LABELS[n.type].label}</Badge>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-slate-500">{n.body}</span>
                      <span className="mt-1 block text-[11.5px] text-slate-400">{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-5 py-4"><Pagination page={page} pages={pages} onPage={setPage} /></div>
          </>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader title="Notification preferences" />
        <p className="mt-2 text-[13px] text-slate-500">
          Email notifications are sent for quotes awaiting your approval, invoice due dates, project status changes,
          deliverable decisions and messages. Manage delivery channels and quiet hours in your profile — in-app
          notifications here always reflect real account activity.
        </p>
        <Link href="/dashboard/profile" className="mt-3 inline-block text-[13px] font-medium text-teal-700 hover:underline">Open profile settings →</Link>
      </Card>
    </div>
  );
}
