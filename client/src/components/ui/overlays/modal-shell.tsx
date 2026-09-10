import { InlineWorkflowGuide, guideForOverlay } from "@/features/guides/InlineWorkflowGuide";
import React from "react";
import { Badge } from "../badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import { cn } from "@/lib/utils";
import { useUIDebug } from "@/_core/contexts/UIDebugContext";

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  overlayName?: string;
  overlayId?: string;
}

export function ModalShell({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  overlayName = "Modal",
  overlayId,
}: ModalShellProps) {
  const { showDebugLabels } = useUIDebug();
  return (
    <Dialog open={isOpen} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className={cn(
          "sm:max-w-[480px] max-h-[90dvh] flex flex-col p-0 gap-0 border border-border bg-popover shadow-xl rounded-[24px] overflow-hidden text-foreground outline-none",
          className
        )}
        data-overlay-id={overlayId}
      >
        <DialogHeader className="p-5 pb-4 shrink-0 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold tracking-tight text-center flex-1">
              {title}
            </DialogTitle>
            {showDebugLabels && overlayName && (
              <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary tracking-wider uppercase bg-primary/5 absolute right-8 top-8">
                UI v2 · {overlayName}
              </div>
            )}
            {showDebugLabels && overlayId && (
              <div className="px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-[10px] font-bold text-destructive tracking-wider font-mono absolute right-8 top-16">
                ID: {overlayId}
              </div>
            )}
          </div>
          {description && (
            <DialogDescription className="text-center text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0 mobile-scroll">
          {guideForOverlay(title) && <InlineWorkflowGuide id={guideForOverlay(title)!} />}
          {children}
        </div>

        {footer && (
          <DialogFooter className="p-5 pt-4 shrink-0 border-t border-border">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
