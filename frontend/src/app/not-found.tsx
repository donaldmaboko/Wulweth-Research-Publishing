import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 font-display text-[30px] font-semibold">This page could not be found</h1>
      <p className="mt-2 max-w-md text-[14px] text-slate-500">
        The link may be outdated or the page may have moved. Try the services catalogue or the research expertise directory.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="rounded-lg bg-ink-600 px-5 py-3 text-sm font-semibold text-white hover:bg-ink-700">Back to home</Link>
        <Link href="/services" className="rounded-lg border border-ink-200 px-5 py-3 text-sm font-semibold text-ink-600 hover:bg-ink-50">View services</Link>
      </div>
    </div>
  );
}
