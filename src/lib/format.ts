const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function money(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return usd.format(cents / 100);
}

export function moneyShort(cents: number): string {
  const v = cents / 100;
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return usd.format(v);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/** Service-fee split used at payout time. Returns company fee in cents. */
export function computeFee(
  grossCents: number,
  mode: "PERCENT" | "FIXED",
  value: number
): number {
  if (mode === "FIXED") return Math.min(value, grossCents);
  return Math.round((grossCents * value) / 100);
}

export function stars(rating: number): string {
  return "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(0, 5 - rating);
}
