/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * This file is part of the core UI primitives. Changes to gradients, blur, 
 * radius, or core styling MUST happen here. 
 * DO NOT OVERRIDE STYLES IN PAGE COMPONENTS.
 */
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
            "flex-1 z-20 flex flex-col relative overflow-hidden",
            // SSOT Rules:
            // - Translucent sheet (blur + rounded top corners)
            // - Uses .liquid-glass tokens concept but adapted for a full sheet
            "backdrop-blur-[32px] rounded-t-[2.5rem] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]",
            // Light mode: uses background wrapper gradient at 90% opacity
            // Dark mode: dark glass tint matching 'Gold Standard' preference
            "dark:bg-slate-950/40 border-t border-white/5",
            className
        )}>
            {/* Light mode background gradient overlay (matches wrapper gradient at 90% opacity) */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100/90 via-purple-50/90 to-cyan-50/90 dark:hidden pointer-events-none" />
            {/* Top Highlight Line */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-white/20 to-transparent opacity-50 pointer-events-none z-10" />
            {/* Content wrapper with relative positioning to be above gradient */}
            <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
}
