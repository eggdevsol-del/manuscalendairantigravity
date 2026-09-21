import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";

export default function Navigation() {
  const [path] = useLocation();
  const { user } = useAuth();
  const { navItems, bottomNavHidden } = useBottomNav();
  const unread = useTotalUnreadCount();
  const artist = user?.role === "artist" || user?.role === "admin";
  if (bottomNavHidden) return null;
  return (
    <>
      <div className="simple-nav-fade" aria-hidden="true" />
      <nav
        id="bottom-nav"
        aria-label="Main navigation"
        className={`v3-navigation v3-navigation-${user?.role || "client"}`}
      >
        <div className="v3-navigation-items">
          {navItems.map(item => {
            const active =
              path === item.path ||
              (!!item.path && path.startsWith(item.path + "/")) ||
              (item.id === "messages" && path.startsWith("/chat/")) ||
              (artist &&
                item.id === "clients" &&
                path.startsWith("/projects/")) ||
              (artist &&
                item.id === "business" &&
                [
                  "/dashboard",
                  "/money",
                  "/shopfront",
                  "/products",
                  "/artist-events",
                  "/store-orders",
                  "/supplies",
                  "/supply-orders",
                  "/purchases",
                  "/artist-profile",
                  "/work-hours",
                  "/bank-payouts",
                  "/payout-history",
                  "/notifications-management",
                  "/subscriptions",
                  "/studio",
                  "/settings",
                ].includes(path)) ||
              (!artist &&
                item.id === "bookings" &&
                path.startsWith("/projects/")) ||
              (!artist &&
                item.id === "profile" &&
                ["/settings", "/purchases", "/waitlist"].includes(path));
            const count =
              item.id === "messages" ? unread : item.badgeCount || 0;
            const content = (
              <>
                <span className="v3-navigation-icon">
                  <item.icon size={23} strokeWidth={active ? 2 : 1.7} />
                  {count > 0 && (
                    <span
                      className="v3-navigation-count"
                      aria-label={count + " unread"}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </>
            );
            return item.path ? (
              <Link
                key={item.id}
                className="v3-navigation-item"
                aria-current={active ? "page" : undefined}
                href={item.path}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.id}
                className="v3-navigation-item"
                onClick={item.action}
              >
                {content}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
