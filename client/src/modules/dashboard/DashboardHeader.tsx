import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface DashboardHeaderProps {
  name?: string;
  subtitle?: string;
}

export function DashboardHeader({ name, subtitle }: DashboardHeaderProps) {
  const timeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex flex-col gap-1 mb-6">
      <h1 className="text-2xl font-bold tracking-tight">
        {timeOfDay()}, {name?.split(" ")[0]}
      </h1>
      <p className="text-muted-foreground text-sm">
        {subtitle || format(new Date(), "EEEE, d MMMM")}
      </p>
    </div>
  );
}
