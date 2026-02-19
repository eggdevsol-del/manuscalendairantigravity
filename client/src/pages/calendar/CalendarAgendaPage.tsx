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

export default function CalendarAgendaPage() {
    const controller = useCalendarAgendaController();

    // Register FAB Actions
    const fabActions = useMemo<FABMenuItem[]>(() => [
        {
            id: "toggle-month",
            label: controller.isBreakdownOpen ? "Close Month" : "Month View",
            icon: CalendarIcon,
            onClick: controller.toggleBreakdown,
            highlight: controller.isBreakdownOpen,
            closeOnClick: true
        }
    ], [controller.isBreakdownOpen, controller.toggleBreakdown]);

    useRegisterFABActions("calendar", fabActions);

    return (
        <div className="fixed inset-0 flex flex-col md:flex-row bg-transparent">
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
