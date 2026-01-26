/**
 * BottomNavRow - Container for bottom navigation action buttons
 * 
 * SIMPLE FLEX CONTAINER - no scroll, no gestures.
 * This ensures child buttons receive all touch/pointer events.
 * 
 * @version 1.0.125
 */

import { cn } from "@/lib/utils";
import React, { forwardRef } from "react";

interface BottomNavRowProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export const BottomNavRow = forwardRef<HTMLDivElement, BottomNavRowProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "flex items-center gap-1 h-full",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);

BottomNavRow.displayName = "BottomNavRow";
