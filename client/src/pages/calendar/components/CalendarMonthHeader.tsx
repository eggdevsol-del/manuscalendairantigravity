import { format } from "date-fns";
import { Menu, ChevronDown, Bell } from "lucide-react";
import { Button, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";

export interface CalendarMonthHeaderProps {
    activeDate: Date;
    onToggleBreakdown: () => void;
    isBreakdownOpen: boolean;
}

export function CalendarMonthHeader({ activeDate, onToggleBreakdown, isBreakdownOpen }: CalendarMonthHeaderProps) {
    const { user } = useAuth();

    return (
        <header className="flex items-center justify-between px-4 py-3 z-20 sticky top-0 border-b border-white/5 bg-background/80 backdrop-blur-md">
            {/* Left: Month/Year (Moved from center to left as per standard iOS headers when menu is gone, or keep center?) 
               User didn't specify position, but removing menu leaves left empty. 
               Let's keep it simple. Title on left or center? 
               Current: Menu (Left), Title (Center), Bell/Avatar (Right).
               If we remove Menu, Title is Center.
               Let's keep Title Center for balance, or move to Left.
               User said "remove the notification button ... remove the burger menu".
               Reference image (if any) might help? No ref image for this specific layout.
               I'll keep Title Center and put just "B" on Right.
            */}

            {/* Spacer for centering if needed, or just justify-between with empty left div */}
            <div className="w-10" />

            {/* Center: Month/Year */}
            <div className="flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity">
                <h1 className="text-lg font-bold">
                    {format(activeDate, "MMMM yyyy")}
                </h1>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Right: B Button */}
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "w-10 h-10 rounded-full font-bold text-lg transition-all",
                    isBreakdownOpen ? "bg-primary text-primary-foreground" : "bg-accent/20 text-foreground"
                )}
                onClick={onToggleBreakdown}
            >
                B
            </Button>
        </header>
    );
}
