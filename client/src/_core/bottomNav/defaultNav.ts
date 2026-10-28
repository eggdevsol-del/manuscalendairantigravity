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
  Leaf,
  BriefcaseBusiness,
} from "lucide-react";
import { BottomNavButton } from "./types";

export const ARTIST_NAV_ITEMS: BottomNavButton[] = [
  {
    id: "messages",
    path: "/conversations",
    label: "Messages",
    icon: MessageCircle,
  },
  { id: "calendar", path: "/calendar", label: "Calendar", icon: Calendar },
  { id: "today", path: "/dashboard", label: "Today", icon: Home },
  {
    id: "business",
    path: "/business",
    label: "Business",
    icon: BriefcaseBusiness,
  },
];

// Profile and settings sit behind the avatar on the Home lock screen.
export const CLIENT_NAV_ITEMS: BottomNavButton[] = [
  { id: "home", path: "/home", label: "Home", icon: Home },
  { id: "bookings", path: "/bookings", label: "My Tattoos", icon: Leaf },
  {
    id: "messages",
    path: "/conversations",
    label: "Messages",
    icon: MessageCircle,
  },
  { id: "discover", path: "/discover", label: "Discover", icon: Compass },
];

export const STUDIO_NAV_ITEMS: BottomNavButton[] = [
  { id: "studio", path: "/studio", label: "Studio", icon: Users },
  {
    id: "messages",
    path: "/conversations",
    label: "Messages",
    icon: MessageCircle,
  },
  { id: "calendar", path: "/calendar", label: "Calendar", icon: Calendar },
  { id: "settings", path: "/settings", label: "Settings", icon: Settings },
];

export const MERCHANT_NAV_ITEMS: BottomNavButton[] = [
  { id: "dashboard", path: "/dashboard", label: "Home", icon: Home },
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
    label: "Messages",
    icon: MessageCircle,
    badgeCount: 0,
  },
];

// Default to artist for backward compatibility
export const MAIN_NAV_ITEMS = ARTIST_NAV_ITEMS;
