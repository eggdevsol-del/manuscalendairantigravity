import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface CalendarMonthHeaderProps {
    activeDate: Date;
    onToggleBreakdown: () => void;
    isBreakdownOpen: boolean;
    onDateChange: (date: Date) => void;
}

export function CalendarMonthHeader({ activeDate, onToggleBreakdown, isBreakdownOpen, onDateChange }: CalendarMonthHeaderProps) {
    return (
        <header className="flex items-center justify-between px-4 py-3 z-20 sticky top-0 bg-transparent">
            {/* Left: Today Button */}
            <div className="flex items-center">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-semibold text-primary hover:bg-primary/10 h-8 px-3"
                    onClick={() => {
                        onDateChange(new Date());
                    }}
                >
                    Today
                </Button>
            </div>

            {/* Center: Navigation & Month/Year */}
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5"
                    onClick={() => {
                        onDateChange(startOfMonth(subMonths(activeDate, 1)));
                    }}
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="flex items-center gap-1 min-w-[140px] justify-center">
                    <h1 className="text-lg font-bold whitespace-nowrap">
                        {format(activeDate, "MMMM yyyy")}
                    </h1>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5"
                    onClick={() => {
                        onDateChange(startOfMonth(addMonths(activeDate, 1)));
                    }}
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            {/* Right: Spacer to balance the Left Today button (hidden on desktop if needed, or just empty) */}
            <div className="w-16" />
        </header>
    );
}
