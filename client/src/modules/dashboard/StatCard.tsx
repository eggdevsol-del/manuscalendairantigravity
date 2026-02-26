import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-none shadow-sm bg-card/50",
        className
      )}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-foreground">{value}</h3>
            {trend && (
              <span
                className={cn(
                  "text-xs font-medium",
                  trendUp ? "text-green-500" : "text-red-500"
                )}
              >
                {trend}
              </span>
            )}
          </div>
        </div>
        {Icon && (
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
