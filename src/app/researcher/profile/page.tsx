import { get } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ProfileForm } from "@/components/researcher-actions";

export default async function ResearcherProfilePage() {
  const user = await requireRole("FREELANCER");
  const profile = get<{
    headline: string | null; bio: string | null; disciplines: string | null;
    affiliation: string | null; orcid: string | null;
  }>(
    "SELECT headline, bio, disciplines, affiliation, orcid FROM users WHERE id = ?",
    user.id
  )!;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
      <Card className="p-7">
        <PageHeader
          title="Profile & portfolio"
          subtitle="The desk matches assignments using your disciplines and headline. Keep them precise."
        />
        <ProfileForm profile={profile} />
      </Card>
      <div className="space-y-4">
        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-ink-950">How matching works</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-ink-600">
            <li>Desk officers filter the roster by <strong>discipline match</strong> first.</li>
            <li>Vetted researchers are shown ahead of unvetted ones.</li>
            <li>Your headline and bio appear to clients on the project page.</li>
            <li>Portfolio links (DOIs, datasets) go in your bio — clickable after publishing.</li>
          </ol>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-ink-950">Getting vetted</h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            Vetting unlocks priority matching and the public trust badge. The desk reviews your
            credentials, ORCID record, a writing sample and a short discipline assessment — then
            flips the badge from this console.
          </p>
        </Card>
      </div>
    </div>
  );
}
