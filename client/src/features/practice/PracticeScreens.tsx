import { Route, Switch } from "wouter";
import Today from "@/app-v3/pages/Today";
import Calendar from "@/app-v3/pages/Calendar";
import Inbox from "@/app-v3/pages/Inbox";
import Business, { Money, Shopfront } from "@/app-v3/pages/Business";
import Supplies from "@/app-v3/pages/Supplies";
import Products from "@/app-v3/pages/Products";
import Events from "@/app-v3/pages/Events";
import { SupplierOrders } from "@/app-v3/pages/Supplier";
import Studio from "@/app-v3/pages/Studio";
import Purchases, { SupplyOrders } from "@/app-v3/pages/Purchases";
import Waitlist from "@/app-v3/pages/Waitlist";
import ArtistProfile from "@/app-v3/pages/ArtistProfile";
import Settings from "@/app-v3/pages/Settings";
import PayoutHistory from "@/app-v3/pages/PayoutHistory";
import Notifications from "@/app-v3/pages/Notifications";
import Plans from "@/app-v3/pages/Plans";
import Lead from "@/app-v3/pages/Lead";
import Clients from "@/app-v3/pages/Clients";
import WorkingHours from "@/app-v3/pages/WorkingHours";
import Bank from "@/app-v3/pages/Bank";
import Booking from "@/app-v3/pages/Booking";
import { BottomNavProvider } from "@/contexts/BottomNavContext";
export const PRACTICE_SCREENS = [
  ["Today", "/dashboard"],
  ["Calendar", "/calendar"],
  ["Inbox", "/conversations"],
  ["Business", "/business"],
  ["Money", "/money"],
  ["Payout history", "/payout-history"],
  ["Supplies", "/supplies"],
  ["Supply orders", "/supply-orders"],
  ["Purchases", "/purchases"],
  ["Shopfront", "/shopfront"],
  ["Products", "/products"],
  ["Events", "/artist-events"],
  ["Store orders", "/store-orders"],
  ["Studio", "/studio"],
  ["Studio invitations", "/studio?view=invitations"],
  ["Waitlist", "/waitlist"],
  ["Profile & portfolio", "/artist-profile"],
  ["Settings", "/settings"],
  ["Notifications", "/notifications-management"],
  ["Subscription", "/subscriptions"],
  ["Booking request", "/lead/1"],
  ...[
    "profile",
    "business",
    "booking-link",
    "regulation",
    "travel",
    "data-import",
    "instagram",
    "consultations",
    "danger-zone",
  ].map(s => [s.replaceAll("-", " "), `/settings?section=${s}`]),
] as const;
export function PracticeScreens() {
  return (
    <BottomNavProvider>
      <Switch>
        <Route path="/dashboard" component={Today} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/conversations" component={Inbox} />
        <Route path="/chat/:id" component={Inbox} />
        <Route path="/business" component={Business} />
        <Route path="/money" component={Money} />
        <Route path="/payout-history" component={PayoutHistory} />
        <Route path="/supplies" component={Supplies} />
        <Route path="/supply-orders" component={SupplyOrders} />
        <Route path="/purchases" component={Purchases} />
        <Route path="/shopfront" component={Shopfront} />
        <Route path="/products" component={Products} />
        <Route path="/artist-events" component={Events} />
        <Route path="/store-orders" component={SupplierOrders} />
        <Route path="/studio" component={Studio} />
        <Route path="/waitlist" component={Waitlist} />
        <Route path="/artist-profile" component={ArtistProfile} />
        <Route path="/settings" component={Settings} />
        <Route path="/notifications-management" component={Notifications} />
        <Route path="/subscriptions" component={Plans} />
        <Route path="/lead/:id" component={Lead} />
        <Route path="/clients" component={Clients} />
        <Route path="/work-hours" component={WorkingHours} />
        <Route path="/bank-payouts" component={Bank} />
        <Route path="/projects/:id" component={Booking} />
        <Route>
          <p>
            This destination is outside the artist practice screens. Choose
            another screen above. Your live account has not been changed.
          </p>
        </Route>
      </Switch>
    </BottomNavProvider>
  );
}
