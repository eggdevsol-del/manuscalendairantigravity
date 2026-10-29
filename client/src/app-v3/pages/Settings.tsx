import { usePractice } from "@/features/practice/PracticeContext";
import { useState } from "react";
import { useLocation, useSearch, Redirect } from "wouter";
import { Briefcase,
  Bell,
  UserRound,
  MapPin,
  CalendarDays,
  ShieldCheck,
  HelpCircle,
  LogOut,
  RefreshCw,
  CreditCard,
  Database,
  Plane,
  Instagram,
  Link2,
  Users,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { APP_VERSION } from "@/lib/version";
import { forceUpdate } from "@/lib/pwa";
import { BookingLink } from "./ArtistProfile";
import Forms from "./Forms";
import { AccountRemoval, Consultations } from "./AccountControls";
import DataImport from "./DataImport";
import Travel from "./Travel";
import Notifications from "./Notifications";
import { InstagramImport } from "./Integrations";
import {
  Action,
  Avatar,
  Row,
  Screen,
  SearchField,
  Section,
} from "../design/primitives";
import { AccountEditor, BusinessEditor } from "./SettingsEditors";
import { WallpaperPicker } from "../design/WallpaperPicker";
import { trpc } from "@/lib/trpc";
import { resolveDepositPercentage, resolvePaymentTier } from "@shared/fees";
import { parseSchedule } from "../design/calendarDays";

/** Route-backed settings preserve deep links and browser navigation. */
export default function Settings() {
  const practice = usePractice();
  const { user, logout } = useAuth();
  const [, go] = useLocation();
  const search = useSearch();
  const section = new URLSearchParams(search).get("section");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const artist = user?.role === "artist" || user?.role === "admin";
  const settingsPath =
    user?.role === "merchant" ? "/account-settings" : "/settings";
  const back = () => go(settingsPath);
  const values = useSettingValues(artist && !section);
  if (section === "profile") return <AccountEditor />;
  if (section === "notifications") return <Notifications />;
  if (section === "business" && artist) return <BusinessEditor />;
  if (section === "work-hours" && artist) return <Redirect to="/work-hours" />;
  if (section === "studio" && artist) return <Redirect to="/studio" />;
  if (section === "booking-link" && artist) return <BookingLink />;
  if (section === "regulation" && artist) return <Forms />;
  if (section === "travel" && artist) return <Travel />;
  if (section === "data-import" && artist) return <DataImport />;
  if (section === "instagram" && artist) return <InstagramImport />;
  if (section === "how-tos") return <Redirect to={settingsPath} />;
  if (section === "consultations" && artist) return <Consultations />;
  if (section === "danger-zone") return <AccountRemoval />;
  if (section === "portfolio") return <Redirect to="/artist-profile" />;
  const groups = [
    {
      title: "Your account",
      items: [
        {
          title: "Profile",
          detail: "Name, photo and contact details",
          icon: UserRound,
          href: settingsPath + "?section=profile",
        },
        {
          title: "Notifications",
          detail: values.alerts ?? (artist
            ? "Device alerts and saved message templates"
            : "Device alerts for updates and messages"),
          icon: Bell,
          href: settingsPath + "?section=notifications",
        },
      ],
    },
    ...(artist
      ? [
          {
            title: "Your business",
            items: [
              {
                title: "Business",
                detail: "Earnings, shopfront, offers and studio",
                icon: Briefcase,
                href: "/business",
              },
              {
                title: "Business details",
                detail: values.business ?? "Location, contact information and licence",
                icon: MapPin,
                href: settingsPath + "?section=business",
              },
              {
                title: "Working hours & services",
                detail: values.hours ?? "Availability, duration and pricing",
                icon: CalendarDays,
                href: "/work-hours",
              },
              {
                title: "Booking link",
                detail: values.link ?? "Client entry and intake settings",
                icon: Link2,
                href: settingsPath + "?section=booking-link",
              },
              {
                title: "Travel & guest spots",
                detail: values.travel ?? "Dates, destinations and nearby clients",
                icon: Plane,
                href: settingsPath + "?section=travel",
              },
              {
                title: "Forms & consent",
                detail: "Consent and medical templates",
                icon: ShieldCheck,
                href: settingsPath + "?section=regulation",
              },
              {
                title: "Bank payouts",
                detail: values.payouts ?? "Payment account and verification",
                icon: CreditCard,
                href: "/bank-payouts",
              },
              {
                title: "Your plan",
                detail: values.plan ?? "Free, Pro and Studio",
                icon: CreditCard,
                href: "/subscriptions",
              },
              {
                title: "Studio",
                detail: values.studio ?? "Team and shared workspace",
                icon: Users,
                href: "/studio",
              },
            ],
          },
          {
            title: "Connections",
            items: [
              {
                title: "Import clients",
                detail: "Bring your existing records",
                icon: Database,
                href: settingsPath + "?section=data-import",
              },
              {
                title: "Instagram import",
                detail: "Manage connected portfolio media",
                icon: Instagram,
                href: settingsPath + "?section=instagram",
              },
            ],
          },
        ]
      : []),
    {
      title: "Help & account controls",
      items: [
        {
          title: "Delete account",
          detail: "Account and data removal",
          icon: ShieldCheck,
          href: settingsPath + "?section=danger-zone",
        },
      ],
    },
  ];
  return (
    <Screen
      title="Settings"
      back={
        artist
          ? "/business"
          : user?.role === "merchant"
            ? "/settings"
            : "/bookings"
      }
    >
      <Row
        title={user?.name || "Your account"}
        detail={user?.email}
        icon={<Avatar name={user?.name} src={user?.avatar} />}
        href={settingsPath + "?section=profile"}
      />
      <SearchField value={filter} onChange={setFilter} label="Find a setting" />
      {groups.map(group => {
        const items = group.items.filter(i =>
          `${i.title} ${i.detail}`.toLowerCase().includes(filter.toLowerCase())
        );
        return items.length ? (
          <Section title={group.title} key={group.title}>
            {items.map(({ icon: Icon, ...item }) => (
              <Row key={item.href} {...item} icon={<Icon />} />
            ))}
          </Section>
        ) : null;
      })}
      <Section title="Appearance">
        <WallpaperPicker />
        <Row
          title="Reload latest version"
          detail={`Version ${APP_VERSION}`}
          icon={<RefreshCw />}
          onClick={() =>
            practice ? practice.simulate("App update preview") : forceUpdate()
          }
        />
      </Section>
      <Action
        tone="quiet"
        onClick={async () => {
          try {
            await logout();
            go("/login");
          } catch {
            setError("Couldn’t sign out. Please try again.");
          }
        }}
      >
        <LogOut />
        Sign out
      </Action>
      {error && <p role="alert">{error}</p>}
    </Screen>
  );
}

/** The current value of each setting, shown on the Settings list as in the prototype. Every value is read
 *  from the artist's own data; a row keeps its usual description until its value has loaded. */
function useSettingValues(enabled: boolean) {
  const settings = trpc.artistSettings.get.useQuery(undefined, { enabled });
  const plan = trpc.billing.subscriptionStatus.useQuery(undefined, { enabled });
  const stripe = trpc.artistSettings.getStripeConnectStatus.useQuery(undefined, {
    enabled,
  });
  const studio = trpc.studios.getCurrentStudio.useQuery(undefined, { enabled });
  const values: Partial<
    Record<
      "alerts" | "business" | "hours" | "link" | "travel" | "payouts" | "plan" | "studio",
      string
    >
  > = {};
  if (typeof Notification !== "undefined")
    values.alerts =
      Notification.permission === "granted"
        ? "Alerts are on for this device"
        : Notification.permission === "denied"
          ? "Alerts are blocked on this device"
          : "Alerts are off on this device";
  const s = settings.data as any;
  if (s) {
    values.business =
      [s.businessName, s.businessAddress].filter(Boolean).join(" · ") ||
      "Add your business name and address";
    const days = parseSchedule(s.workSchedule).filter(
      (d: any) => d?.enabled && (d.type ?? "work") === "work"
    ).length;
    const services = parseSchedule(s.services).length;
    const tier = resolvePaymentTier(plan.data?.tier ?? s.subscriptionTier);
    values.hours = `${days} day${days === 1 ? "" : "s"} a week · ${services} service${services === 1 ? "" : "s"} · ${resolveDepositPercentage(tier, s.depositPercentage)}% deposit`;
    values.link = s.publicSlug
      ? `${window.location.host.replace(/^www\./, "")}/book/${s.publicSlug}${s.funnelEnabled === 0 ? " · paused" : ""}`
      : "Not set up yet";
    const trips = (parseSchedule(s.travelDates) as any[])
      .filter(t => t?.endDate && t.endDate >= new Date().toLocaleDateString("en-CA"))
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
    values.travel = trips[0]
      ? `${trips[0].location || "Next trip"} from ${new Date(`${trips[0].startDate}T12:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}${trips.length > 1 ? ` · ${trips.length - 1} more` : ""}`
      : "No trips planned";
  }
  if (plan.data?.tierLabel) values.plan = plan.data.tierLabel;
  if (stripe.data)
    values.payouts = !stripe.data.connected
      ? "Not set up"
      : !stripe.data.statusAvailable
        ? "Status unavailable"
        : stripe.data.payoutsEnabled
          ? "Payouts on"
          : stripe.data.pendingVerification
            ? "Verification in progress"
            : "Needs attention";
  if (studio.isFetched)
    values.studio = studio.data?.name ? studio.data.name : "Not in a studio";
  return values;
}
