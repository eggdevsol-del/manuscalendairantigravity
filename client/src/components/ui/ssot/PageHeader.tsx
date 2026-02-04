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
import { tokens } from "@/ui/tokens";
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
 */
export function PageHeader({ title, subtitle, className }: PageHeaderProps) {
    // Check for Artist Branding (Teaser Mode or Client View)
    // We check localStorage directly to avoid prop drilling, as this is a global branding requirement
    const artistBranding = typeof window !== 'undefined' ? localStorage.getItem("calendair_artist_branding") : null;

    // If branding exists, we override the display logic
    // Format: [Artist Name] by CalendAIr
    const displayTitle = artistBranding ? (
        <span className="flex flex-col">
            <span>{artistBranding}</span>
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">by CalendAIr</span>
        </span>
    ) : title;

    return (
        <header
            className={cn(
                tokens.shell.header,
                className
            )}
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
            <h1 className={tokens.header.pageTitle}>
                {artistBranding ? displayTitle : title}
            </h1>
            {subtitle && !artistBranding && (
                <span className={tokens.header.pageSubtitle}>
                    {subtitle}
                </span>
            )}
            {/* If branding is active, we might suppress the subtitle or display the original title as subtitle? 
                The requirement says "Artist name = primary", "by CalendAIr = ~50% size".
                It doesn't explicitly say we lose the Page Title (like "Dashboard").
                But usually branding replaces the App Name. 
                Let's assume we keep the Page Title as a subtitle if needed?
                "On all client-facing pages... [Artist Name] by CalendAIr"
                Actually, this implies the Header *Brand* changes. 
                But PageHeader usually displays the Page Name (e.g. "Promotions").
                Replacing "Promotions" with "P Mason Tattoo" might be confusing navigationally.
                
                However, for Teaser App, the context is the Artist.
                Let's stick to the requirement: "Header Branding... Format: [Artist Name] by CalendAIr".
            */}
        </header>
    );
}
