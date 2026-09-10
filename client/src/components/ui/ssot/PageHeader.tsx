import { WorkflowHelp } from "@/features/guides/WorkflowHelp";
/** Shared safe-area header: page task first, compact business identity above. */
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { Button } from "../button";
import { useAuth } from "@/_core/hooks/useAuth";
import { type ReactNode } from "react";
import { APP_TITLE } from "@/const";

interface PageHeaderProps {
  /** Primary page title */
  title: string;
  /** Supporting text below the title */
  subtitle?: string;
  /** Additional classes for the header container */
  className?: string;
  /** Optional back action — renders a back button */
  onBack?: () => void;
  /** Optional action beside contextual help */
  rightAction?: ReactNode;
}

/**
 * PageHeader - SSOT task title, business identity and contextual help
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
  const artistBranding =
    (user as any)?.artistSettings?.businessName || user?.name || null;

  return (
    <header
      className={cn(
        tokens.shell.header,
        "app-safe-header justify-between gap-3",
        className
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back"
            className="-ml-2 h-11 w-11 shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}
        <div className="min-w-0">
          {artistBranding && (
            <p className="text-xs text-muted-foreground break-words">
              {artistBranding} · {APP_TITLE}
            </p>
          )}
          <h1
            className={cn(tokens.header.pageTitle, "break-words leading-tight")}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 break-words">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 max-w-[45%]">
        {rightAction}
        <WorkflowHelp page={title} />
      </div>
    </header>
  );
}
