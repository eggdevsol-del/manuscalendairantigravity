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
 * HalfSheet — Option A: auto-height bottom sheet
 *
 * The sheet grows to fit its content with no fixed height.
 * It caps at 90dvh (safe-area-aware) to never cover the full screen.
 * If content still exceeds the cap, the content area scrolls gracefully.
 *
 * Layout contract:
 *  - Drag handle:  shrink-0  (always visible)
 *  - Header:       shrink-0  (always visible)
 *  - Content:      flex-1 + min-h-0 + overflow-y-auto
 *    → short content: sheet is naturally small
 *    → tall content:  sheet grows to 90dvh, content scrolls within it
 *  - Safe area:    shrink-0  (always present at bottom)
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
    <DialogPrimitive.Root open={open} onOpenChange={o => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* Backdrop */}
            <DialogPrimitive.Overlay asChild>
              <motion.div
                className={tokens.sheetSecondary.overlay}
                initial={tokens.motion.overlayFade.initial}
                animate={tokens.motion.overlayFade.animate}
                exit={tokens.motion.overlayFade.exit}
                transition={tokens.motion.fadeDuration}
              />
            </DialogPrimitive.Overlay>

            {/* Sheet — anchored bottom, grows upward with content */}
            <DialogPrimitive.Content asChild>
              <motion.div
                className="fixed inset-x-0 bottom-0 z-[101] flex flex-col"
                initial={tokens.motion.sheetSlide.initial}
                animate={tokens.motion.sheetSlide.animate}
                exit={tokens.motion.sheetSlide.exit}
                transition={tokens.motion.spring}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={tokens.motion.dragGesture.elastic}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  if (info.offset.y > tokens.motion.dragGesture.threshold) {
                    onClose();
                  }
                }}
                style={{ willChange: "transform" }}
                layout
              >
                {/*
                 * Glass container:
                 *  - overflow-hidden: clips child content to the rounded-t-[16px] corners
                 *  - max-height: caps growth at 90dvh (safe-area-aware)
                 *  - flex flex-col: lets children participate in flex sizing
                 *
                 * NOTE: overflow-hidden here does NOT prevent the container from
                 * growing — it only clips content that exceeds the container bounds.
                 * The container itself is sized by its flex children.
                 */}
                <div
                  className={cn(
                    "relative flex flex-col overflow-hidden",
                    tokens.sheetSecondary.glass
                  )}
                  style={{
                    maxHeight: "calc(90dvh - env(safe-area-inset-top, 0px))",
                  }}
                >
                  {/* Drag handle — always at top, never compresses */}
                  <div className="flex justify-center pt-3 pb-2 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-border/60" />
                  </div>

                  {/* Header — always visible, never scrolls away */}
                  <div className="px-6 pb-4 shrink-0">
                    <DialogPrimitive.Title className={tokens.header.sheetTitle}>
                      {title}
                    </DialogPrimitive.Title>
                    {subtitle && (
                      <DialogPrimitive.Description
                        className={tokens.header.sheetSubtitle}
                      >
                        {subtitle}
                      </DialogPrimitive.Description>
                    )}
                  </div>

                  {/*
                   * Content area:
                   *  - flex-1:        takes all remaining space inside the glass container
                   *  - min-h-0:       CRITICAL — without this, a flex child cannot shrink
                   *                   below its content size, breaking overflow-y-auto
                   *  - overflow-y-auto: scrolls only when content hits the 90dvh cap
                   *  - -webkit-overflow-scrolling: momentum scroll on iOS
                   */}
                  <div
                    className={cn(
                      "flex-1 min-h-0 overflow-y-auto",
                      tokens.spacing.containerPadding,
                      className
                    )}
                    style={{ WebkitOverflowScrolling: "touch" as const }}
                  >
                    {children}
                  </div>

                  {/* Safe area padding — always present at bottom, never scrolls */}
                  <div
                    className="shrink-0"
                    style={{ paddingBottom: "env(safe-area-inset-bottom, 20px)" }}
                  />
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
