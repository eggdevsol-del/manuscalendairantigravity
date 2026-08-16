/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * SegmentedHeader is the canonical tab header component.
 * Use this for consistent tab styling across all pages.
 *
 * §4: Active tab uses solid rgba(255,255,255,.1) pill.
 *     No text-shadow glow, no blur filter.
 *     Inactive text at .58 alpha for ≥4.5:1 contrast.
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

export function SegmentedHeader({
  options,
  activeIndex,
  onChange,
  className,
}: SegmentedHeaderProps) {
  return (
    <div className={cn("flex w-full items-center gap-1 p-1 rounded-full", className)}
      style={{ background: "rgba(255,255,255,.04)" }}
    >
      {options.map((title, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={title}
            onClick={() => onChange(index)}
            className={cn(
              "flex-1 text-center py-2 rounded-full transition-colors duration-200 outline-none",
              "text-[14.5px] font-semibold tracking-tight",
              "min-h-[44px]", // §10 touch target
            )}
            style={{
              background: isActive ? "rgba(255,255,255,.1)" : "transparent",
              color: isActive ? "#f5f5f4" : "rgba(255,255,255,.58)",
            }}
          >
            {title}
          </button>
        );
      })}
    </div>
  );
}

