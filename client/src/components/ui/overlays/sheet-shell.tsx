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
          "flex flex-col p-0 gap-0 border-white/10 bg-background/95 backdrop-blur-[20px] shadow-2xl overflow-hidden text-foreground outline-none",
          side === "bottom" ? "rounded-t-[2.5rem] border-t-0 max-h-[85vh]" : "",
          side === "left" || side === "right"
            ? "h-full border-l border-white/10"
            : "",
          className
        )}
        data-overlay-id={overlayId}
      >
        <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary animate-gradient-x" />
        <SheetHeader className="p-6 pb-4 shrink-0 border-b border-white/5 space-y-2 relative">
          <div className="flex items-center justify-center relative">
            <SheetTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/80 text-center">
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

        <div className="px-6 py-4 overflow-y-auto flex-1 scrollbar-hide">
          {children}
        </div>

        {footer && (
          <div className="p-6 pt-4 shrink-0 border-t border-white/5">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
