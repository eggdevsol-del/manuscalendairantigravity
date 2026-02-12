/**
 * BottomNav - System-level navigation controller
 * 
 * Handles 2D navigation:
 * - Horizontal (X): Fixed 4-item layout (Dashboard, Calendar, Messages, More)
 * - Vertical (Y): Row swap between main nav and contextual actions via swipe up/down
 * 
 * CRITICAL ARCHITECTURE NOTES:
 * - Row 0 (main nav) uses a fixed grid/flex layout (NO SCROLL)
 * - Row 1 (contextual actions) uses a SIMPLE FLEX container with NO scroll
 * 
 * @version 1.0.308
 */

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useTeaser } from "@/contexts/TeaserContext";
import { useRef, useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, MoreHorizontal } from "lucide-react";
import { BottomNavMoreMenu } from "./BottomNavMoreMenu";

// Constants
const SWIPE_THRESHOLD = 30;
const ROW_HEIGHT = 77;
const PRIMARY_NAV_IDS = ['dashboard', 'calendar', 'messages'];

export default function BottomNav() {
    const [location] = useLocation();
    const totalUnreadCount = useTotalUnreadCount();
    const { navItems, contextualRow, isContextualVisible, setContextualVisible } = useBottomNav();
    const { isTeaserClient } = useTeaser();

    const swipeStartY = useRef<number | null>(null);

    const isActive = useCallback((p?: string) => {
        if (!p) return false;
        if (p === "/" && location === "/") return true;
        if (p !== "/" && location.startsWith(p)) return true;
        return false;
    }, [location]);

    const hasContextualRow = contextualRow !== null;
    const showSwipeIndicator = hasContextualRow && !isContextualVisible;
    const showSwipeDownIndicator = isContextualVisible;

    const handleIndicatorTouchStart = useCallback((e: React.TouchEvent) => {
        swipeStartY.current = e.touches[0].clientY;
    }, []);

    const handleIndicatorTouchEnd = useCallback((e: React.TouchEvent) => {
        if (swipeStartY.current === null) return;

        const deltaY = swipeStartY.current - e.changedTouches[0].clientY;
        swipeStartY.current = null;

        if (deltaY > SWIPE_THRESHOLD && !isContextualVisible && hasContextualRow) {
            setContextualVisible(true);
        } else if (deltaY < -SWIPE_THRESHOLD && isContextualVisible) {
            setContextualVisible(false);
        } else if (deltaY > SWIPE_THRESHOLD && isContextualVisible) {
            setContextualVisible(false);
        }
    }, [isContextualVisible, hasContextualRow, setContextualVisible]);

    const renderButton = (item: any) => {
        const active = isActive(item.path);
        const unreadCount = item.id === "messages" ? totalUnreadCount : (item.badgeCount || 0);

        return (
            <Button
                key={item.id} // moved key here
                variant="ghost"
                className={cn(
                    "flex flex-col items-center justify-center gap-1.5 h-full min-w-[68px] rounded-none hover:bg-gray-200/50 dark:hover:bg-white/5 transition-all relative shrink-0", // min-w-[68px] allows 5 items on ~360px+ screens
                    active ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-white/40"
                )}
                onClick={item.action}
            >
                <div className="relative p-1">
                    <item.icon
                        className={cn(
                            "w-6 h-6 transition-all duration-300",
                            active
                                ? "text-gray-900 dark:text-white scale-110 drop-shadow-[0_0_8px_rgba(0,0,0,0.2)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                                : "text-gray-500 dark:text-white/40 group-hover:text-gray-700 dark:group-hover:text-white/70"
                        )}
                        strokeWidth={active ? 2.5 : 2}
                    />

                    {/* Lock Badge for Teaser Clients (Profile) */}
                    {isTeaserClient && item.id === 'profile' && (
                        <div className="absolute -top-1 -right-1 bg-background/80 backdrop-blur-sm rounded-full p-0.5 shadow-sm border border-white/10">
                            <Lock className="w-3 h-3 text-muted-foreground" />
                        </div>
                    )}

                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </div>
                <span className={cn(
                    "text-[11px] font-medium tracking-wide transition-all duration-300",
                    active ? "text-gray-900 dark:text-white opacity-100" : "text-gray-500 dark:text-white/40 opacity-70"
                )}>
                    {item.label}
                </span>
                {active && (
                    <div className="absolute bottom-2 w-1 h-1 rounded-full bg-gray-900 dark:bg-white shadow-[0_0_8px_rgba(0,0,0,0.3)] dark:shadow-[0_0_8px_white]" />
                )}
            </Button>
        );
    };

    return (
        <nav className="fixed bottom-0 inset-x-0 z-[50] select-none">
            {/* Swipe indicator - swipe up to show contextual row */}
            {showSwipeIndicator && (
                <div
                    className="absolute -top-8 left-0 right-0 h-10 flex items-center justify-center cursor-pointer"
                    onClick={() => setContextualVisible(true)}
                    onTouchStart={handleIndicatorTouchStart}
                    onTouchEnd={handleIndicatorTouchEnd}
                >
                    <div className="flex flex-col items-center gap-0.5 opacity-60">
                        <div className="w-8 h-1 rounded-full bg-gray-600 dark:bg-white/60" />
                        <span className="text-[10px] text-gray-600 dark:text-white/60 font-medium">Swipe up</span>
                    </div>
                </div>
            )}

            {/* Swipe indicator - swipe down to close contextual row */}
            {showSwipeDownIndicator && (
                <div
                    className="absolute -top-8 left-0 right-0 h-10 flex items-center justify-center cursor-pointer"
                    onClick={() => setContextualVisible(false)}
                    onTouchStart={handleIndicatorTouchStart}
                    onTouchEnd={handleIndicatorTouchEnd}
                >
                    <div className="flex flex-col items-center gap-0.5 opacity-60">
                        <div className="w-8 h-1 rounded-full bg-gray-600 dark:bg-white/60" />
                        <span className="text-[10px] text-gray-600 dark:text-white/60 font-medium">Swipe to close</span>
                    </div>
                </div>
            )}

            {/* Main container */}
            <div
                className="bg-gray-100/90 dark:bg-slate-950/60 backdrop-blur-[32px] border-t border-gray-200 dark:border-white/10"
                style={{
                    height: ROW_HEIGHT,
                    paddingBottom: "env(safe-area-inset-bottom)"
                }}
            >
                {/* Row Container - slides up/down */}
                <motion.div
                    className="flex flex-col"
                    animate={{ y: isContextualVisible ? -ROW_HEIGHT : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                >
                    {/* Row 0: Main Navigation - Reverted to SCROLLABLE */}
                    <div
                        className="w-full flex items-center overflow-x-auto no-scrollbar mask-gradient-x" // Restore scrolling
                        style={{ height: ROW_HEIGHT }}
                    >
                        {/* Render ALL items in scrollable list */}
                        {navItems.map((item) => (
                            <Link key={item.id} href={item.path || '#'} className="contents">
                                {renderButton(item)}
                            </Link>
                        ))}
                    </div>

                    {/* 
                     * Row 1: Contextual Actions
                     */}
                    <div
                        className="w-full flex items-center justify-start px-2 shrink-0 border-t border-gray-200 dark:border-white/5"
                        style={{
                            height: ROW_HEIGHT,
                        }}
                    >
                        {contextualRow}
                    </div>
                </motion.div>
            </div>
        </nav>
    );
}
