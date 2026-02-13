
import { Avatar, AvatarFallback, AvatarImage, Button, Card, CardContent } from "@/components/ui";
import { Clock, MapPin, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import { getAssetUrl } from "@/lib/assets";

interface NextAppointmentCardProps {
    appointment: any; // Using any for simplicity in wiring, ideally typed from TRPC router output
}

export function NextAppointmentCard({ appointment }: NextAppointmentCardProps) {
    if (!appointment) {
        return (
            <Card className="mb-6 bg-secondary/20 border-none">
                <CardContent className="p-6 text-center text-muted-foreground">
                    <p>No upcoming appointments</p>
                    <Button variant="link" className="mt-2 text-primary">View Calendar</Button>
                </CardContent>
            </Card>
        );
    }

    const startTime = new Date(appointment.startTime);
    const endTime = new Date(appointment.endTime);
    const client = appointment.client;

    return (
        <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Up Next</h2>
            <Card className={cn(tokens.card.base, tokens.card.bg, tokens.card.interactive, "p-0 overflow-hidden")}>
                {/* Left Accent - Teal/Primary for Next Appointment */}
                <div className={cn(tokens.card.leftAccent, "bg-primary")} />

                <CardContent className="p-0 pl-2"> {/* Add pl-2 to account for the border if not absolute overlap, but it is absolute. So maybe standard padding. */}
                    <div className="p-5 pl-7"> {/* pl-7 to clear the w-2 (0.5rem) border + spacing */}
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-3 items-center">
                                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                    <AvatarImage src={getAssetUrl(client?.avatar)} />
                                    <AvatarFallback>{client?.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-bold text-lg leading-tight">{client?.name}</h3>
                                    <p className="text-sm text-muted-foreground">{appointment.title}</p>
                                </div>
                            </div>
                            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                                {format(startTime, "h:mm a")}
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4 text-primary" />
                                <span>{format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}</span>
                            </div>
                            {/* Placeholder for location if we had it */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-4 h-4 text-primary" />
                                <span>Studio A</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-secondary/30 p-3 flex gap-2">
                        <Link href={`/chat/${client.id}`} className="flex-1">
                            <Button variant="secondary" className="w-full gap-2 h-10 shadow-sm bg-background/80 hover:bg-background">
                                <MessageCircle className="w-4 h-4" />
                                Message
                            </Button>
                        </Link>
                        <Button className="flex-1 gap-2 h-10 shadow-sm">
                            Check In
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
