"use client";

import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId,
  useMemo, useState, ReactNode, ButtonHTMLAttributes, InputHTMLAttributes,
  SelectHTMLAttributes, TextareaHTMLAttributes,
} from "react";
import { statusLabel, statusTone } from "@/lib/format";

/* ---------------------------------- Button --------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "teal";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className = "", children, disabled, ...props },
  ref
) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-55 active:scale-[.98]";
  const sizes = { sm: "px-3 py-1.5 text-[13px]", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-[15px]" };
  const variants = {
    primary: "bg-ink-600 text-white shadow-sm hover:bg-ink-700",
    teal: "bg-teal-600 text-white shadow-sm hover:bg-teal-700",
    secondary: "border border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50",
    ghost: "text-ink-600 hover:bg-ink-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return (
    <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading} {...props}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/* ---------------------------------- Cards ---------------------------------- */

export function Card({ children, className = "", ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="text-[15px] font-semibold text-ink-600">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "ink" }: { label: string; value: ReactNode; hint?: string; tone?: "ink" | "teal" | "gold" }) {
  const tones = { ink: "text-ink-600", teal: "text-teal-600", gold: "text-gold-500" };
  return (
    <Card className="p-5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1.5 font-display text-[26px] font-semibold leading-none ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

/* --------------------------------- Badges ---------------------------------- */

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  return <Badge className={`${statusTone(status)} ${className}`}>{statusLabel(status)}</Badge>;
}

export function VerifiedBadge({ status }: { status: string }) {
  if (status === "VERIFIED")
    return (
      <Badge className="bg-teal-50 text-teal-700 ring-teal-200">
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z" clipRule="evenodd" /></svg>
        Qualification Verified
      </Badge>
    );
  if (status === "PENDING")
    return <Badge className="bg-gold-100/70 text-gold-600 ring-gold-400/40">Verification in Progress</Badge>;
  return <Badge className="bg-slate-100 text-slate-500 ring-slate-200">Verification Not Recorded</Badge>;
}

/* ---------------------------------- Forms ---------------------------------- */

export function Field({ label, hint, required, error, children, htmlFor }: {
  label: string; hint?: string; required?: boolean; error?: string | null; children: ReactNode; htmlFor?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-ink-600">
        {label} {required && <span className="text-rose-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...props }, ref) {
  return <input ref={ref} className={`${inputCls} ${className}`} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = "", ...props }, ref) {
  return <textarea ref={ref} className={`${inputCls} min-h-[96px] ${className}`} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className = "", children, ...props }, ref) {
  return <select ref={ref} className={`${inputCls} ${className}`} {...props}>{children}</select>;
});

/* ---------------------------------- Modal ---------------------------------- */

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-ink-900/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className={`relative mx-auto my-10 w-[calc(100%-2rem)] rounded-xl bg-white shadow-lift ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-600">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------- Tabs ----------------------------------- */

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50/70 p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)}
          className={`rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors ${
            active === t.id ? "bg-white text-ink-600 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-ink-600"}`}>
          {t.label}
          {typeof t.count === "number" && (
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold ${active === t.id ? "bg-teal-50 text-teal-700" : "bg-slate-200/70 text-slate-500"}`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- Toasts ---------------------------------- */

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
const ToastCtx = createContext<{ push: (message: string, tone?: Toast["tone"]) => void }>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4800);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status"
            className={`pointer-events-auto animate-fadeUp rounded-lg px-4 py-3 text-sm shadow-lift ring-1 ${
              t.tone === "success" ? "bg-teal-700 text-white ring-teal-800"
              : t.tone === "error" ? "bg-rose-700 text-white ring-rose-800"
              : "bg-ink-700 text-white ring-ink-800"}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------------------------- Misc ----------------------------------- */

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-ink-400">
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 3.75A.75.75 0 012.75 3h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 3.75zm0 4.25A.75.75 0 012.75 7.25h9a.75.75 0 010 1.5h-9A.75.75 0 012 8zm0 4.25a.75.75 0 01.75-.75h5.5a.75.75 0 010 1.5h-5.5a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>
      </div>
      <h3 className="text-[15px] font-semibold text-ink-600">{title}</h3>
      {body && <p className="mt-1 max-w-md text-[13px] text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, className = "h-9 w-9" }: { name: string; className?: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div aria-hidden="true" className={`flex items-center justify-center rounded-full bg-ink-600 font-display text-[13px] font-semibold text-teal-100 ${className}`}>
      {initials}
    </div>
  );
}

export function Alert({ tone = "info", title, role, children }: { tone?: "info" | "warning" | "success" | "error"; title?: string; role?: string; children: ReactNode }) {
  const tones = {
    info: "bg-ink-50/70 ring-ink-200 text-ink-700",
    warning: "bg-gold-100/50 ring-gold-400/40 text-gold-600",
    success: "bg-teal-50 ring-teal-200 text-teal-800",
    error: "bg-rose-50 ring-rose-200 text-rose-800",
  };
  return (
    <div role={role} className={`rounded-lg px-4 py-3 text-[13px] ring-1 ring-inset ${tones[tone]}`}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
            {head.map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm" aria-label="Pagination">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
      <span className="text-slate-500">Page {page} of {pages}</span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
    </nav>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
    }}>
      {copied ? "Copied" : label}
    </Button>
  );
}

export function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
