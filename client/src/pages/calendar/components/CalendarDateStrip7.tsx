import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CalendarDateStrip7Props {
    stripDates: Date[];
    activeDate: Date;
    onDateTap: (date: Date) => void;
}

export function CalendarDateStrip7({ stripDates, activeDate, onDateTap }: CalendarDateStrip7Props) {
    return (
        <div className="flex justify-between items-center px-4 py-2 bg-background/95 backdrop-blur z-10 sticky top-[60px]">
            {stripDates.map((date) => {
                const isActive = isSameDay(date, activeDate);
                return (
                    <div
                        key={date.toISOString()}
                        onClick={() => onDateTap(date)}
                        className="flex flex-col items-center gap-1 cursor-pointer w-10"
                    >
                        <span className="text-xs font-medium text-muted-foreground uppercase">
                            {format(date, "EEEEE")}
                        </span>
                        <div
                            className={cn(
                                "w-10 h-10 flex items-center justify-center rounded-xl text-lg font-bold transition-all duration-200",
                                isActive ? "bg-black text-white scale-110 shadow-lg" : "text-foreground hover:bg-accent/50"
                            )}
                        >
                            {format(date, "d")}
                        </div>
                        {isActive && (
                            <motion.div layoutId="activeDot" className="w-1 h-1 bg-primary rounded-full mt-1" />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
