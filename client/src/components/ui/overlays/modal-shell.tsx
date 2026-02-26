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
          "sm:max-w-[480px] max-h-[90vh] flex flex-col p-0 gap-0 border border-white/10 bg-background/95 backdrop-blur-[20px] shadow-2xl rounded-[2.5rem] overflow-hidden text-foreground outline-none",
          className
        )}
        data-overlay-id={overlayId}
      >
        <DialogHeader className="p-8 pb-4 shrink-0 border-b border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold tracking-tight text-center flex-1">
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

        <div className="px-8 py-4 overflow-y-auto flex-1 scrollbar-hide">
          {children}
        </div>

        {footer && (
          <DialogFooter className="p-8 pt-4 shrink-0 border-t border-white/5">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
