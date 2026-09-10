import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import React, { useState } from "react";
import { PageHeader } from "@/components/ui/ssot/PageHeader";
import { SegmentedHeader } from "@/components/ui/ssot/SegmentedHeader";
import { UpcomingTab } from "./UpcomingTab";
import { PendingPlans } from "./PendingPlans";
import { PastTab } from "./PastTab";

const TABS = ["Upcoming", "Past"];

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const projects = trpc.conversations.list.useQuery();

  // Format today's date like "Monday, 18 August"
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="app-document bg-background">
      <PageHeader title="Bookings" subtitle={dateStr} />

      <div className="px-4 pt-2 pb-3">
        <SegmentedHeader
          options={TABS}
          activeIndex={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div className="px-4 pb-[110px] max-w-5xl mx-auto">
        {activeTab === 0 ? (
          <>
            <Link href="/waitlist" className="inline-flex min-h-11 items-center underline mb-3">Cancellation offers</Link>
            <PendingPlans />
            <section className="mb-6 space-y-3" aria-label="Your artists and projects">
              <h2 className="text-lg font-semibold">Your artists & projects</h2>
              <p className="text-sm text-muted-foreground">Follow an enquiry, review a brief or pick up where you left off.</p>
              {projects.isLoading && <p role="status">Loading your projects…</p>}
              {projects.error && <button className="min-h-11 underline" onClick={() => void projects.refetch()}>Projects could not load. Try again</button>}
              {projects.data?.length === 0 && <p className="text-sm text-muted-foreground">Your artist conversations will appear here after you send a request. Open your artist’s booking link to get started.</p>}
              <div className="grid sm:grid-cols-2 gap-3">
                {projects.data?.map(project => <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-2xl border bg-card p-4 min-h-14"><span className="font-semibold">{project.otherUser?.name || "Your artist"}</span><span className="block text-sm text-muted-foreground mt-1">Brief, sessions, forms & payments</span>{project.unreadCount > 0 && <span className="text-xs text-primary">{project.unreadCount} unread message{project.unreadCount === 1 ? "" : "s"}</span>}</Link>)}
              </div>
            </section>
            <UpcomingTab />
          </>
        ) : (
          <PastTab />
        )}
      </div>
    </div>
  );
}
