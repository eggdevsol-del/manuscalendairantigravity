import { format, startOfMonth, getDay, isSameMonth, startOfWeek, addDays } from "date-fns";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { getEventStyle } from "../utils/styles";

interface MonthBreakdownProps {
    month: Date;
    eventsByDay?: Record<string, any[]>;
    workSchedule?: any;
    onDateTap?: (date: Date) => void;
}

export function MonthBreakdown({ month, eventsByDay = {}, workSchedule, onDateTap }: MonthBreakdownProps) {
    // Generate fixed 5 weeks (35 days)
    const start = startOfWeek(startOfMonth(month)); // Default to Sunday start
    // We want exactly 35 days
    // Note: This might clip the end of some months (e.g. 30/31 day months starting on Sat)
    // but the user explicitly requested "5 weeks only no more no less".
    const days: Date[] = [];
    let d = start;
    for (let i = 0; i < 35; i++) {
        days.push(d);
        d = addDays(d, 1);
    }

    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // --- Stats Calculation ---
    // 1. Dates Free (this month only)
    const freeDatesCount = days.reduce((acc, day) => {
        if (!isSameMonth(day, month)) return acc; // specific to current month stats

        const key = format(day, "yyyy-MM-dd");
        const hasEvents = eventsByDay[key] && eventsByDay[key].length > 0;

        const dayIndex = getDay(day);
        const dayKey = dayKeys[dayIndex];
        const config = workSchedule?.[dayKey];

        if (!config?.enabled) return acc;
        if (config.type === 'design' || config.type === 'personal') return acc;

        return acc + (hasEvents ? 0 : 1);
    }, 0);

    // 2. Remaining Balance (this month only)
    let totalRemainingBalance = 0;
    days.forEach(day => {
        if (!isSameMonth(day, month)) return;

        const key = format(day, "yyyy-MM-dd");
        const events = eventsByDay[key] || [];
        events.forEach(evt => {
            const price = Number(evt.price || 0);
            const deposit = Number(evt.depositAmount || 0);
            totalRemainingBalance += (price - deposit);
        });
    });

    const monthsInAdvance = 0;

    // Helper to chunk days into weeks for grid rendering
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }

    return (
        <div className="absolute top-0 left-0 right-0 z-0 pt-11 px-0 pb-6 flex flex-col w-full h-[55vh]">
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
                                    const isCurrentMonth = isSameMonth(day, month);
                                    const dateKey = format(day, "yyyy-MM-dd");
                                    const dayEvents = eventsByDay[dateKey] || [];
                                    const hasEvents = dayEvents.length > 0;

                                    const dayOfWeekIndex = getDay(day);
                                    const config = workSchedule?.[dayKeys[dayOfWeekIndex]];
                                    const isDesign = config?.enabled && config?.type === 'design';

                                    // Get service color if event exists
                                    let bgClass = "bg-white/5";
                                    if (hasEvents) {
                                        const style = getEventStyle(dayEvents[0]);
                                        bgClass = style.className; // Contains bg-x and text-x
                                    }

                                    return (
                                        <div
                                            key={day.toISOString()}
                                            onClick={() => onDateTap?.(day)}
                                            className={cn(
                                                "aspect-square flex items-center justify-center text-[10px] font-medium transition-all relative cursor-pointer active:scale-95",
                                                hasEvents ? bgClass : "bg-white/5",
                                                !isCurrentMonth && "opacity-30", // Dim non-current month
                                                hasEvents ? "rounded-[1px]" : "rounded-none",
                                                !isCurrentMonth && !hasEvents && "text-muted-foreground/20",
                                                isCurrentMonth && !hasEvents && "text-muted-foreground/30"
                                            )}
                                        >
                                            <span>
                                                {isDesign ? "D" : format(day, "d")}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom: Stats (Underneath, Evenly Spaced) */}
                <div className="mt-2 px-6 grid grid-cols-3 gap-4 border-t border-white/5 pt-2">
                    {/* Dates Free */}
                    <div className="text-center">
                        <div className="text-xl font-medium text-foreground">{freeDatesCount}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Dates Free</div>
                        <div className="text-[9px] text-muted-foreground/60">(this month)</div>
                    </div>

                    {/* Remaining Balance */}
                    <div className="text-center">
                        <div className="text-xl font-medium text-green-400">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalRemainingBalance)}
                        </div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Remaining Bal</div>
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
