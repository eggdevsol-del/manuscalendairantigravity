import { Link, useLocation } from "wouter";
import { Settings } from "lucide-react";
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
    <nav
      id="bottom-nav"
      aria-label="Main navigation"
      className={"v3-navigation" + (artist ? " v3-navigation-artist" : "")}
    >
      {artist && (
        <Link className="v3-navigation-brand v3-wordmark" href="/dashboard">
          TATTOI
        </Link>
      )}
      <div className="v3-navigation-items">
        {navItems.map(item => {
          const active =
            path === item.path ||
            (!!item.path && path.startsWith(item.path + "/")) ||
            (item.id === "messages" && path.startsWith("/chat/")) ||
            (item.id === "calendar" &&
              artist &&
              path.startsWith("/projects/")) ||
            (item.id === "bookings" &&
              !artist &&
              path.startsWith("/projects/"));
          const count = item.id === "messages" ? unread : item.badgeCount || 0;
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
      {artist && (
        <Link
          className="v3-navigation-business v3-navigation-item"
          href="/business"
          aria-current={
            [
              "/business",
              "/money",
              "/settings",
              "/subscriptions",
              "/bank-payouts",
            ].includes(path)
              ? "page"
              : undefined
          }
        >
          <Settings size={22} />
          <span>Business</span>
        </Link>
      )}
    </nav>
  );
}
