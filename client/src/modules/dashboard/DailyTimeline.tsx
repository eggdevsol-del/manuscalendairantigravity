import { format } from "date-fns";

interface DailyTimelineProps {
  appointments: any[];
}

export function DailyTimeline({ appointments }: DailyTimelineProps) {
  if (!appointments || appointments.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Today's Schedule</h2>
      <div className="space-y-3">
        {appointments.map(appt => (
          <div key={appt.id} className="flex gap-4">
            <div className="w-16 flex flex-col items-center pt-1">
              <span className="text-sm font-bold text-foreground">
                {format(new Date(appt.startTime), "h:mm")}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(appt.startTime), "a")}
              </span>
            </div>
            <div className="flex-1 p-3 rounded-2xl bg-card border border-border/50 relative">
              <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full" />
              <div className="pl-3">
                <p className="font-semibold text-sm">
                  {appt.client?.name || "Client"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {appt.serviceName || appt.title}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
