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
import { BottomSheet, LoadingState, PageShell, PageHeader, GlassSheet } from "@/components/ui/ssot";

import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
        "p-4 border rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-between group",
        selected
          ? "bg-primary/10 border-primary/50"
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
      )}
      onClick={onClick}
    >
      <div className="flex-1">
        <h3 className={cn("font-semibold text-base transition-colors", selected ? "text-primary" : "text-foreground group-hover:text-foreground")}>
          {title}
        </h3>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
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

  const getAppointmentsForDate = (date: Date) => {
    if (!appointments) return [];
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.startTime);
      return (
        aptDate.getDate() === date.getDate() &&
        aptDate.getMonth() === date.getMonth() &&
        aptDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // -- Swipe Gestures --
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const xDistance = touchStart.x - touchEnd.x;
    const yDistance = touchStart.y - touchEnd.y;

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

      // Swipe Up (yDistance > 0) -> Open Hourly (Week) View
      if (yDistance > 0 && viewMode === "month") {
        setViewMode("week");
      }
      // Swipe Down (yDistance < 0) -> Back to Month View (Optional UX improvement)
      if (yDistance < 0 && viewMode === "week") {
        setViewMode("month");
      }
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
      <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
        <p className="text-4xl font-light text-foreground/90 tracking-tight">
          {currentDate.toLocaleDateString("en-US", { weekday: "long" })}
        </p>
        <p className="text-muted-foreground text-lg font-medium mt-1">
          {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* 3. Sheet Container */}
      <GlassSheet className="bg-white/5">

        {/* Sheet Header: Controls */}
        <div className="shrink-0 pt-6 pb-2 px-6 border-b border-white/5 space-y-4">

          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={goToPreviousPeriod} className="rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <span className="text-lg font-semibold text-foreground tracking-tight">
              {currentDate.toLocaleDateString("en-US", { month: "long" })}
            </span>
            <Button variant="ghost" size="icon" onClick={goToNextPeriod} className="rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2 pb-2">
            <Button
              variant={viewMode === "week" ? "default" : "secondary"}
              onClick={() => setViewMode("week")}
              className={cn("flex-1 rounded-xl h-9", viewMode === "week" ? "" : "bg-white/5 text-muted-foreground hover:text-foreground")}
            >
              Week
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "secondary"}
              onClick={() => setViewMode("month")}
              className={cn("flex-1 rounded-xl h-9", viewMode === "month" ? "" : "bg-white/5 text-muted-foreground hover:text-foreground")}
            >
              Month
            </Button>
          </div>

        </div>

        {/* Scrollable Calendar Content */}
        <div
          className="flex-1 w-full h-full flex flex-col px-4 pt-4 overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-full max-w-lg mx-auto flex flex-col h-full">

            {/* Calendar Grid Area */}
            <div className="shrink-0 mb-4">
              {viewMode === "week" ? (
                <div className="space-y-3">
                  {getWeekDays().map((day) => {
                    const dayAppointments = getAppointmentsForDate(day);
                    return (
                      <Card
                        key={day.toISOString()}
                        className={cn(
                          "p-4 min-h-[120px] cursor-pointer transition-all duration-300 border-0 bg-white/5 hover:bg-white/10 rounded-2xl",
                          isToday(day) ? "ring-1 ring-primary/50 bg-primary/5" : ""
                        )}
                        onClick={() => handleDateClick(day)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                              {day.toLocaleDateString("en-US", { weekday: "short" })}
                            </p>
                            <p className={cn("text-2xl font-bold mt-0.5", isToday(day) ? "text-primary" : "text-foreground")}>
                              {day.getDate()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {dayAppointments.length} appt{dayAppointments.length !== 1 ? "s" : ""}
                            </p>
                            {isArtist && (
                              <div className="flex justify-end mt-1">
                                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                                  <Plus className="w-3 h-3 text-white/70" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {dayAppointments.length > 0 ? (
                          <div className="space-y-2">
                            {dayAppointments.map((apt) => (
                              <div
                                key={apt.id}
                                className="p-2.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppointment(apt);
                                  setShowAppointmentDetailDialog(true);
                                }}
                              >
                                <div className="flex justify-between items-start">
                                  <p className="text-sm font-semibold text-foreground/90">
                                    {apt.serviceName || apt.title}
                                  </p>
                                  <p className="text-xs font-mono text-muted-foreground">
                                    {new Date(apt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                                {apt.clientName && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {apt.clientName}
                                  </p>
                                )}
                              </div>
                            ))}
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
                <div className="w-full">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-3 mb-2">
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
                  <div className="girls grid grid-cols-7 gap-3">
                    {getMonthDays().map((day, index) => {
                      const dayAppointments = getAppointmentsForDate(day);
                      const dateKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;

                      // Selection Logic
                      const isSelected = selectedDate
                        ? (day.getDate() === selectedDate.getDate() && day.getMonth() === selectedDate.getMonth() && day.getFullYear() === selectedDate.getFullYear())
                        : false;

                      // If no date is manually selected, default to today for visual context, or just let today behave normally
                      // Per screenshot: 30 is blue (Selected), 13 has dot (Today?). 
                      // Let's make "Selected" = Blue background. "Today" = just bold text if not selected?
                      // User said: "when user selects a date...". So we rely on selectedDate state.

                      return (
                        <button
                          key={dateKey}
                          className={cn(
                            "aspect-square flex flex-col items-center justify-center rounded-[14px] transition-all relative",
                            // Base Style
                            "bg-[#1c1c1e] text-foreground border-none",
                            // Selection Style (Blue/Cyan gradient per screenshot)
                            isSelected
                              ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 z-10 scale-105 font-bold"
                              : "hover:bg-white/10",
                            // Dim filler days
                            !isCurrentMonth(day) && !isSelected && "opacity-20 bg-transparent"
                          )}
                          onClick={() => {
                            setSelectedDate(day);
                            // Dont trigger the create dialog immediately if just selecting for view
                            // The original 'handleDateClick' triggered create dialog. Needs adjustment.
                            // We will just set selected date here. Create dialog can be a separate button or double click?
                            // For now, let's keep it simple: Click = Select. 
                          }}
                        >
                          <span className={cn(
                            "text-[15px]",
                            isToday(day) && !isSelected && "text-blue-400 font-bold", // Today but not selected
                          )}>
                            {day.getDate()}
                          </span>

                          {/* Dots */}
                          {dayAppointments.length > 0 && (
                            <div className={cn(
                              "absolute bottom-2 w-1 h-1 rounded-full",
                              isSelected ? "bg-white/80" : "bg-blue-500"
                            )} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Date List Area (Displayed in Month View) */}
            {viewMode === "month" && (
              <div className="flex-1 overflow-y-auto min-h-0 border-t border-white/5 pt-4 -mx-4 px-4 bg-black/20">
                <div className="space-y-3 pb-24">
                  {selectedDate ? (
                    <>
                      <div className="flex items-center justify-between px-1 mb-2">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                          {selectedDate.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h3>
                        {/* Add Appt Button (Small) */}
                        {isArtist && (
                          <Button
                            size="sm" variant="ghost" className="h-6 px-2 text-primary hover:text-primary hover:bg-primary/10 -mr-2"
                            onClick={() => handleDateClick(selectedDate)} // Use original create handler
                          >
                            <Plus className="w-4 h-4 mr-1" /> Add
                          </Button>
                        )}
                      </div>

                      {getAppointmentsForDate(selectedDate).length > 0 ? (
                        getAppointmentsForDate(selectedDate).map(apt => (
                          <div
                            key={apt.id}
                            className="flex items-center gap-4 p-4 rounded-2xl bg-[#1c1c1e] border border-white/5 active:scale-[0.98] transition-transform cursor-pointer"
                            onClick={() => {
                              setSelectedAppointment(apt);
                              setShowAppointmentDetailDialog(true);
                            }}
                          >
                            {/* Icon Box */}
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-400">
                              {apt.status === 'confirmed' ? <Check className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-base text-white truncate">{apt.serviceName || apt.title}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                                <span>{new Date(apt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                <span>-</span>
                                <span>{new Date(apt.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              {apt.clientName && (
                                <p className="text-xs text-muted-foreground/60 mt-1 truncate">{apt.clientName}</p>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40 space-y-2">
                          <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                            <CalendarIcon className="w-5 h-5" />
                          </div>
                          <p className="text-sm">No events</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground/40">
                      <p className="text-sm">Select a date to view events</p>
                    </div>
                  )}
                </div>
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
        <header className="px-4 py-4 z-10 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === 'details' && (
              <Button variant="ghost" size="icon" className="rounded-full bg-white/5 hover:bg-white/10 text-foreground -ml-2" onClick={goBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <DialogTitle className="text-2xl font-bold text-foreground">{getStepTitle()}</DialogTitle>
          </div>
          {/* No Right Action - standardized */}
        </header>

        {/* Top Context Area */}
        <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[15vh] opacity-80 transition-all duration-300">
          {step === 'service' && <p className="text-4xl font-light text-foreground/90 tracking-tight">Booking</p>}
          {step === 'details' && (
            <div>
              <p className="text-lg font-bold text-primary">{selectedService?.name || appointmentForm.title || "Custom Appointment"}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(appointmentForm.startTime).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                {" • "}
                {new Date(appointmentForm.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}
        </div>

        {/* Sheet Container */}
        <div className="flex-1 z-20 flex flex-col bg-white/5 backdrop-blur-2xl rounded-t-[2.5rem] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-white/20 to-transparent opacity-50 pointer-events-none" />

          <div className="flex-1 w-full h-full px-4 pt-8 overflow-y-auto mobile-scroll touch-pan-y">
            <div className="pb-32 max-w-lg mx-auto space-y-4">

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
                      <SelectTrigger className="h-14 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
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
                      className="h-14 rounded-xl bg-white/5 border-white/10 focus:border-primary/50 transition-all font-medium"
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
                        className="h-14 rounded-xl bg-white/5 border-white/10"
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
                        className="h-14 rounded-xl bg-white/5 border-white/10"
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
                      className="rounded-xl bg-white/5 border-white/10 focus:border-primary/50 resize-none p-4"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleClose}
                      className="flex-1 h-14 rounded-full bg-transparent border-white/10 hover:bg-white/5 text-muted-foreground"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="lg"
                      onClick={handleCreateAppointment}
                      disabled={createAppointmentMutation.isPending || !appointmentForm.clientId || !appointmentForm.title}
                      className="flex-1 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_-5px_rgba(var(--primary-rgb),0.5)]"
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
            <div className="flex w-full gap-2 border-t border-white/10 pt-4">
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
                className="flex-1 bg-transparent border-white/10 hover:bg-white/5"
              >
                Close
              </Button>
            </div>
          ) : null
        }
      >
        {selectedAppointment && (
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Service</Label>
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
                <p className="mt-1 text-sm bg-white/5 p-3 rounded-xl">{selectedAppointment.description}</p>
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
    </PageShell>
  );
}
