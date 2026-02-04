/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * LoadingState is the canonical loading indicator component.
 * Use this for consistent loading states across all pages.
 * 
 * DO NOT create custom loading spinners or "Loading..." text in page components.
 */
import { tokens } from "@/ui/tokens";
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
    <div className={cn(tokens.loading.base, className)}>
      <Spinner className="size-5" />
      {message && <span className={tokens.loading.text}>{message}</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className={tokens.loading.fullScreen}>
        {content}
      </div>
    );
  }

  return content;
}
