import { useMediaQuery } from "./useMediaQuery";

/**
 * Hook to detect if the current viewport matches tablet landscape dimensions.
 * We define "Tablet Landscape" as a screen width of at least 1024px.
 * This covers iPads in landscape (1024px+) and desktop monitors.
 */
export function useTabletLandscape() {
    // 1024px is the standard breakpoint for iPad Landscape and Desktop
    return useMediaQuery("(min-width: 1024px)");
}
