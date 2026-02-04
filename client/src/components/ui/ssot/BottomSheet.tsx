/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * BottomSheet is the canonical full-screen bottom sheet component.
 * Use this for dialogs that slide up from the bottom and cover the full screen.
 * 
 * This is different from ModalShell which is a centered modal dialog.
 * BottomSheet is used for:
 * - Full-screen detail views (e.g., appointment details in Calendar)
 * - Full-screen forms (e.g., client profile in Chat)
 * - Action sheets with complex content
 * 
 * DO NOT use DialogPrimitive directly in page components.
 * 
 * @version 1.0.126
 */
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion } from "framer-motion";

interface BottomSheetProps {
  /** Whether the sheet is open (preferred prop name) */
  open?: boolean;
  /** Alias for open - for backward compatibility */
  isOpen?: boolean;
  /** Callback when open state changes (preferred prop name) */
  onOpenChange?: (open: boolean) => void;
  /** Alias for onOpenChange - for backward compatibility */
  onClose?: () => void;
  /** Sheet content */
  children: ReactNode;
  /** Optional title for accessibility (visually hidden if not displayed) */
  title?: string;
  /** Additional className for the content container */
  className?: string;
  /** 
   * Overlay variant:
   * - "default": Semi-transparent black overlay (bg-black/30)
   * - "dark": Darker overlay for more focus (bg-black/60)
   */
  overlayVariant?: "default" | "dark";
}

export function BottomSheet({
  open,
  isOpen,
  onOpenChange,
  onClose,
  children,
  title = "Sheet",
  className,
  overlayVariant = "default"
}: BottomSheetProps) {
  // Support both prop naming conventions
  const isSheetOpen = open ?? isOpen ?? false;
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else if (onClose && !newOpen) {
      onClose();
    }
  };

  return (
    <Dialog open={isSheetOpen} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            tokens.sheetSecondary.overlay,
            overlayVariant === "dark" && "bg-black/60"
          )}
        />
        <DialogPrimitive.Content asChild>
          <motion.div
            className={cn(
              tokens.sheetSecondary.content,
              tokens.animations.sheetSlideUp,
              "will-change-transform",
              className
            )}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={tokens.motion.dragGesture.elastic}
            onDragEnd={(_, info) => {
              if (info.offset.y > tokens.motion.dragGesture.threshold) {
                handleOpenChange(false);
              }
            }}
          >
            {/* Accessibility: Hidden title for screen readers */}
            <DialogTitle className="sr-only">{title}</DialogTitle>
            {children}
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}

/**
 * ActionSheet is a variant of BottomSheet that slides up from the bottom
 * and only covers part of the screen (like iOS action sheets).
 */
interface ActionSheetProps {
  /** Whether the sheet is open (preferred prop name) */
  open?: boolean;
  /** Alias for open - for backward compatibility */
  isOpen?: boolean;
  /** Callback when open state changes (preferred prop name) */
  onOpenChange?: (open: boolean) => void;
  /** Alias for onOpenChange - for backward compatibility */
  onClose?: () => void;
  /** Sheet content */
  children: ReactNode;
  /** Optional title for accessibility */
  title?: string;
  /** Additional className for the content container */
  className?: string;
  /** Maximum height of the sheet (default: 85vh) */
  maxHeight?: string;
}

export function ActionSheet({
  open,
  isOpen,
  onOpenChange,
  onClose,
  children,
  title = "Action Sheet",
  className,
  maxHeight = "85vh"
}: ActionSheetProps) {
  // Support both prop naming conventions
  const isSheetOpen = open ?? isOpen ?? false;
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else if (onClose && !newOpen) {
      onClose();
    }
  };

  return (
    <Dialog open={isSheetOpen} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={tokens.sheetSecondary.overlay}
        />
        <DialogPrimitive.Content
          style={{ maxHeight }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-[101] w-full outline-none will-change-transform",
            tokens.sheetSecondary.glass,
            "p-6 pb-12 shadow-2xl space-y-6",
            tokens.animations.sheetSlideUp,
            className
          )}
        >
          {/* Accessibility: Hidden title for screen readers */}
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
