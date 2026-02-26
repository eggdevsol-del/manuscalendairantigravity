import { StatCard } from "./StatCard";
import { Calendar, DollarSign, MessageSquare } from "lucide-react";

interface ArtistStatsRowProps {
  stats: {
    appointmentsToday: number;
    pendingRequests: number;
    totalRevenue: number;
  };
}

import { Link } from "wouter";

export function ArtistStatsRow({ stats }: ArtistStatsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <StatCard
        label="Today"
        value={stats.appointmentsToday}
        icon={Calendar}
        className="col-span-1 bg-blue-500/10"
      />
      <Link to="/conversations">
        <StatCard
          label="Requests"
          value={stats.pendingRequests}
          icon={MessageSquare}
          className="col-span-1 bg-orange-500/10 hover:bg-orange-500/20 cursor-pointer transition-colors"
        />
      </Link>
      <StatCard
        label="Total Revenue"
        value={`$${stats.totalRevenue.toLocaleString()}`}
        icon={DollarSign}
        className="col-span-2 bg-green-500/10"
      />
    </div>
  );
}
