import React from "react";
import { Route, Switch } from "wouter";
import BottomNav from "@/components/BottomNav";
import { ActionPanel } from "@/components/ActionPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import ClientProfile from "@/pages/ClientProfile";
import Conversations from "@/pages/Conversations";
import Chat from "@/pages/Chat";
import Calendar from "@/pages/Calendar";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

export default function ClientShell() {
  return (
    <div className="min-h-screen pb-16">
      <Switch>
        <Route path="/profile" component={ClientProfile} />
        <Route path="/conversations" component={Conversations} />
        <Route path="/chat/:id" component={Chat} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>

      <ErrorBoundary boundary="fab">
        <BottomNav />
        <ActionPanel />
      </ErrorBoundary>
    </div>
  );
}
