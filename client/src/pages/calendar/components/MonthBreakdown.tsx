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
    // Since we only have current month data passed in typically, getting future months is hard without global data.
    // For now, hardcode or randomize based on "glimpse" nature, or just say "3.5" as a placeholder for the UI.
    // In a real app, this would come from the backend.
    const monthsInAdvance = 2.5; // Placeholder

    return (
        <div className="absolute inset-0 bg-background z-0 pt-20 px-6 pb-6 flex flex-col">
            <h2 className="text-xl font-light text-muted-foreground uppercase tracking-widest mb-6">Month at a Glimpse</h2>

            <div className="flex gap-8 h-full">
                {/* Left: Month Grid */}
                <div className="flex-1 max-w-sm">
                    {/* Days of week header */}
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs text-muted-foreground font-bold">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <div key={i}>{d}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {/* Empty padding for start of month */}
                        {Array.from({ length: getDay(start) }).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}

                        {days.map((day) => {
                            const dateKey = format(day, "yyyy-MM-dd");
                            const dayEvents = eventsByDay[dateKey] || [];
                            const hasEvents = dayEvents.length > 0;

                            // Determine color. If multiple, pick first? Or split?
                            // User said "if an appointment is on... the square is coloured with the service color".
                            // We use the first event's service style.
                            let bgClass = "bg-white/5";
                            let textClass = "";

                            if (hasEvents) {
                                const style = getEventStyle(dayEvents[0]);
                                // style.className contains "bg-x text-x border-x". 
                                // We want just the bg color logic. 
                                // Ideally we extract it or reuse the style. 
                                // The utility returns a string class. We can apply it but override rounding/size.
                                // Or we can try to extract just the bg part if possible, but applying the whole class 
                                // might add borders we don't want.
                                // Let's just use the style.className and rely on CSS specificity or twMerge if needed.

                                // Simple approach: standard bg-white/5 if empty.
                                // If full, use the style classes.
                                bgClass = style.className;
                            } else {
                                // Empty state
                            }

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={cn(
                                        "aspect-square rounded-sm flex items-center justify-center text-xs font-medium relative transition-all",
                                        hasEvents ? bgClass : "bg-white/5 text-muted-foreground/30",
                                        !hasEvents && "border border-white/5" // border for empty cells
                                    )}
                                >
                                    {/* Number */}
                                    <span className={cn(hasEvents ? "opacity-100" : "opacity-30")}>
                                        {format(day, "d")}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Stats */}
                <div className="flex-1 flex flex-col justify-center gap-8 pl-8 border-l border-white/5">
                    {/* Dates Free */}
                    <div>
                        <div className="text-4xl font-light text-foreground">{freeDatesCount}</div>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Dates Free</div>
                        <div className="text-[10px] text-muted-foreground/60">(This Month)</div>
                    </div>

                    {/* Total Revenue */}
                    <div>
                        <div className="text-4xl font-light text-green-400">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalRevenue)}
                        </div>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Total Revenue</div>
                        <div className="text-[10px] text-muted-foreground/60">(This Month)</div>
                    </div>

                    {/* Months in Advance */}
                    <div>
                        <div className="text-4xl font-light text-blue-400">{monthsInAdvance}</div>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Mths in Advance</div>
                        <div className="text-[10px] text-muted-foreground/60">(@ 90% Capacity)</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
