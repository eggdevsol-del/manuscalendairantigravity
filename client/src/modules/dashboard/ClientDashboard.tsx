import { trpc } from "@/lib/trpc";
import { DashboardHeader } from "./DashboardHeader";
import { ClientUpcoming } from "./ClientUpcoming";
import { VoucherCarousel } from "./VoucherCarousel";
import { InspirationFeed } from "./InspirationFeed";
import { useAuth } from "@/_core/hooks/useAuth";

export function ClientDashboard() {
  const { user } = useAuth();
  const {
    data: overview,
    isLoading,
    error,
  } = trpc.dashboard.getClientOverview.useQuery();

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
      <DashboardHeader
        name={user?.name || "Client"}
        subtitle="Ready to book your next session?"
      />

      <ClientUpcoming appointment={overview.nextAppointment} />

      <VoucherCarousel vouchers={overview.activeVouchers} />

      <InspirationFeed likes={overview.recentLikes} />
    </div>
  );
}
