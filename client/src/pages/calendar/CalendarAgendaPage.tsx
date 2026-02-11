import { useCalendarAgendaController } from "./hooks/useCalendarAgendaController";
import { CalendarMonthHeader } from "./components/CalendarMonthHeader";
import { CalendarDateStrip7 } from "./components/CalendarDateStrip7";
import { AgendaDayList } from "./components/AgendaDayList";
import { MonthBreakdown } from "./components/MonthBreakdown";
import { PageShell } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";

export default function CalendarAgendaPage() {
    const controller = useCalendarAgendaController();

    return (
        <div className="fixed inset-0 flex flex-col bg-black">
            {/* 1. Underlying Breakdown Layer (visible when top layer slides down) */}
            <MonthBreakdown
                month={controller.activeDate}
                eventsByDay={controller.eventsByDay}
            />

            {/* 2. Sliding Main Content Layer */}
            <div
                className={cn(
                    "fixed inset-0 flex flex-col bg-background transition-transform duration-500 ease-in-out z-10",
                    controller.isBreakdownOpen ? "translate-y-[60vh] rounded-t-[2.5rem] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] overflow-hidden" : "translate-y-0"
                )}
            >
                {/* Sticky Header Zone */}
                <div className="z-20 shadow-sm bg-background">
                    <CalendarMonthHeader
                        activeDate={controller.activeDate}
                        onToggleBreakdown={controller.toggleBreakdown}
                        isBreakdownOpen={controller.isBreakdownOpen}
                    />
                    <CalendarDateStrip7
                        stripDates={controller.stripDates}
                        activeDate={controller.activeDate}
                        onDateTap={controller.handleDateTap}
                    />
                </div>

                {/* Scrollable Agenda List */}
                <div className="flex-1 relative overflow-hidden bg-background">
                    <AgendaDayList
                        virtualizer={controller.virtualizer}
                        agendaDates={controller.agendaDates}
                        eventsByDay={controller.eventsByDay}
                        parentRef={controller.parentRef}
                    />
                </div>

                {/* Weekly Income Bar - Pinned above Bottom Nav (h-16 = 64px in main layout, but here it's inside relative container) */}
                {/* We need to be careful with z-indexing if bottom nav is outside this content. 
                   Typically BottomNav is in PageShell. This Page IS the content. 
                   If we transform this div, the income bar moves with it. Correct. */}
                <div className="absolute bottom-16 left-0 right-0 h-10 bg-background/80 backdrop-blur-md border-t flex items-center justify-between px-4 z-40">
                    <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">This week's income</span>
                    <span className="text-sm font-bold text-foreground">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(controller.weeklyIncome)}
                    </span>
                </div>

                {/* FAB (Floating Action Button) */}
                <div className="absolute bottom-28 right-6 z-50">
                    <button
                        onClick={() => {
                            // TODO: Open appointment creation logic
                        }}
                        className="w-14 h-14 rounded-full bg-black text-white shadow-2xl flex items-center justify-center hover:scale-105 transition-all"
                    >
                        <span className="text-3xl font-light mb-1">+</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
