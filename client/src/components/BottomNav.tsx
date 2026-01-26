/**
 * BottomNav - System-level interaction controller
 * 
 * Handles 2D navigation:
 * - Horizontal (X): Navigation between top-level pages via horizontal scroll
 * - Vertical (Y): Row swap between main nav and contextual actions via swipe up/down
 * 
 * The nav has a FIXED height. Swipe up/down swaps which row is visible,
 * NOT expanding like a drawer.
 * 
 * See docs/bottom-nav.md for full architecture documentation.
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useRef, useCallback } from "react";
import { motion } from "framer-motion";

// Constants for gesture detection
const SWIPE_THRESHOLD = 30; // pixels to commit swipe
const ROW_HEIGHT = 77; // Height of nav row in pixels

export default function BottomNav() {
    const [location] = useLocation();
    const totalUnreadCount = useTotalUnreadCount();
    const { navItems, contextualRow, isContextualVisible, setContextualVisible } = useBottomNav();
    
    // Gesture state for the swipe indicator only
    const swipeStartY = useRef<number | null>(null);

    const isActive = (p?: string) => {
        if (!p) return false;
        if (p === "/" && location === "/") return true;
        if (p !== "/" && location.startsWith(p)) return true;
        return false;
    };

    // Check if contextual row is available
    const hasContextualRow = contextualRow !== null;

    // Swipe indicator - shows when contextual row is available or when on contextual row
    const showSwipeIndicator = hasContextualRow && !isContextualVisible;
    const showSwipeDownIndicator = isContextualVisible;

    // Handle swipe on the indicator area only
    const handleIndicatorTouchStart = useCallback((e: React.TouchEvent) => {
        swipeStartY.current = e.touches[0].clientY;
    }, []);

    const handleIndicatorTouchEnd = useCallback((e: React.TouchEvent) => {
        if (swipeStartY.current === null) return;
        
        const deltaY = swipeStartY.current - e.changedTouches[0].clientY;
        swipeStartY.current = null;
        
        // Swipe up to show contextual row
        if (deltaY > SWIPE_THRESHOLD && !isContextualVisible && hasContextualRow) {
            setContextualVisible(true);
        }
        // Swipe down to hide contextual row
        else if (deltaY < -SWIPE_THRESHOLD && isContextualVisible) {
            setContextualVisible(false);
        }
        // Swipe up while on contextual row also hides it
        else if (deltaY > SWIPE_THRESHOLD && isContextualVisible) {
            setContextualVisible(false);
        }
    }, [isContextualVisible, hasContextualRow, setContextualVisible]);

    return (
        <nav className="fixed bottom-0 inset-x-0 z-[50] select-none">
            {/* Swipe indicator - appears above nav when contextual row available */}
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

            {/* Swipe indicator for Row 1 - swipe up or down to return to main nav */}
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

            {/* Container with nav row height + safe area, overflow hidden for row swap */}
            <div 
                className="bg-gray-100/90 dark:bg-slate-950/60 backdrop-blur-[32px] border-t border-gray-200 dark:border-white/10 overflow-hidden"
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
                    {/* Row 0: Main Navigation */}
                    <div 
                        className="w-full overflow-x-auto snap-x snap-mandatory flex items-center no-scrollbar overscroll-x-contain shrink-0"
                        style={{ height: ROW_HEIGHT }}
                    >
                        {navItems.map((item) => {
                            const active = isActive(item.path);
                            const ButtonContent = (
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-1.5 h-full w-full rounded-none hover:bg-gray-200/50 dark:hover:bg-white/5 transition-all relative snap-center shrink-0",
                                        "min-w-[33.33vw] w-[33.33vw]",
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
                                        {item.id === "messages" && totalUnreadCount > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                                                {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
                                            </span>
                                        )}
                                        {item.badgeCount !== undefined && item.badgeCount > 0 && item.id !== "messages" && (
                                            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                                                {item.badgeCount}
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

                            if (item.path) {
                                return (
                                    <Link key={item.id} href={item.path} className="contents">
                                        {ButtonContent}
                                    </Link>
                                );
                            }
                            return (
                                <div key={item.id} className="contents">
                                    {ButtonContent}
                                </div>
                            );
                        })}
                    </div>

                    {/* Row 1: Contextual Actions - NO pointer event handlers here */}
                    <div 
                        className="w-full overflow-x-auto snap-x snap-mandatory no-scrollbar overscroll-x-contain flex items-center shrink-0 border-t border-gray-200 dark:border-white/5"
                        style={{ height: ROW_HEIGHT }}
                    >
                        {contextualRow}
                    </div>
                </motion.div>
            </div>
        </nav>
    );
}
