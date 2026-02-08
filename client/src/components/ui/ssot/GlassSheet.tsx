/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * This file is part of the core UI primitives. Changes to gradients, blur, 
 * radius, or core styling MUST happen here. 
 * DO NOT OVERRIDE STYLES IN PAGE COMPONENTS.
 */
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GlassSheetProps {
    children: ReactNode;
    className?: string;
}

export function GlassSheet({ children, className }: GlassSheetProps) {
    return (
        <div className={cn(
            tokens.sheetMain.container,
            className
        )}>
            {/* Top Highlight Line */}
            <div className={cn(tokens.sheetMain.highlight, "z-10")} />
            {/* Content wrapper with relative positioning */}
            <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
}
