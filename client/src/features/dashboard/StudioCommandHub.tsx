/**
 * StudioCommandHub — Progressive In-Place Studio Extension on Artist Dashboard
 *
 * Provides:
 * 1. Scope Switcher Pill: [ Personal | Studio: <Studio Name> ]
 * 2. Studio Mode Executive View:
 *    - 30D Collective Gross & Live Stripe Escrow Balance with instant payout checkout
 *    - Live Chair Occupancy Spectrum with dynamic working schedule capacity & free hours
 *    - Quick action triggers (Supplies, QLD Audit Pack, Invite Chair)
 * 3. Personal Mode Live Floor Island:
 *    - Compact glassmorphic capsule displaying live active chairs and escrow balance
 */

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/formatMoney";
import { toast } from "sonner";
import {
  Building2,
  ShieldCheck,
  Package,
  UserPlus,
  ArrowRight,
  Sparkles,
  Download,
  CheckCircle2,
} from "lucide-react";
import { InviteArtistModal } from "@/features/studio/InviteArtistModal";

interface StudioCommandHubProps {
  activeScope: "personal" | "studio";
  onScopeChange: (scope: "personal" | "studio") => void;
  onGoToSupplies?: () => void;
}

export function StudioCommandHub({
  activeScope,
  onScopeChange,
  onGoToSupplies,
}: StudioCommandHubProps) {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const { data: myStudio } = trpc.studios.getMyStudio.useQuery();
  const studioId = myStudio?.id || "";

  const { data: dashData } = trpc.studios.getDashboard.useQuery(
    { studioId },
    { enabled: !!studioId }
  );

  const { data: rosterData } = trpc.studios.getRoster.useQuery(
    { studioId },
    { enabled: !!studioId }
  );

  const { data: moneyData } = trpc.studios.getMoney.useQuery(
    { studioId, range: "30d" },
    { enabled: !!studioId }
  );

  const withdrawMutation = trpc.studios.withdraw.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Payout of ${formatMoney(data.amountCents)} initiated to your verified bank account.`
      );
    },
    onError: (err) => {
      toast.error(err.message || "Failed to process withdrawal");
    },
  });

  if (!myStudio) return null;

  const studioName = myStudio.name || "Studio Space";
  const balanceCents = moneyData?.balanceCents ?? myStudio.balanceCents ?? 0;
  const earned30dCents = moneyData?.earnedCents ?? dashData?.stats?.totalEarned30dCents ?? 0;
  const artists = rosterData || [];
  const activeChairs = artists.length;

  const handleWithdraw = () => {
    if (balanceCents <= 0) {
      toast.error("No escrow balance available to withdraw yet");
      return;
    }
    withdrawMutation.mutate({ studioId, amountCents: balanceCents });
  };

  return (
    <div className="w-full space-y-3 mb-2 font-['DM_Sans',system-ui,sans-serif]">
      {/* ── Top Scope Switcher Pill ── */}
      <div className="flex bg-[#1a1a1b] border border-white/10 rounded-full p-1 shadow-sm">
        <button
          onClick={() => onScopeChange("personal")}
          className={`flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeScope === "personal"
              ? "bg-[#323236] text-white shadow-sm"
              : "text-[#9a9aa0] hover:text-white"
          }`}
        >
          <span>👤 Personal</span>
        </button>
        <button
          onClick={() => onScopeChange("studio")}
          className={`flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeScope === "studio"
              ? "bg-gradient-to-r from-[#8a7434]/40 to-[#eec95f]/20 border border-[#eec95f]/50 text-[#eec95f] shadow-sm"
              : "text-[#9a9aa0] hover:text-[#eec95f]"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span className="truncate">🏛️ {studioName}</span>
        </button>
      </div>

      {/* ── When in Personal Scope: Compact Live Floor Island ── */}
      {activeScope === "personal" && (
        <div
          onClick={() => onScopeChange("studio")}
          className="bg-gradient-to-r from-[#1c1c1f] via-[#222226] to-[#1c1c1f] border border-[#eec95f]/30 hover:border-[#eec95f]/60 rounded-2xl p-3 px-4 flex items-center justify-between gap-3 cursor-pointer shadow-md transition-all active:scale-[0.99] group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#57c97e] animate-pulse shrink-0" />
            <span className="text-xs font-medium text-[#c9c9ce] truncate">
              Studio Floor: <strong className="text-white">{activeChairs} chairs active</strong> · {formatMoney(balanceCents, true)} escrow
            </span>
          </div>
          <div className="text-xs font-semibold text-[#eec95f] flex items-center gap-1 shrink-0 group-hover:translate-x-0.5 transition-transform">
            <span>Studio View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* ── When in Studio Scope: Full Executive Hub ── */}
      {activeScope === "studio" && (
        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
          {/* Executive Finances Card */}
          <div className="bg-gradient-to-br from-[#1c1c1f] via-[#242429] to-[#1c1c1f] border border-[#eec95f]/40 rounded-[20px] p-4.5 sm:p-5 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="text-[10px] font-semibold tracking-[1.8px] text-[#9a8a55] uppercase">
                  30-DAY COLLECTIVE REVENUE
                </div>
                <div className="text-2xl font-bold text-[#eec95f] mt-0.5">
                  {formatMoney(earned30dCents, true)}
                </div>
                <div className="text-[11px] text-[#9b9ba1] mt-0.5">
                  Commission cuts + weekly chair rent settlements
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[10px] font-semibold tracking-[1.8px] text-[#9a8a55] uppercase">
                  LIVE ESCROW
                </div>
                <div className="text-xl font-bold text-white mt-0.5">
                  {formatMoney(balanceCents, true)}
                </div>
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawMutation.isPending || balanceCents <= 0}
                  className="mt-2 bg-[#eec95f] hover:bg-[#f6d97e] text-[#1c1503] font-bold text-[11px] px-3 py-1.5 rounded-full transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {withdrawMutation.isPending ? "Processing..." : "Payout Escrow"}
                </button>
              </div>
            </div>

            {/* Quick Action Pills */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-white/10">
              <button
                onClick={() => onGoToSupplies ? onGoToSupplies() : toast.info("Navigate to Supplies tab")}
                className="bg-[#2a2a2e] hover:bg-[#343439] border border-white/5 rounded-xl p-2.5 text-center text-white transition-all flex flex-col items-center gap-1"
              >
                <Package className="w-4 h-4 text-[#eec95f]" />
                <span className="text-[11px] font-semibold">Wholesale Supplies</span>
              </button>

              <button
                onClick={() => toast.success("QLD Form 9 & Consent Audit Package compiled (.ZIP / PDF).")}
                className="bg-[#2a2a2e] hover:bg-[#343439] border border-white/5 rounded-xl p-2.5 text-center text-white transition-all flex flex-col items-center gap-1"
              >
                <ShieldCheck className="w-4 h-4 text-[#57c97e]" />
                <span className="text-[11px] font-semibold">Export QLD Audit</span>
              </button>

              <button
                onClick={() => setInviteModalOpen(true)}
                className="bg-[#2a2a2e] hover:bg-[#343439] border border-white/5 rounded-xl p-2.5 text-center text-white transition-all flex flex-col items-center gap-1"
              >
                <UserPlus className="w-4 h-4 text-[#7b5cf5]" />
                <span className="text-[11px] font-semibold">Invite Chair</span>
              </button>
            </div>
          </div>

          {/* Chair Capacity Spectrum */}
          <div className="bg-[#1a1a1b] border border-white/10 rounded-[20px] p-4.5 shadow-lg">
            <div className="flex justify-between items-baseline mb-3">
              <div className="text-[10.5px] font-semibold tracking-[1.6px] text-[#8d8d93] uppercase">
                RESIDENT CHAIR CAPACITY ({activeChairs} of 10 Chairs Filled)
              </div>
            </div>

            <div className="space-y-3">
              {artists.map((a: any) => {
                const name = a.user?.name || "Resident Artist";
                const initials = name.slice(0, 2).toUpperCase();
                const termsBadge =
                  a.role === "owner"
                    ? "Studio Owner"
                    : a.paymentModel === "commission"
                      ? `${a.commissionPct}% commission`
                      : a.paymentModel === "rent"
                        ? `$${Math.round((a.weeklyChairRentCents || 35000) / 100)}/wk chair`
                        : "Resident";

                return (
                  <div key={a.id} className="bg-[#242427] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#eec95f]/15 border border-[#eec95f]/40 text-[#eec95f] font-bold text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{name}</div>
                          <div className="text-[11px] text-[#9b9ba1] truncate">{a.specialties || "Custom"}</div>
                        </div>
                      </div>

                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-[#c9c9ce] shrink-0">
                        {termsBadge}
                      </span>
                    </div>

                    {/* Utilization Bar */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[#353539] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#eec95f] to-[#f6d97e] rounded-full transition-all duration-300"
                          style={{ width: `${a.utilizationPct ?? 0}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-[#eec95f] shrink-0">
                        {a.utilizationPct ?? 0}%
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-1 text-[10.5px] text-[#9b9ba1]">
                      <span>{a.bookedHours ?? 0}h scheduled ({a.completedBookingsCount || 0} completed)</span>
                      <span className="text-[#57c97e] font-medium">{a.freeHours ?? 0}h open capacity</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <InviteArtistModal
          studioId={studioId}
          open={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
        />
      )}
    </div>
  );
}
