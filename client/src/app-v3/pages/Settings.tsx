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
import { BookingLink } from "./ArtistProfile";
import Forms from "./Forms";
import { AccountRemoval, Consultations } from "./AccountControls";
import DataImport from "./DataImport";
import Travel from "./Travel";
import Notifications from "./Notifications";
import { InstagramImport } from "./Integrations";
import Guides from "./Guides";
import {
  Action,
  Avatar,
  Row,
  Screen,
  SearchField,
  Section,
} from "../design/primitives";
import { AccountEditor, BusinessEditor } from "./SettingsEditors";

/** Route-backed settings preserve deep links and browser navigation. */
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
  if (section === "studio" && artist) return <Redirect to="/studio" />;
  if (section === "booking-link" && artist) return <BookingLink />;
  if (section === "regulation" && artist) return <Forms />;
  if (section === "travel" && artist) return <Travel />;
  if (section === "data-import" && artist) return <DataImport />;
  if (section === "instagram" && artist) return <InstagramImport />;
  if (section === "how-tos") return <Guides />;
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
          detail: artist
            ? "Device alerts and saved message templates"
            : "Device alerts for updates and messages",
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
