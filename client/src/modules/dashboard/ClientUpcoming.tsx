import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
} from "@/components/ui";
import { Calendar, Clock, MapPin, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface ClientUpcomingProps {
  appointment: any;
}

export function ClientUpcoming({ appointment }: ClientUpcomingProps) {
  const [, setLocation] = useLocation();

  if (!appointment) return null;

  const startTime = new Date(appointment.startTime);
  const artist = appointment.artist;

  const needsBalancePayment = appointment.remainingBalanceCents > 0 && appointment.paymentStatus !== "fully_paid";

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Your Next Session</h2>
      <Card className="border-none bg-gradient-to-r from-primary/10 to-accent/10 overflow-hidden relative">
        <div className="absolute right-0 top-0 p-3 opacity-10">
          <Calendar className="w-24 h-24" />
        </div>
        <CardContent className="p-5 relative z-10">
          <div className="flex gap-4 items-center mb-4">
            <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
              <AvatarImage src={artist?.avatar} />
              <AvatarFallback>{artist?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                With
              </p>
              <h3 className="font-bold text-xl leading-none">{artist?.name}</h3>
              <p className="text-sm text-primary mt-1 font-medium">
                {appointment.title}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-background/50 rounded-lg p-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">
                {format(startTime, "MMM d")}
              </span>
            </div>
            <div className="bg-background/50 rounded-lg p-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">
                {format(startTime, "h:mm a")}
              </span>
            </div>
          </div>

          <div className="flex gap-2 w-full mt-2">
            <Button className="flex-1 shadow-lg" variant={needsBalancePayment ? "outline" : "default"}>View Details</Button>
            {needsBalancePayment && (
              <Button 
                onClick={() => setLocation(`/balance/${appointment.id}`)}
                className="flex-1 shadow-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold tracking-wide"
              >
                <DollarSign className="w-4 h-4 mr-1.5" />
                Pay Balance
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
