import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth } from "date-fns";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { getEventStyle } from "../utils/styles";

interface MonthBreakdownProps {
    month: Date;
    eventsByDay?: Record<string, any[]>;
}

export function MonthBreakdown({ month, eventsByDay = {} }: MonthBreakdownProps) {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days = eachDayOfInterval({ start, end });

    // --- Stats Calculation ---
    // 1. Dates Free (this month)
    // Assume a day is "free" if it has 0 appointments.
    const freeDatesCount = days.reduce((acc, day) => {
        const key = format(day, "yyyy-MM-dd");
        const hasEvents = eventsByDay[key] && eventsByDay[key].length > 0;
        // Also exclude weekends? Usually tattoo artists work specific days.
        // For simplicity, we count all days without events as "free".
        return acc + (hasEvents ? 0 : 1);
    }, 0);

    // 2. Total Revenue (this month)
    let totalRevenue = 0;
    days.forEach(day => {
        const key = format(day, "yyyy-MM-dd");
        const events = eventsByDay[key] || [];
        events.forEach(evt => {
            // Check if price exists.
            if (evt.price) totalRevenue += Number(evt.price);
        });
    });

    // 3. Months in Advance
    // Placeholder logic: "How many months ahead has at least 1 booking?"
    const monthsInAdvance = 0; // Default to 0 as requested if no data

    // Helper to group days into weeks
    const weeks: (Date | null)[][] = [];
    let currentWeek: (Date | null)[] = [];
    // Pad first week
    const firstDay = getDay(days[0]);
    for (let i = 0; i < firstDay; i++) {
        currentWeek.push(null);
    }
    days.forEach(day => {
        currentWeek.push(day);
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    });
    // Pad last week
    if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
            currentWeek.push(null);
        }
        weeks.push(currentWeek);
    }

    return (
        <div className="absolute top-0 left-0 right-0 z-0 pt-16 px-0 pb-6 flex flex-col w-full h-[50vh]">
            <div className="px-6 mb-4">
                <h2 className="text-xl font-light text-muted-foreground uppercase tracking-widest">My Month</h2>
            </div>

            <div className="flex flex-col h-full w-full">
                {/* Top: Month Grid (Edge to Edge) */}
                <div className="w-full px-2">
                    {/* Header Row: Spacer + S M T W T F S */}
                    <div className="grid grid-cols-[30px_repeat(7,1fr)] gap-0.5 mb-0.5 text-center text-[10px] text-muted-foreground font-bold">
                        <div></div> {/* Spacer for Week Numbers */}
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <div key={i}>{d}</div>
                        ))}
                    </div>

                    {/* Weeks */}
                    <div className="flex flex-col gap-0.5">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="grid grid-cols-[30px_repeat(7,1fr)] gap-0.5">
                                {/* Week Number */}
                                <div className="flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                                    W{weekIndex + 1}
                                </div>
                                {/* Days */}
                                {week.map((day, dayIndex) => {
                                    if (!day) return <div key={`empty-${weekIndex}-${dayIndex}`} className="aspect-square bg-transparent" />;

                                    const dateKey = format(day, "yyyy-MM-dd");
                                    const dayEvents = eventsByDay[dateKey] || [];
                                    const hasEvents = dayEvents.length > 0;

                                    // Get service color if event exists
                                    let bgClass = "bg-white/5";
                                    if (hasEvents) {
                                        const style = getEventStyle(dayEvents[0]);
                                        bgClass = style.className; // Contains bg-x and text-x
                                    }

                                    return (
                                        <div
                                            key={day.toISOString()}
                                            className={cn(
                                                "aspect-square flex items-center justify-center text-[10px] font-medium transition-all relative",
                                                hasEvents ? bgClass : "bg-white/5 text-muted-foreground/30",
                                                hasEvents ? "rounded-[1px]" : "rounded-none" // Square indicators
                                            )}
                                        >
                                            <span className={cn(hasEvents ? "opacity-100" : "opacity-30")}>
                                                {format(day, "d")}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom: Stats (Underneath, Evenly Spaced) */}
                <div className="mt-8 px-6 grid grid-cols-3 gap-4 border-t border-white/5 pt-6">
                    {/* Dates Free */}
                    <div className="text-center">
                        <div className="text-xl font-medium text-foreground">{freeDatesCount}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Dates Free</div>
                        <div className="text-[9px] text-muted-foreground/60">(this month)</div>
                    </div>

                    {/* Total Revenue */}
                    <div className="text-center">
                        <div className="text-xl font-medium text-green-400">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalRevenue)}
                        </div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Total Revenue</div>
                        <div className="text-[9px] text-muted-foreground/60">(this month)</div>
                    </div>

                    {/* Months in Advance */}
                    <div className="text-center">
                        <div className="text-xl font-medium text-blue-400">{monthsInAdvance}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Mths Adv</div>
                        <div className="text-[9px] text-muted-foreground/60">(booked out)</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
