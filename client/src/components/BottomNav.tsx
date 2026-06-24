/**
 * BottomNav - Clean 4-tab navigation bar
 *
 * Icons-only, solid white matching app background,
 * with a subtle top fade so page content blends in.
 *
 * @version 1.1.4
 */

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
        userSelect: "none",
      }}
    >

      {/* Icon row — solid white */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 56,
          backgroundColor: "#ffffff",
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
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  height: "100%",
                  background: "none",
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                  color: active ? "#1a1a2e" : "#9ca3af",
                  WebkitTapHighlightColor: "transparent",
                  padding: 0,
                }}
              >
                <div style={{ position: "relative" }}>
                  <item.icon
                    style={{ width: 24, height: 24, color: "inherit" }}
                    strokeWidth={active ? 2.5 : 1.8}
                  />

                  {/* Lock Badge for Teaser Clients */}
                  {isTeaserClient && item.id === "profile" && (
                    <div
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        borderRadius: 9999,
                        padding: 2,
                        background: "#ffffff",
                      }}
                    >
                      <Lock style={{ width: 10, height: 10, color: "#9ca3af" }} />
                    </div>
                  )}

                  {/* Unread Badge */}
                  {unreadCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -8,
                        display: "flex",
                        height: 16,
                        width: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 9999,
                        backgroundColor: "#ef4444",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#ffffff",
                        boxShadow: "0 0 0 2px #ffffff",
                      }}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
              </button>
            </Link>
          );
        })}
      </div>

      {/* Safe area spacer — white to fill home indicator zone */}
      <div style={{ height: "env(safe-area-inset-bottom, 0px)", backgroundColor: "#ffffff" }} />
    </nav>
  );
}
