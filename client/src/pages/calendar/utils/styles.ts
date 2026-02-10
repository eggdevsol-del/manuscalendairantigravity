import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";

export const getEventStyle = (appointment: any) => {
    const hash = (appointment.title?.length || 0) + (appointment.id?.length || 0);
    const palettes = [
        tokens.calendar.event.orange,
        tokens.calendar.event.purple,
        tokens.calendar.event.green,
        tokens.calendar.event.pink,
        tokens.calendar.event.blue
    ];
    const palette = palettes[hash % palettes.length] || tokens.calendar.event.default;
    return {
        className: cn(palette.bg, palette.text, "border-l-4", palette.border),
    };
};
