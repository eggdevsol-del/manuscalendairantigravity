import { instant } from "@/features/workspace/bookingPresentation";
import { formatInTimeZone } from "date-fns-tz";
import { startOfMonth, endOfMonth } from "date-fns";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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

export function useCalendarAgendaController() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [activeDate, setActiveDate] = useState<Date>(() => {
    const raw = new URLSearchParams(window.location.search).get("date");
    const date = raw ? new Date(raw) : new Date();
    return startOfDay(Number.isNaN(date.getTime()) ? new Date() : date);
  });
  const requestStart = subDays(startOfMonth(activeDate), 7);
  const requestEnd = addDays(endOfMonth(activeDate), 7);

  // Fetch Studio and Artists for the Studio view first so we know if we need a studio calendar
  const { data: currentStudio, isLoading: isLoadingStudio } =
    trpc.studios.getCurrentStudio.useQuery(undefined, {
      enabled: !!user && (user.role === "artist" || user.role === "admin"),
    });

  const { data: teamMembers } = trpc.studios.getStudioMembers.useQuery(
    { studioId: currentStudio?.id! },
    { enabled: !!currentStudio?.id }
  );

  // 1. Studio Context
  const isStudioView =
    !!currentStudio &&
    (user?.role === "artist" ||
      user?.role === "studio" ||
      user?.role === "admin");
  const isArtistLike = user?.role === "artist" || user?.role === "admin";
  const {
    data: studioAppointments,
    isLoading: isLoadingStudioAppts,
    refetch: refetchStudioAppts,
    error: studioError,
    isFetching: fetchingStudio,
  } = trpc.appointments.getStudioCalendar.useQuery(
    {
      studioId: currentStudio?.id!,
      startDate: requestStart,
      endDate: requestEnd,
    },
    { enabled: isStudioView, placeholderData: prev => prev }
  );

  // Always include the signed-in artist’s appointments, including bookings
  // created before joining a studio and connected-calendar events.
  const isArtistView = isArtistLike;
  const {
    data: artistAppointments,
    isLoading: isLoadingArtistAppts,
    refetch: refetchArtistAppts,
    error: artistError,
    isFetching: fetchingArtist,
  } = trpc.appointments.getArtistCalendar.useQuery(
    { artistId: user?.id!, startDate: requestStart, endDate: requestEnd },
    { enabled: isArtistView, placeholderData: prev => prev }
  );

  // 3. Client Context
  const isClientView = user?.role === "client";
  const {
    data: clientAppointments,
    isLoading: isLoadingClientAppts,
    refetch: refetchClientAppts,
    error: clientError,
    isFetching: fetchingClient,
  } = trpc.appointments.getClientCalendar.useQuery(
    { clientId: user?.id!, startDate: requestStart, endDate: requestEnd },
    { enabled: isClientView, placeholderData: prev => prev }
  );

  const appointments = useMemo(() => {
    if (isArtistLike) {
      // The studio endpoint already enforces shared-calendar privacy. Never
      // substitute it for the owner’s personal calendar or duplicate shared bookings.
      return Array.from(
        new Map(
          [
            ...(isStudioView ? (studioAppointments ?? []) : []),
            ...(artistAppointments ?? []),
          ].map(appointment => [appointment.id, appointment])
        ).values()
      );
    }
    if (isStudioView) return studioAppointments;
    if (isClientView) return clientAppointments;
    return [];
  }, [
    isStudioView,
    studioAppointments,
    isArtistLike,
    artistAppointments,
    isClientView,
    clientAppointments,
  ]);

  const isLoading =
    (isStudioView && isLoadingStudioAppts) ||
    (isArtistView && isLoadingArtistAppts) ||
    (isClientView && isLoadingClientAppts) ||
    (isArtistLike && isLoadingStudio);

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
          role: m.role,
        });
      }
    });
    return Array.from(uniqueMap.values());
  }, [teamMembers, user]);

  const refetch = useCallback(() => {
    if (isStudioView) refetchStudioAppts();
    if (isArtistView) refetchArtistAppts();
    if (isClientView) refetchClientAppts();
  }, [
    isStudioView,
    refetchStudioAppts,
    isArtistView,
    refetchArtistAppts,
    isClientView,
    refetchClientAppts,
  ]);

  const eventsByDay = useMemo(() => {
    if (!appointments) return {};
    const groups: Record<string, any[]> = {};
    appointments.forEach((apt: any) => {
      const dateKey = formatInTimeZone(
        instant(apt.startTime),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        "yyyy-MM-dd"
      );
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(apt);
    });
    return groups;
  }, [appointments]);

  const { setFABOpen } = useBottomNav();
  const handleDateTap = useCallback(
    (date: Date) => setActiveDate(startOfDay(date)),
    []
  );

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
  // ── Reschedule mode ──────────────────────────────────────────────────
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any>(null);
  const reschedule = trpc.appointments.reschedule.useMutation({
    onSuccess: result => {
      if (result.depositForfeited) {
        toast.info(
          "Appointment rescheduled. New deposit required from client."
        );
      } else {
        toast.success("Appointment rescheduled successfully.");
      }
      setRescheduleAppointment(null);
      refetch();
    },
    onError: err => {
      toast.error(err.message || "Failed to reschedule");
    },
  });

  const { data: proposalData, isPending } =
    trpc.appointments.getProposalForAppointment.useQuery(
      selectedAppointment?.id,
      { enabled: !!selectedAppointment?.id }
    );

  const isLoadingProposal = !!selectedAppointment?.id && isPending;

  const handleAppointmentTap = useCallback(
    (apt: any) => {
      // If in reschedule mode, ignore appointment taps
      if (rescheduleAppointment) return;
      if (apt.id < 0) {
        toast.info("This event is managed in your connected calendar.");
        return;
      }
      setIsBookingStarted(false);
      setSelectedAppointment(apt);
      setFABOpen(true);
    },
    [setFABOpen, rescheduleAppointment]
  );

  const startBooking = useCallback(
    (date?: Date) => {
      // If in reschedule mode, complete the reschedule to this date
      if (rescheduleAppointment) {
        const originalStart = new Date(rescheduleAppointment.startTime);
        const originalEnd = new Date(rescheduleAppointment.endTime);
        const duration = originalEnd.getTime() - originalStart.getTime();
        const newStart = date || new Date();
        const newEnd = new Date(newStart.getTime() + duration);
        // Keep original time, just change the date
        newStart.setHours(
          originalStart.getHours(),
          originalStart.getMinutes(),
          0,
          0
        );
        newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);

        reschedule.mutate({
          appointmentId: rescheduleAppointment.id,
          newStartTime: newStart.toISOString(),
          newEndTime: newEnd.toISOString(),
        });
        return;
      }
      setSelectedAppointment(null);
      setBookingInitialDate(date);
      setIsBookingStarted(true);
      setFABOpen(true);
    },
    [setFABOpen, rescheduleAppointment, reschedule]
  );

  const startReschedule = useCallback(
    (appointment: any) => {
      setSelectedAppointment(null);
      setFABOpen(false);
      setRescheduleAppointment(appointment);
      toast.info(
        `Tap a new date to reschedule ${appointment.clientName || appointment.title}`
      );
    },
    [setFABOpen]
  );

  const cancelReschedule = useCallback(() => {
    setRescheduleAppointment(null);
  }, []);

  return {
    user,
    isLoading,
    error: studioError || artistError || clientError,
    activeDate,
    eventsByDay,
    isFetching: fetchingStudio || fetchingArtist || fetchingClient,
    handleDateTap,
    handleAppointmentTap,
    startBooking,
    isBookingStarted,
    setIsBookingStarted,
    bookingInitialDate,
    selectedAppointment,
    setSelectedAppointment,
    proposalData,
    isLoadingProposal,
    refetch,
    workSchedule,
    artistServices,
    artistSettings,
    setActiveDate,
    activeArtists,
    // Reschedule
    rescheduleAppointment,
    startReschedule,
    cancelReschedule,
    isRescheduling: !!rescheduleAppointment,
  };
}
