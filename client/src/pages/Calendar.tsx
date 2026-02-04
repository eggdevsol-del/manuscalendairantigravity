import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Card, Dialog, DialogTitle, Input, Label, ModalShell, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Check,
  X,
  ArrowLeft,
  Clock
} from "lucide-react";
import { BottomSheet, LoadingState, PageShell, PageHeader, GlassSheet, SegmentedHeader } from "@/components/ui/ssot";

import { useEffect, useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";

type ViewMode = "month" | "week";

function SelectableCard({
  selected,
  onClick,
  title,
  subtitle,
  children,
  rightElement
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  rightElement?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-between group",
        tokens.calendar.cardWeek,
        selected
          ? cn(tokens.calendar.selectedBg, tokens.calendar.selectedBorder)
          : cn(tokens.calendar.cellBg, tokens.calendar.cellBorder, tokens.calendar.cellBgHover, tokens.calendar.cellBorderHover)
      )}
      onClick={onClick}
    >
      <div className="flex-1">
        <h3 className={cn(tokens.calendar.cardTitle, "transition-colors", selected ? tokens.calendar.selectedText : "text-foreground group-hover:text-foreground")}>
          {title}
        </h3>
        {subtitle && <div className={cn(tokens.calendar.cardSubtitle, "mt-0.5")}>{subtitle}</div>}
        {children}
      </div>

      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center border transition-all ml-4",
        selected
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-transparent border-white/20 text-transparent group-hover:border-white/40"
      )}>
        {rightElement || <Check className="w-4 h-4" />}
      </div>
    </div>
  );
}

export default function Calendar() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showAppointmentDetailDialog, setShowAppointmentDetailDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showTimelineContent, setShowTimelineContent] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Scroll to time when timeline content becomes visible


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

  // Calculate grid range for data fetching
  // We need to know the start/end of the VISIBLE grid, not just the month
  const gridStart = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const day = start.getDay(); // 0-6
    start.setDate(start.getDate() - day);
    return start;
  }, [currentDate]);

  const gridEnd = useMemo(() => {
    const end = new Date(gridStart);
    end.setDate(gridStart.getDate() + 42); // 6 rows * 7 days
    return end;
  }, [gridStart]);

  const { data: appointments, isLoading, refetch } = trpc.appointments.list.useQuery(
    {
      startDate: gridStart,
      endDate: gridEnd,
    },
    {
      enabled: !!user,
      // Keep previous data while fetching new month to prevent flickering
      placeholderData: (previousData) => previousData,
    }
  );

  const { data: conversations } = trpc.conversations.list.useQuery(undefined, {
    enabled: !!user && (user.role === "artist" || user.role === "admin"),
  });



  // Extract unique clients from conversations
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
    onError: (error: any) => {
      toast.error("Failed to create appointment: " + error.message);
    },
  });

  const updateAppointmentMutation = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Appointment updated successfully");
      setShowAppointmentDetailDialog(false);
      setSelectedAppointment(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error("Failed to update appointment: " + error.message);
    },
  });

  const deleteAppointmentMutation = trpc.appointments.delete.useMutation({
    onSuccess: () => {
      toast.success("Appointment deleted successfully");
      setShowAppointmentDetailDialog(false);
      setSelectedAppointment(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error("Failed to delete appointment: " + error.message);
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
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
    setSelectedDate(null);
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
      setStep('service'); // Reset to first step
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
      startTime: new Date(appointmentForm.startTime),
      endTime: new Date(appointmentForm.endTime),
    });
  };

  const goToPreviousPeriod = () => {
    if (viewMode === "month") {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      );
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() - 7);
      setCurrentDate(newDate);
    }
  };

  const goToNextPeriod = () => {
    if (viewMode === "month") {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      );
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + 7);
      setCurrentDate(newDate);
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
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

  // Memoize month days to prevent re-renders causing visual glitches
  const monthDays = useMemo(() => {
    const firstDay = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const lastDay = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    // getDay() returns 0 for Sunday, which is correct for our S M T W T F S layout
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Date[] = [];

    // Generate fixed 6-row grid (42 days)
    // Start from the first Sunday (even if in previous month)
    const startOfGrid = new Date(firstDay);
    startOfGrid.setDate(firstDay.getDate() - startDay); // Go back to Sunday

    for (let i = 0; i < 42; i++) {
      const date = new Date(startOfGrid);
      date.setDate(startOfGrid.getDate() + i);
      days.push(date);
    }

    return days;
  }, [currentDate]);

  // Keep getMonthDays for backward compatibility but use memoized value
  const getMonthDays = () => monthDays;

  // Optimize appointment lookup: Create O(1) map
  const appointmentsByDate = useMemo(() => {
    if (!appointments) return new Map<string, any[]>();
    const map = new Map<string, any[]>();

    appointments.forEach((apt) => {
      const d = new Date(apt.startTime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; // Consistent key
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    });
    return map;
  }, [appointments]);

  const getAppointmentsForDate = (date: Date) => {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return appointmentsByDate.get(key) || [];
  };

  // Scroll to time when timeline content becomes visible
  useEffect(() => {
    if (showTimelineContent && selectedDate && timelineRef.current) {
      const el = timelineRef.current;
      const dayAppts = getAppointmentsForDate(selectedDate);
      let scrollHour = 9; // Default 9 AM

      if (dayAppts.length > 0) {
        const appts = [...dayAppts].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        const first = new Date(appts[0].startTime);
        scrollHour = first.getHours();
      }

      const targetHour = Math.max(0, scrollHour - 1);
      const targetEl = el.querySelector(`#time-slot-${targetHour}`);

      if (targetEl) {
        targetEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  }, [showTimelineContent, selectedDate, appointmentsByDate]);

  // -- Swipe Gestures --
  // Use Refs instead of State to prevent re-renders during swipe (60fps critical)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchEndRef = useRef<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndRef.current = null;
    touchStartRef.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };
  };

  const onTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;

    const xDistance = touchStartRef.current.x - touchEndRef.current.x;
    const yDistance = touchStartRef.current.y - touchEndRef.current.y;

    // Check for horizontal swipe (Month Navigation)
    const isHorizontalSwipe = Math.abs(xDistance) > Math.abs(yDistance);

    if (isHorizontalSwipe) {
      if (Math.abs(xDistance) < minSwipeDistance) return;

      if (xDistance > 0) {
        goToNextPeriod();
      } else {
        goToPreviousPeriod();
      }
    } else {
      // Vertical Swipe
      if (Math.abs(yDistance) < minSwipeDistance) return;

      // Swipe Up/Down Logic
      // Currently empty as per original code
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  if (loading || isLoading) {
    return <LoadingState message="Loading calendar..." fullScreen />;
  }

  const isArtist = user?.role === "artist" || user?.role === "admin";

  // -- Gold Standard Helpers --

  const handleClose = () => {
    setShowAppointmentDialog(false);
    // Reset state after slight delay for animation
    setTimeout(() => {
      setStep('service');
      setSelectedService(null);
      resetForm();
    }, 300);
  };

  const goBack = () => {
    if (step === 'details') setStep('service');
  };

  const getStepTitle = () => {
    switch (step) {
      case 'service': return "Select Service";
      case 'details': return "Appointment Details";
      default: return "Create Appointment";
    }
  };

  const handleSelectService = (service: any) => {
    setSelectedService(service);

    // Auto-calculate End Time based on Start Time (which is set when opening modal)
    // Parse the ISO string from form
    const startDate = new Date(appointmentForm.startTime); // "YYYY-MM-DDTHH:mm" parses correctly in most browsers/node, but let's be safe.
    // Actually appointmentForm.startTime is "YYYY-MM-DDTHH:mm" string.
    // We need to operate on it.

    if (!isNaN(startDate.getTime())) {
      const duration = service.duration || 60;
      const endDate = new Date(startDate.getTime() + duration * 60000);

      // Format to "YYYY-MM-DDTHH:mm" manually to avoid timezone shifts from toISOString()
      const formatDateTime = (date: Date) => {
        const pad = (n: number) => n < 10 ? '0' + n : n;
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      };

      setAppointmentForm(prev => ({
        ...prev,
        title: service.name,
        endTime: formatDateTime(endDate)
      }));
    } else {
      setAppointmentForm(prev => ({
        ...prev,
        title: service.name,
      }));
    }

    setTimeout(() => setStep('details'), 200);
  };

  return (
    <PageShell>
      {/* 1. Page Header - Left aligned, no icons */}
      <PageHeader title="Calendar" />

      {/* 2. Top Context Area (Date Display) */}
      <div
        className={cn(
          "z-10 shrink-0 flex flex-col justify-center transition-all duration-500 ease-in-out overflow-hidden",
          tokens.calendar.contextPadding,
          selectedDate ? "h-0 opacity-0 pb-0" : cn(tokens.calendar.contextHeight, "opacity-80 pb-8")
        )}
        style={{ willChange: "height, padding, opacity" }}
      >
        <p className={tokens.calendar.contextTitle}>
          {currentDate.toLocaleDateString("en-US", { weekday: "long" })}
        </p>
        <p className={cn(tokens.calendar.contextSubtitle, "mt-1")}>
          {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* 3. Sheet Container */}
      <GlassSheet className="bg-white/5">

        {/* Sheet Header: Controls */}
        <div className={cn("shrink-0 pb-2 space-y-4", tokens.calendar.sheetHeaderPadding, tokens.calendar.divider, "border-b")}>

          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={goToPreviousPeriod}>
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <span className={tokens.calendar.sheetTitle}>
              {currentDate.toLocaleDateString("en-US", { month: "long" })}
            </span>
            <Button variant="ghost" size="icon" onClick={goToNextPeriod}>
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2 pb-2">
            <SegmentedHeader
              options={["Week", "Month"]}
              activeIndex={viewMode === "week" ? 0 : 1}
              onChange={(index) => setViewMode(index === 0 ? "week" : "month")}
              className="w-full"
            />
          </div>

        </div>

        {/* Scrollable Calendar Content */}
        <div
          className={cn("flex-1 w-full h-full flex flex-col overflow-hidden", tokens.calendar.sheetContentPadding)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-full max-w-lg mx-auto flex flex-col h-full">

            {/* Calendar Grid Area */}
            <div
              className={cn(
                "flex-1 mb-4 transition-all duration-300 ease-in-out",
                // Enable scrolling for week view
                viewMode === 'week' ? "overflow-y-auto mobile-scroll touch-pan-y" : "",
                // When selected, constrain grid height to allow timeline to take 75%
                selectedDate && viewMode === 'month' ? cn(tokens.calendar.gridHeightCollapsed, "overflow-hidden shrink-0") : ""
              )}
              style={{ willChange: "height, flex-basis" }}
            >
              {viewMode === "week" ? (
                <div className="space-y-3">
                  {getWeekDays().map((day) => {
                    const dayAppointments = getAppointmentsForDate(day);
                    return (
                      <Card
                        key={day.toISOString()}
                        className={cn(
                          tokens.calendar.card,
                          tokens.calendar.cellBg,
                          tokens.calendar.cellBgHover,
                          isToday(day) ? cn(tokens.calendar.todayRing, tokens.calendar.todayBg) : ""
                        )}
                        onClick={() => handleDateClick(day)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className={tokens.calendar.dayLabel}>
                              {day.toLocaleDateString("en-US", { weekday: "short" })}
                            </p>
                            <p className={cn(tokens.calendar.dayNumber, "mt-0.5", isToday(day) ? tokens.calendar.todayText : "text-foreground")}>
                              {day.getDate()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {dayAppointments.length} appt{dayAppointments.length !== 1 ? "s" : ""}
                            </p>
                            {isArtist && (
                              <div className="flex justify-end mt-1">
                                <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", tokens.calendar.iconBg)}>
                                  <Plus className={cn("w-3 h-3", tokens.calendar.iconText)} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {dayAppointments.length > 0 ? (
                          <div className="space-y-2">
                            {dayAppointments.map((apt) => {
                              const serviceColor = availableServices.find(s => s.name === apt.serviceName || s.name === apt.title)?.color || "var(--primary)";
                              const isHex = serviceColor.startsWith('#');

                              const sessionLabel = (() => {
                                if (!apt.totalSessions || apt.totalSessions <= 1) return null;
                                if (apt.sessionNumber === apt.totalSessions) return "Final Session";
                                if (apt.sessionNumber === 1) return "Session One";
                                return `Session ${apt.sessionNumber}`;
                              })();

                              return (
                                <div
                                  key={apt.id}
                                  className="p-2.5 rounded-xl border cursor-pointer transition-colors backdrop-blur-sm flex flex-col justify-center"
                                  style={{
                                    backgroundColor: isHex ? `${serviceColor}40` : `oklch(from ${serviceColor} l c h / 0.1)`,
                                    borderColor: isHex ? `${serviceColor}60` : `oklch(from ${serviceColor} l c h / 0.2)`
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAppointment(apt);
                                    setShowAppointmentDetailDialog(true);
                                  }}
                                >
                                  <p className="text-sm font-bold text-foreground truncate">
                                    {apt.clientName || "Unknown Client"}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-xs text-foreground/80 truncate mt-0.5">
                                    <span>{apt.serviceName || apt.title}</span>
                                    {sessionLabel && (
                                      <>
                                        <span className="opacity-40">•</span>
                                        <span className="opacity-60 font-medium">{sessionLabel}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center p-2 mt-2 border border-dashed border-white/10 rounded-lg">
                            <span className="text-xs text-muted-foreground/40">Available</span>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                // MONTH VIEW
                <div className="w-full h-full flex flex-col">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-3 mb-2 shrink-0">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
                      <div
                        key={`day-header-${idx}`}
                        className="text-center text-xs font-medium text-muted-foreground/50 py-1"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Date Grid */}
                  <div className={cn(
                    "girls grid grid-cols-7 gap-3",
                    // Ensure grid is scrollable if compressed
                    selectedDate ? "overflow-y-auto pr-1 custom-scrollbar" : ""
                  )}>
                    {getMonthDays().map((day, index) => {
                      const dayAppointments = getAppointmentsForDate(day);
                      const dateKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;

                      // Selection Logic
                      const isSelected = selectedDate
                        ? (day.getDate() === selectedDate.getDate() && day.getMonth() === selectedDate.getMonth() && day.getFullYear() === selectedDate.getFullYear())
                        : false;

                      return (
                        <button
                          key={dateKey}
                          className={cn(
                            "aspect-square flex flex-col items-center justify-center rounded-[14px] transition-all relative font-medium",
                            // Base Style: Use Secondary (medium greyish in dark mode, light grey in light mode)
                            // SSOT: Use semantic tokens.
                            "bg-secondary text-foreground border-none ring-0 outline-none",
                            // Selection Style
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 z-10 scale-105 font-bold"
                              : "hover:bg-secondary/80",
                            // Dim filler days
                            !isCurrentMonth(day) && !isSelected && "opacity-30 bg-transparent text-muted-foreground"
                          )}
                          onClick={() => {
                            if (selectedDate?.getTime() === day.getTime()) return;
                            setSelectedDate(day);
                            setShowTimelineContent(false);
                            setTimeout(() => setShowTimelineContent(true), 305);
                          }}
                        >
                          <span className={cn(
                            "text-[15px]",
                            isToday(day) && !isSelected && "text-primary font-bold", // Today but not selected
                          )}>
                            {day.getDate()}
                          </span>

                          {/* Dots */}
                          {dayAppointments.length > 0 && (
                            <div className={cn(
                              "absolute bottom-2 w-1 h-1 rounded-full",
                              isSelected ? tokens.calendar.dotSelected : tokens.calendar.dot
                            )} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Hourly Day Timeline Area (Displayed in Month View) */}
            {viewMode === "month" && (
              <div
                className={cn(
                  cn("flex-1 overflow-hidden min-h-0 flex flex-col transition-all duration-300", tokens.calendar.divider, "border-t", tokens.calendar.timelineBg),
                  selectedDate ? cn(tokens.calendar.timelineHeightExpanded, "grow-0") : ""
                )}
                style={{ willChange: "flex-basis", contain: "layout paint" }}
              >

                {/* Timeline Header */}
                <div className={cn("shrink-0 flex items-center justify-between backdrop-blur-md z-10 transition-colors duration-300", tokens.calendar.timelineHeaderPadding, tokens.calendar.divider, "border-b", tokens.calendar.headerBg)}>
                  <div className="flex items-center gap-2">
                    {selectedDate && (
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8 -ml-2 text-muted-foreground hover:text-foreground rounded-full"
                        onClick={() => {
                          setShowTimelineContent(false);
                          setSelectedDate(null);
                        }}
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </Button>
                    )}
                    <h3 className={cn(tokens.calendar.timelineTitle, "pl-1")}>
                      {selectedDate
                        ? selectedDate.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' })
                        : "Select a date"}
                    </h3>
                  </div>

                  {selectedDate && isArtist && (
                    <Button
                      size="sm" variant="ghost" className="h-8 text-primary"
                      onClick={() => handleDateClick(selectedDate)} // Default add (9am)
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  )}
                </div>

                {/* Timeline Scroll Area */}
                {selectedDate ? (
                  <div
                    key={selectedDate.toISOString()}
                    className="flex-1 overflow-y-auto relative mobile-scroll touch-pan-y"
                    ref={timelineRef}
                  >
                    {showTimelineContent && (
                      <div className={cn(tokens.calendar.timelineScrollHeight, "pb-32")}> {/* Tall container for 24h */}
                        {Array.from({ length: 24 }).map((_, hour) => (
                          <div key={hour} id={`time-slot-${hour}`} className={cn("relative group", tokens.calendar.hourSlotHeight, tokens.calendar.divider, "border-b")}>
                            {/* Hour Label */}
                            <div className="absolute top-0 left-0 w-16 text-right pr-3 -mt-2.5 z-10 pointer-events-none">
                              <span className={cn("text-xs font-medium", tokens.calendar.hourLabel)}>
                                {hour === 0 ? "12 AM" : hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                              </span>
                            </div>

                            {/* 15 Minute Slots */}
                            {[0, 15, 30, 45].map((minute) => (
                              <div
                                key={minute}
                                className={cn(
                                  "w-full pl-20 pr-4 flex items-center cursor-pointer transition-colors",
                                  tokens.calendar.minuteSlotHeight,
                                  tokens.calendar.divider,
                                  "border-l",
                                  tokens.calendar.slotHover,
                                  tokens.calendar.slotActive,
                                  minute === 0 ? cn(tokens.calendar.hourBorder, "border-t") : cn(tokens.calendar.minuteBorder, "border-t")
                                )}
                                onClick={() => {
                                  if (!isArtist) return;
                                  const newTime = new Date(selectedDate);
                                  newTime.setHours(hour);
                                  newTime.setMinutes(minute);

                                  // Use ISO string logic similar to handleDateClick but specific time
                                  const dateStr = newTime.getFullYear() + "-" +
                                    String(newTime.getMonth() + 1).padStart(2, '0') + "-" +
                                    String(newTime.getDate()).padStart(2, '0');
                                  const timeStr = String(newTime.getHours()).padStart(2, '0') + ":" + String(newTime.getMinutes()).padStart(2, '0');
                                  const endTimeStr = String(newTime.getHours() + 1).padStart(2, '0') + ":" + String(newTime.getMinutes()).padStart(2, '0'); // Default 1h

                                  setAppointmentForm({
                                    ...appointmentForm,
                                    startTime: `${dateStr}T${timeStr}`,
                                    endTime: `${dateStr}T${endTimeStr}`,
                                  });
                                  setStep('service');
                                  setSelectedService(null);
                                  setShowAppointmentDialog(true);
                                }}
                              >
                                {/* Use semantic border for markers */}
                              </div>
                            ))}

                            {/* Render Appointments starting in this hour */}
                            {getAppointmentsForDate(selectedDate).filter(apt => {
                              const d = new Date(apt.startTime);
                              return d.getHours() === hour;
                            }).map(apt => {
                              const start = new Date(apt.startTime);
                              const end = new Date(apt.endTime);

                              // Calculate styling
                              const startMin = start.getMinutes();
                              const durationMins = (end.getTime() - start.getTime()) / 60000;

                              // 1 hour = 96px (4 * 24px slots). 
                              // 1 min = 96/60 = 1.6px
                              const topPx = startMin * 1.6;
                              const heightPx = Math.max(durationMins * 1.6, 24); // Min height 1 slot

                              // Get service color from availableServices or default to primary
                              const serviceColor = availableServices.find(s => s.name === apt.serviceName || s.name === apt.title)?.color || "var(--primary)";
                              const isHex = serviceColor.startsWith('#');

                              return (
                                <div
                                  key={apt.id}
                                  className={cn("absolute left-20 right-4 rounded-lg backdrop-blur-sm shadow-sm overflow-hidden z-20 hover:brightness-110 transition-all cursor-pointer flex flex-col border", tokens.calendar.appointmentPadding, tokens.calendar.appointmentBorder)}
                                  style={{
                                    top: `${topPx}px`,
                                    height: `${heightPx}px`,
                                    backgroundColor: isHex ? `${serviceColor}40` : `oklch(from ${serviceColor} l c h / 0.3)`,
                                    borderColor: serviceColor,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAppointment(apt);
                                    setShowAppointmentDetailDialog(true);
                                  }}
                                >
                                  {(() => {
                                    const sessionLabel = (() => {
                                      if (!apt.totalSessions || apt.totalSessions <= 1) return null;
                                      if (apt.sessionNumber === apt.totalSessions) return "Final Session";
                                      if (apt.sessionNumber === 1) return "Session One";
                                      return `Session ${apt.sessionNumber}`;
                                    })();

                                    return (
                                      <>
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: serviceColor }} />
                                          <p className="text-sm font-bold text-foreground truncate shadow-black drop-shadow-sm">
                                            {apt.clientName || "Unknown Client"}
                                          </p>
                                        </div>

                                        {heightPx > 40 && (
                                          <div className="flex items-center gap-1.5 text-xs text-foreground/90 truncate pl-3.5 mt-0.5">
                                            <span>{apt.serviceName || apt.title}</span>
                                            {sessionLabel && (
                                              <>
                                                <span className="opacity-40">•</span>
                                                <span className="opacity-70 font-medium">{sessionLabel}</span>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground/40 space-y-4">
                    <div className={cn("w-16 h-16 rounded-full flex items-center justify-center animate-pulse", tokens.calendar.emptyStateBg)}>
                      <Clock className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="text-sm font-medium">Select a date to view agenda</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </GlassSheet>

      {/* Appointment Creation Sheet (Gold Standard) */}
      <BottomSheet
        open={showAppointmentDialog}
        onOpenChange={(open) => !open && handleClose()}
        title="Create Appointment"
      >
        {/* Header */}
        <header className={cn("z-10 shrink-0 flex items-center justify-between", tokens.appointmentWizard.headerPadding)}>
          <div className="flex items-center gap-3">
            {step === 'details' && (
              <Button variant="ghost" size="icon" className={cn("text-foreground -ml-2", tokens.appointmentWizard.backButton)} onClick={goBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <DialogTitle className={tokens.appointmentWizard.title}>{getStepTitle()}</DialogTitle>
          </div>
          {/* No Right Action - standardized */}
        </header>

        {/* Top Context Area */}
        <div className={cn("z-10 shrink-0 flex flex-col justify-center opacity-80 transition-all duration-300", tokens.appointmentWizard.contextPadding, tokens.appointmentWizard.contextHeight)}>
          {step === 'service' && <p className={tokens.appointmentWizard.contextTitle}>Booking</p>}
          {step === 'details' && (
            <div>
              <p className={tokens.appointmentWizard.serviceTitle}>{selectedService?.name || appointmentForm.title || "Custom Appointment"}</p>
              <p className={tokens.appointmentWizard.contextSubtitle}>
                {new Date(appointmentForm.startTime).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                {" • "}
                {new Date(appointmentForm.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}
        </div>

        {/* Sheet Container */}
        <div className={cn("flex-1 z-20 flex flex-col overflow-hidden relative", tokens.appointmentWizard.sheetBg, tokens.appointmentWizard.sheetBlur, tokens.appointmentWizard.sheetRadius, tokens.appointmentWizard.sheetShadow)}>
          <div className={cn("absolute top-0 inset-x-0 h-px pointer-events-none", tokens.appointmentWizard.highlightGradient, tokens.appointmentWizard.highlightOpacity)} />

          <div className={cn("flex-1 w-full h-full overflow-y-auto mobile-scroll touch-pan-y", tokens.appointmentWizard.contentPadding)}>
            <div className={cn("max-w-lg mx-auto space-y-4", tokens.appointmentWizard.bottomPadding)}>

              {/* STEP 1: SERVICE SELECTION */}
              {step === 'service' && (
                <div className="space-y-3">
                  {availableServices.length > 0 ? (
                    availableServices.map((service: any) => (
                      <SelectableCard
                        key={service.name} // Name fallback as ID might be missing
                        selected={!!selectedService && (selectedService.name === service.name)}
                        onClick={() => handleSelectService(service)}
                        title={service.name}
                        subtitle={
                          <div className="flex gap-3 text-xs text-muted-foreground font-mono">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {service.duration}m</span>
                            <span className="font-bold text-muted-foreground">${service.price}</span>
                          </div>
                        }
                      />
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No services found. <br />
                      <Button variant="link" onClick={() => setStep('details')} className="mt-2 text-primary">
                        Skip to Manual Entry
                      </Button>
                    </div>
                  )}
                  {/* Always allow skip to manual */}
                  {availableServices.length > 0 && (
                    <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => { setSelectedService(null); setStep('details'); }}>
                      Skip / Manual Entry
                    </Button>
                  )}
                </div>
              )}

              {/* STEP 2: APPOINTMENT DETAILS */}
              {step === 'details' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="client" className="text-muted-foreground ml-1">Client</Label>
                    <Select
                      value={appointmentForm.clientId}
                      onValueChange={(value) =>
                        setAppointmentForm({ ...appointmentForm, clientId: value })
                      }
                    >
                      <SelectTrigger className={cn("transition-colors", tokens.appointmentWizard.inputHeight, tokens.appointmentWizard.inputRadius, tokens.appointmentWizard.inputBg, tokens.appointmentWizard.inputBorder, tokens.appointmentWizard.inputBorderHover)}>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client: any) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name || client.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-muted-foreground ml-1">Title</Label>
                    <Input
                      id="title"
                      value={appointmentForm.title}
                      onChange={(e) =>
                        setAppointmentForm({ ...appointmentForm, title: e.target.value })
                      }
                      placeholder="Appointment Title"
                      className={cn("transition-all font-medium", tokens.appointmentWizard.inputHeight, tokens.appointmentWizard.inputRadius, tokens.appointmentWizard.inputBg, tokens.appointmentWizard.inputBorder, tokens.appointmentWizard.inputBorderFocus)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="startTime" className="text-muted-foreground ml-1">Start</Label>
                      <Input
                        id="startTime"
                        type="datetime-local"
                        value={appointmentForm.startTime}
                        onChange={(e) =>
                          setAppointmentForm({
                            ...appointmentForm,
                            startTime: e.target.value,
                          })
                        }
                        className={cn(tokens.appointmentWizard.inputHeight, tokens.appointmentWizard.inputRadius, tokens.appointmentWizard.inputBg, tokens.appointmentWizard.inputBorder)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime" className="text-muted-foreground ml-1">End</Label>
                      <Input
                        id="endTime"
                        type="datetime-local"
                        value={appointmentForm.endTime}
                        onChange={(e) =>
                          setAppointmentForm({
                            ...appointmentForm,
                            endTime: e.target.value,
                          })
                        }
                        className={cn(tokens.appointmentWizard.inputHeight, tokens.appointmentWizard.inputRadius, tokens.appointmentWizard.inputBg, tokens.appointmentWizard.inputBorder)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-muted-foreground ml-1">Notes</Label>
                    <Textarea
                      id="description"
                      value={appointmentForm.description}
                      onChange={(e) =>
                        setAppointmentForm({
                          ...appointmentForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="Optional details..."
                      rows={3}
                      className={cn("resize-none p-4", tokens.appointmentWizard.inputRadius, tokens.appointmentWizard.inputBg, tokens.appointmentWizard.inputBorder, tokens.appointmentWizard.inputBorderFocus)}
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleClose}
                      className={cn("flex-1", tokens.appointmentWizard.buttonHeight, tokens.appointmentWizard.buttonRadius, tokens.appointmentWizard.cancelButton)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="lg"
                      onClick={handleCreateAppointment}
                      disabled={createAppointmentMutation.isPending || !appointmentForm.clientId || !appointmentForm.title}
                      className={cn("flex-1", tokens.appointmentWizard.buttonHeight, tokens.appointmentWizard.buttonRadius, tokens.appointmentWizard.createButton)}
                    >
                      {createAppointmentMutation.isPending ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> create...</div> : "Create Appointment"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* Appointment Detail Dialog */}
      <ModalShell
        isOpen={showAppointmentDetailDialog}
        onClose={() => setShowAppointmentDetailDialog(false)}
        title="Appointment Details"
        className="max-w-md"
        overlayName="Appointment Details"
        overlayId="calendar.appointment_details"
        footer={
          selectedAppointment ? (
            <div className={cn("flex w-full gap-2 border-t pt-4", tokens.proposalModal.cardBorder)}>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this appointment?')) {
                    deleteAppointmentMutation.mutate(selectedAppointment.id);
                  }
                }}
                disabled={deleteAppointmentMutation.isPending}
                className="flex-1"
              >
                {deleteAppointmentMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAppointmentDetailDialog(false);
                  setSelectedAppointment(null);
                }}
                className={cn("flex-1 bg-transparent", tokens.proposalModal.cardBorder, "hover:bg-white/5")}
              >
                Close
              </Button>
            </div>
          ) : null
        }
      >
        {selectedAppointment && (
          <div className="space-y-4 pt-1">
            <div className={cn("border", tokens.proposalModal.cardBg, tokens.proposalModal.cardBorder, tokens.proposalModal.cardRadius, tokens.proposalModal.cardPadding)}>
              <Label className={cn("mb-1 block", tokens.proposalModal.sectionLabel)}>Service</Label>
              <p className="text-xl font-bold text-foreground">{selectedAppointment.serviceName || selectedAppointment.title}</p>
            </div>

            {selectedAppointment.clientName && (
              <div>
                <Label className="text-muted-foreground">Client</Label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {selectedAppointment.clientName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{selectedAppointment.clientName}</p>
                    {selectedAppointment.clientEmail && (
                      <p className="text-sm text-muted-foreground">{selectedAppointment.clientEmail}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedAppointment.description && (
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className={cn("mt-1 text-sm", tokens.proposalModal.cardBg, tokens.proposalModal.statusPadding, tokens.proposalModal.statusRadius)}>{selectedAppointment.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Date</Label>
                <p className="font-medium mt-1">
                  {new Date(selectedAppointment.startTime).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Time</Label>
                <p className="font-medium mt-1 font-mono text-sm">
                  {new Date(selectedAppointment.startTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" - "}
                  {new Date(selectedAppointment.endTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {selectedAppointment.price !== undefined && (
              <div>
                <Label className="text-muted-foreground">Price</Label>
                {selectedAppointment.description?.includes('Promotion Applied') ? (
                  <div className="mt-1">
                    <p className="text-2xl font-bold text-green-500">${selectedAppointment.price}</p>
                    <p className="text-xs text-green-500/80 mt-1 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                      Promotion discount applied
                    </p>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-primary mt-1">${selectedAppointment.price}</p>
                )}
              </div>
            )}
          </div>
        )}
      </ModalShell>
    </PageShell >
  );
}
