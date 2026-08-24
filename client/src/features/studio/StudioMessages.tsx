/**
 * StudioMessages — "The Department of Tattoo Services"
 *
 * Implements:
 * 1. Studio Inbox: Inbound leads with auto-brief & style tags + search
 * 2. Send-to-Artist 3-step referral wizard:
 *    - Step 1: Select artist with style match ("Great fit") & next free day
 *    - Step 2: Recommend day (10-day grid with booked hours) & start time (9:00 / 1:00)
 *    - Step 3: Review note & Send referral hold
 * 3. Resident Artist Threads: Symmetrical SETTLEMENT RECEIVED & STUDIO REFERRAL cards
 */

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface StudioMessagesProps {
  initialLeadId?: number | null;
  initialThreadAid?: string | null;
}

export function StudioMessages({ initialLeadId, initialThreadAid }: StudioMessagesProps) {
  const [msgSeg, setMsgSeg] = useState<"inbox" | "artists">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [selLeadId, setSelLeadId] = useState<number | null>(initialLeadId || null);
  const [selThreadAid, setSelThreadAid] = useState<string | null>(initialThreadAid || null);
  const [draft, setDraft] = useState("");

  const { data: myStudio } = trpc.studios.getMyStudio.useQuery();
  const studioId = myStudio?.id || "";

  // Queries
  const { data: inboxLeads, refetch: refetchInbox } = trpc.studios.getInbox.useQuery(
    { studioId },
    { enabled: !!studioId }
  );

  const { data: rosterData } = trpc.studios.getRoster.useQuery(
    { studioId },
    { enabled: !!studioId }
  );

  // Mutations
  const sendReferralMutation = trpc.studios.sendReferral.useMutation({
    onSuccess: () => {
      toast.success("Referral sent to artist — held on their calendar");
      setAsOpen(false);
      refetchInbox();
    },
    onError: (err) => toast.error(err.message),
  });

  // Send-to-Artist 3-Step Wizard Sheet
  const [asOpen, setAsOpen] = useState(false);
  const [asStep, setAsStep] = useState<1 | 2 | 3>(1);
  const [asAid, setAsAid] = useState<string | null>(null);
  const [asDate, setAsDate] = useState<string | null>(null);
  const [asTime, setAsTime] = useState<string>("9:00 AM");
  const [asNote, setAsNote] = useState<string>("");

  const leads = inboxLeads || [];
  const artists = rosterData || [];

  const selLead = useMemo(() => leads.find((l) => l.id === selLeadId) || null, [leads, selLeadId]);
  const selArtist = useMemo(() => artists.find((a) => a.userId === selThreadAid) || null, [artists, selThreadAid]);
  const asArtist = useMemo(() => artists.find((a) => a.userId === asAid) || null, [artists, asAid]);

  // Filtered Leads / Artists for Search
  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return leads;
    return leads.filter(
      (l) => l.clientName?.toLowerCase().includes(q) || l.projectType?.toLowerCase().includes(q)
    );
  }, [leads, searchQuery]);

  const filteredArtists = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return artists;
    return artists.filter((a) => a.user?.name?.toLowerCase().includes(q));
  }, [artists, searchQuery]);

  // Date Helpers
  const DOWL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const nextTenDays = useMemo(() => {
    const days: { dateStr: string; dow: string; dnum: string }[] = [];
    for (let i = 1; i <= 10; i++) {
      const d = new Date(Date.now() + i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({
        dateStr,
        dow: DOWL[d.getDay()],
        dnum: `${d.getDate()} ${MONS[d.getMonth()]}`,
      });
    }
    return days;
  }, []);

  const hasSelection = !!(selLead || selArtist);

  return (
    <div className="max-w-[1060px] mx-auto w-full px-4 sm:px-6 py-6 pb-28 text-[#f2f2f3]">
      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-4.5">
        <div>
          <h1 className="text-[25px] font-bold tracking-tight leading-tight text-white">
            {myStudio?.name || "Harpoon and highwater"}
          </h1>
          <div className="text-[10px] font-semibold tracking-[1.6px] text-[#8d8d93] mt-1 uppercase">
            {myStudio?.brandLine || "STUDIO BY THE DEPT OF TATTOO SERVICES"}
          </div>
        </div>
        <div className="text-[21px] font-medium text-[#ececee]">Messages</div>
      </div>

      {/* ── 2-Pane or Single Column Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-[400px_1fr] gap-4 items-start">
        {/* LEFT COLUMN: LIST */}
        <div className={hasSelection ? "hidden md:block" : "block"}>
          {/* Search Box */}
          <div className="flex items-center gap-2.5 bg-[#1a1a1b] border border-white/[0.07] rounded-full py-3 px-4.5 mb-3.5">
            <span className="text-[#6e6e75] text-base">⌕</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent border-none outline-none text-white text-sm"
            />
          </div>

          {/* Segment: Studio Inbox vs Artists */}
          <div className="flex bg-[#1a1a1b] rounded-full p-1 mb-4">
            <button
              onClick={() => {
                setMsgSeg("inbox");
                setSelThreadAid(null);
              }}
              className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-all ${
                msgSeg === "inbox" ? "bg-[#48484c] text-white shadow" : "text-[#9a9aa0] hover:text-white"
              }`}
            >
              Studio inbox
            </button>
            <button
              onClick={() => {
                setMsgSeg("artists");
                setSelLeadId(null);
              }}
              className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-all ${
                msgSeg === "artists" ? "bg-[#48484c] text-white shadow" : "text-[#9a9aa0] hover:text-white"
              }`}
            >
              Artists
            </button>
          </div>

          {/* Leads List */}
          {msgSeg === "inbox" && (
            <div className="space-y-2.5">
              {filteredLeads.map((r) => {
                const initials = (r.clientName || "CL").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                const isSelected = selLeadId === r.id;
                const chipCol = r.status === "new" ? "#eec95f" : r.status === "referred" ? "#e8a15c" : "#57c97e";
                const chipText = r.status === "new" ? "NEW" : r.status === "referred" ? "AWAITING" : "BOOKED";

                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelLeadId(r.id);
                      setSelThreadAid(null);
                    }}
                    className={`bg-[#1a1a1b] border rounded-[18px] p-3.5 sm:p-4 flex items-center gap-3 cursor-pointer transition-all ${
                      isSelected ? "border-[#eec95f]" : "border-white/[0.07] hover:border-white/20"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#e7c563] to-[#8f6f2c] text-[#231b06] flex items-center justify-center font-bold text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-white truncate">{r.clientName}</div>
                      <div className="text-xs text-[#9b9ba1] truncate">{r.projectType || "Tattoo Inquiry"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-[#8d8d93] mb-1">
                        {new Date(r.createdAt || Date.now()).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </div>
                      <span
                        className="text-[10.5px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ borderColor: chipCol, color: chipCol }}
                      >
                        {chipText}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredLeads.length === 0 && (
                <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center text-[#6e6e75] text-xs">
                  No inquiries in the studio inbox
                </div>
              )}
            </div>
          )}

          {/* Artists List */}
          {msgSeg === "artists" && (
            <div className="space-y-2.5">
              {filteredArtists.map((a) => {
                const name = a.user?.name || "Resident Artist";
                const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "RA";
                const isSelected = selThreadAid === a.userId;

                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      setSelThreadAid(a.userId);
                      setSelLeadId(null);
                    }}
                    className={`bg-[#1a1a1b] border rounded-[18px] p-3.5 sm:p-4 flex items-center gap-3 cursor-pointer transition-all ${
                      isSelected ? "border-[#eec95f]" : "border-white/[0.07] hover:border-white/20"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#eec95f]/15 border border-[#eec95f] text-[#eec95f] flex items-center justify-center font-bold text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-white truncate">{name}</div>
                      <div className="text-xs text-[#9b9ba1] truncate capitalize">
                        {a.paymentModel} settlement · weekly payout
                      </div>
                    </div>
                    <div className="text-[11px] text-[#8d8d93] shrink-0">Active</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: THREAD DETAIL PANE */}
        <div className={!hasSelection ? "hidden md:block" : "block"}>
          {!hasSelection ? (
            <div className="border-1.5 border-dashed border-white/10 rounded-[20px] p-16 text-center text-[#6e6e75] text-sm">
              Select a conversation
            </div>
          ) : selLead ? (
            /* Lead Thread Pane */
            <div className="bg-[#1a1a1b] border border-white/[0.07] rounded-[20px] overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
                <button
                  onClick={() => setSelLeadId(null)}
                  className="md:hidden w-9 h-9 rounded-full bg-[#2f2f33] text-[#e8e8ea] flex items-center justify-center text-sm"
                >
                  ←
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e7c563] to-[#8f6f2c] text-[#231b06] flex items-center justify-center font-bold text-sm shrink-0">
                  {(selLead.clientName || "CL").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-white truncate">{selLead.clientName}</div>
                  <div className="text-xs text-[#9b9ba1] truncate">Studio inquiry · {selLead.clientEmail || selLead.clientPhone}</div>
                </div>
                <span
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border"
                  style={{
                    borderColor: selLead.status === "new" ? "#eec95f" : selLead.status === "referred" ? "#e8a15c" : "#57c97e",
                    color: selLead.status === "new" ? "#eec95f" : selLead.status === "referred" ? "#e8a15c" : "#57c97e",
                  }}
                >
                  {selLead.status === "new" ? "NEW" : selLead.status === "referred" ? "AWAITING" : "BOOKED"}
                </span>
              </div>

              {/* Lead Brief Box */}
              <div className="p-4.5 pb-2">
                <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2">
                  LEAD BRIEF
                </div>
                <p className="text-sm leading-relaxed text-[#d8d8dc]">
                  {selLead.clientName} is inquiring about a {selLead.projectType || "custom tattoo"}. Budget estimated at $
                  {((selLead.estimatedValue || 45000) / 100).toFixed(0)}.
                </p>
                <div className="flex gap-2 flex-wrap mt-3">
                  <span className="text-xs px-3 py-1 rounded-full bg-[#2e2a4d] text-[#b3a7f5]">Custom</span>
                  <span className="text-xs px-3 py-1 rounded-full bg-[#2e2a4d] text-[#b3a7f5]">Inquiry</span>
                </div>
              </div>

              {/* Message & Status Panel */}
              <div className="p-4.5 pt-2">
                <div className="bg-[#28282b] rounded-2xl rounded-tl-sm p-3.5 max-w-[520px] text-sm text-[#e2e2e6] leading-relaxed mb-3">
                  Hi! I found the studio on Instagram — looking to get this piece done. What are deposits like and when is someone free?
                </div>

                {selLead.status === "new" && (
                  <button
                    onClick={() => {
                      setAsOpen(true);
                      setAsStep(1);
                      setAsAid(null);
                      setAsDate(null);
                    }}
                    className="w-full bg-[#f2cf63] text-[#1c1503] font-bold rounded-full py-3.5 text-sm hover:bg-[#f6d97e] transition-colors shadow-lg mt-2"
                  >
                    Send to artist
                  </button>
                )}

                {selLead.status === "referred" && (
                  <div className="bg-[#1a1a1b] border border-white/10 rounded-2xl p-4.5 mt-3 space-y-2">
                    <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase">
                      REFERRAL SENT
                    </div>
                    <div className="text-base font-bold text-white">Recommended to resident artist</div>
                    <div className="bg-[#e8a15c]/12 border border-[#e8a15c]/50 text-[#e8a15c] rounded-xl py-2.5 text-center text-xs font-medium">
                      Waiting for artist to confirm
                    </div>
                  </div>
                )}
              </div>

              {/* Input Bar */}
              <div className="flex items-center gap-2.5 p-3.5 border-t border-white/[0.06]">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-[#28282b] border border-white/[0.08] rounded-full py-3 px-4.5 text-white text-sm outline-none focus:border-[#eec95f]"
                />
                <button
                  onClick={() => {
                    if (!draft.trim()) return;
                    setDraft("");
                    toast.success("Message sent");
                  }}
                  className="w-11 h-11 rounded-full bg-[#d7b556] text-[#1c1503] flex items-center justify-center font-bold text-base shrink-0"
                >
                  ➤
                </button>
              </div>
            </div>
          ) : (
            /* Artist Thread Pane */
            <div className="bg-[#1a1a1b] border border-white/[0.07] rounded-[20px] overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
                <button
                  onClick={() => setSelThreadAid(null)}
                  className="md:hidden w-9 h-9 rounded-full bg-[#2f2f33] text-[#e8e8ea] flex items-center justify-center text-sm"
                >
                  ←
                </button>
                <div className="w-10 h-10 rounded-full bg-[#eec95f]/15 border border-[#eec95f] text-[#eec95f] flex items-center justify-center font-bold text-sm shrink-0">
                  {(selArtist?.user?.name || "RA").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-white truncate">{selArtist?.user?.name}</div>
                  <div className="text-xs text-[#9b9ba1] truncate">Resident Artist · {selArtist?.paymentModel} terms</div>
                </div>
              </div>

              <div className="p-4.5 space-y-3">
                <div className="text-[11px] text-[#6e6e75] text-center mb-2">
                  Studio updates and settlement notices are delivered to the artist's Dept messages
                </div>

                {/* Symmetrical Settlement Card */}
                <div className="bg-[#1a1a1b] border border-white/10 rounded-2xl p-4 max-w-[500px] ml-auto space-y-1.5">
                  <div className="text-[10.5px] font-bold tracking-[1.8px] text-[#8d8d93] uppercase">
                    SETTLEMENT RECEIVED
                  </div>
                  <div className="text-base font-bold text-white">
                    {selArtist?.paymentModel === "rent" ? `$${Math.round((selArtist.weeklyChairRentCents || 35000) / 100)} chair rent` : "Settlement cut from payout"}
                  </div>
                  <div className="text-xs text-[#c9c9ce]">
                    Weekly payout · {new Date().toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} · recorded in both feeds
                  </div>
                  <div className="border border-[#57c97e] text-[#57c97e] rounded-xl py-2 text-center text-xs font-semibold mt-2">
                    Transferred to studio Stripe balance
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3.5 border-t border-white/[0.06]">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message artist..."
                  className="flex-1 bg-[#28282b] border border-white/[0.08] rounded-full py-3 px-4.5 text-white text-sm outline-none focus:border-[#eec95f]"
                />
                <button
                  onClick={() => {
                    if (!draft.trim()) return;
                    setDraft("");
                    toast.success("Message sent");
                  }}
                  className="w-11 h-11 rounded-full bg-[#d7b556] text-[#1c1503] flex items-center justify-center font-bold text-base shrink-0"
                >
                  ➤
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* SEND-TO-ARTIST 3-STEP WIZARD SHEET */}
      {/* ══════════════════════════════════════════════ */}
      {asOpen && selLead && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div onClick={() => setAsOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-[640px] mx-auto bg-[#28282b] rounded-t-[26px] p-5 sm:p-6 max-h-[86vh] overflow-y-auto border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-5">
            {/* Wizard Header */}
            <div className="flex items-center gap-3 mb-4.5">
              <button
                onClick={() => {
                  if (asStep === 1) setAsOpen(false);
                  else setAsStep((prev) => (prev - 1) as any);
                }}
                className="w-10 h-10 rounded-full bg-[#353539] text-[#e8e8ea] flex items-center justify-center text-base shrink-0"
              >
                ←
              </button>
              <div className="text-[13px] font-bold tracking-[2px] text-[#c9c9ce] uppercase">
                {asStep === 1 ? "SELECT ARTIST" : asStep === 2 ? "RECOMMEND A DAY" : "REVIEW REFERRAL"}
              </div>
              <div className="ml-auto text-xs text-[#9b9ba1] truncate">{selLead.clientName}</div>
            </div>

            {/* STEP 1: SELECT ARTIST */}
            {asStep === 1 && (
              <div className="space-y-2.5">
                {artists.map((a) => {
                  const name = a.user?.name || "Resident Artist";
                  const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={a.id}
                      onClick={() => {
                        setAsAid(a.userId);
                        setAsStep(2);
                      }}
                      className="bg-[#2f2f33] border border-white/[0.07] hover:border-[#eec95f] rounded-2xl p-3.5 flex items-center gap-3.5 cursor-pointer transition-all"
                    >
                      <div className="w-11 h-11 rounded-full bg-[#eec95f]/15 border border-[#eec95f] text-[#eec95f] flex items-center justify-center font-bold text-sm shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{name}</div>
                        <div className="text-xs text-[#9b9ba1] truncate">{a.specialties || "Resident Artist"}</div>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#57c97e] text-[#57c97e] shrink-0">
                        Great fit
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 2: SELECT DAY & TIME */}
            {asStep === 2 && asArtist && (
              <div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                  {nextTenDays.map((d) => {
                    const isSelected = asDate === d.dateStr;
                    return (
                      <div
                        key={d.dateStr}
                        onClick={() => setAsDate(d.dateStr)}
                        className={`rounded-xl p-3 text-center cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-[#eec95f]/15 border-[#eec95f] text-[#eec95f]"
                            : "bg-[#2f2f33] border-white/[0.06] text-[#e8e8ea] hover:border-white/20"
                        }`}
                      >
                        <div className="text-xs font-semibold">{d.dow}</div>
                        <div className="text-sm font-bold mt-0.5">{d.dnum}</div>
                        <div className="text-[11px] text-[#57c97e] mt-1">Free</div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2">
                  START TIME
                </div>
                <div className="flex gap-2.5 mb-5">
                  {(["9:00 AM", "1:00 PM"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setAsTime(t)}
                      className={`flex-1 py-3 rounded-full text-sm font-semibold border transition-all ${
                        asTime === t
                          ? "bg-[#eec95f]/15 border-[#eec95f] text-[#eec95f]"
                          : "bg-[#2f2f33] border-white/[0.06] text-[#c9c9ce]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (!asDate) {
                      toast.error("Please pick a day");
                      return;
                    }
                    setAsStep(3);
                    setAsNote(
                      `Hey ${asArtist.user?.name?.split(" ")[0]} — this one looks like yours. ${selLead.projectType || "Tattoo"}. I've suggested ${asDate} · ${asTime} — confirm in the app or propose a new time.`
                    );
                  }}
                  className="w-full bg-[#f2cf63] text-[#1c1503] font-bold rounded-full py-3.5 text-sm hover:bg-[#f6d97e] transition-colors"
                >
                  Review referral
                </button>
              </div>
            )}

            {/* STEP 3: REVIEW & SEND */}
            {asStep === 3 && asArtist && (
              <div className="space-y-4">
                <div className="bg-[#2f2f33] rounded-2xl p-4.5 space-y-3">
                  <div className="flex justify-between text-[11px] font-bold tracking-[1.6px] text-[#8d8d93] uppercase">
                    <span>LEAD</span>
                    <span>ARTIST</span>
                  </div>
                  <div className="flex justify-between text-base font-bold">
                    <span className="text-white">{selLead.clientName}</span>
                    <span className="text-[#eec95f]">{asArtist.user?.name}</span>
                  </div>
                  <div className="border-t border-white/[0.08]" />
                  <div className="text-[11px] font-bold tracking-[1.6px] text-[#8d8d93] uppercase">PROPOSED</div>
                  <div className="text-sm font-bold text-white">{asDate} · {asTime}</div>
                  <div className="text-xs text-[#9b9ba1]">Held on the calendar until artist confirms in Dept Messages</div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold tracking-[1.8px] text-[#8d8d93] uppercase mb-1.5">
                    NOTE TO ARTIST
                  </label>
                  <textarea
                    value={asNote}
                    onChange={(e) => setAsNote(e.target.value)}
                    rows={3}
                    className="w-full bg-[#2f2f33] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-[#eec95f]"
                  />
                </div>

                <button
                  onClick={() =>
                    sendReferralMutation.mutate({
                      studioId,
                      leadId: selLead.id,
                      artistId: asArtist.userId,
                      proposedDate: asDate || "",
                      proposedTime: asTime,
                      note: asNote,
                    })
                  }
                  disabled={sendReferralMutation.isPending}
                  className="w-full bg-[#f2cf63] text-[#1c1503] font-bold rounded-full py-3.5 text-sm hover:bg-[#f6d97e] disabled:opacity-50 transition-colors shadow-lg"
                >
                  {sendReferralMutation.isPending ? "Sending Referral..." : "SEND REFERRAL"}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
