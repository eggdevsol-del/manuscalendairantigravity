import { useCalendarAgendaController } from "./hooks/useCalendarAgendaController";
import { CalendarMonthHeader } from "./components/CalendarMonthHeader";
import { CalendarDateStrip7 } from "./components/CalendarDateStrip7";
import { AgendaDayList } from "./components/AgendaDayList";
import { AgendaBreakdownList } from "./components/AgendaBreakdownList";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { useRegisterFABActions } from "@/contexts/BottomNavContext";

import { useMemo, useState, useCallback } from "react";
import { type FABMenuItem } from "@/ui/FABMenu";
import { BookingWizardContent } from "@/features/booking/BookingWizardContent";
import { PersonalReminderForm } from "@/features/calendar/PersonalReminderForm";
import { QuickBookingSheet } from "@/features/calendar/QuickBookingSheet";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Cancel confirmation step type ──
type CancelStep = null | "confirm" | "confirmAll";

export default function CalendarAgendaPage() {
  const controller = useCalendarAgendaController();
  const [, setLocation] = useLocation();
  const { isFABOpen, setFABOpen } = useBottomNav();
  const { user } = useAuth();
  const isClient = user?.role === "client";

  // ── Cancel state ──
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelStep, setCancelStep] = useState<CancelStep>(null);

  const cancelSessionMutation = trpc.appointments.cancelSession.useMutation({
    onSuccess: () => {
      toast.success("Session cancelled");
      controller.refetch();
      resetCancel();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelProjectMutation = trpc.appointments.cancelProjectSessions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.cancelledCount} sessions cancelled`);
      controller.refetch();
      resetCancel();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetCancel = useCallback(() => {
    setCancelTarget(null);
    setCancelStep(null);
  }, []);

  const handleCancelSession = useCallback((apt: any) => {
    setCancelTarget(apt);
    setCancelStep("confirm");
  }, []);

  const handleConfirmCancel = useCallback(() => {
    if (!cancelTarget) return;

    // If this appointment is part of a multi-session plan, ask about cancelling all
    if (cancelTarget.sessionPlanId && cancelTarget.sessionTotal && cancelTarget.sessionTotal > 1) {
      setCancelStep("confirmAll");
    } else {
      // Single session — cancel immediately
      cancelSessionMutation.mutate({ appointmentId: cancelTarget.id });
    }
  }, [cancelTarget, cancelSessionMutation]);

  const handleConfirmAllDecision = useCallback((cancelAll: boolean) => {
    if (!cancelTarget) return;

    if (cancelAll) {
      cancelProjectMutation.mutate({ sessionPlanId: cancelTarget.sessionPlanId });
    } else {
      cancelSessionMutation.mutate({ appointmentId: cancelTarget.id });
    }
  }, [cancelTarget, cancelSessionMutation, cancelProjectMutation]);

  // Reset selection when FAB closes
  useEffect(() => {
    if (!isFABOpen) {
      controller.setSelectedAppointment(null);
    }
  }, [isFABOpen, controller.setSelectedAppointment]);

  // Register FAB Actions
  const fabActions = useMemo<any>(() => {
    // Client role: show personal reminder form instead of booking wizard
    if (isClient && controller.isBookingStarted) {
      return (
        <PersonalReminderForm
          initialDate={controller.bookingInitialDate}
          onClose={() => {
            controller.setIsBookingStarted(false);
            setFABOpen(false);
          }}
          onSuccess={() => {
            controller.refetch();
          }}
        />
      );
    }

    // Artist role: new booking via "+" → show QuickBookingSheet
    if (!isClient && controller.isBookingStarted && !controller.selectedAppointment) {
      return (
        <QuickBookingSheet
          initialDate={controller.bookingInitialDate}
          onClose={() => {
            controller.setIsBookingStarted(false);
            setFABOpen(false);
          }}
          onSuccess={() => {
            controller.refetch();
          }}
        />
      );
    }

    // Artist role: tapped existing appointment → show full BookingWizardContent
    if (controller.selectedAppointment) {
      return (
        <BookingWizardContent
          conversationId={controller.selectedAppointment?.conversationId}
          artistServices={controller.artistServices}
          artistSettings={controller.artistSettings}
          isArtist={controller.user?.role === "artist" || controller.user?.role === "admin"}
          onBookingSuccess={() => {
            controller.refetch();
          }}
          onClose={() => {
            controller.setSelectedAppointment(null);
            setFABOpen(false);
          }}
          selectedProposal={controller.proposalData}
          selectedAppointmentRaw={controller.selectedAppointment}
          clientNameOverride={controller.selectedAppointment?.clientName}
          isLoadingProposal={controller.isLoadingProposal}
          showGoToChat={!!controller.selectedAppointment?.conversationId}
          onGoToChat={() =>
            setLocation(
              `/chat/${controller.selectedAppointment?.conversationId}`
            )
          }
          artistId={controller.user?.id}
          initialDate={controller.bookingInitialDate}
          onReschedule={(apt: any) => controller.startReschedule(apt)}
          onNoShow={(apt: any) => {
            // Mark as no-show immediately
            controller.refetch();
            setFABOpen(false);
          }}
        />
      );
    }

    // No FAB items when idle — the "+" on each day row handles bookings
    return [] as FABMenuItem[];
  }, [
    controller.selectedAppointment,
    controller.isBookingStarted,
    controller.proposalData,
    controller.bookingInitialDate,
    controller.user?.role,
    controller.user?.id,
    setLocation,
    controller.artistServices,
    controller.artistSettings,
    controller.refetch,
    isClient,
  ]);

  useRegisterFABActions("calendar", fabActions);

  // Gestures for toggling Agenda View — DISABLED when agenda is open to allow scrolling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = () => {
    // When agenda is open, don't intercept swipes — allow free scrolling
    if (controller.isBreakdownOpen) return;

    const deltaY = touchEndY.current - touchStartY.current;
    const deltaX = touchEndX.current - touchStartX.current;

    if (Math.abs(deltaY) > 50 && Math.abs(deltaY) > Math.abs(deltaX)) {
      // No-op for now: swipe gestures only used in week view
    }
  };

  return (
    <PageShell>
      <PageHeader title="Calendar" />

      {/* ── Cancel Confirmation Banner (SSOT pattern) ── */}
      {cancelStep === "confirm" && (
        <div className="flex items-center justify-between px-4 py-3 bg-destructive/10 border-b border-destructive/20 animate-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-semibold text-destructive">
            Cancel this session?
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={resetCancel}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 transition-colors"
            >
              No
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={cancelSessionMutation.isPending}
              className="px-3 py-1.5 text-xs font-bold text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90 transition-colors"
            >
              Yes
            </button>
          </div>
        </div>
      )}

      {cancelStep === "confirmAll" && (
        <div className="flex items-center justify-between px-4 py-3 bg-destructive/10 border-b border-destructive/20 animate-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-semibold text-destructive">
            Cancel all sessions for this project?
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleConfirmAllDecision(false)}
              disabled={cancelSessionMutation.isPending}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 transition-colors"
            >
              No, just this one
            </button>
            <button
              onClick={() => handleConfirmAllDecision(true)}
              disabled={cancelProjectMutation.isPending}
              className="px-3 py-1.5 text-xs font-bold text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90 transition-colors"
            >
              Yes, cancel all
            </button>
          </div>
        </div>
      )}

      {/* Reschedule mode banner */}
      {controller.isRescheduling && (
        <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-b border-primary/20">
          <span className="text-xs font-semibold text-primary">
            Tap a date to reschedule
          </span>
          <button
            onClick={controller.cancelReschedule}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}
      <div
        className="relative flex flex-col md:flex-row flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 1. Underlying Agenda Layer (visible when top layer slides down) */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300 md:relative md:inset-auto md:w-1/2 md:opacity-100 md:z-0",
            controller.isBreakdownOpen ? "opacity-100 z-0" : "opacity-0 -z-10"
          )}
        >
          <AgendaBreakdownList
            eventsByDay={controller.eventsByDay}
            workSchedule={controller.workSchedule}
            activeArtists={controller.activeArtists}
            onAppointmentTap={controller.handleAppointmentTap}
            onDateTap={controller.startBooking}
            onCancelSession={handleCancelSession}
          />
        </div>

        {/* 2. Sliding Main Content Layer */}
        {/* When agenda is open, tapping this area (which is slid down, showing the calendar) returns to week view */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col transition-transform duration-500 ease-in-out z-10",
            "md:relative md:inset-auto md:w-1/2 md:translate-y-0 md:bg-transparent md:border-l md:border-border md:pt-5",
            controller.isBreakdownOpen
              ? "translate-y-[55vh] rounded-t-[2.5rem] bg-background shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.15)] overflow-hidden cursor-pointer"
              : "translate-y-0 bg-transparent"
          )}
          onClick={controller.isBreakdownOpen ? controller.toggleBreakdown : undefined}
        >
          {/* Sticky Header Zone */}
          <div className="z-20 bg-transparent" onClick={(e) => {
            // When breakdown is open, clicking the header should close it
            // But don't prevent button clicks within the header
            if (controller.isBreakdownOpen) {
              e.stopPropagation();
            }
          }}>
            <CalendarMonthHeader
              activeDate={controller.activeDate}
              onToggleBreakdown={controller.toggleBreakdown}
              isBreakdownOpen={controller.isBreakdownOpen}
              onDateChange={controller.handleDateTap}
            />
            <CalendarDateStrip7
              stripDates={controller.stripDates}
              activeDate={controller.activeDate}
              onDateTap={controller.handleDateTap}
            />
          </div>

          {/* Scrollable Agenda List */}
          <div className="flex-1 relative overflow-hidden bg-transparent">
            <AgendaDayList
              virtualizer={controller.virtualizer}
              agendaDates={controller.agendaDates}
              eventsByDay={controller.eventsByDay}
              parentRef={controller.parentRef}
              workSchedule={controller.workSchedule}
              onAppointmentTap={controller.handleAppointmentTap}
              onDateTap={controller.startBooking}
              activeArtists={controller.activeArtists}
              rescheduleAppointmentId={controller.rescheduleAppointment?.id}
            />
          </div>

          {/* Weekly Income Bar — inside flow, above bottom nav padding */}
          {!isClient && (
            <div className="shrink-0 h-10 flex items-center justify-between px-4 bg-transparent">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                This week's income
              </span>
              <span className="text-sm font-bold text-foreground">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(controller.weeklyIncome)}
              </span>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
