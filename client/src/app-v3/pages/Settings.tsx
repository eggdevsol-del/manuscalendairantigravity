import { useState } from "react";
import { useLocation, useSearch, Redirect } from "wouter";
import {
  Bell,
  UserRound,
  MapPin,
  CalendarDays,
  ShieldCheck,
  HelpCircle,
  LogOut,
  Moon,
  RefreshCw,
  CreditCard,
  Database,
  Plane,
  Instagram,
  Link2,
  Users,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { APP_VERSION } from "@/lib/version";
import { forceUpdate } from "@/lib/pwa";
import { PageShell } from "@/components/ui/ssot";
import { FunnelSettings } from "@/components/FunnelSettings";
import { RegulationSettings } from "@/components/settings/RegulationSettings";
import { ConsultationSettings } from "@/components/settings/ConsultationSettings";
import { DataImportSettings } from "@/components/settings/DataImportSettings";
import { TravelSettings } from "@/components/settings/TravelSettings";
import { DangerZoneSettings } from "@/components/settings/DangerZoneSettings";
import Notifications from "./Notifications";
import { StudioDashboardSettings } from "@/components/settings/StudioDashboardSettings";
import { InstagramImportSettings } from "@/components/settings/InstagramImportSettings";
import { HowTosSettings } from "@/components/settings/HowTosSettings";
import {
  Action,
  Avatar,
  Row,
  Screen,
  SearchField,
  Section,
} from "../design/primitives";
import { AccountEditor, BusinessEditor } from "./SettingsEditors";

/** Route-backed settings. Specialist editors remain explicit migration entries. */
export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, go] = useLocation();
  const search = useSearch();
  const section = new URLSearchParams(search).get("section");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const artist = user?.role === "artist" || user?.role === "admin";
  const settingsPath =
    user?.role === "merchant" ? "/account-settings" : "/settings";
  const back = () => go(settingsPath);
  if (section === "profile") return <AccountEditor />;
  if (section === "notifications") return <Notifications />;
  if (section === "business" && artist) return <BusinessEditor />;
  if (section === "work-hours" && artist) return <Redirect to="/work-hours" />;
  const panels: Record<string, React.ReactNode> = {
    "booking-link": artist ? <FunnelSettings onBack={back} /> : null,
    regulation: artist ? <RegulationSettings onBack={back} /> : null,
    consultations: artist ? <ConsultationSettings onBack={back} /> : null,
    "data-import": artist ? <DataImportSettings onBack={back} /> : null,
    travel: artist ? (
      <TravelSettings
        onBack={back}
        onNavigateToClients={() => go("/clients")}
      />
    ) : null,
    studio: artist ? <StudioDashboardSettings onBack={back} /> : null,
    instagram: artist ? <InstagramImportSettings onBack={back} /> : null,
    "how-tos": <HowTosSettings onBack={back} />,
    "danger-zone": <DangerZoneSettings onBack={back} />,
  };
  if (section && panels[section])
    return <PageShell>{panels[section]}</PageShell>;
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
          detail: "Reminders and message preferences",
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
                title: "Business details",
                detail: "Location, contact information and licence",
                icon: MapPin,
                href: settingsPath + "?section=business",
              },
              {
                title: "Working hours & services",
                detail: "Availability, duration and pricing",
                icon: CalendarDays,
                href: "/work-hours",
              },
              {
                title: "Booking link",
                detail: "Client entry and intake settings",
                icon: Link2,
                href: settingsPath + "?section=booking-link",
              },
              {
                title: "Travel & guest spots",
                detail: "Dates, destinations and nearby clients",
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
                detail: "Payment account and verification",
                icon: CreditCard,
                href: "/bank-payouts",
              },
              {
                title: "Your plan",
                detail: "Free, Pro and Studio",
                icon: CreditCard,
                href: "/subscriptions",
              },
              {
                title: "Studio",
                detail: "Team and shared workspace",
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
          title: "Guided walkthroughs",
          detail: "Learn each workflow",
          icon: HelpCircle,
          href: settingsPath + "?section=how-tos",
        },
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
      <Section title="Preferences">
        <Row
          title="Dark appearance"
          detail={theme === "dark" ? "On" : "Off"}
          icon={<Moon />}
          trailing={
            <button
              className="v3-action v3-action-secondary"
              role="switch"
              aria-checked={theme === "dark"}
              aria-label="Dark appearance"
              onClick={toggleTheme}
            >
              {theme === "dark" ? "On" : "Off"}
            </button>
          }
        />
        <Row
          title="Check for updates"
          detail={`Version ${APP_VERSION}`}
          icon={<RefreshCw />}
          onClick={() => forceUpdate()}
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
