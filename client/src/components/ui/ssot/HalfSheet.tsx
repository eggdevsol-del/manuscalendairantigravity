import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

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
 * 
 * @example
 * <HalfSheet
 *     open={isOpen}
 *     onClose={handleClose}
 *     title="Deposit Due"
 *     subtitle="Verify payments"
 * >
 *     <Button>Execute Action</Button>
 * </HalfSheet>
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
                            <motion.div
                                className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            />
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
                                <div className="relative flex flex-col bg-white/5 backdrop-blur-2xl rounded-t-[2.5rem] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] overflow-hidden">
                                    {/* Top edge highlight */}
                                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                                    {/* Drag handle */}
                                    <div className="flex justify-center pt-3 pb-2">
                                        <div className="w-10 h-1 rounded-full bg-white/20" />
                                    </div>

                                    {/* Header with title/subtitle */}
                                    <div className="px-6 pb-6">
                                        <DialogPrimitive.Title className="text-2xl font-semibold text-foreground">
                                            {title}
                                        </DialogPrimitive.Title>
                                        {subtitle && (
                                            <DialogPrimitive.Description className="text-muted-foreground mt-1">
                                                {subtitle}
                                            </DialogPrimitive.Description>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className={`px-6 pb-8 ${className}`}>
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
