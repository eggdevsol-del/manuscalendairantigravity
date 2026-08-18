import React from "react";
import { Route, Switch } from "wouter";
import BottomNav from "@/components/BottomNav";

import ErrorBoundary from "@/components/ErrorBoundary";
import { AnimatedSwitch } from "@/components/AnimatedSwitch";
import ClientHome from "@/features/client-home/ClientHome";
import Conversations from "@/pages/Conversations";
import Chat from "@/pages/Chat";
import BookingsPage from "@/features/bookings/BookingsPage";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import ClientProfilePage from "@/pages/profile/ClientProfilePage";

export default function ClientShell() {
  return (
    <div className="min-h-screen pb-16">
      <AnimatedSwitch>
        <Switch>
          <Route path="/discover" component={ClientHome} />
          <Route path="/profile" component={ClientProfilePage} />
          <Route path="/conversations" component={Conversations} />
          <Route path="/chat/:id" component={Chat} />
          <Route path="/bookings" component={BookingsPage} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </AnimatedSwitch>

      <ErrorBoundary boundary="fab">
        <BottomNav />
      </ErrorBoundary>
    </div>
  );
}
