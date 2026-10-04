import { ArtistRoutes } from "./ArtistRoutes";
import { ArtistSetupGate } from "@/features/onboarding/ArtistSetupGate";
import PracticeWorkspace from "@/features/practice/PracticeWorkspace";
import React from "react";
import { Route, Switch, useLocation } from "wouter";
import BottomNav from "@/app-v3/design/Navigation";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AnimatedSwitch } from "@/components/AnimatedSwitch";
import { useAppointmentCheckIn } from "@/features/appointments/useAppointmentCheckIn";
import { ArrivalToast } from "@/components/ArrivalToast";
export default function ArtistShell() {
  return (
    <div className="artist-workspace min-h-screen">
      <ArtistSetupGate>
        <ArtistWorkspace />
      </ArtistSetupGate>
    </div>
  );
}
function ArtistWorkspace() {
  const [path] = useLocation();
  return (
    <div>
      <AnimatedSwitch>
        <Switch>
          <Route path="/practice" component={PracticeWorkspace} />
          <Route>
            <ArtistRoutes />
          </Route>
        </Switch>
      </AnimatedSwitch>
      {path !== "/practice" && (
        <ErrorBoundary boundary="fab">
          <BottomNav />
        </ErrorBoundary>
      )}
      {path !== "/practice" && <ArrivalOverlay />}
    </div>
  );
}

function ArrivalOverlay() {
  const [dismissed, setDismissed] = React.useState<number | null>(null);
  const snoozeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (snoozeTimer.current) clearTimeout(snoozeTimer.current);
    },
    []
  );
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
      onDismiss={() => {
        setDismissed(appointment.id);
        if (snoozeTimer.current) clearTimeout(snoozeTimer.current);
        snoozeTimer.current = setTimeout(
          () =>
            setDismissed(current =>
              current === appointment.id ? null : current
            ),
          10 * 60 * 1000
        );
      }}
    />
  );
}
