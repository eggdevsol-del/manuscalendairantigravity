import { trpc } from "@/lib/trpc";
import { DashboardHeader } from "./DashboardHeader";
import { ArtistStatsRow } from "./ArtistStatsRow";
import { NextAppointmentCard } from "./NextAppointmentCard";
import { DailyTimeline } from "./DailyTimeline";
import { QuickActions } from "./QuickActions";
import { useAuth } from "@/_core/hooks/useAuth";

export function ArtistDashboard() {
  const { user } = useAuth();
  const {
    data: overview,
    isLoading,
    error,
  } = trpc.dashboard.getArtistOverview.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground animate-pulse">
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        Failed to load dashboard: {error.message}
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="min-h-screen py-6 px-4 pb-24 max-w-md mx-auto">
      <DashboardHeader name={user?.name || "Artist"} />

      <ArtistStatsRow stats={overview.stats} />

      <QuickActions />

      <NextAppointmentCard appointment={overview.nextAppointment} />

      <DailyTimeline appointments={overview.todayTimeline} />
    </div>
  );
}
