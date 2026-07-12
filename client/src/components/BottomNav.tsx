/**
 * BottomNav — TATTOI Design System v1.0
 *
 * Spec:
 * - Background: --color-bg-header (#141416 dark / #F8F8FA light)
 * - Border-top: 1px solid --color-border
 * - Active: --color-accent-violet (#7B5CF5), weight 600
 * - Inactive: --color-text-secondary (#8A8A92 / #6A6A72)
 * - Label: 10px, 400 inactive / 600 active
 * - Icon: 24px
 * - Total height: 82px including safe area
 *
 * @version 2.0.0
 */

import { Link, useLocation } from "wouter";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useTeaser } from "@/contexts/TeaserContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCallback } from "react";
import { Lock } from "lucide-react";

export default function BottomNav() {
  const [location] = useLocation();
  const totalUnreadCount = useTotalUnreadCount();
  const { navItems, bottomNavHidden } = useBottomNav();
  const { isTeaserClient } = useTeaser();
  const { user } = useAuth();

  // TATTOI DS v1.0 — all via CSS custom properties, no hardcoded hex
  const bgColor      = "var(--color-bg-header)";
  const borderColor  = "var(--color-border)";
  const activeColor  = "var(--color-accent-violet)";
  const inactiveColor = "var(--color-text-secondary)";
  const badgeBorder  = "var(--color-bg-header)";
  const dangerColor  = "var(--color-danger)";

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
        backgroundColor: bgColor,
        borderTop: `1px solid ${borderColor}`,
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        willChange: "transform",
        transform: bottomNavHidden ? "translateY(100%)" : "translateY(0)",
      }}
    >
      {/* Tab row — 62px icon area */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 62,
          paddingTop: 8,
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
                  gap: 4,
                  flex: 1,
                  height: "100%",
                  background: "none",
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                  color: active ? activeColor : inactiveColor,
                  WebkitTapHighlightColor: "transparent",
                  padding: 0,
                }}
              >
                {/* Icon with badges */}
                <div style={{ position: "relative" }}>
                  <item.icon
                    style={{ width: 24, height: 24, color: "inherit" }}
                    strokeWidth={active ? 2.5 : 1.8}
                    fill={active ? "currentColor" : "none"}
                    fillOpacity={active ? 0.15 : 0}
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
                        backgroundColor: bgColor,
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      <Lock style={{ width: 10, height: 10, color: inactiveColor }} />
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
                        backgroundColor: dangerColor,
                        fontSize: 9,
                        fontWeight: 700,
                        color: "var(--primary-foreground)",
                        boxShadow: `0 0 0 2px ${badgeBorder}`,
                      }}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>

                {/* Label — 10px, active=600 violet, inactive=400 secondary */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: active ? 600 : 400,
                    color: "inherit",
                    lineHeight: 1.2,
                    letterSpacing: "0.01em",
                  }}
                >
                  {item.label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>

      {/* Bottom safe-area fill */}
      <div
        style={{
          height: "env(safe-area-inset-bottom, 20px)",
          backgroundColor: bgColor,
          minHeight: 20,
        }}
      />
    </nav>
  );
}
