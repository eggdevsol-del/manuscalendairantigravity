import { useRef, useEffect } from 'react';
import { Virtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';

type DayKey = string; // "YYYY-MM-DD"

/**
 * Throttles a function using requestAnimationFrame.
 * This ensures the function runs at most once per frame (approx 60fps),
 * which is ideal for scroll handlers.
 */
function rafThrottle<T extends (...args: any[]) => void>(fn: T) {
    let raf = 0;
    let lastArgs: any[] | null = null; // Stores the latest arguments
    return (...args: any[]) => {
        lastArgs = args; // Always update to the latest args
        if (raf) return; // If a frame is pending, do nothing
        raf = requestAnimationFrame(() => {
            raf = 0;
            if (lastArgs) {
                fn(...lastArgs);
                lastArgs = null;
            }
        });
    };
}

interface UseAgendaScrollSpyOptions {
    scrollRootRef: React.RefObject<HTMLElement | null>;
    onActiveDayChange: (dayKey: DayKey) => void;
    // Use 'any' for virtualizer to be flexible with specific element types (Window vs Element)
    virtualizer: Virtualizer<any, Element>;
    items: Date[]; // The list of dates corresponding to virtual items
    enabled?: boolean;
}

/**
 * Hook to synchronize the agenda scroll position with the active day state.
 * Uses RAF throttling to prevent "machine-gunning" state updates.
 */
export function useAgendaScrollSpy({
    scrollRootRef,
    onActiveDayChange,
    virtualizer,
    items,
    enabled = true
}: UseAgendaScrollSpyOptions) {
    const lastActiveRef = useRef<DayKey | null>(null);

    useEffect(() => {
        const scrollElement = scrollRootRef.current;
        if (!scrollElement || !enabled) return;

        const handleScroll = rafThrottle(() => {
            // Use virtualizer to determine the top-most visible item
            // virtualizer.getVirtualItems() often includes overscan items (which are above the viewport)
            // So we can't just take the first item.
            const visibleItems = virtualizer.getVirtualItems();
            const scrollOffset = virtualizer.scrollOffset;

            if (visibleItems.length === 0) return;

            // Find the first item whose bottom edge extends into the visible area (below scrollTop)
            // item.start is top position, item.size is height.
            // We want item where (start + size) > scrollOffset.
            const firstVisibleItem = visibleItems.find(item => (item.start + item.size) > scrollOffset);

            if (!firstVisibleItem) return;

            const index = firstVisibleItem.index;

            if (index >= 0 && index < items.length) {
                const date = items[index];
                const dayKey = format(date, 'yyyy-MM-dd');

                // Only trigger update if the day has actually changed
                if (lastActiveRef.current !== dayKey) {
                    lastActiveRef.current = dayKey;
                    onActiveDayChange(dayKey);
                }
            }
        });

        // Attach passive scroll listener
        scrollElement.addEventListener('scroll', handleScroll, { passive: true });

        // Run immediately to sync state if we just became enabled (e.g. after programmatic scroll)
        handleScroll();

        return () => {
            scrollElement.removeEventListener('scroll', handleScroll);
        };
    }, [scrollRootRef, onActiveDayChange, virtualizer, items, enabled]);
}
