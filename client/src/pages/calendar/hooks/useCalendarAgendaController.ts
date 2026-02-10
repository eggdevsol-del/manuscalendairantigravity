import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { addDays, startOfDay, format, isSameDay, subDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAgendaScrollSpy } from "./useAgendaScrollSpy";

const BUFFER_DAYS = 60; // Fetch buffer

export function useCalendarAgendaController() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();

    // 1. Core State
    const [activeDate, setActiveDate] = useState<Date>(startOfDay(new Date()));
    const [windowStart, setWindowStart] = useState<Date>(subDays(startOfDay(new Date()), 3)); // Start centered-ish

    // 2. Data Fetching
    const gridStart = useMemo(() => subDays(activeDate, BUFFER_DAYS), [activeDate]);
    const gridEnd = useMemo(() => addDays(activeDate, BUFFER_DAYS), [activeDate]);

    const { data: appointments, isLoading, refetch } = trpc.appointments.list.useQuery(
        { startDate: gridStart, endDate: gridEnd },
        { enabled: !!user, placeholderData: (prev) => prev }
    );

    // 3. Derived State
    // The 7-day strip window
    const stripDates = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => addDays(windowStart, i));
    }, [windowStart]);

    // Group appointments by date for the list
    const eventsByDay = useMemo(() => {
        if (!appointments) return {};
        const groups: Record<string, any[]> = {};
        appointments.forEach((apt: any) => {
            const dateKey = format(new Date(apt.startTime), "yyyy-MM-dd");
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(apt);
        });
        return groups;
    }, [appointments]);

    // 4. Virtualizer / Scroll Logic
    // We need a list of days to render. Let's render a large range around activeDate?
    // Or infinite scroll? For now, let's allow scrolling within the buffer range.
    const agendaDates = useMemo(() => {
        // Render from -BUFFER_DAYS to +BUFFER_DAYS derived from initial load?
        // Actually, let's just render the gridStart to gridEnd range.
        const days = [];
        let current = gridStart;
        while (current <= gridEnd) {
            days.push(current);
            current = addDays(current, 1);
        }
        return days;
        return days;
    }, [gridStart, gridEnd]);

    const parentRef = useRef<HTMLDivElement>(null);
    const isScrollingProgrammatically = useRef(false);
    const scrollTimeout = useRef<NodeJS.Timeout>(undefined);

    const virtualizer = useVirtualizer({
        count: agendaDates.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100, // Estimate height of a day section
        overscan: 5,
    });

    // 5. Actions
    const handleDateTap = useCallback((date: Date) => {
        isScrollingProgrammatically.current = true;
        setActiveDate(date);

        // Scroll to that date in the list
        const index = agendaDates.findIndex(d => isSameDay(d, date));
        if (index !== -1) {
            virtualizer.scrollToIndex(index, { align: 'start' });
        }

        // Re-center window if needed
        const diff = (date.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
        if (diff < 1 || diff > 5) {
            setWindowStart(subDays(date, 3));
        }

        // Reset programmatic flag after scroll settles
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
            isScrollingProgrammatically.current = false;
        }, 800);

    }, [agendaDates, virtualizer, windowStart]);

    // Sync Strip with Scroll (Scroll Spy)
    // We need to know which item is at the top of the viewport.
    // react-virtual doesn't give "current item" easily without tracking scrollTop.
    // We can use onScroll in the parent.

    // Sync Strip with Scroll (Scroll Spy)
    // We use a custom hook with RAF throttle for performance
    const onActiveDayChange = useCallback((dayKey: string) => {
        if (isScrollingProgrammatically.current) return;

        // Find date object from key
        const date = agendaDates.find(d => format(d, 'yyyy-MM-dd') === dayKey);

        if (date && !isSameDay(date, activeDate)) {
            setActiveDate(date);
            // Shift window if needed
            const diff = (date.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
            if (diff < 1 || diff > 5) {
                setWindowStart(subDays(date, 3));
            }
        }
    }, [agendaDates, activeDate, windowStart]);

    // Initialize Scroll Spy
    useAgendaScrollSpy({
        scrollRootRef: parentRef,
        onActiveDayChange,
        virtualizer,
        items: agendaDates,
        enabled: !isScrollingProgrammatically.current
    });

    // 6. Calculate Weekly Income
    const weeklyIncome = useMemo(() => {
        if (!appointments) return 0;
        const start = startOfWeek(activeDate, { weekStartsOn: 1 });
        const end = endOfWeek(activeDate, { weekStartsOn: 1 });

        const weekApps = appointments.filter(a => {
            const d = new Date(a.startTime);
            return isWithinInterval(d, { start, end }) && a.status !== 'cancelled';
        });

        return weekApps.reduce((sum, app) => sum + (app.price || 0), 0);
    }, [appointments, activeDate]);


    return {
        user,
        activeDate,
        windowStart,
        stripDates,
        eventsByDay,
        parentRef,
        virtualizer,
        agendaDates,
        handleDateTap,
        // No handleScroll anymore, handled by hook
        refetch,
        weeklyIncome
    };
}
