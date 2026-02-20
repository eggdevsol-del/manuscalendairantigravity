import { format, isToday, getDay } from "date-fns";
import { Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import { formatLocalTime, getBusinessTimezone } from "../../../../../shared/utils/timezone";
import { getEventStyle } from "../utils/styles";

interface AgendaDayListProps {
    virtualizer: any;
    agendaDates: Date[];
    eventsByDay: Record<string, any[]>;
    parentRef: React.RefObject<HTMLDivElement | null>;
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    workSchedule?: any;
    onAppointmentTap?: (apt: any) => void;
    onDateTap?: (date: Date) => void;
}

const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function AgendaDayList({ virtualizer, agendaDates, eventsByDay, parentRef, onScroll, workSchedule, onAppointmentTap, onDateTap }: AgendaDayListProps) {
    return (
        <div
            ref={parentRef}
            onScroll={onScroll}
            className="flex-1 overflow-y-auto w-full h-full relative pb-40"
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem: any) => {
                    const date = agendaDates[virtualItem.index];
                    if (!date) return null;

                    const dateKey = format(date, "yyyy-MM-dd");
                    const dayEvents = eventsByDay[dateKey] || [];
                    const isTdy = isToday(date);

                    const dayIndex = getDay(date);
                    const dayKey = dayKeys[dayIndex];
                    const config = workSchedule?.[dayKey];
                    const isDesign = config?.enabled && config?.type === 'design';

                    return (
                        <div
                            key={virtualItem.key}
                            data-index={virtualItem.index}
                            ref={virtualizer.measureElement}
                            className="absolute top-0 left-0 w-full px-4 py-4"
                            style={{
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                        >
                            {/* Day Header */}
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <h2 className={cn("text-lg font-bold", isTdy ? "text-primary" : "text-foreground")}>
                                        {format(date, "EEEE")}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">{format(date, "d MMMM")}</p>
                                </div>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full bg-accent/20 hover:bg-accent/40 text-muted-foreground"
                                    onClick={() => onDateTap?.(date)}
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Events List */}
                            <div className="flex flex-col gap-2">
                                {isDesign && (
                                    <div className="py-2 px-3 bg-purple-500/10 border border-purple-500/20 rounded-md">
                                        <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Design Day</span>
                                    </div>
                                )}

                                {dayEvents.length > 0 ? (
                                    dayEvents.map((apt: any) => {
                                        const style = getEventStyle(apt);
                                        return (
                                            <div
                                                key={apt.id}
                                                onClick={() => onAppointmentTap?.(apt)}
                                                className={cn(
                                                    tokens.calendar.eventCard.base,
                                                    tokens.calendar.eventCard.bg,
                                                    tokens.calendar.eventCard.interactive,
                                                    tokens.calendar.eventCard.padding,
                                                    "shadow-sm flex flex-col gap-1 cursor-pointer active:scale-[0.98] transition-transform",
                                                    style.className
                                                )}
                                            >


                                                <div className="font-bold text-sm z-10 relative">{apt.title}</div>
                                                <div className="text-xs opacity-70 flex justify-between z-10 relative">
                                                    <span>{formatLocalTime(apt.startTime, getBusinessTimezone(), 'h:mm a')} - {formatLocalTime(apt.endTime, getBusinessTimezone(), 'h:mm a')}</span>
                                                    <span>{apt.clientName || ""}</span>
                                                </div>

                                                {/* Status Overlay */}
                                                {apt.status === 'completed' ? (
                                                    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 bg-zinc-500/20 text-zinc-400 rounded-full border border-zinc-500/50 z-20">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        <span className="text-[9px] font-bold uppercase tracking-widest">Completed</span>
                                                    </div>
                                                ) : ((apt.clientArrived === 1 || apt.clientArrived === true) && (
                                                    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)] z-20">
                                                        <span className="relative flex h-1.5 w-1.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                                        </span>
                                                        <span className="text-[9px] font-bold uppercase tracking-widest text-shadow-sm">In Progress</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    })
                                ) : (
                                    !isDesign && (
                                        <div
                                            className="py-6 text-center text-sm text-muted-foreground/30 italic cursor-pointer hover:bg-white/[0.02] rounded-md transition-colors"
                                            onClick={() => onDateTap?.(date)}
                                        >
                                            Touch to add appointment
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
