/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * SegmentedHeader is the canonical tab header component.
 * Use this for consistent tab styling across all pages.
 * 
 * Features:
 * - Non-selected tabs have 4% blur effect
 * - Active tab has full opacity and slight scale
 * - Smooth transitions between states
 * 
 * DO NOT create custom tab styles in page components.
 */
import { cn } from "@/lib/utils";

interface SegmentedHeaderProps {
    options: string[];
    activeIndex: number;
    onChange: (index: number) => void;
    className?: string;
}

export function SegmentedHeader({ options, activeIndex, onChange, className }: SegmentedHeaderProps) {
    return (
        <div className={cn("flex w-full items-center justify-between gap-2", className)}>
            {options.map((title, index) => {
                const isActive = index === activeIndex;
                return (
                    <button
                        key={title}
                        onClick={() => onChange(index)}
                        className={cn(
                            "flex-1 text-center text-lg tracking-tight transition-all duration-300 ease-out py-2 outline-none",
                            isActive
                                ? "text-foreground font-bold opacity-100 scale-[1.02]"
                                : "text-muted-foreground font-medium opacity-40 hover:opacity-70 scale-[0.98]"
                        )}
                        style={{
                            // Active tab: no blur, non-active: 4% blur (approx 0.4px)
                            filter: isActive ? "none" : "blur(0.4px)",
                            textShadow: isActive ? "0 0 20px rgba(255,255,255,0.3)" : "none"
                        }}
                    >
                        {title}
                    </button>
                );
            })}
        </div>
    );
}
