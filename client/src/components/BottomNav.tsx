/**
 * BottomNav - Clean white 4-tab navigation bar
 *
 * Icons-only, solid white, no borders, no shadows.
 * Matches the clean UI variant aesthetic.
 *
 * @version 1.1.0
 */

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useTeaser } from "@/contexts/TeaserContext";
import { useCallback } from "react";
import { Lock } from "lucide-react";

const NAV_HEIGHT = 64;

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
    <nav className="fixed bottom-0 inset-x-0 z-[50] select-none">
      <div
        className="bg-white"
        style={{
          height: NAV_HEIGHT,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-center h-full">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const unreadCount =
              item.id === "messages" ? totalUnreadCount : item.badgeCount || 0;

            return (
              <Link key={item.id} href={item.path || "#"} className="contents">
                <Button
                  variant="ghost"
                  className={cn(
                    "flex flex-col items-center justify-center h-full flex-1 rounded-none transition-all relative",
                    active ? "text-[#1a1a2e]" : "text-[#9ca3af]"
                  )}
                  style={{ background: "transparent" }}
                >
                  <div className="relative">
                    <item.icon
                      className={cn(
                        "w-6 h-6 transition-all duration-200",
                        active ? "text-[#1a1a2e]" : "text-[#9ca3af]"
                      )}
                      strokeWidth={active ? 2.5 : 1.8}
                    />

                    {/* Lock Badge for Teaser Clients */}
                    {isTeaserClient && item.id === "profile" && (
                      <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-200">
                        <Lock className="w-2.5 h-2.5 text-[#9ca3af]" />
                      </div>
                    )}

                    {/* Unread Badge */}
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
