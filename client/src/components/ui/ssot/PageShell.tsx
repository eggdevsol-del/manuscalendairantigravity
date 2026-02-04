/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * PageShell is the canonical full-screen page wrapper.
 * ALL pages that need a fixed full-screen layout MUST use this component.
 * DO NOT create custom fixed wrappers in page components.
 * 
 * This component provides:
 * - Fixed positioning covering the full viewport
 * - Proper handling of dynamic viewport height (100dvh)
 * - Flex column layout for header/content/footer patterns
 * - Transparent background to show body gradient
 */
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        tokens.shell.base,
        className
      )}
      style={{
        // Use dvh for dynamic viewport, fallback to vh
        height: "100dvh",
        // Account for safe areas - top is handled by body padding
        paddingBottom: "env(safe-area-inset-bottom)"
      }}
    >
      {children}
    </div>
  );
}
