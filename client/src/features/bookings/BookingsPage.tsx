import React, { useState } from "react";
import { PageHeader } from "@/components/ui/ssot/PageHeader";
import { SegmentedHeader } from "@/components/ui/ssot/SegmentedHeader";
import { UpcomingTab } from "./UpcomingTab";
import { PastTab } from "./PastTab";

const TABS = ["Upcoming", "Past"];

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState(0);

  // Format today's date like "Monday, 18 August"
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen" style={{ background: "#1B1B1B" }}>
      <PageHeader title="Bookings" subtitle={dateStr} />

      <div className="px-4 pt-2 pb-3">
        <SegmentedHeader
          options={TABS}
          activeIndex={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div className="px-4 pb-[110px]">
        {activeTab === 0 ? <UpcomingTab /> : <PastTab />}
      </div>
    </div>
  );
}
