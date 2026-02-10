import { useRef, useEffect } from 'react';
import { Virtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';

type DayKey = string; // "YYYY-MM-DD"

function rafThrottle<T extends (...args: any[]) => void>(fn: T) {
    let raf = 0;
    let lastArgs: any[] | null = null;
    return (...args: any[]) => {
        lastArgs = args;
        if (raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            if (lastArgs) fn(...lastArgs);
            lastArgs = null;
        });
    };
}

interface UseAgendaScrollSpyOptions {
    scrollRootRef: React.RefObject<HTMLElement | null>;
    onActiveDayChange: (dayKey: DayKey) => void;
    virtualizer: Virtualizer<any, Element>;
    items: Date[]; // The list of dates corresponding to virtual items
    enabled?: boolean;
}

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
            const visibleItems = virtualizer.getVirtualItems();

            if (visibleItems.length === 0) return;

            // Find the item closest to the top (index 0 of visible items usually)
            // Note: react-virtual returns items that overlap the visible range.
            // The first item in the list is the one at the top.
            const firstVisibleItem = visibleItems[0];
            const index = firstVisibleItem.index;

            if (index >= 0 && index < items.length) {
                const date = items[index];
                const dayKey = format(date, 'yyyy-MM-dd');

                if (lastActiveRef.current !== dayKey) {
                    lastActiveRef.current = dayKey;
                    onActiveDayChange(dayKey);
                }
            }
        });

        scrollElement.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            scrollElement.removeEventListener('scroll', handleScroll);
        };
    }, [scrollRootRef, onActiveDayChange, virtualizer, items, enabled]);
}
