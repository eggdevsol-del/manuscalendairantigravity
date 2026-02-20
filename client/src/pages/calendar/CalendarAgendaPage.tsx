import { useCalendarAgendaController } from "./hooks/useCalendarAgendaController";
import { CalendarMonthHeader } from "./components/CalendarMonthHeader";
import { CalendarDateStrip7 } from "./components/CalendarDateStrip7";
import { AgendaDayList } from "./components/AgendaDayList";
import { MonthBreakdown } from "./components/MonthBreakdown";
import { PageShell } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { useRegisterFABActions } from "@/contexts/BottomNavContext";
import { Calendar as CalendarIcon } from "lucide-react";
import { useMemo } from "react";
import { type FABMenuItem } from "@/ui/FABMenu";
import { BookingWizardContent } from "@/features/booking/BookingWizardContent";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { useBottomNav } from "@/contexts/BottomNavContext";

export default function CalendarAgendaPage() {
    const controller = useCalendarAgendaController();
    const [, setLocation] = useLocation();
    const { isFABOpen } = useBottomNav();

    // Reset selection when FAB closes
    useEffect(() => {
        if (!isFABOpen) {
            controller.setSelectedAppointment(null);
        }
    }, [isFABOpen, controller.setSelectedAppointment]);

    // Register FAB Actions
    const fabActions = useMemo<any>(() => {
        if (controller.selectedAppointment || controller.isBookingStarted) {
            return (
                <BookingWizardContent
                    conversationId={controller.selectedAppointment?.conversationId}
                    artistServices={controller.artistServices}
                    artistSettings={controller.artistSettings}
                    isArtist={controller.user?.role === 'artist'}
                    onBookingSuccess={() => { controller.refetch(); }}
                    onClose={() => {
                        controller.setSelectedAppointment(null);
                        setFABOpen(false);
                    }}
                    selectedProposal={controller.proposalData}
                    selectedAppointmentRaw={controller.selectedAppointment}
                    clientNameOverride={controller.selectedAppointment?.clientName}
                    isLoadingProposal={controller.isLoadingProposal}
                    showGoToChat={!!controller.selectedAppointment?.conversationId}
                    onGoToChat={() => setLocation(`/chat/${controller.selectedAppointment?.conversationId}`)}
                    artistId={controller.user?.id}
                    initialDate={controller.bookingInitialDate}
                />
            );
        }

        const items: FABMenuItem[] = [
            {
                id: "toggle-month",
                label: controller.isBreakdownOpen ? "Close Month" : "Month View",
                icon: CalendarIcon,
                onClick: controller.toggleBreakdown,
                highlight: controller.isBreakdownOpen,
                closeOnClick: true
            }
        ];

        if (controller.user?.role === 'artist') {
            items.push({
                id: 'settings',
                label: 'Settings',
                icon: (props: any) => (
                    <div className="flex items-center justify-center w-full h-full">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </div>
                ),
                onClick: () => setLocation('/settings'),
            });
            // Match Chat's "Book Project" button
            items.push({
                id: 'book',
                label: 'Book Project',
                icon: (props: any) => (
                    <div className="flex items-center justify-center w-full h-full">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                ),
                onClick: () => setLocation('/conversations'), // Redirect to conversations to start a booking? Or show a list?
                highlight: true
            });
        }

        return items;
    }, [controller.isBreakdownOpen, controller.toggleBreakdown, controller.selectedAppointment, controller.isBookingStarted, controller.proposalData, controller.bookingInitialDate, controller.user?.role, controller.user?.id, setLocation, controller.artistServices, controller.artistSettings, controller.refetch]);

    useRegisterFABActions("calendar", fabActions);

    // Gestures for toggling Month View
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
        const deltaY = touchEndY.current - touchStartY.current;
        const deltaX = touchEndX.current - touchStartX.current;

        // If it's a prominent vertical swipe and Month View is open
        if (Math.abs(deltaY) > 50 && Math.abs(deltaY) > Math.abs(deltaX)) {
            // Either Swipe Down or Swipe Up when Month View is open will close it
            // Swipe Down often feels like "pulling the drawer closed" if the drawer opens downwards
            if (controller.isBreakdownOpen) {
                controller.toggleBreakdown();
            } else if (deltaY > 50 && !controller.isBreakdownOpen) {
                // Swipe down on the week view (when closed) could pull open the month view. 
                // But only if we swipe on the header, otherwise we break list scrolling.
                // We'll leave it out for now to avoid scrolling conflicts.
            }
        }
    };

    return (
        <div
            className="fixed inset-0 flex flex-col md:flex-row bg-transparent"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* 1. Underlying Breakdown Layer (visible when top layer slides down) */}
            {/* iPad: Relative, 50% width, always visible, z-0 */}
            <div className={cn(
                "absolute inset-0 transition-opacity duration-300 md:relative md:inset-auto md:w-1/2 md:opacity-100 md:z-0 pt-[env(safe-area-inset-top)]",
                controller.isBreakdownOpen ? "opacity-100 z-0" : "opacity-0 -z-10"
            )}>
                <MonthBreakdown
                    month={controller.activeDate}
                    eventsByDay={controller.eventsByDay}
                    workSchedule={controller.workSchedule}
                    onDateTap={controller.handleDateTap}
                />
            </div>

            {/* 2. Sliding Main Content Layer */}
            {/* iPad: Relative, 50% width, no transform, always visible, z-10 */}
            <div
                className={cn(
                    "fixed inset-0 flex flex-col transition-transform duration-500 ease-in-out z-10",
                    "md:relative md:inset-auto md:w-1/2 md:translate-y-0 md:bg-transparent md:border-l md:border-white/10 md:pt-5",
                    controller.isBreakdownOpen ? "translate-y-[55vh] rounded-t-[2.5rem] bg-background/95 backdrop-blur-sm shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] overflow-hidden" : "translate-y-0 bg-transparent"
                )}
            >
                {/* Sticky Header Zone */}
                {/* iPad: Ensure header is visible and functional */}
                <div className="z-20 bg-transparent pt-[env(safe-area-inset-top)]">
                    <CalendarMonthHeader
                        activeDate={controller.activeDate}
                        onToggleBreakdown={controller.toggleBreakdown}
                        isBreakdownOpen={controller.isBreakdownOpen}
                        onDateChange={controller.handleDateTap}
                    // iPad: Hide toggle button on split view since both are visible? 
                    // Actually per user request "MY MONTH side by side", so toggle might be redundant on iPad
                    // but let's keep it functional or hide it via CSS in child if needed.
                    // For now we just layout.
                    // For now we just layout.
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
                    />
                </div>

                {/* Weekly Income Bar - Pinned above Bottom Nav (h-16 = 64px in main layout, but here it's inside relative container) */}
                {/* We need to be careful with z-indexing if bottom nav is outside this content. 
                   Typically BottomNav is in PageShell. This Page IS the content. 
                   If we transform this div, the income bar moves with it. Correct. */}
                <div className="absolute bottom-16 left-0 right-0 h-10 bg-white/5 backdrop-blur-md border-t border-white/10 flex items-center justify-between px-4 z-40">
                    <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">This week's income</span>
                    <span className="text-sm font-bold text-foreground">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(controller.weeklyIncome)}
                    </span>
                </div>

            </div>
        </div>
    );
}
