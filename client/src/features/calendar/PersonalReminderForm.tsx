import React, { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, FileText, Check, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens, typography } from "@/ui/tokens";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// PersonalReminderForm — renders inside the FAB panel for clients to add
// personal reminders / appointments to their calendar.
// ---------------------------------------------------------------------------

interface PersonalReminderFormProps {
  initialDate?: Date;
  onClose: () => void;
  onSuccess: () => void;
}

export const PersonalReminderForm: React.FC<PersonalReminderFormProps> = ({
  initialDate,
  onClose,
  onSuccess,
}) => {
  // ── local form state ────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(
    initialDate ? format(initialDate, "yyyy-MM-dd") : "",
  );
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  // ── SSOT tokens ─────────────────────────────────────────────────────────
  const fab = tokens.fab;
  const inputClass = cn(tokens.input.base, tokens.input.hero);

  // ── mutation ─────────────────────────────────────────────────────────────
  const createMutation = trpc.appointments.create.useMutation({
    onSuccess: () => {
      toast.success("Reminder saved");
      onSuccess();
      onClose();
    },
    onError: () => {
      toast.error("Failed to save reminder");
    },
  });

  // ── derived helpers ──────────────────────────────────────────────────────
  const buildISOString = (
    dateStr: string,
    timeStr: string | undefined,
  ): string => {
    const t = timeStr || "09:00";
    return `${dateStr}T${t}`;
  };

  const canSubmit = title.trim().length > 0 && date.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const startISO = buildISOString(date, time || undefined);
    // Default duration: 1 hour
    const startDate = new Date(startISO);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const endISO = format(endDate, "yyyy-MM-dd'T'HH:mm");

    createMutation.mutate({
      title,
      startTime: startISO,
      endTime: endISO,
      description: notes || undefined,
      // Personal reminder fields — the endpoint may need to be extended to
      // accept these without requiring conversationId / artistId / clientId.
      conversationId: 0,
      artistId: "",
      clientId: "",
    });
  };

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={fab.animation.panel}
      initial="hidden"
      animate="visible"
      className="flex flex-col w-full pt-2 pb-6 px-1"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div variants={fab.animation.item} className={fab.itemRow}>
        <button onClick={onClose} className={fab.itemButton}>
          <ArrowLeft className={fab.itemIconSize} />
        </button>
        <span className={cn(typography.h3, "text-foreground flex-1 text-right")}>
          Add Reminder
        </span>
      </motion.div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4 w-full">
        {/* ── Title ──────────────────────────────────────────────────── */}
        <motion.div variants={fab.animation.item} className="flex flex-col gap-1">
          <label className={cn(typography.label, "text-muted-foreground pl-1")}>
            Title
          </label>
          <div className="relative">
            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              required
              placeholder="e.g. Dentist appointment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(inputClass, "pl-11")}
            />
          </div>
        </motion.div>

        {/* ── Date ───────────────────────────────────────────────────── */}
        <motion.div variants={fab.animation.item} className="flex flex-col gap-1">
          <label className={cn(typography.label, "text-muted-foreground pl-1")}>
            Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(inputClass, "pl-11")}
            />
          </div>
        </motion.div>

        {/* ── Time (optional) ────────────────────────────────────────── */}
        <motion.div variants={fab.animation.item} className="flex flex-col gap-1">
          <label className={cn(typography.label, "text-muted-foreground pl-1")}>
            Time{" "}
            <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <div className="relative">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={cn(inputClass, "pl-11")}
            />
          </div>
        </motion.div>

        {/* ── Notes (optional) ───────────────────────────────────────── */}
        <motion.div variants={fab.animation.item} className="flex flex-col gap-1">
          <label className={cn(typography.label, "text-muted-foreground pl-1")}>
            Notes{" "}
            <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <textarea
            rows={3}
            placeholder="Any extra details…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cn(
              inputClass,
              "h-auto py-3 resize-none",
            )}
          />
        </motion.div>

        {/* ── Submit ─────────────────────────────────────────────────── */}
        <motion.div variants={fab.animation.item} className="pt-2">
          <button
            type="submit"
            disabled={!canSubmit || createMutation.isPending}
            className={cn(
              tokens.button.primary,
              "flex items-center justify-center gap-2",
              (!canSubmit || createMutation.isPending) && "opacity-50 pointer-events-none",
            )}
          >
            <Check className="h-4 w-4" />
            {createMutation.isPending ? "Saving…" : "Save Reminder"}
          </button>
        </motion.div>
      </form>
    </motion.div>
  );
};
