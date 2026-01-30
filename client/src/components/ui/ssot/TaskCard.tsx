import { Card } from "../card";
/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * TaskCard is the canonical card component for Dashboard tasks.
 * This file is part of the core UI primitives. Changes to gradients, blur, 
 * radius, or core styling MUST happen here. 
 * DO NOT OVERRIDE STYLES IN PAGE COMPONENTS.
 * 
 * Card Dimensions (SSOT):
 * - Border radius: rounded-2xl (1rem / 16px)
 * - Padding: p-4 (1rem / 16px)
 * - Background: bg-white/5 with hover:bg-white/10
 * - Border: border-0 (no border)
 */
import { cn } from "@/lib/utils";
import { Check, ChevronRight } from "lucide-react";

export interface TaskCardProps {
    title: string;
    context?: string;
    priority: 'high' | 'medium' | 'low';
    status: 'pending' | 'completed' | 'snoozed' | 'dismissed';
    actionType: 'none' | 'email' | 'sms' | 'social' | 'internal';
    onClick?: () => void;
}

export function TaskCard({ title, context, priority, status, actionType, onClick }: TaskCardProps) {
    // SSOT Rules:
    // - Left-edge glow for priority (not full-card tint)
    // - Red = urgent, Orange = time-sensitive, Green = maintenance
    // - Neutral translucent background

    const priorityConfig = {
        high: { color: "bg-red-600", gradient: "from-red-600/20" },
        medium: { color: "bg-orange-500", gradient: "from-orange-500/20" },
        low: { color: "bg-emerald-500", gradient: "from-emerald-500/20" }
    }[priority];

    return (
        <Card
            onClick={onClick}
            className={cn(
                "group p-4 relative overflow-hidden transition-all duration-300",
                "border-0 active:scale-[0.98] rounded-2xl cursor-pointer",
                "bg-white/5 hover:bg-white/10" // Neutral translucent
            )}
        >
            {/* Priority Indicator: Left Edge Line */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", priorityConfig.color)} />

            {/* Priority Indicator: Soft Gradient Swath (20%) */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-[20%] bg-gradient-to-r to-transparent pointer-events-none", priorityConfig.gradient)} />
            <div className="flex items-center gap-4 z-10 relative">
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground text-lg leading-tight mb-1 group-hover:text-white transition-colors duration-300">
                        {title}
                    </h3>
                    {context && (
                        <p className="text-sm text-muted-foreground leading-relaxed group-hover:text-muted-foreground/80 transition-colors duration-300">
                            {context}
                        </p>
                    )}
                </div>

                {/* Right Chevron / Check */}
                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-muted-foreground group-hover:border-white/30 group-hover:text-foreground transition-colors">
                    {status === 'completed' ? <Check className="w-4 h-4 text-green-500" /> : <ChevronRight className="w-4 h-4" />}
                </div>
            </div>
        </Card>
    );
}
