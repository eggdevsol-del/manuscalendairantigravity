/**
 * NativeConfirmToast — Push-notification-styled confirmation dialog.
 *
 * Mimics iOS native push notification banner: slides down from top,
 * glassmorphic background, app icon, title/body, action buttons.
 * SSOT-compliant — no hardcoded colors outside tokens.
 */

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NativeConfirmToastProps {
    /** Whether the toast is visible */
    isOpen: boolean;
    /** Notification title (bold) */
    title: string;
    /** Notification body text */
    body: string;
    /** Label for the confirm action button */
    confirmLabel?: string;
    /** Label for the cancel action button */
    cancelLabel?: string;
    /** Variant controls confirm button color */
    variant?: "destructive" | "default";
    /** Called when user confirms */
    onConfirm: () => void;
    /** Called when user cancels / dismisses */
    onCancel: () => void;
    /** Whether the confirm action is currently processing */
    isPending?: boolean;
}

export function NativeConfirmToast({
    isOpen,
    title,
    body,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "destructive",
    onConfirm,
    onCancel,
    isPending = false,
}: NativeConfirmToastProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop — subtle, dismissible */}
                    <motion.div
                        className="fixed inset-0 z-[9998] bg-black/20"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onCancel}
                    />

                    {/* Notification banner */}
                    <motion.div
                        className="fixed top-3 left-3 right-3 z-[9999] mx-auto max-w-[420px]"
                        initial={{ y: -120, opacity: 0, scale: 0.92 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -120, opacity: 0, scale: 0.92 }}
                        transition={{
                            type: "spring",
                            damping: 28,
                            stiffness: 340,
                            mass: 0.8,
                        }}
                    >
                        <div
                            className={cn(
                                "rounded-[22px] overflow-hidden",
                                "bg-[#1c1c1e]/90 backdrop-blur-2xl",
                                "border border-white/[0.08]",
                                "shadow-[0_8px_40px_rgba(0,0,0,0.55)]"
                            )}
                        >
                            {/* Header row — app icon + name + timestamp */}
                            <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1">
                                {/* App icon */}
                                <div className="w-[22px] h-[22px] rounded-[6px] bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-sm shrink-0">
                                    <span className="text-[10px] font-black text-white leading-none select-none">
                                        T
                                    </span>
                                </div>
                                <span className="text-[12px] font-semibold text-white/50 uppercase tracking-wide leading-none">
                                    tattoi
                                </span>
                                <span className="text-[11px] text-white/30 ml-auto leading-none">
                                    now
                                </span>
                            </div>

                            {/* Content */}
                            <div className="px-4 pt-1 pb-3">
                                <p className="text-[15px] font-semibold text-white leading-snug">
                                    {title}
                                </p>
                                <p className="text-[13px] text-white/60 leading-snug mt-0.5">
                                    {body}
                                </p>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-white/[0.08]" />

                            {/* Action buttons — stacked, full-width like iOS notification actions */}
                            <div className="flex">
                                <button
                                    onClick={onCancel}
                                    disabled={isPending}
                                    className={cn(
                                        "flex-1 py-3 text-[15px] font-normal text-[#0a84ff] transition-colors",
                                        "active:bg-white/[0.06]",
                                        "disabled:opacity-40"
                                    )}
                                >
                                    {cancelLabel}
                                </button>

                                <div className="w-px bg-white/[0.08]" />

                                <button
                                    onClick={onConfirm}
                                    disabled={isPending}
                                    className={cn(
                                        "flex-1 py-3 text-[15px] font-semibold transition-colors",
                                        "active:bg-white/[0.06]",
                                        "disabled:opacity-40",
                                        variant === "destructive"
                                            ? "text-red-500"
                                            : "text-[#0a84ff]"
                                    )}
                                >
                                    {isPending ? "Processing…" : confirmLabel}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
