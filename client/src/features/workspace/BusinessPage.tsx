import { Link, useLocation } from "wouter";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { MoneyScreen } from "@/features/dashboard/MoneyScreen";
import { SuppliesSegment } from "@/features/dashboard/SuppliesSegment";
import {
  ChevronRight,
  UserRound,
  Wallet,
  CalendarDays,
  Package,
  Settings,
  Users,
  ListChecks,
} from "lucide-react";
const items = [
  {
    href: "/artist-profile",
    icon: UserRound,
    title: "Public profile & booking link",
    detail: "Your portfolio, services and client entry point",
  },
  {
    href: "/money",
    icon: Wallet,
    title: "Money",
    detail: "Income, outstanding balances and payouts",
  },
  {
    href: "/work-hours",
    icon: CalendarDays,
    title: "Working hours",
    detail: "Availability, breaks and design time",
  },
  {
    href: "/supplies",
    icon: Package,
    title: "Supplies",
    detail: "Stock and supplier orders",
  },
  {
    href: "/waitlist",
    icon: ListChecks,
    title: "Cancellation waitlist",
    detail: "Offer available appointments",
  },
  {
    href: "/studio",
    icon: Users,
    title: "Studio",
    detail: "Manage your team and shared workspace",
  },
  {
    href: "/settings",
    icon: Settings,
    title: "Settings",
    detail: "Account, billing, notifications and integrations",
  },
];
export default function BusinessPage() {
  return (
    <PageShell>
      <PageHeader
        title="Business"
        subtitle="Everything behind your working day"
      />
      <main className="workspace-scroll">
        <div className="workspace-content">
          {items.map(({ href, icon: Icon, title, detail }) => (
            <Link key={href} href={href} className="workspace-menu-row">
              <Icon size={22} />
              <span className="flex-1">
                <strong>{title}</strong>
                <span className="workspace-subtitle block text-sm">
                  {detail}
                </span>
              </span>
              <ChevronRight size={18} />
            </Link>
          ))}
        </div>
      </main>
    </PageShell>
  );
}
export function MoneyPage() {
  const [, go] = useLocation();
  return (
    <PageShell>
      <MoneyScreen onBack={() => go("/business")} />
    </PageShell>
  );
}
export function SuppliesPage() {
  return (
    <PageShell>
      <PageHeader title="Supplies" />
      <main className="workspace-scroll">
        <div className="workspace-content">
          <SuppliesSegment />
        </div>
      </main>
    </PageShell>
  );
}
