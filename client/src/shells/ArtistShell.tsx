import Products from "@/app-v3/pages/Products";
import Events from "@/app-v3/pages/Events";
import { SupplierOrders as StoreOrders } from "@/app-v3/pages/Supplier";
import Studio from "@/app-v3/pages/Studio";
import Purchases from "@/app-v3/pages/Purchases";
import { SupplyOrders as SupplierOrderHistory } from "@/app-v3/pages/Purchases";
import WaitlistPage from "@/app-v3/pages/Waitlist";
import ProjectSummary from "@/app-v3/pages/Booking";
import React from "react";
import BusinessPage, { Money as MoneyPage } from "@/app-v3/pages/Business";
import SuppliesPage from "@/app-v3/pages/Supplies";
import { Redirect, Route, Switch } from "wouter";
import BottomNav from "@/app-v3/design/Navigation";

import ErrorBoundary from "@/components/ErrorBoundary";
import { AnimatedSwitch } from "@/components/AnimatedSwitch";
import Dashboard from "@/app-v3/pages/Today";
import Conversations from "@/app-v3/pages/Inbox";
import Chat from "@/app-v3/pages/Inbox";
import Calendar from "@/app-v3/pages/Calendar";
import Settings from "@/app-v3/pages/Settings";
import ArtistProfileTab from "@/app-v3/pages/ArtistProfile";
import WorkHours from "@/app-v3/pages/WorkingHours";
import Clients from "@/app-v3/pages/Clients";
import BankPayoutsPage from "@/app-v3/pages/Bank";
import PayoutHistory from "@/app-v3/pages/PayoutHistory";
import NotificationsManagement from "@/app-v3/pages/Notifications";
import Subscriptions from "@/app-v3/pages/Plans";
import LeadDetail from "@/app-v3/pages/Lead";
import {
  Operations as Reconciliation,
  ErrorReports as ErrorDashboard,
} from "@/app-v3/pages/Operations";
import NotFound from "@/pages/NotFound";
import { useAppointmentCheckIn } from "@/features/appointments/useAppointmentCheckIn";
import { ArrivalToast } from "@/components/ArrivalToast";

export default function ArtistShell() {
  return (
    <div className="artist-workspace min-h-screen">
      <AnimatedSwitch>
        <Switch>
          <Route path="/products" component={Products} />
          <Route path="/artist-events" component={Events} />
          <Route path="/store-orders" component={StoreOrders} />
          <Route path="/studio" component={Studio} />
          <Route path="/purchases" component={Purchases} />
          <Route path="/">
            <Redirect to="/dashboard" />
          </Route>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/business" component={BusinessPage} />
          <Route path="/money" component={MoneyPage} />
          <Route path="/supplies" component={SuppliesPage} />
          <Route path="/conversations" component={Conversations} />
          <Route path="/chat/:id" component={Chat} />
          <Route path="/projects/:id" component={ProjectSummary} />
          <Route path="/waitlist" component={WaitlistPage} />
          <Route path="/supply-orders" component={SupplierOrderHistory} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/settings" component={Settings} />
          <Route path="/artist-profile" component={ArtistProfileTab} />
          <Route path="/work-hours" component={WorkHours} />
          <Route path="/clients" component={Clients} />
          <Route path="/bank-payouts" component={BankPayoutsPage} />
          <Route path="/payout-history" component={PayoutHistory} />
          <Route
            path="/notifications-management"
            component={NotificationsManagement}
          />
          <Route path="/subscriptions" component={Subscriptions} />
          <Route path="/lead/:id" component={LeadDetail} />
          <Route path="/admin/operations" component={Reconciliation} />
          <Route path="/admin/errors" component={ErrorDashboard} />
          <Route component={NotFound} />
        </Switch>
      </AnimatedSwitch>

      <ErrorBoundary boundary="fab">
        <BottomNav />
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
  if (
    !activeCheckIn ||
    activeCheckIn.phase !== "arrival" ||
    dismissed === activeCheckIn.appointment.id
  ) {
    return null;
  }

  const appointment = activeCheckIn.appointment;

  return (
    <ArrivalToast
      isOpen={true}
      clientName={
        appointment.clientName || appointment.client?.name || "Client"
      }
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
