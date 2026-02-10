import { useCalendarAgendaController } from "./hooks/useCalendarAgendaController";
import { CalendarMonthHeader } from "./components/CalendarMonthHeader";
import { CalendarDateStrip7 } from "./components/CalendarDateStrip7";
import { AgendaDayList } from "./components/AgendaDayList";
import { PageShell } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";

export default function CalendarAgendaPage() {
    const controller = useCalendarAgendaController();

    return (
        <div className="fixed inset-0 flex flex-col">
            {/* Sticky Header Zone */}
            <div className="z-20 shadow-sm">
                <CalendarMonthHeader activeDate={controller.activeDate} />
                <CalendarDateStrip7
                    stripDates={controller.stripDates}
                    activeDate={controller.activeDate}
                    onDateTap={controller.handleDateTap}
                />
            </div>

            {/* Scrollable Agenda List */}
            <div className="flex-1 relative overflow-hidden">
                <AgendaDayList
                    virtualizer={controller.virtualizer}
                    agendaDates={controller.agendaDates}
                    eventsByDay={controller.eventsByDay}
                    parentRef={controller.parentRef}

                />
            </div>

            {/* FAB (Floating Action Button) - Recreate or Import? */}
            {/* The requirements say "Floating round FAB '+' bottom right remains". */}
            {/* We can use the one from Dashboard or plain button. */}
            {/* It's mostly visual for now unless we wire it up. */}
            {/* Weekly Income Bar - Pinned above Bottom Nav (h-16 = 64px) */}
            <div className="fixed bottom-16 left-0 right-0 h-10 bg-background/80 backdrop-blur-md border-t flex items-center justify-between px-4 z-40">
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
                        // This matches the simplified requirement for now.
                        // Ideally we'd reuse the logic from CalendarLegacy or similar.
                        // For this task, we focus on the UI replacement.
                    }}
                    className="w-14 h-14 rounded-full bg-black text-white shadow-2xl flex items-center justify-center hover:scale-105 transition-all"
                >
                    <span className="text-3xl font-light mb-1">+</span>
                </button>
            </div>
        </div>
    );
}
