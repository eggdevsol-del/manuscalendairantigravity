import { Link, useLocation } from "wouter";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Settings } from "lucide-react";
export default function BottomNav() {
  const [location] = useLocation();
  const unread = useTotalUnreadCount();
  const { navItems, bottomNavHidden } = useBottomNav();
  const { user } = useAuth();
  const artist = user?.role === "artist" || user?.role === "admin";
  return (
    <nav
      id="bottom-nav"
      aria-label="Main navigation"
      className={`workspace-nav ${artist ? "workspace-nav-artist" : ""} ${bottomNavHidden ? "workspace-nav-hidden" : ""}`}
    >
      {artist && (
        <Link
          href="/dashboard"
          className="workspace-nav-brand workspace-wordmark"
        >
          TATTOI
        </Link>
      )}
      <div className="workspace-nav-items">
        {navItems.map(item => {
          const active =
            !!item.path &&
            (location === item.path ||
              location.startsWith(item.path + "/") ||
              (item.id === "messages" && location.startsWith("/chat/")));
          const count = item.id === "messages" ? unread : item.badgeCount || 0;
          return (
            <Link
              key={item.id}
              href={item.path || "/dashboard"}
              className={`workspace-nav-item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <item.icon size={23} strokeWidth={active ? 2 : 1.7} />
                {count > 0 && (
                  <span className="workspace-unread">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
      {artist && (
        <Link
          href="/business"
          className={`workspace-nav-business workspace-nav-item ${location === "/business" ? "is-active" : ""}`}
        >
          <Settings size={22} />
          <span>Business</span>
        </Link>
      )}
    </nav>
  );
}
