/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * PageHeader is the canonical page header component.
 * Use this for consistent header styling across all pages.
 * 
 * Features:
 * - Left-aligned title
 * - Optional subtitle (e.g., version number)
 * - Fixed positioning at top of screen
 * - Consistent title size and placement
 * - Safe area inset handling
 * 
 * DO NOT create custom header styles in page components.
 * DO NOT add icons or buttons to the header area.
 */
import { cn } from "@/lib/utils";

interface PageHeaderProps {
    /** Page title - rendered with consistent SSOT styling */
    title: string;
    /** Optional subtitle - displayed next to title (e.g., version number) */
    subtitle?: string;
    /** Additional classes for the header container */
    className?: string;
}

/**
 * PageHeader - SSOT header component with left-aligned title
 * 
 * @example
 * <PageHeader title="Dashboard" />
 * <PageHeader title="Settings" subtitle="v1.0.119" />
 */
export function PageHeader({ title, subtitle, className }: PageHeaderProps) {
    return (
        <header
            className={cn(
                "px-6 py-4 z-10 shrink-0 flex items-center bg-transparent",
                className
            )}
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
            <h1 className="text-2xl font-bold text-foreground">
                {title}
            </h1>
            {subtitle && (
                <span className="ml-2 text-sm font-medium text-muted-foreground/60">
                    {subtitle}
                </span>
            )}
        </header>
    );
}
