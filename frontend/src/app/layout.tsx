import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth";
import { ToastProvider } from "@/components/ui";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", axes: ["SOFT", "WONK"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Wulweth Research & Publishing — Where boundless curiosity meets limitless potential",
    template: "%s · Wulweth Research & Publishing",
  },
  description:
    "Wulweth Research & Publishing connects research needs with professional research expertise — statistical analysis, data services, research consulting and publishing support.",
  keywords: ["research services", "statistical analysis", "research consulting", "data services", "publishing support", "research expertise"],
  openGraph: {
    type: "website",
    siteName: "Wulweth Research & Publishing",
    title: "Wulweth Research & Publishing",
    description: "Where boundless curiosity meets limitless potential. Connect research needs with professional research expertise.",
    images: [{ url: "/images/hero-abstract.jpg", width: 1200, height: 630, alt: "Wulweth Research & Publishing" }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
