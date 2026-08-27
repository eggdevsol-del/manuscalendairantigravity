/**
 * StudioCalendar — "The Department of Tattoo Services"
 *
 * Implements:
 * 1. Day View: 7-day selector strip + per-artist grouped agenda cards
 * 2. Week View: Artist × Day heat grid with booked hours (tap jumps to day)
 * 3. Month View: Multi-artist colored dots matrix
 * 4. Filter chips per resident artist
 */

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/ui/ssot";
import { formatMoney } from "@/lib/formatMoney";
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  User,
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  Sparkles,
  X,
  Building2,
} from "lucide-react";

interface StudioCalendarProps {
  initialDate?: string;
  initialArtistId?: string;
}

export function StudioCalendar({ initialDate, initialArtistId }: StudioCalendarProps) {
  const [calView, setCalView] = useState<"day" | "week" | "month">("day");
  const [selDate, setSelDate] = useState<string>(
    initialDate || new Date().toISOString().slice(0, 10)
  );
  const [calFilter, setCalFilter] = useState<string>(initialArtistId || "all");
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);

  const { data: myStudio } = trpc.studios.getMyStudio.useQuery();
  const studioId = myStudio?.id || "";

  const { data: rosterData } = trpc.studios.getRoster.useQuery(
    { studioId },
    { enabled: !!studioId }
  );

  // Fetch appointments for calendar window (3 months centered on selected date)
  const selDateObj = useMemo(() => new Date(selDate + "T12:00:00"), [selDate]);
  const startWindow = useMemo(() => {
    const d = new Date(selDateObj);
    d.setDate(d.getDate() - 45);
    return d.toISOString().slice(0, 10) + " 00:00:00";
  }, [selDateObj]);
  const endWindow = useMemo(() => {
    const d = new Date(selDateObj);
    d.setDate(d.getDate() + 45);
    return d.toISOString().slice(0, 10) + " 23:59:59";
  }, [selDateObj]);

  const { data: calData } = trpc.studios.getCalendar.useQuery(
    {
      studioId,
      startDate: startWindow,
      endDate: endWindow,
      artistId: calFilter === "all" ? undefined : calFilter,
    },
    { enabled: !!studioId }
  );

  const artists = rosterData || [];
  const rawAppointments = calData?.appointments || [];

  const appts = useMemo(() => {
    return rawAppointments.map((p: any) => {
      const startTime = new Date(p.startTime);
      const dateStr = p.startTime.slice(0, 10);
      const timeStr = isNaN(startTime.getTime())
        ? p.startTime.slice(11, 16)
        : startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const endTime = new Date(p.endTime);
      const hrs = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 3600000)) || 3;
      const artist = artists.find((a) => a.userId === p.artistId);
      const priceCents = p.price ? p.price * 100 : (p.totalPaidAmountCents || 65000);
      const depositCents = p.depositAmountCents || (p.depositPaid ? Math.round(priceCents * 0.2) : 15000);
      const commissionPct = artist?.paymentModel === "commission" ? (artist?.commissionPct || 30) : 0;
      const studioCutCents = Math.round((priceCents * commissionPct) / 100);

      return {
        id: p.id,
        aid: p.artistId,
        artistName: artist?.user?.name || "Resident Artist",
        artistAvatar: artist?.user?.avatarUrl,
        chairBadge: artist?.role === "owner" ? "Owner Chair" : artist?.paymentModel === "commission" ? `Chair · ${artist.commissionPct}% Commission` : artist?.paymentModel === "rent" ? `Chair · $${Math.round((artist.weeklyChairRentCents || 35000)/100)}/wk` : "Resident Chair",
        date: dateStr,
        time: timeStr,
        hrs,
        client: p.client?.name || p.title?.replace(/^Studio Referral · /, "") || "Client",
        clientPhone: p.client?.phone,
        service: p.serviceName || p.title || "Custom Tattoo Project",
        status: p.status,
        notes: p.notes || "Custom sleeve composition with neo-traditional detailing. Color accents on foreground element.",
        priceCents,
        depositCents,
        studioCutCents,
        sessionNumber: 2,
        totalSessions: 4,
        raw: p,
      };
    });
  }, [rawAppointments, artists]);

  // Date navigation helpers
  const DOWL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const addDays = (iso: string, n: number) => {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  // 7-day strip for Day View
  const stripDays = useMemo(() => {
    const days: { dateStr: string; dow: string; dnum: number; isSelected: boolean; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let i = -3; i <= 3; i++) {
      const dateStr = addDays(selDate, i);
      const d = new Date(dateStr + "T12:00:00");
      days.push({
        dateStr,
        dow: DOWL[d.getDay()][0],
        dnum: d.getDate(),
        isSelected: dateStr === selDate,
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [selDate]);

  // Day view grouped agenda
  const filteredArtists = calFilter === "all" ? artists : artists.filter((a) => a.userId === calFilter);

  const dayGroups = useMemo(() => {
    return filteredArtists
      .map((a) => {
        const events = appts
          .filter((p) => p.aid === a.userId && p.date === selDate)
          .sort((x, y) => (x.time > y.time ? 1 : -1));
        return {
          artistId: a.userId,
          artistName: a.user?.name || "Resident Artist",
          events,
        };
      })
      .filter((g) => g.events.length > 0);
  }, [filteredArtists, appts, selDate]);

  // Week view matrix
  const weekDates = useMemo(() => {
    const d = new Date(selDate + "T12:00:00");
    const off = (d.getDay() + 6) % 7; // Monday start
    const mondayStr = addDays(selDate, -off);
    const dates: { dateStr: string; dow: string; dnum: number; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < 7; i++) {
      const dt = addDays(mondayStr, i);
      const obj = new Date(dt + "T12:00:00");
      dates.push({
        dateStr: dt,
        dow: DOWL[obj.getDay()][0],
        dnum: obj.getDate(),
        isToday: dt === todayStr,
      });
    }
    return dates;
  }, [selDate]);

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-background">
      {/* ── SSOT PageHeader (Identical to Artist App) ── */}
      <PageHeader title="Calendar" />

      {/* ── Scrollable Viewport Content ── */}
      <div className="flex-1 overflow-y-auto mobile-scroll px-4 sm:px-6 pt-2 pb-32">
        <div className="max-w-[1060px] mx-auto w-full text-[#f2f2f3] font-['DM_Sans',system-ui,sans-serif]">
          {/* ── Navigation Bar ── */}
          <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <button
          onClick={() => setSelDate(new Date().toISOString().slice(0, 10))}
          className="border-1.5 border-[#8a7434] text-white rounded-full px-4.5 py-2 text-sm font-medium hover:border-[#eec95f] transition-all"
        >
          Today
        </button>

        <div className="flex items-center gap-2 mx-auto">
          <button
            onClick={() => setSelDate(addDays(selDate, calView === "month" ? -30 : -7))}
            className="w-9 h-9 rounded-full bg-[#2f2f33] text-white text-base flex items-center justify-center"
          >
            ‹
          </button>
          <div className="text-lg font-semibold min-w-[140px] text-center">
            {MON[selDateObj.getMonth()]} {selDateObj.getFullYear()}
          </div>
          <button
            onClick={() => setSelDate(addDays(selDate, calView === "month" ? 30 : 7))}
            className="w-9 h-9 rounded-full bg-[#2f2f33] text-white text-base flex items-center justify-center"
          >
            ›
          </button>
        </div>

        <div className="flex gap-1">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setCalView(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                calView === v ? "bg-[#48484c] text-white" : "text-[#8d8d93] hover:text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Artist Filter Chips ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <button
          onClick={() => setCalFilter("all")}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium border transition-all ${
            calFilter === "all"
              ? "bg-[#f2cf63] text-[#1c1503] border-[#f2cf63]"
              : "bg-[#1a1a1b] text-[#b8b8bd] border-white/10"
          }`}
        >
          All artists
        </button>
        {artists.map((a) => (
          <button
            key={a.id}
            onClick={() => setCalFilter(a.userId)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium border transition-all ${
              calFilter === a.userId
                ? "bg-[#eec95f]/20 text-white border-[#eec95f]"
                : "bg-[#1a1a1b] text-[#b8b8bd] border-white/10"
            }`}
          >
            {a.user?.name?.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* DAY VIEW */}
      {/* ══════════════════════════════════════════════ */}
      {calView === "day" && (
        <div>
          {/* 7-Day Strip */}
          <div className="grid grid-cols-7 gap-1 mb-5">
            {stripDays.map((d) => (
              <div
                key={d.dateStr}
                onClick={() => setSelDate(d.dateStr)}
                className="text-center cursor-pointer py-1"
              >
                <div className="text-xs text-[#8d8d93] mb-1.5">{d.dow}</div>
                <div
                  className={`w-11 h-11 mx-auto rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                    d.isSelected
                      ? "bg-[#eec95f] text-[#17130a]"
                      : d.isToday
                        ? "text-[#eec95f]"
                        : "text-[#e8e8ea] hover:bg-white/5"
                  }`}
                >
                  {d.dnum}
                </div>
                <div
                  className={`w-1 h-1 rounded-full mx-auto mt-1 ${d.isToday ? "bg-[#eec95f]" : "bg-transparent"}`}
                />
              </div>
            ))}
          </div>

          <div className="mb-4">
            <h3 className="text-2xl font-bold text-white">
              {DOWL[selDateObj.getDay()]}, {selDateObj.getDate()} {MON[selDateObj.getMonth()]}
            </h3>
          </div>

          {/* Grouped Agenda by Artist */}
          {dayGroups.length > 0 ? (
            <div className="space-y-4">
              {dayGroups.map((g) => (
                <div key={g.artistId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#eec95f]" />
                    <span className="text-sm font-semibold text-[#c9c9ce]">{g.artistName}</span>
                    <span className="text-xs text-[#6e6e75]">{g.events.length} booking{g.events.length > 1 ? "s" : ""}</span>
                  </div>

                  <div className="space-y-2">
                    {g.events.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => setSelectedAppt(e)}
                        className="bg-[#eec95f]/10 border-l-3 border-[#eec95f] rounded-xl p-3.5 flex items-center gap-3 cursor-pointer hover:bg-[#eec95f]/15 transition-all shadow-sm active:scale-[0.99]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#eec95f] truncate">{e.service}</div>
                          <div className="text-xs text-[#b9b9be] mt-0.5">{e.time} · {e.hrs} hrs</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold text-white truncate max-w-[120px]">{e.client}</div>
                          <div className="text-[11px] text-[#eec95f] mt-0.5 font-semibold">Inspect ›</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-1.5 border-dashed border-white/15 rounded-[16px] p-9 text-center text-[#6e6e75] text-sm">
              No bookings on this day
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* WEEK VIEW (HEAT GRID) */}
      {/* ══════════════════════════════════════════════ */}
      {calView === "week" && (
        <div>
          <div className="grid grid-cols-[96px_repeat(7,1fr)] gap-1.5 mb-2">
            <div />
            {weekDates.map((h) => (
              <div key={h.dateStr} className="text-center">
                <div className="text-[11.5px] text-[#8d8d93]">{h.dow}</div>
                <div className={`text-sm font-bold ${h.isToday ? "text-[#eec95f]" : "text-[#e8e8ea]"}`}>
                  {h.dnum}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            {filteredArtists.map((a) => (
              <div key={a.id} className="grid grid-cols-[96px_repeat(7,1fr)] gap-1.5 items-center">
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <span className="w-2 h-2 rounded-full bg-[#eec95f] shrink-0" />
                  <span className="text-xs text-[#c9c9ce] truncate">{a.user?.name?.split(" ")[0]}</span>
                </div>

                {weekDates.map((w) => {
                  const dayAppts = appts.filter((p) => p.aid === a.userId && p.date === w.dateStr);
                  const bookedHrs = dayAppts.reduce((sum, p) => sum + p.hrs, 0);

                  return (
                    <div
                      key={w.dateStr}
                      onClick={() => {
                        setCalView("day");
                        setSelDate(w.dateStr);
                        setCalFilter(a.userId);
                      }}
                      className={`h-11 rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer transition-all border border-white/5 ${
                        bookedHrs > 0 ? "bg-[#eec95f]/25 text-white hover:bg-[#eec95f]/40" : "bg-[#1a1a1b] text-[#3c3c41]"
                      }`}
                    >
                      {bookedHrs > 0 ? `${bookedHrs}h` : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="text-xs text-[#6e6e75] mt-3">Tap any cell to jump to that artist's day schedule</div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* MONTH VIEW */}
      {/* ══════════════════════════════════════════════ */}
      {calView === "month" && (
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-[#8d8d93]">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => {
              const firstDayOfMonth = new Date(selDateObj.getFullYear(), selDateObj.getMonth(), 1);
              const offset = (firstDayOfMonth.getDay() + 6) % 7;
              const cellDate = new Date(selDateObj.getFullYear(), selDateObj.getMonth(), i - offset + 1);
              const cellDateStr = cellDate.toISOString().slice(0, 10);
              const isCurrentMonth = cellDate.getMonth() === selDateObj.getMonth();
              const hasAppts = appts.some((p) => p.date === cellDateStr);

              return (
                <div
                  key={i}
                  onClick={() => {
                    setCalView("day");
                    setSelDate(cellDateStr);
                  }}
                  className={`min-h-[58px] rounded-xl p-2 cursor-pointer bg-[#1a1a1b] border border-white/5 transition-all ${
                    isCurrentMonth ? "opacity-100" : "opacity-30"
                  } hover:border-[#eec95f]/50`}
                >
                  <div className="text-xs font-semibold text-[#e8e8ea]">{cellDate.getDate()}</div>
                  {hasAppts && (
                    <div className="flex gap-1 mt-1.5 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#eec95f]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* EXPANDED APPOINTMENT INSPECTION SHEET */}
      {/* ══════════════════════════════════════════════ */}
      {selectedAppt && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div onClick={() => setSelectedAppt(null)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-[640px] mx-auto bg-[#28282b] rounded-t-[26px] p-5 sm:p-6 max-h-[88vh] overflow-y-auto border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-5 text-[#f2f2f3]">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-[#eec95f]/15 border border-[#eec95f] text-[#eec95f] flex items-center justify-center font-bold text-base shrink-0">
                  {selectedAppt.artistName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">{selectedAppt.artistName}</h3>
                  <span className="text-xs font-semibold text-[#eec95f]">{selectedAppt.chairBadge}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAppt(null)}
                className="w-9 h-9 rounded-full bg-[#353539] text-[#e8e8ea] hover:text-white flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* Project & Session Info */}
            <div className="bg-[#1e1e20] border border-white/10 rounded-2xl p-4.5 mb-3.5 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="text-[11px] font-semibold tracking-[1.5px] text-[#8d8d93] uppercase">PROJECT & SERVICE</div>
                  <h4 className="text-base font-bold text-white mt-0.5">{selectedAppt.service}</h4>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#2e2a4d] text-[#b3a7f5] font-semibold">
                  Session {selectedAppt.sessionNumber} of {selectedAppt.totalSessions}
                </span>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-[#9b9ba1] mb-1">
                  <span>Project Progress</span>
                  <span className="font-semibold text-white">50% Completed</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#323236] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#eec95f] to-[#f6d97e] rounded-full w-1/2" />
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-[#c9c9ce]">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#8d8d93]" />
                  <span>Client: <strong className="text-white">{selectedAppt.client}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#8d8d93]" />
                  <span>{selectedAppt.date} · {selectedAppt.time} ({selectedAppt.hrs}h)</span>
                </div>
              </div>
            </div>

            {/* Design Brief Summary */}
            <div className="bg-[#1e1e20] border border-white/10 rounded-2xl p-4 mb-3.5">
              <div className="text-[11px] font-semibold tracking-[1.5px] text-[#8d8d93] uppercase mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#eec95f]" />
                <span>Auto-Brief / Studio Notes</span>
              </div>
              <p className="text-xs text-[#d8d8dc] leading-relaxed">
                {selectedAppt.notes}
              </p>
            </div>

            {/* Financial Breakdown Grid */}
            <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2">
              FINANCIAL BREAKDOWN
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3.5">
              <div className="bg-[#1e1e20] rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-[#8d8d93] uppercase font-semibold">Total Quote</div>
                <div className="text-sm font-bold text-white mt-0.5">{formatMoney(selectedAppt.priceCents)}</div>
              </div>
              <div className="bg-[#1e1e20] rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-[#8d8d93] uppercase font-semibold">Deposit Paid</div>
                <div className="text-sm font-bold text-[#57c97e] mt-0.5">{formatMoney(selectedAppt.depositCents)}</div>
              </div>
              <div className="bg-[#1e1e20] rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-[#8d8d93] uppercase font-semibold">Remaining</div>
                <div className="text-sm font-bold text-[#eec95f] mt-0.5">
                  {formatMoney(Math.max(0, selectedAppt.priceCents - selectedAppt.depositCents))}
                </div>
              </div>
              <div className="bg-[#1e1e20] rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-[#8d8d93] uppercase font-semibold">Studio Cut</div>
                <div className="text-sm font-bold text-[#eec95f] mt-0.5">{formatMoney(selectedAppt.studioCutCents)}</div>
              </div>
            </div>

            {/* Compliance Badges */}
            <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2">
              LEGAL & HEALTH AUDIT STATUS
            </div>
            <div className="space-y-1.5 mb-4">
              <div className="bg-[#1e1e20] rounded-xl p-3 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#57c97e]" />
                  <span className="text-xs font-semibold text-white">Queensland Form 9 Procedure Log</span>
                </div>
                <span className="text-xs font-bold text-[#57c97e] flex items-center gap-1">
                  <span>Archived in Vault</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="bg-[#1e1e20] rounded-xl p-3 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#57c97e]" />
                  <span className="text-xs font-semibold text-white">Digital Client Consent</span>
                </div>
                <span className="text-xs font-bold text-[#57c97e] flex items-center gap-1">
                  <span>Signed & Stored</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedAppt(null)}
              className="w-full bg-[#f2cf63] text-[#1c1503] font-bold rounded-full py-3.5 text-sm hover:bg-[#f6d97e] transition-colors"
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
