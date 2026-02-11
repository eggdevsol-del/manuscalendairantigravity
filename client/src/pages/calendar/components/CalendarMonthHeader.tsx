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
        <header className="flex items-center justify-between px-4 py-3 z-20 sticky top-0 border-b border-white/5 bg-background/80 backdrop-blur-md">
            {/* Left: Today Button */}
            <div className="flex items-center">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-semibold text-primary hover:bg-primary/10 h-8 px-3"
                    onClick={() => onDateChange(new Date())}
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
                    onClick={() => onDateChange(startOfMonth(subMonths(activeDate, 1)))}
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity min-w-[140px] justify-center">
                    <h1 className="text-lg font-bold whitespace-nowrap">
                        {format(activeDate, "MMMM yyyy")}
                    </h1>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5"
                    onClick={() => onDateChange(startOfMonth(addMonths(activeDate, 1)))}
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            {/* Right: B Button */}
            <div>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "w-10 h-10 rounded-full font-bold text-lg transition-all",
                        isBreakdownOpen ? "bg-primary text-primary-foreground" : "bg-accent/20 text-foreground"
                    )}
                    onClick={onToggleBreakdown}
                >
                    M
                </Button>
            </div>
        </header>
    );
}
