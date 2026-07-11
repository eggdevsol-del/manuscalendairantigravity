// @ts-nocheck — preserved dead code, not used in the active codebase
/**
 * ProposalSheet Component
 *
 * Allows artists to send booking proposals to leads/clients.
 * Follows SSOT UI patterns.
 */

import { useState } from "react";
import { FullScreenSheet, SheetHeader, LoadingState } from "../ui/ssot";
import { Calendar, Clock, DollarSign, Send, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ProposalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  leadId?: number;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  projectType?: string;
  estimatedValue?: number;
}

interface DateOption {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

export function ProposalSheet({
  isOpen,
  onClose,
  leadId,
  clientId,
  clientName,
  clientEmail,
  projectType,
  estimatedValue,
}: ProposalSheetProps) {
  const [dateOptions, setDateOptions] = useState<DateOption[]>([
    { id: "1", date: "", startTime: "10:00", endTime: "14:00" },
  ]);
  const [depositAmount, setDepositAmount] = useState<string>(
    estimatedValue ? String(Math.round((estimatedValue / 100) * 0.2)) : "" // 20% default
  );
  const [depositType, setDepositType] = useState<"fixed" | "percentage">(
    "fixed"
  );
  const [notes, setNotes] = useState("");
  const [isSending, setIsSending] = useState(false);

  const sendProposal = trpc.funnel.sendProposal.useMutation();

  const addDateOption = () => {
    if (dateOptions.length >= 3) return;
    setDateOptions([
      ...dateOptions,
      {
        id: String(Date.now()),
        date: "",
        startTime: "10:00",
        endTime: "14:00",
      },
    ]);
  };

  const removeDateOption = (id: string) => {
    if (dateOptions.length <= 1) return;
    setDateOptions(dateOptions.filter(opt => opt.id !== id));
  };

  const updateDateOption = (
    id: string,
    field: keyof DateOption,
    value: string
  ) => {
    setDateOptions(
      dateOptions.map(opt => (opt.id === id ? { ...opt, [field]: value } : opt))
    );
  };

  const handleSend = async () => {
    const validDates = dateOptions.filter(opt => opt.date);
    if (validDates.length === 0) {
      alert("Please add at least one date option");
      return;
    }

    if (!depositAmount || Number(depositAmount) <= 0) {
      alert("Please enter a deposit amount");
      return;
    }

    setIsSending(true);
    try {
      await sendProposal.mutateAsync({
        leadId: leadId || undefined,
        clientId: clientId || undefined,
        dateOptions: validDates.map(opt => ({
          date: opt.date,
          startTime: opt.startTime,
          endTime: opt.endTime,
        })),
        depositAmount: Number(depositAmount) * 100, // Convert to cents
        depositType,
        notes,
      });
      onClose();
    } catch (error) {
      console.error("Failed to send proposal:", error);
      alert("Failed to send proposal. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <FullScreenSheet isOpen={isOpen} onClose={onClose}>
      <SheetHeader title="Send Proposal" onClose={onClose} />

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Client Info */}
        <div className="bg-secondary/50 rounded-2xl p-4">
          <h3 className="text-white font-medium mb-2">Sending to</h3>
          <p className="text-muted-foreground">{clientName}</p>
          {clientEmail && (
            <p className="text-muted-foreground text-sm">{clientEmail}</p>
          )}
          {projectType && (
            <p className="text-muted-foreground text-sm mt-1">
              Project: {projectType.replace(/-/g, " ")}
            </p>
          )}
        </div>

        {/* Date Options */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date Options
            </h3>
            {dateOptions.length < 3 && (
              <button
                onClick={addDateOption}
                className="text-[var(--color-accent-violet)] text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
            )}
          </div>

          <div className="space-y-3">
            {dateOptions.map((option, index) => (
              <div key={option.id} className="bg-secondary/50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-muted-foreground text-sm">
                    Option {index + 1}
                  </span>
                  {dateOptions.length > 1 && (
                    <button
                      onClick={() => removeDateOption(option.id)}
                      className="text-[var(--color-status-danger-text)] p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <input
                  type="date"
                  value={option.date}
                  onChange={e =>
                    updateDateOption(option.id, "date", e.target.value)
                  }
                  className="w-full bg-secondary/50 border-0 rounded-xl px-4 py-3 text-white mb-3"
                />

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-muted-foreground text-xs mb-1 block">
                      Start
                    </label>
                    <input
                      type="time"
                      value={option.startTime}
                      onChange={e =>
                        updateDateOption(option.id, "startTime", e.target.value)
                      }
                      className="w-full bg-secondary/50 border-0 rounded-xl px-4 py-3 text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-muted-foreground text-xs mb-1 block">
                      End
                    </label>
                    <input
                      type="time"
                      value={option.endTime}
                      onChange={e =>
                        updateDateOption(option.id, "endTime", e.target.value)
                      }
                      className="w-full bg-secondary/50 border-0 rounded-xl px-4 py-3 text-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deposit Amount */}
        <div>
          <h3 className="text-white font-medium flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4" />
            Deposit Required
          </h3>

          <div className="bg-secondary/50 rounded-2xl p-4">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setDepositType("fixed")}
                className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                  depositType === "fixed"
                    ? "bg-[var(--color-accent-violet)] text-white"
                    : "bg-secondary/50 text-muted-foreground"
                }`}
              >
                Fixed Amount
              </button>
              <button
                onClick={() => setDepositType("percentage")}
                className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                  depositType === "percentage"
                    ? "bg-[var(--color-accent-violet)] text-white"
                    : "bg-secondary/50 text-muted-foreground"
                }`}
              >
                Percentage
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {depositType === "fixed" ? "$" : ""}
              </span>
              <input
                type="number"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                placeholder={depositType === "fixed" ? "200" : "20"}
                className={`w-full bg-secondary/50 border-0 rounded-xl py-3 text-white ${
                  depositType === "fixed" ? "pl-8 pr-4" : "pl-4 pr-8"
                }`}
              />
              {depositType === "percentage" && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              )}
            </div>

            {estimatedValue &&
              depositType === "percentage" &&
              depositAmount && (
                <p className="text-muted-foreground text-sm mt-2">
                  = $
                  {Math.round(
                    ((estimatedValue / 100) * Number(depositAmount)) / 100
                  )}
                </p>
              )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <h3 className="text-white font-medium mb-3">Additional Notes</h3>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional details for the client..."
            rows={3}
            className="w-full bg-secondary/50 border-0 rounded-2xl px-4 py-3 text-white placeholder:text-muted-foreground resize-none"
          />
        </div>
      </div>

      {/* Send Button */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleSend}
          disabled={isSending}
          className="w-full bg-[var(--color-accent-violet)] text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSending ? (
            <LoadingState size="sm" />
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send Proposal
            </>
          )}
        </button>
      </div>
    </FullScreenSheet>
  );
}

export default ProposalSheet;
