import React from "react";
import { Route, Switch, useLocation } from "wouter";
import BottomNav from "@/components/BottomNav";
import { ActionPanel } from "@/components/ActionPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import Dashboard from "@/pages/Dashboard";
import { MerchantOrders } from "@/features/merchant/Orders";
import { MerchantProducts } from "@/features/merchant/Products";
import Conversations from "@/pages/Conversations";
import Chat from "@/pages/Chat";
import NotFound from "@/pages/NotFound";

export default function MerchantShell() {
  return (
    <div className="min-h-screen pb-16">
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/merchant/orders" component={MerchantOrders} />
        <Route path="/merchant/products" component={MerchantProducts} />
        <Route path="/conversations" component={Conversations} />
        <Route path="/chat/:id" component={Chat} />
        <Route path="/merchant">
          <RedirectToDashboard />
        </Route>
        <Route component={NotFound} />
      </Switch>

      <ErrorBoundary boundary="fab">
        <BottomNav />
        <ActionPanel />
      </ErrorBoundary>
    </div>
  );
}

function RedirectToDashboard() {
  const [, setLocation] = useLocation();
  React.useEffect(() => {
    setLocation("/dashboard");
  }, [setLocation]);
  return null;
}
