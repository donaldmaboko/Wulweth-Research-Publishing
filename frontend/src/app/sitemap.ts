import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/services", "/expertise", "/disciplines", "/opportunities", "/feed",
    "/research-integrity", "/about", "/contact", "/register", "/signin",
    "/policies/privacy", "/policies/terms", "/policies/copyright", "/policies/cookies",
    "/policies/data-retention", "/policies/integrity"];
  return routes.map((r) => ({
    url: `${SITE}${r}`,
    lastModified: new Date(),
    changeFrequency: r === "" ? "weekly" : "monthly",
    priority: r === "" ? 1 : r.startsWith("/policies") ? 0.4 : 0.8,
  }));
}
