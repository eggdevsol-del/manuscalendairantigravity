import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";

interface HalfSheetProps {
    /** Whether the sheet is open */
    open: boolean;
    /** Called when the sheet should close */
    onClose: () => void;
    /** Title displayed in the sheet header */
    title: string;
    /** Subtitle displayed below the title */
    subtitle?: string;
    /** Content to render inside the sheet */
    children: ReactNode;
    /** Additional classes for the content container */
    className?: string;
}

/**
 * HalfSheet - A bottom sheet that covers approximately half the screen
 * 
 * Used for quick actions and simple selections that don't require
 * full-screen navigation. Features:
 * - Slides up from bottom
 * - Drag handle indicator
 * - Same glass styling as FullScreenSheet
 * - Backdrop blur with tap-to-dismiss
 */
export function HalfSheet({
    open,
    onClose,
    title,
    subtitle,
    children,
    className = "",
}: HalfSheetProps) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
            <AnimatePresence>
                {open && (
                    <DialogPrimitive.Portal forceMount>
                        {/* Backdrop */}
                        <DialogPrimitive.Overlay asChild>
                            <div className={tokens.sheetSecondary.overlay} />
                        </DialogPrimitive.Overlay>

                        {/* Sheet */}
                        <DialogPrimitive.Content asChild>
                            <motion.div
                                className="fixed inset-x-0 bottom-0 z-[101] flex flex-col"
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            >
                                {/* Glass container */}
                                <div className={cn("relative flex flex-col overflow-hidden", tokens.sheetSecondary.glass)}>
                                    {/* Top edge highlight */}
                                    <div className={tokens.sheetSecondary.highlight} />

                                    {/* Drag handle */}
                                    <div className="flex justify-center pt-3 pb-2">
                                        <div className="w-10 h-1 rounded-full bg-white/20" />
                                    </div>

                                    {/* Header with title/subtitle */}
                                    <div className="px-6 pb-6">
                                        <DialogPrimitive.Title className={tokens.header.sheetTitle}>
                                            {title}
                                        </DialogPrimitive.Title>
                                        {subtitle && (
                                            <DialogPrimitive.Description className={tokens.header.sheetSubtitle}>
                                                {subtitle}
                                            </DialogPrimitive.Description>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className={cn(tokens.spacing.containerPadding, className)}>
                                        {children}
                                    </div>

                                    {/* Safe area padding for bottom */}
                                    <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
                                </div>
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    );
}
