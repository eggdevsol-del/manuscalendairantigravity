import Purchases from "@/app-v3/pages/Purchases";
import WaitlistPage from "@/app-v3/pages/Waitlist";
import ProjectSummary from "@/app-v3/pages/Booking";
import React from "react";
import { Redirect, Route, Switch } from "wouter";

import { AnimatedSwitch } from "@/components/AnimatedSwitch";
import ClientHome from "@/app-v3/pages/Discover";
import Conversations from "@/app-v3/pages/Inbox";
import Chat from "@/app-v3/pages/Inbox";
import BookingsPage from "@/app-v3/pages/ClientBookings";
import Settings from "@/app-v3/pages/Settings";
import NotFound from "@/pages/NotFound";
import ClientProfilePage from "@/app-v3/pages/Profile";
import ClientLockHome from "@/app-v3/pages/ClientHome";

export default function ClientShell() {
  return (
    <div className="min-h-screen">
      <AnimatedSwitch>
        <Switch>
          <Route path="/purchases" component={Purchases} />
          <Route path="/">
            <Redirect to="/home" />
          </Route>
          <Route path="/home" component={ClientLockHome} />
          <Route path="/discover" component={ClientHome} />
          <Route path="/profile" component={ClientProfilePage} />
          <Route path="/conversations" component={Conversations} />
          <Route path="/chat/:id" component={Chat} />
          <Route path="/projects/:id" component={ProjectSummary} />
          <Route path="/waitlist" component={WaitlistPage} />
          <Route path="/bookings" component={BookingsPage} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </AnimatedSwitch>

    </div>
  );
}
