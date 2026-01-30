/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * LoadingState is the canonical loading indicator component.
 * Use this for consistent loading states across all pages.
 * 
 * DO NOT create custom loading spinners or "Loading..." text in page components.
 */
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

interface LoadingStateProps {
  /** Optional loading message */
  message?: string;
  /** Whether to show in full-screen centered mode */
  fullScreen?: boolean;
  className?: string;
}

export function LoadingState({ 
  message = "Loading...", 
  fullScreen = false,
  className 
}: LoadingStateProps) {
  const content = (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Spinner className="size-5" />
      {message && <span className="text-muted-foreground">{message}</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        {content}
      </div>
    );
  }

  return content;
}
