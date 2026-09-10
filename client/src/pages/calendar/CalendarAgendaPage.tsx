import { MobileCalendar } from "@/features/workspace/MobileCalendar";
import { WeekCalendar } from "@/features/workspace/WeekCalendar";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui";
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
  const wide = useMediaQuery("(min-width: 768px)");
  const [, setLocation] = useLocation();
  const { isFABOpen, setFABOpen } = useBottomNav();
  const { user } = useAuth();
  const isClient = user?.role === "client";

  const openedDeepLink = useRef(false);
  useEffect(() => {
    const target = Number(
      new URLSearchParams(window.location.search).get("appointment")
    );
    if (!target || openedDeepLink.current) return;
    const appointment = Object.values(controller.eventsByDay)
      .flat()
      .find((a: any) => a.id === target);
    if (appointment) {
      openedDeepLink.current = true;
      controller.handleAppointmentTap(appointment);
    }
  }, [controller.eventsByDay, controller.handleAppointmentTap]);

  // ── Cancel state ──
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelStep, setCancelStep] = useState<CancelStep>(null);

  const cancelSessionMutation = trpc.appointments.cancelSession.useMutation({
    onSuccess: () => {
      toast.success("Session cancelled");
      controller.refetch();
      resetCancel();
    },
    onError: err => toast.error(err.message),
  });

  const cancelProjectMutation =
    trpc.appointments.cancelProjectSessions.useMutation({
      onSuccess: data => {
        toast.success(`${data.cancelledCount} sessions cancelled`);
        controller.refetch();
        resetCancel();
      },
      onError: err => toast.error(err.message),
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
    if (
      cancelTarget.sessionPlanId &&
      cancelTarget.sessionTotal &&
      cancelTarget.sessionTotal > 1
    ) {
      setCancelStep("confirmAll");
    } else {
      // Single session — cancel immediately
      cancelSessionMutation.mutate({ appointmentId: cancelTarget.id });
    }
  }, [cancelTarget, cancelSessionMutation]);

  const handleConfirmAllDecision = useCallback(
    (cancelAll: boolean) => {
      if (!cancelTarget) return;

      if (cancelAll) {
        cancelProjectMutation.mutate({
          sessionPlanId: cancelTarget.sessionPlanId,
        });
      } else {
        cancelSessionMutation.mutate({ appointmentId: cancelTarget.id });
      }
    },
    [cancelTarget, cancelSessionMutation, cancelProjectMutation]
  );

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
    if (
      !isClient &&
      controller.isBookingStarted &&
      !controller.selectedAppointment
    ) {
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
        <>
          <BookingWizardContent
            conversationId={controller.selectedAppointment?.conversationId}
            artistServices={controller.artistServices}
            artistSettings={controller.artistSettings}
            isArtist={
              controller.user?.role === "artist" ||
              controller.user?.role === "admin"
            }
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
          {!isClient &&
            controller.selectedAppointment.status !== "completed" &&
            controller.selectedAppointment.status !== "cancelled" && (
              <Button
                variant="ghost"
                className="w-full mt-4 text-destructive"
                onClick={() => {
                  handleCancelSession(controller.selectedAppointment);
                  setFABOpen(false);
                }}
              >
                Cancel session
              </Button>
            )}
        </>
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

  return (
    <PageShell>
      <PageHeader
        title="Calendar"
        rightAction={
          !wide ? (
            <Button onClick={() => controller.startBooking(new Date())}>
              New booking
            </Button>
          ) : undefined
        }
      />

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
          <span className="text-xs font-semibold text-foreground dark:text-primary">
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
      {controller.error && (
        <div className="px-5 py-3" role="alert">
          Couldn’t load the calendar.{" "}
          <Button variant="outline" onClick={controller.refetch}>
            Try again
          </Button>
        </div>
      )}
      {controller.isLoading && (
        <p role="status" className="px-5 py-2">
          Loading appointments…
        </p>
      )}
      {wide && !isClient ? (
        <WeekCalendar controller={controller} />
      ) : (
        <MobileCalendar controller={controller} />
      )}
    </PageShell>
  );
}
