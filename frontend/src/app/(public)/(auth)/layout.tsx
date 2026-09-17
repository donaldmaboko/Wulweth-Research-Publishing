import { Logo } from "@/components/public-header";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-68px)] lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-10 sm:px-12">
        <div className="w-full max-w-md self-center">
          <div className="mb-8 lg:hidden"><Logo /></div>
          {children}
        </div>
      </div>
      <aside className="relative hidden overflow-hidden bg-ink-600 lg:block" aria-hidden="true">
        <img src="/images/hero-abstract.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="grid-bg absolute inset-0" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="font-display text-[30px] font-semibold leading-snug">
            Where boundless curiosity meets limitless potential
          </p>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-100/85">
            One professional platform for research support, verified expertise, secure
            collaboration and publishing — coordinated by the Wulweth desk with quality control
            and research integrity at the core.
          </p>
        </div>
      </aside>
    </div>
  );
}
