import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import {
  Plus
} from "lucide-react";
import { LoadingState, PageShell, PageHeader, SegmentedHeader } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { useConversations } from "@/hooks/useConversations";

import { useEffect, useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatLocalTime, getBusinessTimezone } from "../../../shared/utils/timezone";

type ViewMode = "month" | "week" | "day";

export default function Calendar() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showAppointmentDetailDialog, setShowAppointmentDetailDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
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

  const gridStart = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    return start;
  }, [currentDate]);

  const gridEnd = useMemo(() => {
    const end = new Date(gridStart);
    end.setDate(gridStart.getDate() + 42);
    return end;
  }, [gridStart]);

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

  // Scroll to 9 AM on mount
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = 540; // 9 AM * 60px
    }
  }, []);

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

  const handleDateClick = (date: Date) => {
    if (user?.role === "artist" || user?.role === "admin") {
      setSelectedDate(date);
      const dateStr = date.toISOString().split("T")[0];
      setAppointmentForm({
        ...appointmentForm,
        startTime: `${dateStr}T09:00`,
        endTime: `${dateStr}T10:00`,
      });
      setStep('service');
      setSelectedService(null);
      setShowAppointmentDialog(true);
    }
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

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  };

  // Scroll Sync Logic for Date Strip
  const dateStripRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  const handleDateStripScroll = () => {
    if (!dateStripRef.current || isProgrammaticScroll.current) return;

    const container = dateStripRef.current;
    const center = container.scrollLeft + container.clientWidth / 2;

    // Find the element closest to the center
    const dayButtons = Array.from(container.children) as HTMLElement[];
    let closest: HTMLElement | null = null;
    let minDiff = Infinity;

    dayButtons.forEach(btn => {
      const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
      const diff = Math.abs(center - btnCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closest = btn;
      }
    });

    if (closest) {
      const dateStr = closest.getAttribute('data-date');
      if (dateStr) {
        const newDate = new Date(dateStr);
        // Only update if different to avoid jitter
        if (newDate.getDate() !== selectedDate?.getDate()) {
          setSelectedDate(newDate);
        }
      }
    }
  };

  // Improved Color Mapping for Pastel Look
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
      style: {}
    };
  };

  const getCurrentTimePosition = () => {
    const tz = getBusinessTimezone();
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes / 1440) * 100; // Percentage of day
  };

  const formatTime = (utcISO: string) => {
    const tz = getBusinessTimezone();
    return formatLocalTime(utcISO, tz, 'h:mm a');
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

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  };

  // Scroll active date into view on mount or change (if not scrolling manually)
  useEffect(() => {
    if (selectedDate && dateStripRef.current && !isProgrammaticScroll.current) {
      // Simple logic: find button with data-date matching selectedDate
      const children = dateStripRef.current.children;
      if (!children) return;

      const btn = Array.from(children).find((c) =>
        (c as HTMLElement).getAttribute('data-date') === selectedDate.toISOString()
      ) as HTMLElement;

      if (btn) {
        isProgrammaticScroll.current = true;
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        setTimeout(() => { isProgrammaticScroll.current = false; }, 500);
      }
    }
  }, [selectedDate]);

  if (loading || isLoading) return <LoadingState message="Loading calendar..." fullScreen />;

  const isArtist = user?.role === "artist" || user?.role === "admin";
  const todayApps = selectedDate ? getAppointmentsForDate(selectedDate) : [];
  const currentTimePos = getCurrentTimePosition();

  return (
    <PageShell>
      <PageHeader title="Calendar" />

      {/* Main Container - Transparent Background */}
      <div className="flex-1 flex flex-col pt-0 pb-24 overflow-hidden bg-transparent">

        {/* View Toggles (SSOT SegmentedHeader) */}
        <div className="px-6 py-4">
          <SegmentedHeader
            options={["Day", "Week", "Month"]}
            activeIndex={viewMode === 'week' ? 1 : viewMode === 'month' ? 2 : 0}
            onChange={(i) => setViewMode(i === 0 ? 'day' : i === 1 ? 'week' : 'month' as any)}
          />
        </div>

        {/* 1. Date Strip */}
        <div className="shrink-0 w-full bg-background/50 backdrop-blur-sm border-b border-border/5 shadow-sm z-10">
          <div
            ref={dateStripRef}
            className={tokens.calendar.dateStrip.container}
            onScroll={handleDateStripScroll}
          >
            {getWeekDays().map((day) => {
              const active = isSelected(day);
              const isTwoday = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  data-date={day.toISOString()}
                  onClick={() => {
                    isProgrammaticScroll.current = true;
                    setSelectedDate(day);
                    setTimeout(() => { isProgrammaticScroll.current = false; }, 500);
                  }}
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

          {/* Context Info Line */}
          {selectedDate && (
            <div className="px-6 py-3 flex items-center justify-between text-sm border-t border-border/5 bg-background/30">
              <span className="font-semibold text-foreground">
                {selectedDate.toLocaleDateString("en-US", { weekday: 'long', day: 'numeric', month: 'long' })}
                {isToday(selectedDate) && " (Today)"}
              </span>
              <span className="text-blue-500 font-medium">
                {todayApps.length} Events Await
              </span>
            </div>
          )}
        </div>

        {/* 2. Scrollable Time Grid */}
        <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-transparent" ref={timelineRef}>
          {/* "Current Time" SSOT Indicator */}
          <div
            className="absolute left-0 right-0 border-t-2 border-blue-500 z-20 pointer-events-none flex items-center"
            style={{ top: `${currentTimePos}%` }}
          >
            <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
          </div>

          <div className="relative min-h-[1440px] px-4 py-4">
            {Array.from({ length: 24 }, (_, hour) => {
              // Filter appointments for this hour slot
              const hourAppointments = todayApps.filter((apt: any) => {
                const h = new Date(apt.startTime).getHours();
                return h === hour;
              });

              return (
                <div key={hour} className="flex h-[120px] group relative">
                  {/* Time Label */}
                  <div className="w-14 shrink-0 text-xs font-medium text-muted-foreground/50 text-right pr-4 pt-0">
                    {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                  </div>

                  {/* Row Content */}
                  <div className="flex-1 border-t border-dashed border-border/30 h-full relative">
                    {hourAppointments.map((apt: any, idx) => {
                      const styles = getEventStyle(apt);
                      const start = new Date(apt.startTime);
                      const end = new Date(apt.endTime);
                      const startMin = start.getMinutes();
                      const duration = (end.getTime() - start.getTime()) / 60000;

                      return (
                        <div
                          key={apt.id}
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setShowAppointmentDetailDialog(true);
                          }}
                          className={cn(
                            "absolute inset-x-0 rounded-2xl p-3 cursor-pointer transition-all hover:brightness-95 shadow-sm flex flex-col justify-center",
                            styles.className
                          )}
                          style={{
                            top: `${(startMin / 60) * 100}%`,
                            height: Math.max(60, (duration / 60) * 120 - 4) + 'px', // Scale: 120px height = 60min. -4px for gap
                            zIndex: 10 + idx
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-sm leading-tight truncate">
                              {apt.title}
                            </h3>
                            {/* Simulated Avatar Group */}
                            <div className="flex -space-x-2 shrink-0">
                              <div className="w-6 h-6 rounded-full bg-black/20 text-[8px] flex items-center justify-center text-white">
                                {apt.clientName?.charAt(0)}
                              </div>
                            </div>
                          </div>
                          <p className="text-[10px] font-medium opacity-80 mt-1">
                            {formatTime(apt.startTime)} - {formatTime(apt.endTime)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Action Button (FAB) */}
        {isArtist && (
          <div className="absolute bottom-24 right-6 z-50">
            <Button
              size="icon"
              className="w-14 h-14 rounded-full bg-black text-white shadow-2xl hover:bg-black/90 hover:scale-105 transition-all"
              onClick={() => handleDateClick(selectedDate || new Date())}
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
        )}

      </div>

      {/* Dialogs reused from previous version */}
      <Dialog open={showAppointmentDialog} onOpenChange={(open) => {
        setShowAppointmentDialog(open);
        if (!open) setTimeout(resetForm, 300);
      }}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>{step === 'service' ? 'Select Service' : 'Details'}</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            {/* Reused form content */}
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
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
