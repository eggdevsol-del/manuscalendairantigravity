import { Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { UpcomingTab } from "./UpcomingTab";
import { PendingPlans } from "./PendingPlans";
import { PastTab } from "./PastTab";
export default function BookingsPage() {
  const [tab, setTab] = useState("Upcoming");
  const { user } = useAuth();
  return (
    <PageShell>
      <PageHeader
        title={`Hi${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        subtitle="Your tattoo bookings, all in one place"
      />
      <main className="workspace-scroll">
        <div className="workspace-content !max-w-3xl space-y-6">
          <div
            className="workspace-tabs"
            role="tablist"
            aria-label="Your bookings"
          >
            {["Upcoming", "Past"].map(t => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Upcoming" ? (
            <>
              <PendingPlans />
              <UpcomingTab />
            </>
          ) : (
            <PastTab />
          )}
          <details className="border-t pt-4">
            <summary className="min-h-12 cursor-pointer text-sm">
              More options
            </summary>
            <div className="flex flex-wrap gap-5">
              <Link className="workspace-link" href="/waitlist">
                Cancellation offers
              </Link>
              <Link className="workspace-link" href="/discover">
                Explore artists
              </Link>
              <Link className="workspace-link" href="/purchases">
                Your purchases
              </Link>
            </div>
          </details>
        </div>
      </main>
    </PageShell>
  );
}
