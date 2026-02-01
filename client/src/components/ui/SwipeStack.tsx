import React, { useState, useEffect, useRef } from "react";
import {
    motion,
    useMotionValue,
    useTransform,
    useAnimation,
    PanInfo,
    AnimatePresence,
} from "framer-motion";
import { cn } from "@/lib/utils";

interface SwipeStackProps<T> {
    items: T[];
    renderItem: (item: T, index: number, isTop: boolean) => React.ReactNode;
    onSwipe: (direction: "up" | "down", index: number) => void;
    onChange?: (index: number) => void;
    startIndex?: number;
    className?: string;
    threshold?: number;
}

export function SwipeStack<T>({
    items,
    renderItem,
    onSwipe,
    onChange,
    startIndex = 0,
    className,
    threshold = 150,
}: SwipeStackProps<T>) {
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    const dragY = useMotionValue(0);
    const controls = useAnimation();
    const hasVibratedExceed = useRef(false);

    // Reset index if items change significantly (optional, but good for filtering)
    // For now, valid items are sliced from currentIndex
    const activeItem = items[currentIndex];
    const nextItem = items[currentIndex + 1];

    // Derived Values
    const rotate = useTransform(dragY, [-200, 200], [-3, 3]); // Tilt +/- 3deg
    const backgroundScale = useTransform(
        dragY,
        [-threshold, 0, threshold],
        [1, 0.96, 1]
    );
    const backgroundBlur = useTransform(
        dragY,
        [-threshold, 0, threshold],
        [0, 2, 0] // Blur 2px at rest, 0px at commit
    );
    const backgroundOpacity = useTransform(
        dragY,
        [-threshold, 0, threshold],
        [1, 0.5, 1] // Optional: fade background in? User asked for blur.
    );

    const handlePan = (_: any, info: PanInfo) => {
        let y = info.offset.y;
        // Dynamic Resistance: Increase usage after 70% threshold
        const limit = threshold * 0.7;
        const isExceeding = Math.abs(y) > threshold * 0.6;

        if (isExceeding && !hasVibratedExceed.current) {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
            hasVibratedExceed.current = true;
        } else if (!isExceeding && hasVibratedExceed.current) {
            hasVibratedExceed.current = false;
        }

        if (y > limit) {
            y = limit + (y - limit) * 0.5;
        } else if (y < -limit) {
            y = -limit + (y + limit) * 0.5;
        }
        dragY.set(y);
    };

    const handlePanEnd = async (_: any, info: PanInfo) => {
        const velocity = info.velocity.y;
        const offset = info.offset.y;
        const absOffset = Math.abs(offset);

        // Determine commit
        // Threshold or high velocity
        const isCommit = absOffset > threshold * 0.6 || Math.abs(velocity) > 500;

        if (isCommit) {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
            const direction = offset < 0 ? "up" : "down"; // Negative Y is Up
            // Animate off screen
            const endY = direction === "up" ? -window.innerHeight : window.innerHeight;

            await controls.start({
                y: endY,
                opacity: 0,
                transition: { duration: 0.3, ease: "anticipate" } // Accelerate out
            });

            // Commit state change
            if (onSwipe) onSwipe(direction, currentIndex);

            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);
            if (onChange) onChange(nextIndex);

            // Reset logic for next card
            dragY.set(0);
            controls.set({ y: 0, opacity: 1 });
            hasVibratedExceed.current = false;
        } else {
            // Rebound
            controls.start({
                y: 0,
                transition: { type: "spring", stiffness: 300, damping: 20 }
            });
            hasVibratedExceed.current = false;
        }
    };

    // If no items left
    if (!activeItem) return null;

    return (
        <div className={cn("relative w-full h-full flex items-center justify-center", className)}>
            {/* Background Card (Next) */}
            {nextItem && (
                <motion.div
                    key={`back-${currentIndex + 1}`}
                    className="absolute w-full h-full z-0 flex items-center justify-center p-4"
                    style={{
                        scale: backgroundScale,
                        filter: useTransform(backgroundBlur, (v) => `blur(${v}px)`),
                        // opacity: activeItem ? 1 : 0 // Always visible behind
                    }}
                >
                    {renderItem(nextItem, currentIndex + 1, false)}
                </motion.div>
            )}

            {/* Foreground Card (Active) */}
            <motion.div
                key={`front-${currentIndex}`} // Key change triggers mount/unmount if needed, but we rely on state
                className="absolute w-full h-full z-10 flex items-center justify-center p-4 touch-none"
                style={{
                    y: dragY,
                    rotate: rotate,
                    cursor: "grab"
                }}
                animate={controls}
                onPan={handlePan}
                onPanEnd={handlePanEnd}
                whileTap={{ cursor: "grabbing" }}
            >
                {renderItem(activeItem, currentIndex, true)}
            </motion.div>
        </div>
    );
}
