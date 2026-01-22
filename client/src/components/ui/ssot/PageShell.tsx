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
        "fixed inset-0 w-full flex flex-col overflow-hidden",
        // Transparent to allow body gradient to show through
        "bg-transparent",
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
