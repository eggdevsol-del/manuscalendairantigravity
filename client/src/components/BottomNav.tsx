/**
 * BottomNav - Clean 4-tab navigation bar
 *
 * Icons-only, seamless with page background, flush to screen bottom.
 *
 * @version 1.1.3
 */

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useTeaser } from "@/contexts/TeaserContext";
import { useCallback } from "react";
import { Lock } from "lucide-react";

export default function BottomNav() {
  const [location] = useLocation();
  const totalUnreadCount = useTotalUnreadCount();
  const { navItems } = useBottomNav();
  const { isTeaserClient } = useTeaser();

  const isActive = useCallback(
    (p?: string) => {
      if (!p) return false;
      if (p === "/" && location === "/") return true;
      if (p !== "/" && location.startsWith(p)) return true;
      return false;
    },
    [location]
  );

  return (
    <nav
      id="bottom-nav"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "transparent",
        userSelect: "none",
      }}
    >
      {/* Icon row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 56,
          background: "transparent",
        }}
      >
        {navItems.map((item) => {
          const active = isActive(item.path);
          const unreadCount =
            item.id === "messages" ? totalUnreadCount : item.badgeCount || 0;

          return (
            <Link key={item.id} href={item.path || "#"} className="contents">
              <button
                type="button"
                className="flex flex-col items-center justify-center flex-1 h-full"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                  color: active ? "#1a1a2e" : "#9ca3af",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <div className="relative">
                  <item.icon
                    className="w-6 h-6"
                    style={{ color: "inherit" }}
                    strokeWidth={active ? 2.5 : 1.8}
                  />

                  {/* Lock Badge for Teaser Clients */}
                  {isTeaserClient && item.id === "profile" && (
                    <div className="absolute -top-1 -right-1 rounded-full p-0.5" style={{ background: "transparent" }}>
                      <Lock className="w-2.5 h-2.5" style={{ color: "#9ca3af" }} />
                    </div>
                  )}

                  {/* Unread Badge */}
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
              </button>
            </Link>
          );
        })}
      </div>

      {/* Safe area spacer — fills the home indicator zone on iOS */}
      <div style={{ height: "env(safe-area-inset-bottom, 0px)", background: "transparent" }} />
    </nav>
  );
}
