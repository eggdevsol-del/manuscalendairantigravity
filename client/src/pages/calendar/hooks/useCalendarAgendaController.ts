import { useBottomNav } from "@/contexts/BottomNavContext";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  addDays,
  startOfDay,
  format,
  isSameDay,
  subDays,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
} from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAgendaScrollSpy } from "./useAgendaScrollSpy";

const BUFFER_DAYS = 1825; // Fetch buffer (5 years) to support historical CSV imports

export function useCalendarAgendaController() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // 1. Core State
  // anchorDate is now fixed to initial load to prevent grid shifting jumps
  const [anchorDate] = useState<Date>(startOfDay(new Date()));
  const [activeDate, setActiveDate] = useState<Date>(startOfDay(new Date()));
  const [windowStart, setWindowStart] = useState<Date>(
    subDays(startOfDay(new Date()), 3)
  );
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  const toggleBreakdown = useCallback(() => {
    setIsBreakdownOpen(prev => !prev);
  }, []);

  // 2. Data Fetching
  // Static grid: anchor +/- 1 year.
  const gridStart = useMemo(
    () => subDays(anchorDate, BUFFER_DAYS),
    [anchorDate]
  );
  const gridEnd = useMemo(() => addDays(anchorDate, BUFFER_DAYS), [anchorDate]);

  // Fetch Studio and Artists for the Studio view first so we know if we need a studio calendar
  const { data: currentStudio, isLoading: isLoadingStudio } = trpc.studios.getCurrentStudio.useQuery(
    undefined,
    {
      enabled: !!user && user.role === "artist",
    }
  );

  const { data: teamMembers } = trpc.studios.getStudioMembers.useQuery(
    { studioId: currentStudio?.id! },
    { enabled: !!currentStudio?.id }
  );

  // 1. Studio Context
  const isStudioView = !!currentStudio && (user?.role === "artist" || user?.role === "studio" || user?.role === "admin");
  const {
    data: studioAppointments,
    isLoading: isLoadingStudioAppts,
    refetch: refetchStudioAppts,
  } = trpc.appointments.getStudioCalendar.useQuery(
    { studioId: currentStudio?.id!, startDate: gridStart, endDate: gridEnd },
    { enabled: isStudioView, placeholderData: prev => prev }
  );

  // 2. Artist Context (Solo)
  const isSoloArtistView = !isStudioView && user?.role === "artist";
  const {
    data: soloAppointments,
    isLoading: isLoadingSoloAppts,
    refetch: refetchSoloAppts,
  } = trpc.appointments.getArtistCalendar.useQuery(
    { artistId: user?.id!, startDate: gridStart, endDate: gridEnd },
    { enabled: isSoloArtistView, placeholderData: prev => prev }
  );

  // 3. Client Context
  const isClientView = user?.role === "client";
  const {
    data: clientAppointments,
    isLoading: isLoadingClientAppts,
    refetch: refetchClientAppts,
  } = trpc.appointments.getClientCalendar.useQuery(
    { clientId: user?.id!, startDate: gridStart, endDate: gridEnd },
    { enabled: isClientView, placeholderData: prev => prev }
  );

  const appointments = useMemo(() => {
    if (isStudioView) return studioAppointments;
    if (isSoloArtistView) return soloAppointments;
    if (isClientView) return clientAppointments;
    return [];
  }, [isStudioView, studioAppointments, isSoloArtistView, soloAppointments, isClientView, clientAppointments]);

  const isLoading = isLoadingStudioAppts || isLoadingSoloAppts || isLoadingClientAppts || isLoadingStudio;



  const activeArtists = useMemo(() => {
    if (!teamMembers || teamMembers.length === 0) {
      // Fallback for solo/client
      return user ? [{ userId: user.id, user, role: user.role }] : [];
    }
    const filtered = teamMembers.filter(m => m.status === "active");
    // Deduplicate by userId in case the DB has multiple rows for the same user
    const uniqueMap = new Map();
    filtered.forEach(m => {
      if (!uniqueMap.has(m.user.id)) {
        uniqueMap.set(m.user.id, {
          userId: m.user.id,
          user: m.user,
          role: m.role
        });
      }
    });
    return Array.from(uniqueMap.values());
  }, [teamMembers, user]);

  const refetch = useCallback(() => {
    if (isStudioView) refetchStudioAppts();
    else if (isSoloArtistView) refetchSoloAppts();
    else if (isClientView) refetchClientAppts();
  }, [isStudioView, refetchStudioAppts, isSoloArtistView, refetchSoloAppts, isClientView, refetchClientAppts]);

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
  const [isScrollingProgrammatically, setIsScrollingProgrammatically] =
    useState(false);
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
        virtualizer.scrollToIndex(index, { align: "start" });
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
  const handleDateTap = useCallback(
    (date: Date) => {
      setIsScrollingProgrammatically(true);
      setActiveDate(date);

      // Scroll to that date in the list
      const index = agendaDates.findIndex(d => isSameDay(d, date));
      if (index !== -1) {
        virtualizer.scrollToIndex(index, { align: "start" });
      }

      // Re-center window if needed
      const diff =
        (date.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
      if (diff < 1 || diff > 5) {
        setWindowStart(subDays(date, 3));
      }

      // Reset programmatic flag after scroll settles
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        setIsScrollingProgrammatically(false);
      }, 800);
    },
    [agendaDates, virtualizer, windowStart]
  );

  // Sync Strip with Scroll (Scroll Spy)
  // We need to know which item is at the top of the viewport.
  // react-virtual doesn't give "current item" easily without tracking scrollTop.
  // We can use onScroll in the parent.

  // Sync Strip with Scroll (Scroll Spy)
  // We use a custom hook with RAF throttle for performance
  const onActiveDayChange = useCallback(
    (dayKey: string) => {
      if (isScrollingProgrammatically) return;

      // Find date object from key
      const date = agendaDates.find(d => format(d, "yyyy-MM-dd") === dayKey);

      if (date && !isSameDay(date, activeDate)) {
        setActiveDate(date);
        // Shift window if needed
        const diff =
          (date.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
        if (diff < 1 || diff > 5) {
          setWindowStart(subDays(date, 3));
        }

        // Removed infinite scroll shifting to prevent jumps.
        // We use a large static buffer (+/- 365 days) instead.
      }
    },
    [agendaDates, activeDate, windowStart, isScrollingProgrammatically]
  );

  // Initialize Scroll Spy
  useAgendaScrollSpy({
    scrollRootRef: parentRef,
    onActiveDayChange,
    virtualizer,
    items: agendaDates,
    enabled: isInitialScrollDone && !isScrollingProgrammatically,
  });

  // 6. Calculate Weekly Income
  const weeklyIncome = useMemo(() => {
    if (!appointments) return 0;
    const start = startOfWeek(activeDate, { weekStartsOn: 1 });
    const end = endOfWeek(activeDate, { weekStartsOn: 1 });

    const weekApps = appointments.filter(a => {
      const d = new Date(a.startTime);
      return isWithinInterval(d, { start, end }) && a.status !== "cancelled";
    });

    return weekApps.reduce((sum, app) => sum + (app.price || 0), 0);
  }, [appointments, activeDate]);

  // 7. Fetch Settings for Schedule (Day Types)
  const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
    enabled: !!user,
    placeholderData: undefined,
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
  const [bookingInitialDate, setBookingInitialDate] = useState<
    Date | undefined
  >(undefined);

  const { data: proposalData, isPending } =
    trpc.appointments.getProposalForAppointment.useQuery(
      selectedAppointment?.id,
      { enabled: !!selectedAppointment?.id }
    );

  const isLoadingProposal = !!selectedAppointment?.id && isPending;

  const handleAppointmentTap = useCallback(
    (apt: any) => {
      setIsBookingStarted(false);
      setSelectedAppointment(apt);
      setFABOpen(true);
    },
    [setFABOpen]
  );

  const startBooking = useCallback(
    (date?: Date) => {
      setSelectedAppointment(null);
      setBookingInitialDate(date);
      setIsBookingStarted(true);
      setFABOpen(true);
    },
    [setFABOpen]
  );

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
    setActiveDate,
    activeArtists,
  };
}
