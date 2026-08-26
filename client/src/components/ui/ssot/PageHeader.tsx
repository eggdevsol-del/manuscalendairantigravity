/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * PageHeader is the canonical page header component.
 * ALL pages that need a header MUST use this component.
 * DO NOT create custom header styles in page components.
 *
 * Features:
 * - Left: Business branding (name + "by Tattoi")
 * - Right: Current page name
 * - Safe area inset handling for phone notch
 * - Optional back button
 */
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { Button } from "../button";
import { useAuth } from "@/_core/hooks/useAuth";
import { type ReactNode } from "react";
import { APP_TITLE } from "@/const";

interface PageHeaderProps {
  /** Page title — displayed on the right side as the current page indicator */
  title: string;
  /** Optional subtitle — displayed below title on right side */
  subtitle?: string;
  /** Additional classes for the header container */
  className?: string;
  /** Optional back action — renders a back button */
  onBack?: () => void;
  /** Optional right-side action element (replaces default title display when provided) */
  rightAction?: ReactNode;
}

/**
 * PageHeader - SSOT header with left branding + right page name
 */
export function PageHeader({
  title,
  subtitle,
  className,
  onBack,
  rightAction,
}: PageHeaderProps) {
  const { user } = useAuth();

  // Business name for branding — fallback to user name
  const artistBranding = (user as any)?.artistSettings?.businessName || user?.name || null;

  return (
    <header
      className={cn(tokens.shell.header, "justify-between items-start gap-3", className)}
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
    >
      {/* Left side — branding or back button */}
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="-ml-2 mt-0.5 h-8 w-8 text-foreground/70 hover:text-foreground shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}
        {artistBranding ? (
          <div className="flex flex-col min-w-0">
            <h1 className={cn(tokens.header.pageTitle, "truncate")}>{artistBranding}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-50 shrink-0">
                by {APP_TITLE}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col min-w-0">
            <h1 className={cn(tokens.header.pageTitle, "truncate")}>{title}</h1>
          </div>
        )}
      </div>

      {/* Right side — page name or custom right action */}
      <div className="flex flex-col items-end gap-0.5">
        {rightAction ?? (
          <span className="text-lg font-light text-foreground/60 tracking-tight">
            {title}
          </span>
        )}
        {subtitle && (
          <span className="text-xs text-muted-foreground/60">{subtitle}</span>
        )}
      </div>
    </header>
  );
}
