import { useBottomNav } from "@/contexts/BottomNavContext";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { addDays, startOfDay, format, isSameDay, subDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAgendaScrollSpy } from "./useAgendaScrollSpy";

const BUFFER_DAYS = 365; // Fetch buffer (1 year)

export function useCalendarAgendaController() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();

    // 1. Core State
    // anchorDate is now fixed to initial load to prevent grid shifting jumps
    const [anchorDate] = useState<Date>(startOfDay(new Date()));
    const [activeDate, setActiveDate] = useState<Date>(startOfDay(new Date()));
    const [windowStart, setWindowStart] = useState<Date>(subDays(startOfDay(new Date()), 3));
    const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

    const toggleBreakdown = useCallback(() => {
        setIsBreakdownOpen(prev => !prev);
    }, []);

    // 2. Data Fetching
    // Static grid: anchor +/- 1 year.
    const gridStart = useMemo(() => subDays(anchorDate, BUFFER_DAYS), [anchorDate]);
    const gridEnd = useMemo(() => addDays(anchorDate, BUFFER_DAYS), [anchorDate]);

    const { data: appointments, isLoading, refetch } = trpc.appointments.list.useQuery(
        { startDate: gridStart, endDate: gridEnd },
        { enabled: !!user, placeholderData: (prev) => prev }
    );

    // 3. Derived State
    const stripDates = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => addDays(windowStart, i));
    }, [windowStart]);

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

    const agendaDates = useMemo(() => {
        const days = [];
        let current = gridStart;
        while (current <= gridEnd) {
            days.push(current);
            current = addDays(current, 1);
        }
        return days;
    }, [gridStart, gridEnd]);

    const parentRef = useRef<HTMLDivElement>(null);
    // Use state to ensure re-renders trigger the spy enabled/disabled prop
    const [isScrollingProgrammatically, setIsScrollingProgrammatically] = useState(false);
    const [isInitialScrollDone, setIsInitialScrollDone] = useState(false);
    const scrollTimeout = useRef<NodeJS.Timeout>(undefined);

    const virtualizer = useVirtualizer({
        count: agendaDates.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100,
        overscan: 5,
    });

    // Initial Scroll Effect
    useEffect(() => {
        if (!isInitialScrollDone && agendaDates.length > 0) {
            const index = agendaDates.findIndex(d => isSameDay(d, anchorDate));
            if (index !== -1) {
                virtualizer.scrollToIndex(index, { align: 'start' });
                // Enable spy after initial scroll is set
                // Small timeout to ensure scroll position settles
                setTimeout(() => {
                    setIsInitialScrollDone(true);
                }, 100);
            }
        }
    }, [agendaDates, virtualizer, anchorDate, isInitialScrollDone]);

    const { setFABOpen } = useBottomNav();

    // 5. Actions
    const handleDateTap = useCallback((date: Date) => {
        setIsScrollingProgrammatically(true);
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
            setIsScrollingProgrammatically(false);
        }, 800);

    }, [agendaDates, virtualizer, windowStart]);

    // Sync Strip with Scroll (Scroll Spy)
    // We need to know which item is at the top of the viewport.
    // react-virtual doesn't give "current item" easily without tracking scrollTop.
    // We can use onScroll in the parent.

    // Sync Strip with Scroll (Scroll Spy)
    // We use a custom hook with RAF throttle for performance
    const onActiveDayChange = useCallback((dayKey: string) => {
        if (isScrollingProgrammatically) return;

        // Find date object from key
        const date = agendaDates.find(d => format(d, 'yyyy-MM-dd') === dayKey);

        if (date && !isSameDay(date, activeDate)) {
            setActiveDate(date);
            // Shift window if needed
            const diff = (date.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
            if (diff < 1 || diff > 5) {
                setWindowStart(subDays(date, 3));
            }

            // Removed infinite scroll shifting to prevent jumps. 
            // We use a large static buffer (+/- 365 days) instead.
        }
    }, [agendaDates, activeDate, windowStart, isScrollingProgrammatically]);

    // Initialize Scroll Spy
    useAgendaScrollSpy({
        scrollRootRef: parentRef,
        onActiveDayChange,
        virtualizer,
        items: agendaDates,
        enabled: isInitialScrollDone && !isScrollingProgrammatically
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


    // 7. Fetch Settings for Schedule (Day Types)
    const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
        enabled: !!user,
        placeholderData: undefined
    });

    const workSchedule = useMemo(() => {
        if (!artistSettings?.workSchedule) return null;
        try {
            return JSON.parse(artistSettings.workSchedule);
        } catch (e) {
            return null;
        }
    }, [artistSettings]);

    const artistServices = useMemo(() => {
        if (!artistSettings?.services) return [];
        try {
            return JSON.parse(artistSettings.services);
        } catch (e) {
            return [];
        }
    }, [artistSettings]);

    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
    const [isBookingStarted, setIsBookingStarted] = useState(false);
    const [bookingInitialDate, setBookingInitialDate] = useState<Date | undefined>(undefined);

    const { data: proposalData, isPending: isLoadingProposal } = trpc.appointments.getProposalForAppointment.useQuery(
        selectedAppointment?.id,
        { enabled: !!selectedAppointment?.id }
    );

    const handleAppointmentTap = useCallback((apt: any) => {
        setIsBookingStarted(false);
        setSelectedAppointment(apt);
        setFABOpen(true);
    }, [setFABOpen]);

    const startBooking = useCallback((date?: Date) => {
        setSelectedAppointment(null);
        setBookingInitialDate(date);
        setIsBookingStarted(true);
        setFABOpen(true);
    }, [setFABOpen]);

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
        handleAppointmentTap,
        startBooking,
        isBookingStarted,
        bookingInitialDate,
        selectedAppointment,
        setSelectedAppointment,
        proposalData,
        isLoadingProposal,
        // No handleScroll anymore, handled by hook
        refetch,
        weeklyIncome,
        isBreakdownOpen,
        toggleBreakdown,
        workSchedule,
        artistServices,
        artistSettings,
        setActiveDate
    };
}
