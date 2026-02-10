import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import {
  Plus, ChevronLeft, ChevronRight, Calculator
} from "lucide-react";
import { LoadingState, PageShell, PageHeader, SegmentedHeader } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { useConversations } from "@/hooks/useConversations";

import { useEffect, useState, useMemo, useRef, useCallback, useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatLocalTime, getBusinessTimezone } from "../../../shared/utils/timezone";

type ViewMode = "day" | "week" | "month";

// --- Date Logic Helpers ---

// Generate a larger buffer for smoother scrolling feel
const BUFFER_DAYS = 90; // +/- 90 days for stable scroll
const ITEM_HEIGHT = 112; // 28 * 4 = 112px (h-28)

const getBufferDays = (centerDate: Date) => {
  const days = [];
  for (let i = -BUFFER_DAYS; i <= BUFFER_DAYS; i++) {
    const d = new Date(centerDate);
    d.setDate(centerDate.getDate() + i);
    days.push(d);
  }
  return days;
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();
};

const isToday = (date: Date) => isSameDay(date, new Date());

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


export default function Calendar() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  // selectedDate: The date currently highlighted/focused
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // anchorDate: The center point of our rendered list. Only changes when we scroll far.
  // Initialized to selectedDate, but drifts as we scroll.
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());

  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showAppointmentDetailDialog, setShowAppointmentDetailDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

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

  // Fetch range logic using Anchor Date to keep data available
  const gridStart = useMemo(() => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - BUFFER_DAYS - 7);
    return d;
  }, [anchorDate]);

  const gridEnd = useMemo(() => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + BUFFER_DAYS + 7);
    return d;
  }, [anchorDate]);

  const { data: appointments, isLoading, refetch } = trpc.appointments.list.useQuery(
    { startDate: gridStart, endDate: gridEnd },
    { enabled: !!user, placeholderData: (prev) => prev }
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

  const getAppointmentsForDate = useCallback((date: Date) => {
    if (!appointments) return [];
    return appointments.filter(apt => {
      const d = new Date(apt.startTime);
      return isSameDay(d, date);
    });
  }, [appointments]);


  // --- Sub-Components ---

  // 1. Horizontal Scrollable Date Strip (Day View) - Enhanced
  const ScrollableHorizontalDateStrip = () => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isUserScrolling = useRef(false);
    const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

    const dates = useMemo(() => getBufferDays(anchorDate), [anchorDate]);

    // PRESERVE SCROLL POSITION ON DATE REFRESH
    // When anchorDate changes, 'dates' regenerates. The content shifts.
    // We must immediately re-center the selectedDate to prevent a visual jump.
    useLayoutEffect(() => {
      if (scrollRef.current) {
        const index = dates.findIndex(d => isSameDay(d, selectedDate));
        if (index !== -1) {
          const container = scrollRef.current;
          const child = container.children[index] as HTMLElement;
          if (child) {
            // Instant jump (start of loop or data refresh)
            const newScrollLeft = child.offsetLeft + child.offsetWidth / 2 - container.clientWidth / 2;
            container.scrollLeft = newScrollLeft;
          }
        }
      }
    }, [dates]); // Only run when dates array changes identity (anchorDate change)

    // Auto-scroll to selectedDate when it changes (only if NOT user interaction)
    useEffect(() => {
      if (scrollRef.current && !isUserScrolling.current) {
        const index = dates.findIndex(d => isSameDay(d, selectedDate));
        if (index !== -1) {
          const el = scrollRef.current.children[index] as HTMLElement;
          // Standard scrollIntoView
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }, [selectedDate]); // Removed dates dependency to avoid double-scroll logic

    const handleScroll = () => {
      if (!scrollRef.current) return;
      isUserScrolling.current = true;

      // Clear existing timeout to keep "scrolling" active
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

      // Calculate center date
      const container = scrollRef.current;

      // Find element closest to center
      const children = Array.from(container.children) as HTMLElement[];
      let bestCandidate = null;
      let minDiff = Infinity;
      const containerCenter = container.scrollLeft + container.clientWidth / 2;

      for (const child of children) {
        // Optimization: check relative to container
        const childLeft = child.offsetLeft;
        const childCenter = childLeft + child.offsetWidth / 2;
        const diff = Math.abs(childCenter - containerCenter);

        if (diff < minDiff) {
          minDiff = diff;
          bestCandidate = child;
        }
      }

      if (bestCandidate) {
        const index = children.indexOf(bestCandidate);
        if (index >= 0 && index < dates.length) {
          const newDate = dates[index];
          if (!isSameDay(newDate, selectedDate)) {
            // We only update selectedDate here. 
            // We DO NOT update anchorDate immediately to avoid "fighting".
            // We let the user stop scrolling first? 
            // actually, we need updates for UI even while scrolling.
            setSelectedDate(newDate);
          }
        }
      }

      // Debounce scroll end to handle anchor updates safely
      scrollTimeout.current = setTimeout(() => {
        isUserScrolling.current = false;

        // Update anchor ONLY when scroll stops
        const idx = dates.findIndex(d => isSameDay(d, selectedDate));
        if (idx !== -1) {
          const current = dates[idx];
          const diffDays = Math.abs((current.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > BUFFER_DAYS - 20) { // Threshold before end
            setAnchorDate(current);
          }
        }
      }, 150);
    };

    return (
      <div className="relative w-full h-24 mb-4 group select-none">
        {/* Stationary Highlight Box */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70px] h-[86px] 
                            border-2 border-blue-500 bg-blue-500/10 rounded-2xl z-20 pointer-events-none 
                            shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300" />

        <div
          ref={scrollRef}
          className="flex items-center gap-4 overflow-x-auto hide-scrollbar px-[calc(50%-35px)] py-2 h-full"
          onScroll={handleScroll}
        // No snap classes!
        >
          {dates.map((date) => {
            const isActive = isSameDay(date, selectedDate);
            const hasApps = getAppointmentsForDate(date).length > 0;
            return (
              <div
                key={date.toISOString()}
                onClick={() => {
                  // If clicked, it's a manual selection. 
                  setSelectedDate(date);
                }}
                className={cn(
                  "shrink-0 flex flex-col items-center justify-center w-[60px] h-[80px] rounded-xl cursor-pointer transition-all duration-300 z-10",
                  isActive ? "scale-110 opacity-100 font-bold" : "opacity-50 hover:opacity-80 scale-90"
                )}
              >
                <span className="text-xs uppercase tracking-wider mb-1">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className="text-2xl">{date.getDate()}</span>
                <div className={cn("w-1.5 h-1.5 rounded-full mt-1", hasApps ? "bg-primary" : "bg-transparent")} />
              </div>
            )
          })}
        </div>
      </div>
    )
  };

  // 2. Vertical Week View (Unified Scroll with Anchor) - Enhanced
  const UnifiedVerticalWeekView = () => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isUserScrolling = useRef(false);
    const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

    // Use anchorDate so list doesn't shift when we just select a neighbor
    const dates = useMemo(() => getBufferDays(anchorDate), [anchorDate]);

    // PRESERVE SCROLL POSITION ON DATE REFRESH
    useLayoutEffect(() => {
      if (scrollRef.current) {
        const index = dates.findIndex(d => isSameDay(d, selectedDate));
        if (index !== -1) {
          const container = scrollRef.current;
          const child = container.children[index] as HTMLElement;
          if (child) {
            // Instant jump to maintain relative position
            // Center the element
            const newScrollTop = child.offsetTop + child.offsetHeight / 2 - container.clientHeight / 2;
            container.scrollTop = newScrollTop;
          }
        }
      }
    }, [dates]);

    // Handle Scroll to update selectedDate
    const handleScroll = () => {
      if (!scrollRef.current) return;
      isUserScrolling.current = true;
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

      const container = scrollRef.current;
      const containerCenter = container.scrollTop + container.clientHeight / 2;

      // Find element at center
      const children = Array.from(container.children) as HTMLElement[];

      let bestCandidate = null;
      let minDiff = Infinity;

      for (const child of children) {
        // Optimization: use offsetTop (relative to parent which is relative)
        const childCenter = child.offsetTop + child.offsetHeight / 2;
        const diff = Math.abs(childCenter - containerCenter);
        if (diff < minDiff) {
          minDiff = diff;
          bestCandidate = child;
        }
      }

      if (bestCandidate) {
        const index = children.indexOf(bestCandidate);
        if (index >= 0 && index < dates.length) {
          const newDate = dates[index];
          if (!isSameDay(newDate, selectedDate)) {
            setSelectedDate(newDate);
          }
        }
      }

      scrollTimeout.current = setTimeout(() => {
        isUserScrolling.current = false;

        // Update anchor ONLY when scroll stops to prevent infinite loop
        const idx = dates.findIndex(d => isSameDay(d, selectedDate));
        if (idx !== -1) {
          const current = dates[idx];
          const diffDays = Math.abs((current.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > BUFFER_DAYS - 20) {
            setAnchorDate(current);
          }
        }
      }, 150);
    };

    // Auto-scroll to selectedDate on mount
    useEffect(() => {
      if (scrollRef.current && !isUserScrolling.current) {
        const index = dates.findIndex(d => isSameDay(d, selectedDate));
        if (index !== -1) {
          const el = scrollRef.current.children[index] as HTMLElement;
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, [selectedDate]);

    return (
      <div className="h-full relative overflow-hidden">
        {/* Stationary Highlight Overlay */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-28 
                           border-y-2 border-primary/20 bg-primary/5 z-0 pointer-events-none 
                           backdrop-blur-[1px]" />

        <div
          className="h-full overflow-y-auto hide-scrollbar py-[calc(50vh-56px)]"
          ref={scrollRef}
          onScroll={handleScroll}
        // No snap classes
        >
          {dates.map((date) => {
            const isActive = isSameDay(date, selectedDate);
            const apps = getAppointmentsForDate(date);
            return (
              <div
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "flex items-center h-28 px-4 gap-6 transition-all duration-300 group relative z-10",
                  isActive ? "opacity-100 scale-100" : "opacity-40 grayscale-[0.5] scale-95"
                )}
              >
                {/* Left: Date */}
                <div className="w-20 text-right shrink-0">
                  <div className="text-xs uppercase font-bold text-muted-foreground mb-1">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={cn("text-3xl font-black", isActive ? "text-primary" : "text-foreground")}>
                    {date.getDate()}
                  </div>
                </div>

                {/* Right: Cards */}
                <div className="flex-1 flex gap-3 overflow-x-auto hide-scrollbar items-center pr-4">
                  {apps.length > 0 ? (
                    apps.map(apt => {
                      const s = getEventStyle(apt);
                      return (
                        <div
                          key={apt.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); setShowAppointmentDetailDialog(true); }}
                          className={cn("min-w-[180px] h-20 p-3 rounded-xl bg-card border shadow-sm cursor-pointer hover:scale-105 transition-transform", s.className)}
                        >
                          <div className="font-bold text-sm line-clamp-1">{apt.title}</div>
                          <div className="text-xs opacity-70 mt-1">{formatLocalTime(apt.startTime, getBusinessTimezone(), 'h:mm a')}</div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-sm font-medium text-muted-foreground/30 italic">Free</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    );
  }

  // 3. Month View (Slot Based)
  const SlotMonthView = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const startDay = startOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i));
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className="h-full flex flex-col pt-2 pb-20 px-4 overflow-y-auto">
        <div className="grid grid-cols-7 mb-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-50">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1 auto-rows-[minmax(100px,1fr)]">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="bg-transparent" />;
            const isTdy = isToday(date);
            const isSel = isSameDay(date, selectedDate);
            const apps = getAppointmentsForDate(date);

            return (
              <div
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "relative bg-card/20 border border-border/10 p-1 flex flex-col gap-1 transition-colors hover:bg-card/40 min-h-[100px] rounded-lg",
                  isSel && "ring-2 ring-primary bg-primary/5",
                  isTdy && "bg-accent/20"
                )}
              >
                <span className={cn(
                  "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full self-end mb-1",
                  isTdy ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}>
                  {date.getDate()}
                </span>

                <div className="flex flex-col gap-1 overflow-hidden">
                  {apps.slice(0, 3).map(apt => {
                    const s = getEventStyle(apt);
                    return (
                      <div key={apt.id} className={cn("text-[8px] px-1 py-0.5 rounded-sm truncate font-medium", s.className, "border-l-2")}>
                        {apt.title}
                      </div>
                    )
                  })}
                  {apps.length > 3 && <div className="text-[8px] text-center opacity-50">+{apps.length - 3} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  };

  // 4. Day View Timeline (Standard Vertical)
  const DayViewTimeline = () => {
    const todayApps = getAppointmentsForDate(selectedDate);
    const tz = getBusinessTimezone();
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    const currentTimePos = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;

    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (containerRef.current) containerRef.current.scrollTop = 540;
    }, []);

    return (
      <div className="flex-1 overflow-y-auto relative bg-background/5" ref={containerRef}>
        <div className="relative min-h-[1440px] px-4 py-4">
          {isToday(selectedDate) && (
            <div className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none" style={{ top: `${currentTimePos}%` }} />
          )}
          {Array.from({ length: 24 }, (_, hour) => {
            const hourAppointments = todayApps.filter(apt => new Date(apt.startTime).getHours() === hour);
            return (
              <div key={hour} className="flex h-[120px] group relative">
                <div className="w-14 text-xs text-muted-foreground/50 text-right pr-4 pt-0">
                  {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                </div>
                <div className="flex-1 border-t border-dashed border-border/20 h-full relative">
                  {hourAppointments.map((apt, idx) => {
                    const s = getEventStyle(apt);
                    const start = new Date(apt.startTime);
                    const end = new Date(apt.endTime);
                    const startMin = start.getMinutes();
                    const duration = (end.getTime() - start.getTime()) / 60000;
                    return (
                      <div
                        key={apt.id}
                        onClick={() => { setSelectedAppointment(apt); setShowAppointmentDetailDialog(true); }}
                        className={cn("absolute inset-x-0 rounded-xl p-3 cursor-pointer hover:brightness-95 shadow-sm flex flex-col justify-center", s.className)}
                        style={{
                          top: `${(startMin / 60) * 100}%`,
                          height: Math.max(50, (duration / 60) * 120 - 4) + 'px',
                          zIndex: 10 + idx
                        }}
                      >
                        <span className="font-bold text-xs truncate">{apt.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }


  if (loading || (isLoading && !appointments)) return <LoadingState message="Loading calendar..." fullScreen />;

  const isArtist = user?.role === "artist" || user?.role === "admin";

  return (
    <PageShell>
      <PageHeader title="Calendar" />

      {/* Context Header */}
      <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80 pointer-events-none">
        <p className="text-4xl font-light text-foreground/90 tracking-tight">
          {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
        </p>
        <p className="text-muted-foreground text-lg font-medium mt-1">
          {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
        </p>
      </div>

      <div className={cn(tokens.contentContainer.base, "relative flex flex-col overflow-hidden")}>
        {/* Toggles */}
        <div className="px-6 py-4 shrink-0">
          <SegmentedHeader
            options={["Day", "Week", "Month"]}
            activeIndex={viewMode === 'day' ? 0 : viewMode === 'week' ? 1 : 2}
            onChange={(i) => setViewMode(i === 0 ? 'day' : i === 1 ? 'week' : 'month' as any)}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden relative">

          {/* View Rendering */}
          {viewMode === 'day' && (
            <>
              <ScrollableHorizontalDateStrip />
              <DayViewTimeline />
            </>
          )}

          {viewMode === 'week' && (
            <UnifiedVerticalWeekView />
          )}

          {viewMode === 'month' && (
            <SlotMonthView />
          )}

        </div>
      </div>

      {/* FAB */}
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

      {/* Dialogs reused from before... */}
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
