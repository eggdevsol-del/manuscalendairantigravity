import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";

export const getEventStyle = (appointment: any) => {
    // Use serviceName for stable coloring if available, otherwise title or id
    const key = appointment.serviceName || appointment.title || appointment.id || "";
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
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
