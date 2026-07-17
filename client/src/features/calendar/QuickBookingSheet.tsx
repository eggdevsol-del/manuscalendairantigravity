/**
 * QuickBookingSheet — Artist quick-book form (calendar "+" action)
 * ────────────────────────────────────────────────────────────────
 * Single-page form matching PersonalReminderForm design pattern.
 * Sends a booking proposal (appointment_request) into the client's
 * message thread — identical to BookingWizardContent's proposal flow.
 *
 * Supports multi-sitting projects: uses checkAvailability server-side
 * to calculate remaining dates, then sends all dates directly to chat.
 */
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Check,
  User,
  DollarSign,
  Briefcase,
  Loader2,
  Search,
  CalendarDays,
  Calendar as CalendarIcon,
  CalendarSearch,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens, typography } from "@/ui/tokens";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format, addMinutes } from "date-fns";
import { useAuth } from "@/_core/hooks/useAuth";

// ─────────────────────────────────────────────────────────────────────────────
interface QuickBookingSheetProps {
  initialDate?: Date;
  onClose: () => void;
  onSuccess: () => void;
}

const freqOptions = [
  { id: "consecutive" as const, label: "Consecutive", Icon: CalendarDays },
  { id: "weekly" as const, label: "Weekly", Icon: CalendarIcon },
  { id: "biweekly" as const, label: "Bi-Weekly", Icon: Repeat },
  { id: "monthly" as const, label: "Monthly", Icon: CalendarSearch },
];

export const QuickBookingSheet: React.FC<QuickBookingSheetProps> = ({
  initialDate,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();

  // ── local form state ──────────────────────────────────────────────────
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [selectedServiceIdx, setSelectedServiceIdx] = useState<number>(-1);
  const [date, setDate] = useState(
    initialDate ? format(initialDate, "yyyy-MM-dd") : ""
  );
  const [time, setTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [price, setPrice] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [frequency, setFrequency] = useState<
    "consecutive" | "weekly" | "biweekly" | "monthly"
  >("consecutive");

  // ── SSOT tokens ───────────────────────────────────────────────────────
  const fab = tokens.fab;
  const inputClass = cn(tokens.input.base, tokens.input.hero);

  // ── data queries ──────────────────────────────────────────────────────
  const { data: clients, isLoading: isLoadingClients } =
    trpc.conversations.getClients.useQuery();

  const { data: artistSettings } =
    trpc.artistSettings.getPublicByArtistId.useQuery(
      { artistId: user?.id || "" },
      { enabled: !!user?.id }
    );

  const services = useMemo(() => {
    if (artistSettings?.services) {
      try {
        return JSON.parse(artistSettings.services) as any[];
      } catch {
        return [];
      }
    }
    return [];
  }, [artistSettings]);

  // Calendar indicators — for date status hints
  const { data: dateIndicators } = trpc.booking.getCalendarIndicators.useQuery(
    {
      artistId: user?.id || "",
      startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 3, 0),
    },
    { enabled: !!user?.id }
  );

  // ── derived ───────────────────────────────────────────────────────────
  const selectedService =
    selectedServiceIdx >= 0 ? services[selectedServiceIdx] : null;
  const sittings = Number(selectedService?.sittings) || 1;
  const isMultiSitting = sittings > 1;

  // ── mutations ─────────────────────────────────────────────────────────
  const utils = trpc.useUtils();
  const getOrCreateConversation =
    trpc.conversations.getOrCreate.useMutation();
  const sendMessageMutation = trpc.messages.send.useMutation({
    onSuccess: () => {
      toast.success("Proposal sent to client");
      onSuccess();
      onClose();
    },
    onError: (err) => {
      toast.error("Failed to send proposal: " + err.message);
      setSubmitting(false);
    },
  });

  // ── filtered clients ──────────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c: any) =>
        c?.name?.toLowerCase().includes(q) ||
        c?.email?.toLowerCase().includes(q)
    );
  }, [clients, clientSearch]);

  // ── service selection handler ─────────────────────────────────────────
  const handleServiceSelect = (idx: number) => {
    setSelectedServiceIdx(idx);
    const svc = services[idx];
    if (svc) {
      setPrice(String(svc.price || ""));
      setDurationMinutes(svc.duration || 60);
    }
  };

  // ── date status hint ──────────────────────────────────────────────────
  const dateStatusHint = useMemo(() => {
    if (!date || !dateIndicators) return null;
    const indicators = dateIndicators[date];
    if (!indicators || indicators.length === 0) return null;
    const fullyBooked = indicators.some((ind: any) => ind.percentage >= 100);
    if (fullyBooked) return { text: "⚠️ Fully booked on this day", warn: true };
    return {
      text: `${indicators.length} appointment${indicators.length > 1 ? "s" : ""} on this day`,
      warn: false,
    };
  }, [date, dateIndicators]);

  // ── can submit ────────────────────────────────────────────────────────
  const canSubmit =
    selectedClientId &&
    selectedService &&
    date &&
    time &&
    !submitting;

  // ── submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user?.id) return;
    setSubmitting(true);

    try {
      // 1. Get or create conversation with this client
      const convo = await getOrCreateConversation.mutateAsync({
        artistId: user.id,
        clientId: selectedClientId,
      });
      if (!convo) {
        toast.error("Failed to create conversation");
        setSubmitting(false);
        return;
      }

      let datesToUse: string[];
      let finalSittings: number;

      if (isMultiSitting) {
        // Multi-sitting: call checkAvailability to find dates server-side
        const startDate = new Date(`${date}T${time}`);
        const availResult = await utils.client.booking.checkAvailability.fetch({
          conversationId: convo.id,
          artistId: user.id,
          serviceName: selectedService.name,
          serviceDuration: durationMinutes,
          sittings,
          price: Number(price) || 0,
          frequency,
          startDate,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });

        if (!availResult?.dates || availResult.dates.length === 0) {
          toast.error("Could not find enough available dates. Try a different start date or frequency.");
          setSubmitting(false);
          return;
        }

        datesToUse = availResult.dates.map((d: any) =>
          format(new Date(d), "yyyy-MM-dd'T'HH:mm")
        );
        finalSittings = datesToUse.length;
      } else {
        // Single sitting
        const startISO = `${date}T${time}`;
        datesToUse = [format(new Date(startISO), "yyyy-MM-dd'T'HH:mm")];
        finalSittings = 1;
      }

      // 2. Build proposal metadata (same structure as BookingWizardContent)
      const totalCost = Number(price) * finalSittings;

      // Deposit % calculation — same logic as BookingWizardContent
      const rawPercent = Number(artistSettings?.depositPercentage ?? 25);
      const dbTier = (artistSettings as any)?.subscriptionTier?.toLowerCase();
      const isFreeTier = dbTier === "free" || dbTier === "basic" || !dbTier;
      const depositPercent = isFreeTier ? 25 : rawPercent;
      const totalDeposit = Math.round((totalCost * depositPercent) / 100);

      const freqLabel = isMultiSitting
        ? frequency === "consecutive"
          ? "Consecutive"
          : frequency === "weekly"
            ? "Weekly"
            : frequency === "biweekly"
              ? "Bi-Weekly"
              : "Monthly"
        : "Custom dates";

      const datesList = datesToUse
        .map((d) => `• ${format(new Date(d), "EEEE, MMMM d, yyyy 'at' h:mm a")}`)
        .join("\n");

      const message = `I have found the following date${finalSittings > 1 ? "s" : ""} for your ${selectedService.name} project:\n\n${datesList}\n\nThis project consists of ${finalSittings} sitting${finalSittings > 1 ? "s" : ""}.\nFrequency: ${freqLabel}\nPrice per sitting: $${price}\n\nPlease confirm ${finalSittings > 1 ? "these dates" : "this date"}.`;

      const metadata = JSON.stringify({
        type: "project_proposal",
        serviceName: selectedService.name,
        serviceDuration: durationMinutes,
        sittings: finalSittings,
        price: Number(price),
        totalCost,
        frequency: freqLabel,
        dates: datesToUse,
        proposedDates: datesToUse,
        status: "pending",
        bsb: artistSettings?.bsb,
        accountNumber: artistSettings?.accountNumber,
        depositAmount: totalDeposit,
        depositPercent,
        autoSendDeposit: (artistSettings as any)?.autoSendDepositInfo,
      });

      // 3. Send proposal message (same as BookingWizardContent)
      sendMessageMutation.mutate({
        conversationId: convo.id,
        content: message,
        messageType: "appointment_request",
        metadata,
      });

      utils.messages.list.invalidate({ conversationId: convo.id });
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
      setSubmitting(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={fab.animation.panel}
      initial="hidden"
      animate="visible"
      className="flex flex-col w-full pt-2 pb-6 px-1"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <motion.div variants={fab.animation.item} className={fab.itemRow}>
        <button onClick={onClose} className={fab.itemButton}>
          <ArrowLeft className={fab.itemIconSize} />
        </button>
        <span className={cn(typography.h3, "text-foreground flex-1 text-right")}>
          Quick Book
        </span>
      </motion.div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4 w-full">
        {/* ── Client Select ──────────────────────────────────────── */}
        <motion.div variants={fab.animation.item} className="flex flex-col gap-1">
          <label className={cn(typography.label, "text-muted-foreground pl-1")}>
            Client
          </label>

          {selectedClientId ? (
            <div
              className={cn(
                inputClass,
                "flex items-center justify-between cursor-pointer"
              )}
              onClick={() => {
                setSelectedClientId("");
                setSelectedClientName("");
              }}
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground font-medium">
                  {selectedClientName}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">Change</span>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className={cn(inputClass, "pl-11")}
                />
              </div>
              <div
                className="max-h-40 overflow-y-auto rounded-lg border border-border/30 bg-card"
                style={{ marginTop: 4 }}
              >
                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    No clients found
                  </div>
                ) : (
                  filteredClients.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-accent/10 transition-colors border-b border-border/10 last:border-b-0"
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setSelectedClientName(c.name || c.email || "Client");
                        setClientSearch("");
                      }}
                    >
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {c.name || "Unnamed"}
                        </span>
                        {c.email && (
                          <span className="text-xs text-muted-foreground truncate">
                            {c.email}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </motion.div>

        {/* ── Service Select ──────────────────────────────────────── */}
        <motion.div variants={fab.animation.item} className="flex flex-col gap-1">
          <label className={cn(typography.label, "text-muted-foreground pl-1")}>
            Service
          </label>
          <div className="relative">
            <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              value={selectedServiceIdx}
              onChange={(e) => handleServiceSelect(Number(e.target.value))}
              className={cn(inputClass, "pl-11 appearance-none")}
            >
              <option value={-1} disabled>
                Select a service...
              </option>
              {services.map((svc: any, idx: number) => (
                <option key={idx} value={idx}>
                  {svc.name} — ${svc.price} ({svc.duration}min)
                  {Number(svc.sittings) > 1 ? ` · ${svc.sittings} sittings` : ""}
                </option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* ── Frequency (multi-sitting only) ──────────────────────── */}
        {isMultiSitting && (
          <motion.div variants={fab.animation.item} className="flex flex-col gap-1">
            <label className={cn(typography.label, "text-muted-foreground pl-1")}>
              Frequency ({sittings} sittings)
            </label>
            <div className="flex flex-wrap gap-2">
              {freqOptions.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFrequency(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                    frequency === id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 bg-card text-muted-foreground hover:bg-accent/10"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Date ───────────────────────────────────────────────── */}
        <motion.div variants={fab.animation.item} className="flex flex-col gap-1">
          <label className={cn(typography.label, "text-muted-foreground pl-1")}>
            {isMultiSitting ? "Start Date" : "Date"}
          </label>
          <div className="relative">
            <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(inputClass, "pl-11")}
            />
          </div>
          {dateStatusHint && (
            <p
              className={cn(
                "text-[11px] pl-1 mt-0.5",
                dateStatusHint.warn
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              )}
            >
              {dateStatusHint.text}
            </p>
          )}
        </motion.div>

        {/* ── Time + Duration (side by side) ──────────────────────── */}
        <motion.div variants={fab.animation.item} className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label className={cn(typography.label, "text-muted-foreground pl-1")}>
              Start Time
            </label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={cn(inputClass, "pl-11")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className={cn(typography.label, "text-muted-foreground pl-1")}>
              Duration
            </label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className={cn(inputClass, "appearance-none")}
            >
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
              <option value={240}>4 hours</option>
              <option value={360}>6 hours</option>
              <option value={480}>8 hours</option>
            </select>
          </div>
        </motion.div>

        {/* ── Price ───────────────────────────────────────────────── */}
        <motion.div variants={fab.animation.item} className="flex flex-col gap-1">
          <label className={cn(typography.label, "text-muted-foreground pl-1")}>
            Price{" "}
            <span className="text-muted-foreground/60">(per sitting)</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="number"
              min={0}
              step={1}
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={cn(inputClass, "pl-11")}
            />
          </div>
        </motion.div>

        {/* ── Notes ───────────────────────────────────────────────── */}
        <motion.div variants={fab.animation.item} className="flex flex-col gap-1">
          <label className={cn(typography.label, "text-muted-foreground pl-1")}>
            Notes{" "}
            <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Any extra details…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cn(inputClass, "h-auto py-3 resize-none")}
          />
        </motion.div>

        {/* ── Submit ──────────────────────────────────────────────── */}
        <motion.div variants={fab.animation.item} className="pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              tokens.button.primary,
              "flex items-center justify-center gap-2",
              !canSubmit && "opacity-50 pointer-events-none"
            )}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {submitting ? "Sending…" : "Send Proposal"}
          </button>
        </motion.div>
      </form>
    </motion.div>
  );
};
