import React from "react";
import { Route, Switch } from "wouter";
import BottomNav from "@/components/BottomNav";
import { ActionPanel } from "@/components/ActionPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import Dashboard from "@/pages/Dashboard";
import Conversations from "@/pages/Conversations";
import Chat from "@/pages/Chat";
import Calendar from "@/pages/Calendar";
import Settings from "@/pages/Settings";
import WorkHours from "@/pages/WorkHours";
import Clients from "@/pages/Clients";
import BankPayoutsPage from "@/pages/BankPayoutsPage";
import PayoutHistory from "@/pages/PayoutHistory";
import NotificationsManagement from "@/pages/NotificationsManagement";
import Subscriptions from "@/pages/Subscriptions";
import LeadDetail from "@/pages/LeadDetail";
import ErrorDashboard from "@/pages/admin/ErrorDashboard";
import NotFound from "@/pages/NotFound";
import { useAppointmentCheckIn } from "@/features/appointments/useAppointmentCheckIn";
import { AppointmentCheckInModal } from "@/components/modals/AppointmentCheckInModal";

export default function ArtistShell() {
  return (
    <div className="min-h-screen pb-16">
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/conversations" component={Conversations} />
        <Route path="/chat/:id" component={Chat} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/settings" component={Settings} />
        <Route path="/work-hours" component={WorkHours} />
        <Route path="/clients" component={Clients} />
        <Route path="/bank-payouts" component={BankPayoutsPage} />
        <Route path="/payout-history" component={PayoutHistory} />
        <Route path="/notifications-management" component={NotificationsManagement} />
        <Route path="/subscriptions" component={Subscriptions} />
        <Route path="/lead/:id" component={LeadDetail} />
        <Route path="/admin/errors" component={ErrorDashboard} />
        <Route component={NotFound} />
      </Switch>

      <ErrorBoundary boundary="fab">
        <BottomNav />
        <ActionPanel />
      </ErrorBoundary>
      
      <AppointmentCheckInOverlay />
    </div>
  );
}

function AppointmentCheckInOverlay() {
  const [dismissed, setDismissed] = React.useState<number | null>(null);
  const { activeCheckIn, updateAppointment } = useAppointmentCheckIn();

  const activeId = activeCheckIn?.appointment?.id;

  React.useEffect(() => {
    if (activeId && activeId !== dismissed) {
      setDismissed(null);
    }
  }, [activeId, dismissed]);

  if (!activeCheckIn || dismissed === activeCheckIn.appointment.id) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] flex justify-center px-4 pt-[env(safe-area-inset-top,12px)] pointer-events-none">
      <div className="w-full max-w-md pointer-events-auto">
        <AppointmentCheckInModal
          isOpen={true}
          checkIn={activeCheckIn}
          onDismiss={() => {
            setDismissed(activeCheckIn.appointment.id);
          }}
          updateAppointment={updateAppointment}
        />
      </div>
    </div>
  );
}
