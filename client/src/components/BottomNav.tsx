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
const SWIPE_THRESHOLD = 15; // pixels to commit swipe (reduced for better responsiveness)
const DRAG_START_THRESHOLD = 5; // pixels before we consider it a drag (not a tap)
const ROW_HEIGHT = 77; // Height of nav row in pixels (increased by 5px from 72)

export default function BottomNav() {
    const [location] = useLocation();
    const totalUnreadCount = useTotalUnreadCount();
    const { navItems, contextualRow, isContextualVisible, setContextualVisible } = useBottomNav();
    
    // Gesture state
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const dragStartY = useRef(0);
    const dragStartX = useRef(0);
    const pointerIdRef = useRef<number | null>(null);
    const hasDragStarted = useRef(false); // Track if we've exceeded drag threshold

    const isActive = (p?: string) => {
        if (!p) return false;
        if (p === "/" && location === "/") return true;
        if (p !== "/" && location.startsWith(p)) return true;
        return false;
    };

    // Check if contextual row is available
    const hasContextualRow = contextualRow !== null;

    // Handle pointer down - start tracking potential drag
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        // Always allow swipe if we have a contextual row OR if we're currently showing it
        if (!hasContextualRow && !isContextualVisible) return;
        
        // Store pointer ID but DON'T capture yet - wait to see if it's a drag
        pointerIdRef.current = e.pointerId;
        dragStartY.current = e.clientY;
        dragStartX.current = e.clientX;
        hasDragStarted.current = false;
        setDragOffset(0);
    }, [hasContextualRow, isContextualVisible]);

    // Handle pointer move - track drag distance
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (pointerIdRef.current !== e.pointerId) return;
        
        const deltaY = dragStartY.current - e.clientY; // Positive = swipe up, Negative = swipe down
        const deltaX = Math.abs(e.clientX - dragStartX.current);
        const absDeltaY = Math.abs(deltaY);
        
        // Only start dragging if vertical movement exceeds threshold and is more than horizontal
        if (!hasDragStarted.current && absDeltaY > DRAG_START_THRESHOLD && absDeltaY > deltaX) {
            hasDragStarted.current = true;
            setIsDragging(true);
            // Now capture the pointer since we're dragging
            try {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
                // Ignore if capture fails
            }
        }
        
        if (hasDragStarted.current) {
            // Clamp the drag offset
            const maxDrag = ROW_HEIGHT;
            const clampedDelta = Math.max(-maxDrag, Math.min(maxDrag, deltaY));
            setDragOffset(clampedDelta);
        }
    }, []);

    // Handle pointer up - determine if swipe commits
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (pointerIdRef.current !== e.pointerId) return;
        
        // Release pointer capture if we captured it
        if (hasDragStarted.current) {
            try {
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
                // Ignore if already released
            }
        }
        
        pointerIdRef.current = null;
        
        // Only process swipe if we actually started dragging
        if (hasDragStarted.current) {
            // Determine if swipe should commit
            // dragOffset > 0 means user swiped UP (finger moved up, deltaY is positive)
            // dragOffset < 0 means user swiped DOWN (finger moved down, deltaY is negative)
            
            if (dragOffset > SWIPE_THRESHOLD && !isContextualVisible && hasContextualRow) {
                // Swipe up while on main row - show contextual row
                setContextualVisible(true);
            } else if (dragOffset < -SWIPE_THRESHOLD && isContextualVisible) {
                // Swipe down while on contextual row - show main row
                setContextualVisible(false);
            } else if (dragOffset > SWIPE_THRESHOLD && isContextualVisible) {
                // Swipe up while on contextual row (Row 1) - also return to main row
                // This allows users to swipe up from Row 1 to get back to main nav
                setContextualVisible(false);
            }
        }
        
        hasDragStarted.current = false;
        setIsDragging(false);
        setDragOffset(0);
    }, [dragOffset, isContextualVisible, hasContextualRow, setContextualVisible]);

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

    // Swipe indicator - shows when contextual row is available or when on contextual row
    const showSwipeIndicator = hasContextualRow && !isContextualVisible;
    const showSwipeDownIndicator = isContextualVisible;

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-[50] select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {/* Swipe indicator - appears above nav when contextual row available */}
            {showSwipeIndicator && (
                <div 
                    className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 opacity-60"
                    onClick={() => setContextualVisible(true)}
                >
                    <div className="w-8 h-1 rounded-full bg-gray-600 dark:bg-white/60" />
                    <span className="text-[10px] text-gray-600 dark:text-white/60 font-medium">Swipe up</span>
                </div>
            )}

            {/* Swipe indicator for Row 1 - swipe up or down to return to main nav */}
            {showSwipeDownIndicator && (
                <div 
                    className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 opacity-60"
                    onClick={() => setContextualVisible(false)}
                >
                    <div className="w-8 h-1 rounded-full bg-gray-600 dark:bg-white/60" />
                    <span className="text-[10px] text-gray-600 dark:text-white/60 font-medium">Swipe to close</span>
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

                    {/* Row 1: Contextual Actions - horizontally scrollable like Row 0 */}
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
