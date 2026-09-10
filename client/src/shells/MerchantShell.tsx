import Purchases from "@/app-v3/pages/Purchases";
import React from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import BottomNav from "@/app-v3/design/Navigation";

import ErrorBoundary from "@/components/ErrorBoundary";
import { AnimatedSwitch } from "@/components/AnimatedSwitch";
import Dashboard, {
  SupplierOrders as MerchantOrders,
  SupplierSettings as MerchantSettings,
} from "@/app-v3/pages/Supplier";

import MerchantProducts from "@/app-v3/pages/Products";
import Conversations from "@/app-v3/pages/Inbox";
import Chat from "@/app-v3/pages/Inbox";
import NotFound from "@/pages/NotFound";
import Settings from "@/app-v3/pages/Settings";

export default function MerchantShell() {
  return (
    <div className="min-h-screen pb-16">
      <AnimatedSwitch>
        <Switch>
          <Route path="/purchases" component={Purchases} />
          <Route path="/">
            <Redirect to="/dashboard" />
          </Route>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/merchant/orders" component={MerchantOrders} />
          <Route path="/merchant/products" component={MerchantProducts} />
          <Route path="/settings" component={MerchantSettings} />
          <Route path="/account-settings" component={Settings} />
          <Route path="/onboarding/merchant">
            <Redirect to="/settings" />
          </Route>
          <Route path="/conversations" component={Conversations} />
          <Route path="/chat/:id" component={Chat} />
          <Route path="/merchant">
            <RedirectToDashboard />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </AnimatedSwitch>

      <ErrorBoundary boundary="fab">
        <BottomNav />
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
