import React from "react";
import { Route, Switch } from "wouter";
import BottomNav from "@/components/BottomNav";
import { ActionPanel } from "@/components/ActionPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AnimatedSwitch } from "@/components/AnimatedSwitch";
import ClientHome from "@/features/client-home/ClientHome";
import Conversations from "@/pages/Conversations";
import Chat from "@/pages/Chat";
import Calendar from "@/pages/Calendar";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import DiscoverFeed from "@/features/feed/DiscoverFeed";

export default function ClientShell() {
  return (
    <div className="min-h-screen pb-16">
      <AnimatedSwitch>
        <Switch>
          <Route path="/discover" component={DiscoverFeed} />
          <Route path="/profile" component={ClientHome} />
          <Route path="/conversations" component={Conversations} />
          <Route path="/chat/:id" component={Chat} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </AnimatedSwitch>

      <ErrorBoundary boundary="fab">
        <BottomNav />
        <ActionPanel />
      </ErrorBoundary>
    </div>
  );
}
