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
import { useRef, useCallback, useState } from "react";
import { motion } from "framer-motion";

// Constants for gesture detection
const SWIPE_THRESHOLD = 20; // pixels to commit swipe
const ROW_HEIGHT = 72; // Height of nav row in pixels

export default function BottomNav() {
    const [location] = useLocation();
    const totalUnreadCount = useTotalUnreadCount();
    const { navItems, contextualRow, isContextualVisible, setContextualVisible } = useBottomNav();
    
    // Gesture state
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const dragStartY = useRef(0);
    const elementRef = useRef<HTMLDivElement>(null);

    const isActive = (p?: string) => {
        if (!p) return false;
        if (p === "/" && location === "/") return true;
        if (p !== "/" && location.startsWith(p)) return true;
        return false;
    };

    // Check if contextual row is available
    const hasContextualRow = contextualRow !== null;

    // Handle pointer down - start tracking
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        // Always allow swipe if we have a contextual row OR if we're currently showing it
        if (!hasContextualRow && !isContextualVisible) return;
        
        // Capture on the nav element itself
        if (elementRef.current) {
            elementRef.current.setPointerCapture(e.pointerId);
        }
        dragStartY.current = e.clientY;
        setIsDragging(true);
        setDragOffset(0);
    }, [hasContextualRow, isContextualVisible]);

    // Handle pointer move - track drag distance
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        
        const deltaY = dragStartY.current - e.clientY; // Positive = swipe up, Negative = swipe down
        // Clamp the drag offset
        const maxDrag = ROW_HEIGHT;
        const clampedDelta = Math.max(-maxDrag, Math.min(maxDrag, deltaY));
        setDragOffset(clampedDelta);
    }, [isDragging]);

    // Handle pointer up - determine if swipe commits
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        
        if (elementRef.current) {
            elementRef.current.releasePointerCapture(e.pointerId);
        }
        setIsDragging(false);
        
        // Determine if swipe should commit
        // dragOffset > 0 means user swiped UP (finger moved up, deltaY is positive)
        // dragOffset < 0 means user swiped DOWN (finger moved down, deltaY is negative)
        
        if (dragOffset > SWIPE_THRESHOLD && !isContextualVisible && hasContextualRow) {
            // Swipe up while on main row - show contextual row
            setContextualVisible(true);
        } else if (dragOffset < -SWIPE_THRESHOLD && isContextualVisible) {
            // Swipe down while on contextual row - show main row
            setContextualVisible(false);
        }
        
        setDragOffset(0);
    }, [isDragging, dragOffset, isContextualVisible, hasContextualRow, setContextualVisible]);

    // Calculate the current Y position of the row container
    const getRowY = () => {
        const baseY = isContextualVisible ? -ROW_HEIGHT : 0;
        if (isDragging) {
            // Add drag offset for visual feedback
            // When showing main (baseY=0), swiping up (positive offset) should move negative
            // When showing contextual (baseY=-ROW_HEIGHT), swiping down (negative offset) should move positive
            return baseY - (dragOffset * 0.5); // 0.5 for elastic feel
        }
        return baseY;
    };

    return (
        <nav
            ref={elementRef}
            className="fixed bottom-0 inset-x-0 z-[50] select-none"
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {/* Container with nav row height + safe area, overflow hidden for row swap */}
            <div 
                className="bg-slate-950/60 backdrop-blur-[32px] border-t border-white/10 overflow-hidden"
                style={{ 
                    height: ROW_HEIGHT,
                    paddingBottom: "env(safe-area-inset-bottom)"
                }}
            >
                {/* Row Container - slides up/down */}
                <motion.div
                    className="flex flex-col"
                    animate={{ y: isDragging ? getRowY() : (isContextualVisible ? -ROW_HEIGHT : 0) }}
                    transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 35 }}
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
                                        "flex flex-col items-center justify-center gap-1.5 h-full w-full rounded-none hover:bg-white/5 transition-all relative snap-center shrink-0",
                                        "min-w-[33.33vw] w-[33.33vw]",
                                        active ? "text-white" : "text-white/40"
                                    )}
                                    onClick={item.action}
                                >
                                    <div className="relative p-1">
                                        <item.icon
                                            className={cn(
                                                "w-6 h-6 transition-all duration-300",
                                                active
                                                    ? "text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                                                    : "text-white/40 group-hover:text-white/70"
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
                                        active ? "text-white opacity-100" : "text-white/40 opacity-70"
                                    )}>
                                        {item.label}
                                    </span>
                                    {active && (
                                        <div className="absolute bottom-2 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_white]" />
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

                    {/* Row 1: Contextual Actions - horizontally scrollable like Row 0 */}
                    <div 
                        className="w-full overflow-x-auto snap-x snap-mandatory no-scrollbar overscroll-x-contain flex items-center shrink-0 border-t border-white/5"
                        style={{ height: ROW_HEIGHT }}
                    >
                        {contextualRow}
                    </div>
                </motion.div>
            </div>
        </nav>
    );
}
