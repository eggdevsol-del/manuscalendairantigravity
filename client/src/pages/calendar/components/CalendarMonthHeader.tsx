import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";

export interface CalendarMonthHeaderProps {
  activeDate: Date;
  onToggleBreakdown: () => void;
  isBreakdownOpen: boolean;
  onDateChange: (date: Date) => void;
}

export function CalendarMonthHeader({
  activeDate,
  onToggleBreakdown,
  isBreakdownOpen,
  onDateChange,
}: CalendarMonthHeaderProps) {

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
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
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
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          onClick={() => {
            onDateChange(startOfMonth(addMonths(activeDate, 1)));
          }}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Right: View toggle — mirrors Today button dimensions */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs font-semibold text-primary hover:bg-primary/10 h-8 px-3"
          onClick={onToggleBreakdown}
        >
          {isBreakdownOpen ? "Week" : "Month"}
        </Button>
      </div>
    </header>
  );
}
