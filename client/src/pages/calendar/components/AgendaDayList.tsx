import { format, isToday } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens"; // Assuming tokens still valid
import { formatLocalTime, getBusinessTimezone } from "../../../../../shared/utils/timezone"; // Fix path if needed
import { getEventStyle } from "../utils/styles"; // Import style util

interface AgendaDayListProps {
    virtualizer: any;
    agendaDates: Date[];
    eventsByDay: Record<string, any[]>;
    parentRef: React.RefObject<HTMLDivElement | null>;
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export function AgendaDayList({ virtualizer, agendaDates, eventsByDay, parentRef, onScroll }: AgendaDayListProps) {
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
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-accent/20 hover:bg-accent/40 text-muted-foreground">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Events List */}
                            <div className="flex flex-col gap-2">
                                {dayEvents.length > 0 ? (
                                    dayEvents.map((apt: any) => {
                                        // Apply legacy style logic or new one?
                                        // "soft tinted background, left colored vertical bar, title bold, subtitle and time"
                                        // This matches getEventStyle utility we saved
                                        const style = getEventStyle(apt);
                                        // We need to parse color from style.className if meaningful, or use utility classes.
                                        // The utility returns className with bg, text, border.

                                        return (
                                            <div
                                                key={apt.id}
                                                className={cn(
                                                    "p-3 rounded-[4px] flex flex-col gap-1 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-sm border",
                                                    style.className
                                                )}
                                            >
                                                <div className="font-bold text-sm">{apt.title}</div>
                                                <div className="text-xs opacity-70 flex justify-between">
                                                    <span>{formatLocalTime(apt.startTime, getBusinessTimezone(), 'h:mm a')} - {formatLocalTime(apt.endTime, getBusinessTimezone(), 'h:mm a')}</span>
                                                    {/* Client name if available */}
                                                    <span>{apt.clientName || ""}</span>
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="py-4 text-center text-sm text-muted-foreground/30 italic">
                                        Nothing planned
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div >
    );
}
