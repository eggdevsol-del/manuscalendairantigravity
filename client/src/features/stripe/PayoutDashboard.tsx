import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Banknote, Clock, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";
import { useState } from "react";
import { useLocation } from "wouter";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

export function PayoutDashboard() {
  const [, setLocation] = useLocation();
  const { data, isLoading, refetch } = trpc.artistSettings.getPayoutSchedule.useQuery();
  const updateSchedule = trpc.artistSettings.updatePayoutSchedule.useMutation();
  const [editing, setEditing] = useState(false);
  const [interval, setInterval] = useState<string>("daily");
  const [anchor, setAnchor] = useState<string>("monday");

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading payout info...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-6">
        <p className="text-sm text-muted-foreground">No payout information available.</p>
      </div>
    );
  }

  const handleSaveSchedule = async () => {
    try {
      await updateSchedule.mutateAsync({
        interval: interval as any,
        weeklyAnchor: interval === "weekly" ? anchor : undefined,
        monthlyAnchor: interval === "monthly" ? 1 : undefined,
      });
      toast.success("Payout schedule updated!");
      setEditing(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to update schedule.");
    }
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const selectClass = "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-[#E09F3E]/50 appearance-none";

  return (
    <div className="space-y-5">
      {/* Status Banner */}
      {data.pendingVerification && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-400 font-semibold">ID Verification Pending</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Your identity document is being reviewed. Payouts will be enabled once verified (usually within minutes).</p>
          </div>
        </div>
      )}

      {/* Status Card */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${data.payoutsEnabled ? "bg-emerald-500/20 border border-emerald-500/40" : "bg-amber-500/20 border border-amber-500/40"}`}>
            <Banknote className={`w-5 h-5 ${data.payoutsEnabled ? "text-emerald-400" : "text-amber-400"}`} />
          </div>
          <div>
            <h3 className="font-bold text-foreground">{data.payoutsEnabled ? "Payouts Active" : "Payouts Pending"}</h3>
            <p className="text-xs text-muted-foreground">{data.payoutsEnabled ? "Deposits are paid out automatically" : "Waiting for ID verification"}</p>
          </div>
        </div>

        {/* Bank Info */}
        {data.bankLast4 && (
          <div className="flex justify-between items-center py-2 border-t border-white/5">
            <span className="text-xs text-muted-foreground">Bank Account</span>
            <span className="text-sm text-foreground font-medium">
              {data.bankName ? `${data.bankName} ` : ""}••••{data.bankLast4}
            </span>
          </div>
        )}

        {/* Balance */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Available</p>
            <p className="text-lg font-bold text-emerald-400">{formatCents(data.availableBalance)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Pending</p>
            <p className="text-lg font-bold text-foreground">{formatCents(data.pendingBalance)}</p>
          </div>
        </div>
      </div>

      {/* Payout Schedule */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-foreground text-sm">Payout Schedule</h3>
              <p className="text-xs text-muted-foreground capitalize">
                {data.interval}{data.interval === "weekly" ? ` (${data.weeklyAnchor})` : ""} — {data.delayDays}-day delay
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setInterval(data.interval); setEditing(!editing); }} className="text-xs">
            {editing ? "Cancel" : "Change"}
          </Button>
        </div>

        {editing && (
          <div className="space-y-3 pt-2 border-t border-white/5">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Frequency</label>
              <select className={selectClass} value={interval} onChange={e => setInterval(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly (1st of month)</option>
              </select>
            </div>
            {interval === "weekly" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Day</label>
                <select className={selectClass} value={anchor} onChange={e => setAnchor(e.target.value)}>
                  {DAYS.map(d => <option key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
            )}
            <Button onClick={handleSaveSchedule} disabled={updateSchedule.isPending} className="w-full bg-[#E09F3E]/75 text-white hover:bg-[#E09F3E]">
              {updateSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Schedule"}
            </Button>
          </div>
        )}
      </div>

      {/* Payout History Link */}
      <button onClick={() => setLocation("/payout-history")} className="w-full flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-2xl p-4 hover:bg-white/[0.05] transition-colors">
        <span className="text-sm font-medium text-foreground">Payout History</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}
