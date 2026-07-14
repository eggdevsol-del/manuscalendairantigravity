import React from "react";
import { Route, Switch } from "wouter";
import BottomNav from "@/components/BottomNav";
import { ActionPanel } from "@/components/ActionPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AnimatedSwitch } from "@/components/AnimatedSwitch";
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
import { ArrivalToast } from "@/components/ArrivalToast";

export default function ArtistShell() {
  return (
    <div className="min-h-screen pb-16">
      <AnimatedSwitch>
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
      </AnimatedSwitch>

      <ErrorBoundary boundary="fab">
        <BottomNav />
        <ActionPanel />
      </ErrorBoundary>
      
      <ArrivalOverlay />
    </div>
  );
}

function ArrivalOverlay() {
  const [dismissed, setDismissed] = React.useState<number | null>(null);
  const { activeCheckIn, updateAppointment } = useAppointmentCheckIn();

  const activeId = activeCheckIn?.appointment?.id;

  React.useEffect(() => {
    if (activeId && activeId !== dismissed) {
      setDismissed(null);
    }
  }, [activeId, dismissed]);

  // Only show for arrival phase — completion is handled by Stripe balance payment
  if (!activeCheckIn || activeCheckIn.phase !== "arrival" || dismissed === activeCheckIn.appointment.id) {
    return null;
  }

  const appointment = activeCheckIn.appointment;

  return (
    <ArrivalToast
      isOpen={true}
      clientName={appointment.clientName || appointment.client?.name || "Client"}
      onArrived={() => {
        updateAppointment.mutate({
          id: appointment.id,
          clientArrived: 1,
          actualStartTime: new Date().toISOString(),
          status: "confirmed",
        });
        setDismissed(appointment.id);
      }}
      onNoShow={() => {
        updateAppointment.mutate({
          id: appointment.id,
          status: "no-show",
        });
        setDismissed(appointment.id);
      }}
      onDismiss={() => setDismissed(appointment.id)}
    />
  );
}
