/** Original destinations and role rules, presented with the shared Ivory skin. */
import { Link, useLocation } from "wouter";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useTeaser } from "@/contexts/TeaserContext";
import { Lock } from "lucide-react";
export default function BottomNav() {
  const [location] = useLocation();
  const totalUnreadCount = useTotalUnreadCount();
  const { navItems, bottomNavHidden } = useBottomNav();
  const { isTeaserClient } = useTeaser();
  return (
    <nav
      id="bottom-nav"
      aria-label="Main navigation"
      className="original-ivory-nav"
      inert={bottomNavHidden || undefined}
      style={{
        transform: bottomNavHidden
          ? "translateY(calc(100% + 40px))"
          : undefined,
      }}
    >
      {navItems.map(item => {
        const active =
          !!item.path &&
          (location === item.path ||
            (item.path !== "/" && location.startsWith(item.path + "/")) ||
            (item.id === "messages" && location.startsWith("/chat/")));
        const count =
          item.id === "messages" ? totalUnreadCount : item.badgeCount || 0;
        return (
          <Link
            key={item.id}
            href={item.path || "#"}
            aria-current={active ? "page" : undefined}
            className="original-ivory-nav-item"
          >
            <span className="relative">
              <item.icon size={23} strokeWidth={active ? 2 : 1.7} />
              {isTeaserClient && item.id === "profile" && (
                <Lock className="absolute -top-1 -right-2" size={10} />
              )}
              {count > 0 && (
                <span className="original-ivory-badge">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
