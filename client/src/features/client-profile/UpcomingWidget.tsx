/**
 * UpcomingWidget.tsx
 * Compact home-page widget showing the next 1-2 upcoming appointments.
 */
import { format } from "date-fns";
import { Calendar, DollarSign, Clock } from "lucide-react";
import { Button } from "@/components/ui";
import { useLocation } from "wouter";

interface UpcomingWidgetProps {
  upcoming: any[];
}

export function UpcomingWidget({ upcoming }: UpcomingWidgetProps) {
  const [, setLocation] = useLocation();

  // Show max 2 upcoming appointments
  const items = (upcoming || []).slice(0, 2);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-base">Upcoming</h3>
      </div>

      {items.map(item => {
        const date = new Date(item.date);
        const now = new Date();
        const daysAway = Math.ceil(
          (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        return (
          <div
            key={item.id}
            className="relative rounded-2xl bg-card border border-border p-4 overflow-hidden"
          >
            {daysAway <= 5 && daysAway > 0 && (
              <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-bl-xl">
                In {daysAway} day{daysAway !== 1 ? "s" : ""}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-xs text-primary font-bold uppercase tracking-wider">
                {format(date, "MMM d, yyyy • h:mm a")}
              </span>
              <h4 className="text-base font-bold text-foreground">
                {item.title}
              </h4>
              {item.serviceName && (
                <p className="text-sm text-muted-foreground">
                  {item.serviceName}
                </p>
              )}

              <div className="mt-2 flex items-center gap-4">
                {item.depositAmount > 0 && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Deposit
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      ${item.depositAmount}
                    </span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Estimate
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    ${item.price}
                  </span>
                </div>
              </div>

              {item.remainingBalanceCents > 0 &&
                item.paymentStatus !== "fully_paid" && (
                  <Button
                    onClick={() => setLocation(`/balance/${item.id}`)}
                    className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold tracking-wide"
                    size="sm"
                  >
                    <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                    Pay Balance ($
                    {(item.remainingBalanceCents / 100).toFixed(2)})
                  </Button>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
