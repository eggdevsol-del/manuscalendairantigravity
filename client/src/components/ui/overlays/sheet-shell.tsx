import { InlineWorkflowGuide, guideForOverlay } from "@/features/guides/InlineWorkflowGuide";
import React from "react";
import { Badge } from "../badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../sheet";
import { cn } from "@/lib/utils";
import { useUIDebug } from "@/_core/contexts/UIDebugContext";

interface SheetShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  overlayName?: string;
  overlayId?: string;
}

export function SheetShell({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  side = "bottom",
  overlayName = "Sheet",
  overlayId,
}: SheetShellProps) {
  const { showDebugLabels } = useUIDebug();
  return (
    <Sheet open={isOpen} onOpenChange={v => !v && onClose()}>
      <SheetContent
        side={side}
        className={cn(
          "flex flex-col p-0 gap-0 border-border bg-popover shadow-xl overflow-hidden text-foreground outline-none",
          side === "bottom" ? "rounded-t-[24px] border-t-0 max-h-[85dvh]" : "",
          side === "left" || side === "right"
            ? "h-full border-l border-border"
            : "",
          className
        )}
        data-overlay-id={overlayId}
      >
        <div className="h-1 w-full bg-[rgba(255,255,255,0.12)]" />
        <SheetHeader className="p-6 pb-4 shrink-0 border-b border-border space-y-2 relative">
          <div className="flex items-center justify-center relative">
            <SheetTitle className="text-xl font-semibold tracking-tight text-foreground text-center">
              {title}
            </SheetTitle>
            {showDebugLabels && overlayName && (
              <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary tracking-wider uppercase bg-primary/5 absolute right-0 top-1/2 -translate-y-1/2">
                UI v2 · {overlayName}
              </div>
            )}
          </div>
          {description && (
            <SheetDescription className="text-center text-xs text-muted-foreground">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0 mobile-scroll">
          {guideForOverlay(title) && <InlineWorkflowGuide id={guideForOverlay(title)!} />}
          {children}
        </div>

        {footer && (
          <div className="p-6 pt-4 shrink-0 border-t border-border">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
