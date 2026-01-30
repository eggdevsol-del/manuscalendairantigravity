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
import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "lucide-react";
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
            <DialogPrimitive.Portal>
                {/* Backdrop: Subtle Blur + Dim */}
                <DialogPrimitive.Overlay 
                    className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" 
                />

                {/* Full-Screen Sheet Shell */}
                <DialogPrimitive.Content
                    className="fixed inset-0 z-[101] w-full h-[100dvh] outline-none flex flex-col gap-0 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4"
                >
                    {/* 1. Header */}
                    <header className="px-4 py-4 z-10 shrink-0 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {onBack && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="rounded-full bg-white/5 hover:bg-white/10 text-foreground -ml-2" 
                                    onClick={onBack}
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                            )}
                            <DialogPrimitive.Title className="text-2xl font-bold text-foreground">
                                {title}
                            </DialogPrimitive.Title>
                        </div>

                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full bg-white/5 hover:bg-white/10 text-foreground" 
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
                                    <p className="text-4xl font-light text-foreground/90 tracking-tight">
                                        {contextTitle}
                                    </p>
                                )}
                                {contextSubtitle && (
                                    <p className="text-muted-foreground text-lg font-medium mt-1">
                                        {contextSubtitle}
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* 3. Glass Sheet Container */}
                    <div className="flex-1 z-20 flex flex-col dark:bg-card backdrop-blur-2xl rounded-t-[2.5rem] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] overflow-hidden relative">
                        {/* Light mode background gradient overlay (matches wrapper gradient at 90% opacity) */}
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-100/90 via-purple-50/90 to-cyan-50/90 dark:hidden pointer-events-none" />
                        {/* Top Edge Highlight */}
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-white/20 to-transparent opacity-50 pointer-events-none z-10" />

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
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

export default FullScreenSheet;
