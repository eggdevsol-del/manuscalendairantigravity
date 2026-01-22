/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * PageHeader is the canonical page header component.
 * Use this for consistent header styling across all pages.
 * 
 * Features:
 * - Fixed positioning at top of screen
 * - Consistent title size and placement
 * - Optional left/right action slots
 * - Safe area inset handling
 * 
 * DO NOT create custom header styles in page components.
 */
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageHeaderProps {
    /** Page title - rendered with consistent SSOT styling */
    title: string;
    /** Optional content for left side (e.g., back button) */
    leftAction?: ReactNode;
    /** Optional content for right side (e.g., settings button) */
    rightAction?: ReactNode;
    /** Additional classes for the header container */
    className?: string;
    /** 
     * Header variant:
     * - "default": Sticky header with blur background (for scrollable pages)
     * - "transparent": Transparent header (for fixed layouts with GlassSheet)
     */
    variant?: "default" | "transparent";
}

/**
 * PageHeader - SSOT header component with fixed positioning
 * 
 * @example
 * // Simple header with title only
 * <PageHeader title="Dashboard" />
 * 
 * @example
 * // Header with right action
 * <PageHeader 
 *     title="Messages" 
 *     rightAction={<Button variant="ghost" size="icon"><User /></Button>}
 * />
 * 
 * @example
 * // Header with back button
 * <PageHeader 
 *     title="Settings" 
 *     leftAction={<Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft /></Button>}
 * />
 */
export function PageHeader({ 
    title, 
    leftAction, 
    rightAction, 
    className, 
    variant = "transparent" 
}: PageHeaderProps) {
    return (
        <header
            className={cn(
                "px-4 py-4 z-10 shrink-0 flex items-center justify-between",
                variant === "default" && "mobile-header",
                variant === "transparent" && "bg-transparent",
                className
            )}
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
            {/* Left slot - for back button or empty space */}
            <div className="w-10 flex items-center justify-start">
                {leftAction}
            </div>

            {/* Title - centered with consistent styling */}
            <h1 className="text-2xl font-bold text-foreground flex-1 text-center">
                {title}
            </h1>

            {/* Right slot - for action buttons or empty space */}
            <div className="w-10 flex items-center justify-end">
                {rightAction}
            </div>
        </header>
    );
}

/**
 * @deprecated Use PageHeader with title prop instead
 * Legacy PageHeader that accepts children - kept for backward compatibility
 */
export function PageHeaderLegacy({ 
    children, 
    className, 
    variant = "default" 
}: { 
    children: ReactNode; 
    className?: string; 
    variant?: "default" | "transparent"; 
}) {
    return (
        <header
            className={cn(
                "px-4 py-4 z-10 shrink-0 flex items-center",
                variant === "default" && "mobile-header",
                variant === "transparent" && "bg-transparent",
                className
            )}
        >
            {children}
        </header>
    );
}
