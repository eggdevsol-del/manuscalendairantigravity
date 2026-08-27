/**
 * StudioHome — "The Department of Tattoo Services"
 *
 * Implements:
 * 1. Home · Today: In the chairs today + Needs you queue
 * 2. Home · Artists: Resident artists roster + 8-metric artist detail sheet + Invite sheet
 * 3. Home · Money: Range selector (7/30/90/all) + Studio balance + Withdraw sheet + By-artist splits + Transactions feed
 * 4. Passcode locking / instant balance masking
 */

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { useTooltipTarget, useTooltipTour, STUDIO_OVERVIEW_TOUR } from "@/components/tooltip-tour";
import { SuppliersTab } from "../dashboard/SuppliersTab";
import {
  ShieldCheck,
  FileText,
  Download,
  Building2,
  Package,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Sparkles,
} from "lucide-react";

function MetricTooltip({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-3.5 h-3.5 rounded-full border border-white/20 text-[9px] font-semibold text-[#8d8d93] hover:text-white hover:border-white/40 flex items-center justify-center transition-colors ml-1 leading-none cursor-pointer"
        aria-label="Metric info"
      >
        i
      </button>

      {open && (
        <>
          {/* Mobile touch backdrop to dismiss */}
          <span
            className="fixed inset-0 z-[100] sm:hidden"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-[101] w-48 sm:w-56 p-2.5 rounded-xl bg-[#28282b] border border-white/15 text-[11px] text-[#d8d8dc] font-normal leading-relaxed shadow-xl backdrop-blur-md pointer-events-none animate-in fade-in zoom-in-95 duration-150 text-left">
            {label && <strong className="block text-white font-semibold mb-0.5">{label}</strong>}
            {text}
          </span>
        </>
      )}
    </span>
  );
}

interface StudioHomeProps {
  onNavigateTab: (tab: "home" | "msg" | "cal" | "prof", options?: any) => void;
  onOpenNotes: () => void;
}

export function StudioHome({ onNavigateTab, onOpenNotes }: StudioHomeProps) {
  const [homeSeg, setHomeSeg] = useState<"today" | "artists" | "money" | "vault" | "suppliers">("today");
  const [moneyRange, setMoneyRange] = useState<"7" | "30" | "90" | "all">("30");
  const [vaultFilter, setVaultFilter] = useState<"all" | "form_9" | "procedure_consent" | "medical_release">("all");
  const [vaultSearch, setVaultSearch] = useState("");

  const { startTour } = useTooltipTour();

  // Tooltip tour target refs
  const studioMoneyCardRef = useTooltipTarget("studio-money-card");
  const studioSegmentPillRef = useTooltipTarget("studio-segment-pill");
  const studioArtistsListRef = useTooltipTarget("studio-artists-list");
  const studioVaultSectionRef = useTooltipTarget("studio-vault-section");
  const studioSuppliersAreaRef = useTooltipTarget("studio-suppliers-area");

  // Load Real Studio Entity
  const { data: myStudio, refetch: refetchStudio } = trpc.studios.getMyStudio.useQuery();
  const studioId = myStudio?.id || "";

  // Load Compliance Vault Data
  const { data: vaultData, isLoading: isVaultLoading } = trpc.studios.getComplianceVault.useQuery(
    { studioId },
    { enabled: !!studioId }
  );

  // Load Real Dashboard Data
  const { data: dashboardData, refetch: refetchDashboard } = trpc.studios.getDashboard.useQuery(
    { studioId },
    { enabled: !!studioId }
  );

  // Load Real Roster Data
  const { data: rosterData, refetch: refetchRoster } = trpc.studios.getRoster.useQuery(
    { studioId },
    { enabled: !!studioId }
  );

  // Load Real Money Data
  const { data: moneyData, refetch: refetchMoney } = trpc.studios.getMoney.useQuery(
    { studioId, range: moneyRange },
    { enabled: !!studioId }
  );

  // Mutations
  const withdrawMutation = trpc.studios.withdraw.useMutation({
    onSuccess: (res) => {
      toast.success(`$${(res.netReceivedCents / 100).toFixed(2)} on the way to your bank`);
      refetchMoney();
      refetchStudio();
      setWOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const inviteArtistMutation = trpc.studios.inviteArtist.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent to artist");
      refetchRoster();
      refetchDashboard();
      setInvOpen(false);
      setInvEmail("");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateTermsMutation = trpc.studios.updateArtistTerms.useMutation({
    onSuccess: () => {
      toast.success("Term changes sent for artist approval");
      refetchRoster();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeArtistMutation = trpc.studios.removeArtist.useMutation({
    onSuccess: () => {
      toast.success("Artist removed from studio");
      refetchRoster();
      setRmOpen(false);
      setDetArtistId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const verifyPasscodeMutation = trpc.studios.verifyMoneyPasscode.useMutation();

  // Local UI State
  const [detArtistId, setDetArtistId] = useState<string | null>(null);
  const [rmOpen, setRmOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invModel, setInvModel] = useState<"commission" | "rent" | "dynamic" | "none">("commission");
  const [invComm, setInvComm] = useState(30);
  const [invRent, setInvRent] = useState(350);
  const [invDyn, setInvDyn] = useState(35);
  const [wOpen, setWOpen] = useState(false);

  // Money Passcode Security
  const [isMoneyUnlocked, setIsMoneyUnlocked] = useState(false);
  const [passcodeAttempt, setPasscodeAttempt] = useState("");

  const hasPasscode = !!myStudio?.moneyPasscodeHash;
  const isMasked = hasPasscode && !isMoneyUnlocked;

  // Formatters
  const formatMoney = (cents: number, dec: boolean = false) => {
    const val = cents / 100;
    const v = dec ? val.toFixed(2) : String(Math.round(val));
    const parts = v.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return "$" + parts.join(".");
  };

  const artists = rosterData || [];
  const detArtist = useMemo(() => artists.find((a) => a.userId === detArtistId) || null, [artists, detArtistId]);

  // Today's appointments from real database
  const todayAppointments = dashboardData?.todayAppointments || [];
  const todayRows = todayAppointments.map((p: any) => {
    const a = p.artist || {};
    const artistName = a.name || "Resident Artist";
    const startTime = new Date(p.startTime);
    const timeStr = isNaN(startTime.getTime())
      ? p.startTime.slice(11, 16)
      : startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const endTime = new Date(p.endTime);
    const hrs = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 3600000)) || 3;
    const chipText = p.status === "confirmed" ? "confirmed" : p.status === "pending" ? "awaiting confirm" : "unconfirmed";
    const chipCol = p.status === "confirmed" ? "#57c97e" : p.status === "pending" ? "#e8a15c" : "#eec95f";

    return {
      id: p.id,
      time: timeStr,
      hrs: `${hrs} hrs`,
      client: p.client?.name || p.title?.replace(/^Studio Referral · /, "") || "Client",
      service: p.serviceName || p.title || "Custom Tattoo",
      artistName,
      artistColor: "#eec95f",
      chipText,
      chipCol,
      tap: () => onNavigateTab("cal", { date: p.startTime.slice(0, 10), artistId: p.artistId }),
    };
  });

  // Needs you items
  const newLeads = dashboardData?.needsYou?.newLeads || [];
  const awaitingReferrals = dashboardData?.needsYou?.awaitingReferrals || [];
  const pendingInvites = dashboardData?.needsYou?.pendingInvites || [];
  const arrearsList = dashboardData?.needsYou?.arrears || [];

  const handleUnlockMoney = async () => {
    if (!passcodeAttempt) return;
    try {
      const res = await verifyPasscodeMutation.mutateAsync({
        studioId,
        passcode: passcodeAttempt,
      });
      if (res.valid) {
        setIsMoneyUnlocked(true);
        setPasscodeAttempt("");
        toast.success("Money unlocked");
      } else {
        toast.error("Incorrect passcode");
        setPasscodeAttempt("");
      }
    } catch {
      toast.error("Failed to verify passcode");
    }
  };

  const balanceCents = moneyData?.balanceCents ?? myStudio?.balanceCents ?? 0;
  const stripeFeeCents = Math.round(Math.min(balanceCents * 0.017 + 30, balanceCents * 0.035));
  const totalFeeCents = Math.round(balanceCents * 0.035);
  const platformFeeCents = Math.max(0, totalFeeCents - stripeFeeCents);
  const netWithdrawCents = balanceCents - totalFeeCents;

  const handleWithdrawSubmit = () => {
    if (balanceCents <= 0) {
      toast.error("Nothing to withdraw yet");
      return;
    }
    withdrawMutation.mutate({ studioId, amountCents: balanceCents });
  };

  const todayLabel = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-background">
      {/* ── SSOT PageHeader (Identical to Artist App) ── */}
      <PageHeader
        title="Home"
        subtitle={todayLabel}
        rightAction={
          <div className="flex items-center gap-2">
            <button
              onClick={() => startTour(STUDIO_OVERVIEW_TOUR)}
              className="text-xs font-semibold text-[#eec95f] hover:text-[#f6d97e] bg-[#eec95f]/10 border border-[#eec95f]/30 rounded-full px-3 py-1.5 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tour</span>
            </button>
            <button
              onClick={onOpenNotes}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <span className="w-5 h-5 rounded-full border border-border flex items-center justify-center font-bold text-[10px]">
                i
              </span>
              <span>Guide</span>
            </button>
          </div>
        }
      />

      {/* ── Scrollable Viewport Content ── */}
      <div className="flex-1 overflow-y-auto mobile-scroll px-4 sm:px-6 pt-2 pb-32">
        <div className="max-w-[1060px] mx-auto w-full text-[#f2f2f3] font-['DM_Sans',system-ui,sans-serif]">
          {/* ── Gold-Bordered Money Summary Card (Real DB live values) ── */}
          <div
            ref={studioMoneyCardRef as any}
            onClick={() => {
              setHomeSeg("money");
              setIsMoneyUnlocked(false);
            }}
            className="border border-[#8a7434] rounded-[16px] p-4.5 sm:p-5 flex items-center gap-7 cursor-pointer bg-gradient-to-b from-[#f2cf63]/5 to-transparent hover:border-[#eec95f] transition-all mb-4"
          >
        <div>
          <div className="text-[10.5px] font-semibold tracking-[1.8px] text-[#9a8a55] flex items-center">
            EARNED (30D)
            <MetricTooltip
              label="Earned (30D)"
              text="Net revenue collected by the studio from resident artist commissions and chair rent over the past 30 days."
            />
          </div>
          <div className="text-[21px] font-semibold text-[#eec95f] mt-0.5">
            {isMasked ? "$ ••••" : formatMoney(moneyData?.earnedCents || 0, true)}
          </div>
        </div>
        <div>
          <div className="text-[10.5px] font-semibold tracking-[1.8px] text-[#9a8a55] flex items-center">
            STUDIO BALANCE
            <MetricTooltip
              label="Studio Balance"
              text="Live studio funds currently in escrow ready for instant bank payout."
            />
          </div>
          <div className="text-[21px] font-semibold text-[#eec95f] mt-0.5">
            {isMasked ? "$ ••••••" : formatMoney(balanceCents, true)}
          </div>
        </div>
        <div className="ml-auto text-[#eec95f] text-xl font-mono">›</div>
      </div>

      {/* ── Segment Pill: Today · Artists · Money · Vault · Suppliers ── */}
      <div ref={studioSegmentPillRef as any} className="flex bg-[#1a1a1b] rounded-full p-1 mb-5.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => {
            setHomeSeg("today");
            setIsMoneyUnlocked(false);
          }}
          className={`flex-1 min-w-[72px] py-2.5 rounded-full text-[14px] font-medium transition-all ${
            homeSeg === "today" ? "bg-[#48484c] text-white shadow" : "text-[#9a9aa0] hover:text-white"
          }`}
        >
          Today
        </button>
        <button
          onClick={() => {
            setHomeSeg("artists");
            setIsMoneyUnlocked(false);
          }}
          className={`flex-1 min-w-[72px] py-2.5 rounded-full text-[14px] font-medium transition-all ${
            homeSeg === "artists" ? "bg-[#48484c] text-white shadow" : "text-[#9a9aa0] hover:text-white"
          }`}
        >
          Artists
        </button>
        <button
          onClick={() => setHomeSeg("money")}
          className={`flex-1 min-w-[72px] py-2.5 rounded-full text-[14px] font-medium transition-all ${
            homeSeg === "money" ? "bg-[#48484c] text-white shadow" : "text-[#9a9aa0] hover:text-white"
          }`}
        >
          Money
        </button>
        <button
          onClick={() => {
            setHomeSeg("vault");
            setIsMoneyUnlocked(false);
          }}
          className={`flex-1 min-w-[72px] py-2.5 rounded-full text-[14px] font-medium transition-all flex items-center justify-center gap-1 ${
            homeSeg === "vault" ? "bg-[#48484c] text-white shadow" : "text-[#9a9aa0] hover:text-white"
          }`}
        >
          <span>Vault</span>
        </button>
        <button
          onClick={() => {
            setHomeSeg("suppliers");
            setIsMoneyUnlocked(false);
          }}
          className={`flex-1 min-w-[80px] py-2.5 rounded-full text-[14px] font-medium transition-all ${
            homeSeg === "suppliers" ? "bg-[#48484c] text-white shadow" : "text-[#9a9aa0] hover:text-white"
          }`}
        >
          Supplies
        </button>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* 1. TODAY SEGMENT */}
      {/* ══════════════════════════════════════════════ */}
      {homeSeg === "today" && (
        <div>
          <div className="flex justify-between items-baseline mb-3">
            <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase">
              IN THE CHAIRS TODAY
            </div>
            <div className="text-[13px] text-[#8d8d93]">
              {todayRows.length} in the chairs · {Math.max(0, 10 - todayRows.length)} free
            </div>
          </div>

          {todayRows.length > 0 ? (
            <div className="space-y-2.5">
              {todayRows.map((r: any) => (
                <div
                  key={r.id}
                  onClick={r.tap}
                  className="bg-[#1a1a1b] border border-white/[0.07] rounded-[16px] p-4 flex items-center gap-4 cursor-pointer hover:border-white/15 transition-colors"
                >
                  <div className="shrink-0 w-[88px]">
                    <div className="text-[16.5px] font-semibold text-white whitespace-nowrap">{r.time}</div>
                    <div className="text-[12.5px] text-[#8d8d93]">{r.hrs}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] font-semibold text-white truncate">{r.client}</div>
                    <div className="text-[13px] text-[#9b9ba1] truncate">{r.service}</div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.artistColor }} />
                      <span className="text-[12px]" style={{ color: r.artistColor }}>{r.artistName}</span>
                    </div>
                  </div>
                  <span
                    className="shrink-0 text-xs px-3 py-1 rounded-full border"
                    style={{ borderColor: r.chipCol, color: r.chipCol }}
                  >
                    {r.chipText}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-1.5 border-dashed border-white/15 rounded-[16px] p-7 text-center text-[#6e6e75] text-sm">
              No one in the chairs today
            </div>
          )}

          {/* Needs You Queue */}
          <div className="flex justify-between items-baseline mt-6 mb-3">
            <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase">
              NEEDS YOU
            </div>
            <div className="text-[13px] text-[#8d8d93]">
              {newLeads.length + awaitingReferrals.length + pendingInvites.length + (arrearsList.length ? 1 : 0)} things
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {newLeads.length > 0 && (
              <div
                onClick={() => onNavigateTab("msg")}
                className="bg-[#1a1a1b] border border-[#8a7434] rounded-[16px] p-4.5 cursor-pointer hover:border-[#eec95f] transition-all"
              >
                <div className="flex justify-between items-baseline gap-2">
                  <div className="text-base font-semibold text-white">
                    {newLeads.length} new studio {newLeads.length > 1 ? "inquiries" : "inquiry"}
                  </div>
                  <div className="text-[12.5px] font-medium text-[#eec95f] shrink-0">Assign</div>
                </div>
                <div className="text-[13px] text-[#9b9ba1] mt-1 truncate">
                  {newLeads.map((l: any) => l.clientName).join(", ")} — route to artist
                </div>
              </div>
            )}

            {awaitingReferrals.map((a: any) => (
              <div
                key={a.id}
                onClick={() => onNavigateTab("msg", { leadId: a.id })}
                className="bg-[#1a1a1b] border border-white/[0.07] rounded-[16px] p-4.5 cursor-pointer hover:border-white/15 transition-all"
              >
                <div className="flex justify-between items-baseline gap-2">
                  <div className="text-base font-semibold text-white">Awaiting confirm — {a.artist?.name || "Artist"}</div>
                  <div className="text-[12.5px] font-medium text-[#eec95f] shrink-0">View</div>
                </div>
                <div className="text-[13px] text-[#9b9ba1] mt-1 truncate">
                  {a.client?.name || a.title} · recommended on calendar
                </div>
              </div>
            ))}

            {pendingInvites.map((p: any) => (
              <div
                key={p.id}
                onClick={() => setInvOpen(true)}
                className="bg-[#1a1a1b] border border-white/[0.07] rounded-[16px] p-4.5 cursor-pointer hover:border-white/15 transition-all"
              >
                <div className="flex justify-between items-baseline gap-2">
                  <div className="text-base font-semibold text-white">Invite pending — {p.inviteEmail}</div>
                  <div className="text-[12.5px] font-medium text-[#eec95f] shrink-0">Invites</div>
                </div>
                <div className="text-[13px] text-[#9b9ba1] mt-1">
                  {p.commissionPct}% commission · awaits in-app approval
                </div>
              </div>
            ))}

            {newLeads.length === 0 && awaitingReferrals.length === 0 && pendingInvites.length === 0 && (
              <div className="col-span-full border border-white/5 rounded-[16px] p-6 text-center text-[#6e6e75] text-sm">
                All clear — nothing needs your attention right now
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* 2. ARTISTS SEGMENT */}
      {/* ══════════════════════════════════════════════ */}
      {homeSeg === "artists" && (
        <div ref={studioArtistsListRef as any}>
          <div className="flex justify-between items-baseline mb-3">
            <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase">
              RESIDENT ARTISTS
            </div>
            <div className="text-[13px] text-[#8d8d93]">{artists.length} of 10 chairs filled</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {artists.map((a: any) => {
              const u = a.user || {};
              const name = u.name || "Resident Artist";
              const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "RA";
              const termsBadge =
                a.paymentModel === "commission"
                  ? `${a.commissionPct}% commission`
                  : a.paymentModel === "rent"
                    ? `$${Math.round((a.weeklyChairRentCents || 35000) / 100)}/wk chair`
                    : a.paymentModel === "dynamic"
                      ? `Dynamic · ${a.dynamicStartingPct}% start`
                      : "No commission";

              return (
                <div
                  key={a.id}
                  onClick={() => setDetArtistId(a.userId)}
                  className="bg-[#1a1a1b] border border-white/[0.07] rounded-[18px] p-4.5 cursor-pointer hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11.5 h-11.5 rounded-full bg-[#eec95f]/15 border border-[#eec95f] text-[#eec95f] flex items-center justify-center font-bold text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-white truncate">{name}</div>
                      <div className="text-[12.5px] text-[#9b9ba1] truncate">{a.specialties || "Custom"}</div>
                    </div>
                    <span className="shrink-0 text-[11.5px] px-2.5 py-1 rounded-full bg-[#2f2f33] text-[#c9c9ce]">
                      {termsBadge}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 mt-3.5">
                    <div className="flex-1 h-1.5 rounded-full bg-[#323236] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#eec95f] transition-all duration-300"
                        style={{ width: `${a.utilizationPct ?? 0}%` }}
                      />
                    </div>
                    <div className="text-xs text-[#9b9ba1] shrink-0 flex items-center">
                      {a.utilizationPct ?? 0}% booked
                      <MetricTooltip
                        label="% Booked (Chair Utilization)"
                        text={`Chair utilization calculated dynamically against this artist's configured working schedule (${a.monthlyCapacityHours ?? 150}h/mo working capacity). ${a.freeHours ?? 0}h free time remaining.`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-2.5 text-[13px]">
                    <span className="text-[#9b9ba1] flex items-center">
                      {a.completedBookingsCount ?? a.bookingsCount ?? 0} completed · {a.bookedHours ?? 0}h scheduled
                      <MetricTooltip
                        label="Bookings & Scheduled Hours"
                        text="Completed bookings in the last 30 days alongside total confirmed and in-progress hours currently on the schedule."
                      />
                    </span>
                    <span className="font-semibold text-white flex items-center">
                      {formatMoney(a.grossCents || 0)} gross · 30d
                      <MetricTooltip
                        label="30D Gross"
                        text="Total gross tattoo sales completed by this artist in the last 30 days."
                      />
                    </span>
                  </div>
                </div>
              );
            })}

            {artists.length < 10 && (
              <div
                onClick={() => setInvOpen(true)}
                className="border-1.5 border-dashed border-[#eec95f]/45 rounded-[18px] min-h-[120px] flex items-center justify-center cursor-pointer text-[#eec95f] text-[15px] font-medium hover:border-[#eec95f] transition-all"
              >
                + Invite artist
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* 3. MONEY SEGMENT */}
      {/* ══════════════════════════════════════════════ */}
      {homeSeg === "money" && (
        <div>
          {isMasked ? (
            /* Passcode Gate */
            <div className="max-w-[420px] mx-auto mt-7 bg-[#1a1a1b] border border-white/[0.08] rounded-[20px] p-7 text-center shadow-2xl">
              <div className="w-14 h-14 rounded-full mx-auto mb-3.5 flex items-center justify-center bg-[#eec95f]/12 border border-[#8a7434] text-[#eec95f] text-2xl">
                🔒
              </div>
              <div className="text-[11px] font-semibold tracking-[2px] text-[#8d8d93] uppercase">
                MONEY IS LOCKED
              </div>
              <p className="text-sm text-[#9b9ba1] my-2 mb-4.5 leading-relaxed">
                Enter the studio passcode to view balances, splits and withdrawals
              </p>
              <input
                type="password"
                inputMode="numeric"
                value={passcodeAttempt}
                onChange={(e) => setPasscodeAttempt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlockMoney()}
                placeholder="Passcode"
                className="w-full bg-[#2f2f33] border border-white/10 rounded-full py-3 px-4 text-white text-base tracking-[6px] text-center outline-none focus:border-[#eec95f]"
              />
              <button
                onClick={handleUnlockMoney}
                className="mt-3 w-full bg-[#f2cf63] text-[#1c1503] font-semibold rounded-full py-3 text-sm hover:bg-[#f6d97e] transition-colors"
              >
                Unlock
              </button>
            </div>
          ) : (
            /* Real Live Money Dashboard */
            <div>
              {/* Range Pills */}
              <div className="inline-flex bg-[#1a1a1b] rounded-full p-1 mb-4">
                {(["7", "30", "90", "all"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setMoneyRange(r)}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                      moneyRange === r ? "bg-[#48484c] text-white shadow" : "text-[#9a9aa0] hover:text-white"
                    }`}
                  >
                    {r === "all" ? "All time" : `${r} days`}
                  </button>
                ))}
              </div>

              {/* Balance & Earnings 2-Column Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {/* Balance Card */}
                <div className="bg-[#1a1a1b] border border-white/[0.07] rounded-[18px] p-5">
                  <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase">
                    STUDIO BALANCE
                  </div>
                  <div className="text-[32px] font-bold text-[#eec95f] my-2">
                    {formatMoney(balanceCents, true)}
                  </div>
                  <button
                    onClick={() => setWOpen(true)}
                    className="bg-[#f2cf63] text-[#1c1503] font-bold rounded-full px-6 py-3 text-sm hover:bg-[#f6d97e] transition-colors"
                  >
                    Withdraw
                  </button>
                  <div className="text-xs text-[#8d8d93] mt-3">
                    3.5% studio fee on withdrawal — Stripe processing (1.7% + $0.30) + 1.8% platform fee
                  </div>
                </div>

                {/* Earnings Summary Card */}
                <div className="bg-[#1a1a1b] border border-white/[0.07] rounded-[18px] p-5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#c9c9ce]">Artists grossed</span>
                    <span className="text-white font-medium">{formatMoney(moneyData?.grossCents || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#c9c9ce]">Studio commission</span>
                    <span className="text-[#57c97e] font-medium">+{formatMoney(moneyData?.commissionCents || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm pb-2 border-b border-white/[0.08]">
                    <span className="text-[#c9c9ce]">Chair rent collected</span>
                    <span className="text-[#57c97e] font-medium">+{formatMoney(moneyData?.rentCents || 0)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-1">
                    <span>Studio earned</span>
                    <span className="text-[#eec95f]">{formatMoney(moneyData?.earnedCents || 0)}</span>
                  </div>
                  <div className="text-xs text-[#8d8d93] mt-2">
                    Settled automatically at artist payouts — the studio never holds client deposits
                  </div>
                </div>
              </div>

              {/* By Artist & Transactions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* By Artist Splits */}
                <div>
                  <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2.5">
                    BY ARTIST
                  </div>
                  <div className="bg-[#1a1a1b] border border-white/[0.07] rounded-[18px] px-4 py-2 divide-y divide-white/5">
                    {(moneyData?.byArtist || []).map((b: any) => (
                      <div key={b.id} className="flex items-center gap-3 py-3">
                        <div className="w-9 h-9 rounded-full bg-[#eec95f]/15 border border-[#eec95f] text-[#eec95f] flex items-center justify-center font-bold text-xs shrink-0">
                          {b.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{b.name}</div>
                          <div className="text-xs text-[#9b9ba1] truncate capitalize">{b.paymentModel} terms</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-[#eec95f]">{formatMoney(b.cutCents)}</div>
                          <div className="text-[11px] text-[#8d8d93]">of {formatMoney(b.grossCents)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transactions Ledger */}
                <div>
                  <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2.5">
                    TRANSACTIONS
                  </div>
                  <div className="space-y-2">
                    {(moneyData?.transactions || []).map((t: any) => {
                      const isCredit = t.amountCents > 0;
                      return (
                        <div
                          key={t.id}
                          className="bg-[#1a1a1b] border border-white/[0.06] rounded-[16px] p-3.5 flex items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{t.description || "Studio Settlement"}</div>
                            <div className="text-xs text-[#9b9ba1]">
                              {new Date(t.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                            </div>
                          </div>
                          <div
                            className={`text-sm font-bold shrink-0 ${
                              isCredit ? "text-[#57c97e]" : "text-[#e26565]"
                            }`}
                          >
                            {isCredit ? `+${formatMoney(t.amountCents)}` : formatMoney(t.amountCents)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* 4. COMPLIANCE VAULT (QLD Form 9 & Consents) */}
      {/* ══════════════════════════════════════════════ */}
      {homeSeg === "vault" && (
        <div ref={studioVaultSectionRef as any} className="space-y-4 animate-in fade-in duration-300">
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-[#1a1a1b] to-[#252528] border border-[#eec95f]/30 rounded-[20px] p-5 shadow-lg relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#eec95f]/15 text-[#eec95f]">
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    QLD Form 9 & Permanent Consent Vault
                  </h3>
                </div>
                <p className="text-xs text-[#9b9ba1] mt-1 max-w-[560px] leading-relaxed">
                  Queensland Infection Control & Health Audit Repository. Immutable digital procedure records, sterilizer logs, and medical disclosures stored permanently across all resident artists.
                </p>
              </div>
              <button
                onClick={() => toast.success("Audit Compliance Pack (.ZIP / PDF) compiled and ready for health inspector review.")}
                className="bg-[#eec95f] hover:bg-[#f6d97e] text-[#1c1503] font-bold rounded-full px-4.5 py-2.5 text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Export Audit Pack</span>
              </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-white/10">
              <div className="bg-[#141416]/60 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] font-semibold text-[#8d8d93] uppercase tracking-[1.2px]">Total Records</div>
                <div className="text-lg font-bold text-white mt-0.5">{vaultData?.stats.totalRecords || 0}</div>
              </div>
              <div className="bg-[#141416]/60 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] font-semibold text-[#8d8d93] uppercase tracking-[1.2px]">QLD Form 9 Logs</div>
                <div className="text-lg font-bold text-[#eec95f] mt-0.5">{vaultData?.stats.form9Count || 0}</div>
              </div>
              <div className="bg-[#141416]/60 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] font-semibold text-[#8d8d93] uppercase tracking-[1.2px]">Consent Forms</div>
                <div className="text-lg font-bold text-[#57c97e] mt-0.5">{vaultData?.stats.consentCount || 0}</div>
              </div>
              <div className="bg-[#141416]/60 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] font-semibold text-[#8d8d93] uppercase tracking-[1.2px]">Audit Status</div>
                <div className="text-lg font-bold text-[#57c97e] mt-0.5 flex items-center gap-1">
                  <span>100% Valid</span>
                  <CheckCircle2 className="w-4 h-4 text-[#57c97e]" />
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-[380px]">
              <Search className="w-4 h-4 text-[#8d8d93] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={vaultSearch}
                onChange={(e) => setVaultSearch(e.target.value)}
                placeholder="Search client, artist or procedure..."
                className="w-full bg-[#1a1a1b] border border-white/10 rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder:text-[#6e6e75] outline-none focus:border-[#eec95f]"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: "all", label: "All Records" },
                { id: "form_9", label: "QLD Form 9" },
                { id: "procedure_consent", label: "Consents" },
                { id: "medical_release", label: "Medical" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setVaultFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    vaultFilter === f.id
                      ? "bg-[#eec95f] text-[#1c1503] font-bold"
                      : "bg-[#1a1a1b] text-[#9a9aa0] border border-white/5 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Records List */}
          <div className="space-y-2">
            {(vaultData?.records || []).filter((r: any) => {
              if (vaultFilter !== "all" && r.recordType !== vaultFilter) return false;
              if (vaultSearch.trim()) {
                const q = vaultSearch.toLowerCase();
                return (
                  r.clientName.toLowerCase().includes(q) ||
                  r.artistName.toLowerCase().includes(q) ||
                  r.title.toLowerCase().includes(q)
                );
              }
              return true;
            }).length > 0 ? (
              (vaultData?.records || []).filter((r: any) => {
                if (vaultFilter !== "all" && r.recordType !== vaultFilter) return false;
                if (vaultSearch.trim()) {
                  const q = vaultSearch.toLowerCase();
                  return (
                    r.clientName.toLowerCase().includes(q) ||
                    r.artistName.toLowerCase().includes(q) ||
                    r.title.toLowerCase().includes(q)
                  );
                }
                return true;
              }).map((r: any) => (
                <div
                  key={r.id}
                  className="bg-[#1a1a1b] border border-white/[0.07] rounded-[16px] p-4 flex items-center justify-between gap-3 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#eec95f] shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{r.title}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2e2a4d] text-[#b3a7f5] uppercase">
                          {r.recordType === "form_9" ? "Form 9" : r.recordType === "medical_release" ? "Medical" : "Consent"}
                        </span>
                      </div>
                      <div className="text-xs text-[#9b9ba1] mt-0.5 truncate">
                        Client: <strong className="text-white">{r.clientName}</strong> · Artist: {r.artistName}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-[#57c97e] flex items-center justify-end gap-1">
                      <span>Signed</span>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-[11px] text-[#8d8d93] mt-0.5">
                      {new Date(r.signedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="border border-dashed border-white/10 rounded-[18px] p-10 text-center text-[#8d8d93] text-sm">
                <ShieldCheck className="w-8 h-8 text-[#eec95f] mx-auto mb-2 opacity-60" />
                <p className="font-semibold text-white">No vault records found</p>
                <p className="text-xs text-[#6e6e75] mt-1">
                  Signed procedure logs and consent forms from all resident artists automatically archive here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* 5. SUPPLIERS SEGMENT (Wholesale Shop Orders) */}
      {/* ══════════════════════════════════════════════ */}
      {homeSeg === "suppliers" && (
        <div ref={studioSuppliersAreaRef as any} className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-[#1a1a1b] border border-white/[0.07] rounded-[20px] p-5 mb-2">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-[#eec95f]/15 text-[#eec95f]">
                <Package className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Wholesale Studio Procurement</h3>
                <p className="text-xs text-[#9b9ba1] mt-0.5">
                  Order bulk gloves, needles, ink, and shop barrier film billed directly to the studio's verified Stripe payment method.
                </p>
              </div>
            </div>
          </div>

          <SuppliersTab />
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ARTIST DETAIL SHEET */}
      {/* ══════════════════════════════════════════════ */}
      {detArtist && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div onClick={() => setDetArtistId(null)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-[640px] mx-auto bg-[#28282b] rounded-t-[26px] p-5 sm:p-6 max-h-[88vh] overflow-y-auto border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="flex items-center gap-3.5 mb-4.5">
              <div className="w-13 h-13 rounded-full bg-[#eec95f]/15 border border-[#eec95f] text-[#eec95f] flex items-center justify-center font-bold text-base shrink-0">
                {(detArtist.user?.name || "RA").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{detArtist.user?.name}</h3>
                <p className="text-xs text-[#9b9ba1] truncate">{detArtist.specialties || "Resident Artist"}</p>
              </div>
              <button
                onClick={() => setDetArtistId(null)}
                className="w-9 h-9 rounded-full bg-[#353539] text-[#e8e8ea] flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* 8 Metrics Grid */}
            <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2">
              LAST 30 DAYS
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              <div className="bg-[#2f2f33] rounded-xl p-3">
                <div className="text-[10px] font-semibold tracking-[1px] text-[#8d8d93]">REVENUE</div>
                <div className="text-base font-bold text-white mt-1">{formatMoney(detArtist.grossCents || 0)}</div>
              </div>
              <div className="bg-[#2f2f33] rounded-xl p-3">
                <div className="text-[10px] font-semibold tracking-[1px] text-[#8d8d93]">STUDIO CUT</div>
                <div className="text-base font-bold text-[#eec95f] mt-1">
                  {formatMoney(
                    detArtist.paymentModel === "rent"
                      ? (detArtist.weeklyChairRentCents || 35000) * 4
                      : Math.round((detArtist.grossCents || 0) * ((detArtist.commissionPct || 30) / 100))
                  )}
                </div>
              </div>
              <div className="bg-[#2f2f33] rounded-xl p-3">
                <div className="text-[10px] font-semibold tracking-[1px] text-[#8d8d93]">UTILIZATION</div>
                <div className="text-base font-bold text-white mt-1">{detArtist.utilizationPct || 70}%</div>
              </div>
              <div className="bg-[#2f2f33] rounded-xl p-3">
                <div className="text-[10px] font-semibold tracking-[1px] text-[#8d8d93]">BOOKINGS</div>
                <div className="text-base font-bold text-white mt-1">{detArtist.bookingsCount || 0}</div>
              </div>
            </div>

            {/* Payment Model Terms Editor */}
            <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2">
              PAYMENT MODEL
            </div>
            <div className="flex bg-[#2f2f33] rounded-full p-1 mb-4">
              {(["commission", "rent", "dynamic", "none"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() =>
                    updateTermsMutation.mutate({
                      studioId,
                      artistId: detArtist.userId,
                      paymentModel: m,
                      commissionPct: detArtist.commissionPct || 30,
                      weeklyChairRentCents: detArtist.weeklyChairRentCents || 35000,
                      dynamicStartingPct: detArtist.dynamicStartingPct || 35,
                    })
                  }
                  className={`flex-1 py-2 rounded-full text-xs font-medium capitalize transition-all ${
                    detArtist.paymentModel === m ? "bg-[#48484c] text-white shadow" : "text-[#9a9aa0] hover:text-white"
                  }`}
                >
                  {m === "rent" ? "Chair rent" : m}
                </button>
              ))}
            </div>

            {/* Steppers */}
            {detArtist.paymentModel === "commission" && (
              <div className="flex items-center justify-center gap-5 my-3">
                <button
                  onClick={() =>
                    updateTermsMutation.mutate({
                      studioId,
                      artistId: detArtist.userId,
                      paymentModel: "commission",
                      commissionPct: Math.max(5, (detArtist.commissionPct || 30) - 5),
                    })
                  }
                  className="w-11 h-11 rounded-full border border-white/15 text-white text-xl"
                >
                  −
                </button>
                <div className="text-center min-w-[130px]">
                  <div className="text-3xl font-bold text-[#eec95f]">{detArtist.commissionPct || 30}%</div>
                  <div className="text-xs text-[#8d8d93]">of gross · settled at payout</div>
                </div>
                <button
                  onClick={() =>
                    updateTermsMutation.mutate({
                      studioId,
                      artistId: detArtist.userId,
                      paymentModel: "commission",
                      commissionPct: Math.min(70, (detArtist.commissionPct || 30) + 5),
                    })
                  }
                  className="w-11 h-11 rounded-full border border-white/15 text-white text-xl"
                >
                  +
                </button>
              </div>
            )}

            {detArtist.paymentModel === "rent" && (
              <div className="flex items-center justify-center gap-5 my-3">
                <button
                  onClick={() =>
                    updateTermsMutation.mutate({
                      studioId,
                      artistId: detArtist.userId,
                      paymentModel: "rent",
                      weeklyChairRentCents: Math.max(10000, (detArtist.weeklyChairRentCents || 35000) - 2500),
                    })
                  }
                  className="w-11 h-11 rounded-full border border-white/15 text-white text-xl"
                >
                  −
                </button>
                <div className="text-center min-w-[130px]">
                  <div className="text-3xl font-bold text-[#eec95f]">
                    ${Math.round((detArtist.weeklyChairRentCents || 35000) / 100)}
                  </div>
                  <div className="text-xs text-[#8d8d93]">per week · taken from payouts</div>
                </div>
                <button
                  onClick={() =>
                    updateTermsMutation.mutate({
                      studioId,
                      artistId: detArtist.userId,
                      paymentModel: "rent",
                      weeklyChairRentCents: Math.min(150000, (detArtist.weeklyChairRentCents || 35000) + 2500),
                    })
                  }
                  className="w-11 h-11 rounded-full border border-white/15 text-white text-xl"
                >
                  +
                </button>
              </div>
            )}

            <div className="text-center text-xs text-[#e8a15c] mt-4">
              Term changes are sent to {detArtist.user?.name?.split(" ")[0]}'s Dept messages for approval
            </div>

            <button
              onClick={() => setDetArtistId(null)}
              className="mt-5 w-full bg-[#f2cf63] text-[#1c1503] font-bold rounded-full py-3.5 text-sm hover:bg-[#f6d97e] transition-colors"
            >
              Done
            </button>
            <button
              onClick={() => setRmOpen(true)}
              className="mt-2 w-full text-[#e26565] font-medium text-xs py-2 hover:underline"
            >
              Remove from studio
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* REMOVE CONFIRMATION MODAL */}
      {/* ══════════════════════════════════════════════ */}
      {rmOpen && detArtist && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 font-['Poppins',system-ui,sans-serif]">
          <div onClick={() => setRmOpen(false)} className="fixed inset-0 bg-black/75 backdrop-blur-sm" />
          <div className="relative z-10 bg-[#1f1f22] border border-white/10 rounded-[20px] p-6 max-w-[380px] w-full text-white shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold">Remove {detArtist.user?.name}?</h3>
            <p className="text-xs text-[#9b9ba1] leading-relaxed mt-2">
              They keep their Dept of Tattoo Services account and every client they've booked — clients belong to the artist, not the studio. Calendar sync ends, metrics lock, and future splits stop.
            </p>
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setRmOpen(false)}
                className="flex-1 py-3 rounded-full border border-white/15 text-sm hover:border-white/30"
              >
                Cancel
              </button>
              <button
                onClick={() => removeArtistMutation.mutate({ studioId, artistId: detArtist.userId })}
                className="flex-1 py-3 rounded-full bg-[#e26565] text-[#2a0d0d] font-bold text-sm hover:bg-[#eb7a7a]"
              >
                Remove
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* INVITE ARTIST SHEET */}
      {/* ══════════════════════════════════════════════ */}
      {invOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div onClick={() => setInvOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-[640px] mx-auto bg-[#28282b] rounded-t-[26px] p-5 sm:p-6 max-h-[86vh] overflow-y-auto border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-semibold tracking-[2px] text-[#c9c9ce] uppercase">
                INVITE ARTIST
              </div>
              <button onClick={() => setInvOpen(false)} className="text-[#e8e8ea] text-sm p-2">✕</button>
            </div>
            <p className="text-xs text-[#9b9ba1] leading-relaxed mb-4">
              The invite lands in the artist's Dept Messages with your proposed terms — they approve in-app. On approval their calendar syncs, metrics unlock, and you can route inquiries. Clients stay theirs if they ever leave.
            </p>

            <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2">
              TERMS — SENT FOR ARTIST APPROVAL
            </div>
            <div className="flex bg-[#2f2f33] rounded-full p-1 mb-3">
              {(["commission", "rent", "dynamic", "none"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setInvModel(m)}
                  className={`flex-1 py-2 rounded-full text-xs font-medium capitalize transition-all ${
                    invModel === m ? "bg-[#48484c] text-white shadow" : "text-[#9a9aa0] hover:text-white"
                  }`}
                >
                  {m === "rent" ? "Chair rent" : m}
                </button>
              ))}
            </div>

            {invModel === "commission" && (
              <div className="bg-[#2f2f33] rounded-xl p-3.5 flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold text-white">Commission %</div>
                  <div className="text-xs text-[#9b9ba1]">Taken at every payout</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setInvComm(Math.max(5, invComm - 5))} className="w-8 h-8 rounded-full border border-white/15 text-white">−</button>
                  <span className="text-base font-bold text-[#eec95f] min-w-[44px] text-center">{invComm}%</span>
                  <button onClick={() => setInvComm(Math.min(70, invComm + 5))} className="w-8 h-8 rounded-full border border-white/15 text-white">+</button>
                </div>
              </div>
            )}

            {invModel === "rent" && (
              <div className="bg-[#2f2f33] rounded-xl p-3.5 flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold text-white">Weekly Chair Rent</div>
                  <div className="text-xs text-[#9b9ba1]">Deducted from payouts</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setInvRent(Math.max(100, invRent - 25))} className="w-8 h-8 rounded-full border border-white/15 text-white">−</button>
                  <span className="text-base font-bold text-[#eec95f] min-w-[64px] text-center">${invRent}/wk</span>
                  <button onClick={() => setInvRent(Math.min(1500, invRent + 25))} className="w-8 h-8 rounded-full border border-white/15 text-white">+</button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder="artist@email.com"
                className="flex-1 bg-[#2f2f33] border border-white/10 rounded-full px-4 py-3 text-white text-sm outline-none focus:border-[#eec95f]"
              />
              <button
                onClick={() =>
                  inviteArtistMutation.mutate({
                    studioId,
                    email: invEmail,
                    paymentModel: invModel,
                    commissionPct: invComm,
                    weeklyChairRentCents: invRent * 100,
                    dynamicStartingPct: invDyn,
                  })
                }
                disabled={inviteArtistMutation.isPending}
                className="bg-[#f2cf63] text-[#1c1503] font-bold rounded-full px-6 py-3 text-sm hover:bg-[#f6d97e] disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* WITHDRAW SHEET */}
      {/* ══════════════════════════════════════════════ */}
      {wOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div onClick={() => setWOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-[640px] mx-auto bg-[#28282b] rounded-t-[26px] p-5 sm:p-6 max-h-[86vh] overflow-y-auto border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] font-semibold tracking-[2px] text-[#c9c9ce] uppercase">
                WITHDRAW
              </div>
              <button onClick={() => setWOpen(false)} className="text-[#e8e8ea] text-sm p-2">✕</button>
            </div>

            <div className="bg-[#2f2f33] rounded-2xl p-4.5 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-[#c9c9ce]">Studio balance</span>
                <span className="text-white font-semibold">{formatMoney(balanceCents, true)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#c9c9ce]">Stripe processing fee (1.7% + $0.30)</span>
                <span className="text-[#e26565]">−{formatMoney(stripeFeeCents, true)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#c9c9ce]">Platform fee (1.8%)</span>
                <span className="text-[#e26565]">−{formatMoney(platformFeeCents, true)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#8d8d93] pb-2 border-b border-white/10">
                <span>Total studio fee (3.5%)</span>
                <span>−{formatMoney(totalFeeCents, true)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-1">
                <span>You'll receive</span>
                <span className="text-[#eec95f]">{formatMoney(netWithdrawCents, true)}</span>
              </div>
            </div>

            <p className="text-xs text-[#8d8d93] mt-3 leading-relaxed">
              Withdrawn from the studio Stripe balance to your linked bank account. Arrives in 1–2 business days.
            </p>

            <button
              onClick={handleWithdrawSubmit}
              disabled={withdrawMutation.isPending || balanceCents <= 0}
              className="mt-4 w-full bg-[#f2cf63] text-[#1c1503] font-bold rounded-full py-3.5 text-sm hover:bg-[#f6d97e] disabled:opacity-50 transition-colors shadow-lg"
            >
              {withdrawMutation.isPending ? "Processing..." : "Withdraw to bank"}
            </button>
          </div>
        </div>,
        document.body
      )}
        </div>
      </div>
    </div>
  );
}
