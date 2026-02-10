import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import {
  Plus, ChevronLeft, ChevronRight
} from "lucide-react";
import { LoadingState, PageShell, PageHeader, SegmentedHeader } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { useConversations } from "@/hooks/useConversations";

import { useEffect, useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatLocalTime, getBusinessTimezone } from "../../../shared/utils/timezone";

type ViewMode = "day" | "week" | "month";

export default function Calendar() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  // selectedDate is the SSOT for the current view focus
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showAppointmentDetailDialog, setShowAppointmentDetailDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // New State for Gold Standard Flow
  const [step, setStep] = useState<'service' | 'details'>('service');
  const [selectedService, setSelectedService] = useState<any>(null);

  const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
    enabled: !!user && (user.role === "artist" || user.role === "admin"),
  });

  const availableServices = useMemo(() => {
    if (!artistSettings?.services) return [];
    try {
      const parsed = JSON.parse(artistSettings.services);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to parse services", e);
      return [];
    }
  }, [artistSettings]);

  const [appointmentForm, setAppointmentForm] = useState({
    clientId: "",
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    status: "scheduled" as const,
  });

  // Fetch range logic: always fetch enough for the month view to be safe
  const gridStart = useMemo(() => {
    const d = new Date(selectedDate);
    // Start of month - 1 week buffer
    d.setDate(1);
    d.setDate(d.getDate() - 7);
    return d;
  }, [selectedDate]); // Simplified dependency to avoid over-fetching

  const gridEnd = useMemo(() => {
    const d = new Date(selectedDate);
    // End of month + 1 week buffer
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    d.setDate(d.getDate() + 14);
    return d;
  }, [selectedDate]);

  const { data: appointments, isLoading, refetch } = trpc.appointments.list.useQuery(
    { startDate: gridStart, endDate: gridEnd },
    { enabled: !!user }
  );

  const { data: conversations } = useConversations();
  const clients = conversations?.map((conv: any) => ({
    id: conv.clientId,
    name: conv.clientName,
    email: conv.otherUser?.email,
  })).filter((client: any, index: number, self: any[]) =>
    index === self.findIndex((c: any) => c.id === client.id)
  ) || [];

  const createAppointmentMutation = trpc.appointments.create.useMutation({
    onSuccess: () => {
      toast.success("Appointment created successfully");
      setShowAppointmentDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => toast.error("Failed to create appointment: " + error.message),
  });

  const updateAppointmentMutation = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Appointment updated successfully");
      setShowAppointmentDetailDialog(false);
      setSelectedAppointment(null);
      refetch();
    },
    onError: (error: any) => toast.error("Failed to update appointment: " + error.message),
  });

  const deleteAppointmentMutation = trpc.appointments.delete.useMutation({
    onSuccess: () => {
      toast.success("Appointment deleted successfully");
      setShowAppointmentDetailDialog(false);
      setSelectedAppointment(null);
      refetch();
    },
    onError: (error: any) => toast.error("Failed to delete appointment: " + error.message),
  });

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  // Scroll to 9 AM on mount (for Day/Week views)
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = 540; // 9 AM * 60px
    }
  }, [viewMode]); // Re-scroll when switching views

  const resetForm = () => {
    setAppointmentForm({
      clientId: "",
      title: "",
      description: "",
      startTime: "",
      endTime: "",
      status: "scheduled",
    });
  };

  const handleCreateAppointment = () => {
    if (!appointmentForm.clientId || !appointmentForm.title || !appointmentForm.startTime || !appointmentForm.endTime) {
      toast.error("Please fill in all required fields");
      return;
    }
    createAppointmentMutation.mutate({
      conversationId: 0,
      artistId: user!.id,
      clientId: appointmentForm.clientId,
      title: appointmentForm.title,
      description: appointmentForm.description,
      startTime: appointmentForm.startTime,
      endTime: appointmentForm.endTime,
      timeZone: getBusinessTimezone(),
    });
  };

  // --- Date Logic ---

  // Generate a dynamic date strip range centered on selectedDate
  const getDateStripDays = () => {
    const days = [];
    const center = new Date(selectedDate);
    // Render +/- 14 days
    for (let i = -14; i <= 14; i++) {
      const d = new Date(center);
      d.setDate(center.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  };

  const getAppointmentsForDate = (date: Date) => {
    if (!appointments) return [];
    return appointments.filter(apt => {
      const d = new Date(apt.startTime);
      return d.getDate() === date.getDate() &&
        d.getMonth() === date.getMonth() &&
        d.getFullYear() === date.getFullYear();
    });
  };

  // --- Date Strip Scroll Handling ---
  const dateStripRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  const handleDateStripScroll = () => {
    if (!dateStripRef.current || isProgrammaticScroll.current) return;

    // Idea: If scrolled near ends, we could shift selectedDate effectively "paging".
    // For now, simpler "snap to select" logic on stop?
    // User requested "populate as user scrolls". Truly infinite scroll requires state buffering.
    // Given complexity, we will rely on the static +/- 14 days buffer for now. 
    // If they click an edge date, the strip regenerates around it.
  };

  // Re-center strip when selectedDate changes
  useEffect(() => {
    if (dateStripRef.current && !isProgrammaticScroll.current) {
      // Find the element for selectedDate
      const children = Array.from(dateStripRef.current.children) as HTMLElement[];
      const target = children.find(c => c.getAttribute('data-date') === selectedDate.toISOString());
      if (target) {
        isProgrammaticScroll.current = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        setTimeout(() => isProgrammaticScroll.current = false, 500);
      }
    }
  }, [selectedDate]);


  // Improved Color Mapping
  const getEventStyle = (appointment: any) => {
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

  const getCurrentTimePosition = () => {
    const tz = getBusinessTimezone();
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes / 1440) * 100;
  };
  const currentTimePos = getCurrentTimePosition();

  // --- Views ---

  // Day View Component (Inline)
  const DayView = () => {
    const todayApps = getAppointmentsForDate(selectedDate);

    return (
      <div className="relative min-h-[1440px] px-4 py-4">
        {/* Current Time Indicator */}
        {isToday(selectedDate) && (
          <div
            className="absolute left-0 right-0 border-t-2 border-blue-500 z-20 pointer-events-none flex items-center"
            style={{ top: `${currentTimePos}%` }}
          >
            <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
          </div>
        )}

        {Array.from({ length: 24 }, (_, hour) => {
          const hourAppointments = todayApps.filter((apt: any) => new Date(apt.startTime).getHours() === hour);
          return (
            <div key={hour} className="flex h-[120px] group relative">
              {/* Time Label */}
              <div className="w-14 shrink-0 text-xs font-medium text-muted-foreground/50 text-right pr-4 pt-0">
                {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
              </div>
              {/* Row Content */}
              <div className="flex-1 border-t border-dashed border-border/30 h-full relative">
                {hourAppointments.map((apt: any, idx: number) => {
                  const styles = getEventStyle(apt);
                  const start = new Date(apt.startTime);
                  const end = new Date(apt.endTime);
                  const startMin = start.getMinutes();
                  const duration = (end.getTime() - start.getTime()) / 60000;
                  return (
                    <div
                      key={apt.id}
                      onClick={() => { setSelectedAppointment(apt); setShowAppointmentDetailDialog(true); }}
                      className={cn("absolute inset-x-0 rounded-2xl p-3 cursor-pointer transition-all hover:brightness-95 shadow-sm flex flex-col justify-center", styles.className)}
                      style={{
                        top: `${(startMin / 60) * 100}%`,
                        height: Math.max(60, (duration / 60) * 120 - 4) + 'px',
                        zIndex: 10 + idx
                      }}
                    >
                      <h3 className="font-bold text-sm leading-tight truncate">{apt.title}</h3>
                      <p className="text-[10px] font-medium opacity-80 mt-1">
                        {formatLocalTime(apt.startTime, getBusinessTimezone(), 'h:mm a')} - {formatLocalTime(apt.endTime, getBusinessTimezone(), 'h:mm a')}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          );
        })}
      </div>
    )
  };

  // Week View Component
  const WeekView = () => {
    // Determine start of week (Sunday)
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });

    return (
      <div className="flex min-w-[700px] min-h-[1440px] px-2">
        {/* Time Labels Column */}
        <div className="w-12 shrink-0 py-4 flex flex-col justify-between h-[1440px]">
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="text-[10px] text-muted-foreground h-[60px]">{i === 0 ? '12am' : i < 12 ? i + 'am' : i === 12 ? '12pm' : (i - 12) + 'pm'}</div>
          ))}
        </div>

        {/* Days Columns */}
        {weekDays.map(day => {
          const dayApps = getAppointmentsForDate(day);
          const isTdy = isToday(day);
          return (
            <div key={day.toISOString()} className={cn("flex-1 border-l border-border/10 relative", isTdy && "bg-blue-500/5")}>
              {/* Header for Day Name inside Column if needed, usually handled by date strip logic? The Date Strip tracks Selected Date. 
                           In Week view, showing headers is helpful. */}
              <div className="sticky top-0 z-10 text-center py-2 text-xs font-bold border-b border-border/10 bg-background/80 backdrop-blur">
                {day.toLocaleDateString('en-US', { weekday: 'short' })} {day.getDate()}
              </div>

              {/* 1440px height relative container for events */}
              <div className="relative h-[1440px]">
                {/* Current Time Line if Today */}
                {isTdy && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                    style={{ top: `${currentTimePos}%` }}
                  />
                )}

                {dayApps.map((apt: any) => {
                  const styles = getEventStyle(apt);
                  const start = new Date(apt.startTime);
                  const end = new Date(apt.endTime);
                  const startMin = start.getHours() * 60 + start.getMinutes();
                  const duration = (end.getTime() - start.getTime()) / 60000;

                  return (
                    <div
                      key={apt.id}
                      onClick={() => { setSelectedAppointment(apt); setShowAppointmentDetailDialog(true); }}
                      className={cn("absolute inset-x-0.5 rounded-md p-1 cursor-pointer hover:brightness-95 text-[10px] overflow-hidden", styles.className)}
                      style={{
                        top: `${(startMin / 1440) * 100}%`,
                        height: `${(duration / 1440) * 100}%`,
                      }}
                    >
                      <div className="font-bold truncate">{apt.title}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    );
  };

  // Month View Component
  const MonthView = () => {
    // Logic for Month Grid
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const startDay = startOfMonth.getDay(); // 0-6
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();

    // Generate grid cells (42 for 6 rows max)
    const cells = [];
    // Previous month padding
    for (let i = 0; i < startDay; i++) cells.push(null);
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i);
      cells.push(d);
    }
    // Next month padding to fill row
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className="h-full flex flex-col p-4">
        <div className="grid grid-cols-7 mb-2 text-center text-sm font-semibold text-muted-foreground">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 flex-1 auto-rows-fr gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="bg-transparent" />;
            const isTdy = isToday(date);
            const isSel = isSelected(date);
            const apps = getAppointmentsForDate(date);
            return (
              <div
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "flex flex-col items-center justify-start py-2 rounded-xl cursor-pointer hover:bg-white/5 transition-colors relative",
                  isSel && "bg-white/10 ring-1 ring-primary",
                  isTdy && "bg-primary/10"
                )}
              >
                <span className={cn("text-sm font-medium", isTdy && "text-primary font-bold", isSel && "text-white")}>
                  {date.getDate()}
                </span>
                {/* Event Dots */}
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
                  {apps.slice(0, 4).map((_, idx) => (
                    <div key={idx} className="w-1 h-1 rounded-full bg-primary" />
                  ))}
                  {apps.length > 4 && <div className="w-1 h-1 rounded-full bg-muted-foreground" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading || isLoading) return <LoadingState message="Loading calendar..." fullScreen />;

  const isArtist = user?.role === "artist" || user?.role === "admin";
  const todayApps = selectedDate ? getAppointmentsForDate(selectedDate) : [];

  return (
    <PageShell>
      <PageHeader title="Calendar" />

      {/* 2. Top Context Area (DASHBOARD HEIGHT MATCH) */}
      {/* Replicated from Dashboard.tsx lines 256-263 */}
      <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
        <p className="text-4xl font-light text-foreground/90 tracking-tight">
          {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
        </p>
        <p className="text-muted-foreground text-lg font-medium mt-1">
          {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Main Content Container - Matches Dashboard container placement */}
      {/* This pushes buttons and content down to the "70%" area efficiently */}
      <div className={cn(tokens.contentContainer.base, "relative flex flex-col overflow-hidden")}>
        {/* View Toggles (Top of Content) */}
        <div className="px-6 py-4 shrink-0">
          <SegmentedHeader
            options={["Day", "Week", "Month"]}
            activeIndex={viewMode === 'day' ? 0 : viewMode === 'week' ? 1 : 2}
            onChange={(i) => setViewMode(i === 0 ? 'day' : i === 1 ? 'week' : 'month' as any)}
          />
        </div>

        {/* Calendar Views */}
        <div className="flex-1 flex flex-col overflow-hidden relative">

          {/* Date Strip (Only visible in Day view, per standard design? Or keeping it for Week too?) 
                User request: "Date strip and context header should sit beneath the buttons"
                Usually Month view doesn't need a Date Strip. 
            */}
          {viewMode !== 'month' && (
            <div className="shrink-0 w-full bg-transparent z-10">
              <div
                ref={dateStripRef}
                className={tokens.calendar.dateStrip.container}
                onScroll={handleDateStripScroll}
              >
                {getDateStripDays().map((day) => {
                  const active = isSelected(day);
                  return (
                    <button
                      key={day.toISOString()}
                      data-date={day.toISOString()}
                      onClick={() => { setSelectedDate(day); }}
                      className={cn(
                        "flex flex-col items-center justify-center min-w-[60px] h-[84px] rounded-2xl transition-all duration-300 shrink-0 snap-center",
                        active ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105" : "bg-transparent text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5"
                      )}
                    >
                      <span className="text-xs font-semibold mb-1 uppercase tracking-wide opacity-80">
                        {day.toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span className={cn("text-xl font-bold", active ? "text-white" : "text-foreground")}>
                        {day.getDate()}
                      </span>
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full mt-2 transition-colors",
                        getAppointmentsForDate(day).length > 0
                          ? (active ? "bg-white" : "bg-primary")
                          : "bg-transparent"
                      )} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* View Switching */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar bg-transparent" ref={timelineRef}>
            {viewMode === 'day' && <DayView />}
            {viewMode === 'week' && <WeekView />}
            {viewMode === 'month' && <MonthView />}
          </div>
        </div>
      </div>

      {/* Floating Action Button (FAB) */}
      {isArtist && (
        <div className="absolute bottom-24 right-6 z-50">
          <Button
            size="icon"
            className="w-14 h-14 rounded-full bg-black text-white shadow-2xl hover:bg-black/90 hover:scale-105 transition-all"
            onClick={() => {
              setAppointmentForm(prev => ({ ...prev, startTime: `${selectedDate.toISOString().split('T')[0]}T09:00`, endTime: `${selectedDate.toISOString().split('T')[0]}T10:00` }));
              setStep('service');
              setShowAppointmentDialog(true);
            }}
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Dialogs ... (Keeping strictly same as before) */}
      <Dialog open={showAppointmentDialog} onOpenChange={(open) => {
        setShowAppointmentDialog(open);
        if (!open) setTimeout(resetForm, 300);
      }}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>{step === 'service' ? 'Select Service' : 'Details'}</DialogTitle>
          </DialogHeader>
          {availableServices.length > 0 && step === 'service' ? (
            <div className="grid gap-2">
              {availableServices.map((s: any) => (
                <div key={s.name} onClick={() => {
                  setSelectedService(s);
                  setStep('details');
                  setAppointmentForm(prev => ({ ...prev, title: s.name }));
                }} className="p-4 border rounded-xl cursor-pointer hover:bg-accent">
                  <div className="font-bold">{s.name}</div>
                  <div className="text-sm text-muted-foreground">{s.duration} mins</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <Label>Client</Label>
              <Select onValueChange={(v) => setAppointmentForm(p => ({ ...p, clientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select Client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Title" value={appointmentForm.title} onChange={e => setAppointmentForm(p => ({ ...p, title: e.target.value }))} />
              <Button onClick={handleCreateAppointment} className="w-full">Create</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
