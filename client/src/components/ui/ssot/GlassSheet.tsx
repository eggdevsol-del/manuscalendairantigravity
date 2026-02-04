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
            "dark:bg-slate-950/40 border-t border-white/5",
            className
        )}>
            {/* Light mode background gradient overlay (matches wrapper gradient at 90% opacity) */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100/90 via-purple-50/90 to-cyan-50/90 dark:hidden pointer-events-none" />
            {/* Top Highlight Line */}
            <div className={cn(tokens.sheetMain.highlight, "z-10")} />
            {/* Content wrapper with relative positioning to be above gradient */}
            <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
}
