import {
  Calendar,
  MessageCircle,
  Settings,
  Compass,
  User,
  Users,
  Home,
  Package,
  ShoppingBag,
  Search,
  Heart,
} from "lucide-react";
import { BottomNavButton } from "./types";

export const ARTIST_NAV_ITEMS: BottomNavButton[] = [
  { id: "dashboard", path: "/dashboard", label: "Today", icon: Home },
  {
    id: "messages",
    path: "/conversations",
    label: "Inbox",
    icon: MessageCircle,
    badgeCount: 0,
  },
  { id: "calendar", path: "/calendar", label: "Calendar", icon: Calendar },
  { id: "clients", path: "/clients", label: "Clients", icon: Users },
];

export const CLIENT_NAV_ITEMS: BottomNavButton[] = [
  { id: "bookings", path: "/bookings", label: "Bookings", icon: Calendar },
  {
    id: "messages",
    path: "/conversations",
    label: "Inbox",
    icon: MessageCircle,
  },
  { id: "profile", path: "/profile", label: "Profile", icon: User },
];

export const STUDIO_NAV_ITEMS: BottomNavButton[] = [
  { id: "studio", path: "/studio", label: "Studio", icon: Users },
  {
    id: "messages",
    path: "/conversations",
    label: "Inbox",
    icon: MessageCircle,
  },
  { id: "calendar", path: "/calendar", label: "Calendar", icon: Calendar },
  { id: "settings", path: "/settings", label: "Settings", icon: Settings },
];

export const MERCHANT_NAV_ITEMS: BottomNavButton[] = [
  { id: "dashboard", path: "/dashboard", label: "Today", icon: Home },
  { id: "orders", path: "/merchant/orders", label: "Orders", icon: Package },
  {
    id: "products",
    path: "/merchant/products",
    label: "Products",
    icon: ShoppingBag,
  },
  {
    id: "messages",
    path: "/conversations",
    label: "Inbox",
    icon: MessageCircle,
    badgeCount: 0,
  },
];

// Default to artist for backward compatibility
export const MAIN_NAV_ITEMS = ARTIST_NAV_ITEMS;
