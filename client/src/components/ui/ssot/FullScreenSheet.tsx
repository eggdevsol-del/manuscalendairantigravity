/**
 * FullScreenSheet - SSOT Full-Screen Sheet Component
 * 
 * A full-screen takeover sheet that follows the app's page structure:
 * - Header with back/close buttons
 * - Top context area (title/subtitle)
 * - Glass sheet content area with rounded top corners
 * 
 * Use for wizards, multi-step flows, or any full-screen overlay that
 * should feel like a page rather than a modal dialog.
 * 
 * @example
 * <FullScreenSheet
 *   open={isOpen}
 *   onClose={handleClose}
 *   title="Review Proposal"
 *   contextTitle="Summary"
 *   contextSubtitle="consecutive • Full day sitting"
 *   onBack={canGoBack ? handleBack : undefined}
 * >
 *   <div className="space-y-4">
 *     {content}
 *   </div>
 * </FullScreenSheet>
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "lucide-react";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";

interface FullScreenSheetProps {
    /** Whether the sheet is open */
    open: boolean;
    /** Called when the sheet should close */
    onClose: () => void;
    /** Header title (e.g., "Review Proposal", "Select Service") */
    title: string;
    /** Large title in the context area (e.g., "Summary", "Booking") */
    contextTitle?: string;
    /** Subtitle in the context area */
    contextSubtitle?: string;
    /** Custom content for the context area (overrides contextTitle/contextSubtitle) */
    contextContent?: React.ReactNode;
    /** If provided, shows a back button that calls this function */
    onBack?: () => void;
    /** Content to render inside the glass sheet */
    children: React.ReactNode;
    /** Additional class names for the sheet content container */
    className?: string;
    /** Height of the context area (default: "h-[15vh]") */
    contextHeight?: string;
}

export function FullScreenSheet({
    open,
    onClose,
    title,
    contextTitle,
    contextSubtitle,
    contextContent,
    onBack,
    children,
    className,
    contextHeight = "h-[15vh]"
}: FullScreenSheetProps) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <AnimatePresence>
                {open && (
                    <DialogPrimitive.Portal forceMount>
                        {/* Backdrop: Subtle Blur + Dim */}
                        <DialogPrimitive.Overlay asChild>
                            <motion.div
                                className={tokens.sheetSecondary.overlay}
                                initial={tokens.motion.overlayFade.initial}
                                animate={tokens.motion.overlayFade.animate}
                                exit={tokens.motion.overlayFade.exit}
                                transition={tokens.motion.fadeDuration}
                            />
                        </DialogPrimitive.Overlay>

                        {/* Full-Screen Sheet Shell */}
                        <DialogPrimitive.Content asChild>
                            <motion.div
                                className={cn(tokens.sheetSecondary.content, tokens.animations.sheetSlideUp, "will-change-transform")}
                                drag="y"
                                dragConstraints={{ top: 0 }}
                                dragElastic={tokens.motion.dragGesture.elastic}
                                dragMomentum={false}
                                onDragEnd={(_, info) => {
                                    if (info.offset.y > tokens.motion.dragGesture.threshold) {
                                        onClose();
                                    }
                                }}
                            >
                                {/* 1. Header */}
                                <header className="px-4 py-4 z-10 shrink-0 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {onBack && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn(tokens.button.icon, "-ml-2")}
                                                onClick={onBack}
                                            >
                                                <ArrowLeft className="w-5 h-5" />
                                            </Button>
                                        )}
                                        <DialogPrimitive.Title className={tokens.header.sheetTitle}>
                                            {title}
                                        </DialogPrimitive.Title>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={tokens.button.icon}
                                        onClick={onClose}
                                    >
                                        <X className="w-5 h-5" />
                                    </Button>
                                </header>

                                {/* 2. Top Context Area */}
                                <div className={cn(
                                    "px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center opacity-80 transition-all duration-300",
                                    contextHeight
                                )}>
                                    {contextContent ? (
                                        contextContent
                                    ) : (
                                        <>
                                            {contextTitle && (
                                                <p className={tokens.header.contextTitle}>
                                                    {contextTitle}
                                                </p>
                                            )}
                                            {contextSubtitle && (
                                                <p className={tokens.header.contextSubtitle}>
                                                    {contextSubtitle}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* 3. Glass Sheet Container */}
                                <div className={cn("flex-1 z-20 flex flex-col relative overflow-hidden", tokens.sheetSecondary.glass)}>
                                    {/* Light mode background gradient overlay (matches wrapper gradient at 90% opacity) */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-100/90 via-purple-50/90 to-cyan-50/90 dark:hidden pointer-events-none" />
                                    {/* Top Edge Highlight */}
                                    <div className={cn(tokens.sheetSecondary.highlight, "opacity-50 z-10")} />

                                    {/* Scrollable Content */}
                                    <div className={cn(
                                        "relative z-10 flex-1 w-full h-full px-4 pt-8 overflow-y-auto mobile-scroll touch-pan-y",
                                        className
                                    )}>
                                        <div className="pb-32 max-w-lg mx-auto">
                                            {children}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    );
}

export default FullScreenSheet;
