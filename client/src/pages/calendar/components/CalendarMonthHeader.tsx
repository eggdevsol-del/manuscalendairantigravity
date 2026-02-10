import { format } from "date-fns";
import { Menu, ChevronDown, Bell } from "lucide-react";
import { Button, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { useAuth } from "@/_core/hooks/useAuth";

interface CalendarMonthHeaderProps {
    activeDate: Date;
}

export function CalendarMonthHeader({ activeDate }: CalendarMonthHeaderProps) {
    const { user } = useAuth();

    return (
        <header className="flex items-center justify-between px-4 py-3 z-20 sticky top-0 border-b border-border/10">
            {/* Left: Hamburger */}
            <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="w-6 h-6" />
            </Button>

            {/* Center: Month/Year */}
            <div className="flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity">
                <h1 className="text-lg font-bold">
                    {format(activeDate, "MMMM yyyy")}
                </h1>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Right: Bell + Avatar */}
            <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="w-6 h-6" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-background" />
                </Button>
                <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.imageUrl} />
                    <AvatarFallback>{user?.firstName?.[0] || "U"}</AvatarFallback>
                </Avatar>
            </div>
        </header>
    );
}
