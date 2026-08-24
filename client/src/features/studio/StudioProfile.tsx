/**
 * StudioProfile — "The Department of Tattoo Services"
 *
 * Implements:
 * 1. Studio Identity & specialties
 * 2. Business defaults (commission %, weekly chair rent)
 * 3. Money passcode security configuration (bcrypt)
 * 4. Auto-brief toggle & preferences
 * 5. Design notes reference sheet
 */

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface StudioProfileProps {
  onNavigateHomeArtists?: () => void;
  onOpenNotes?: () => void;
}

export function StudioProfile({ onNavigateHomeArtists, onOpenNotes }: StudioProfileProps) {
  const { data: myStudio, refetch: refetchStudio } = trpc.studios.getMyStudio.useQuery();
  const studioId = myStudio?.id || "";

  const [autoBriefOn, setAutoBriefOn] = useState(myStudio?.autoBriefEnabled !== 0);
  const [defComm, setDefComm] = useState(myStudio?.defaultCommission ?? 30);
  const [defRent, setDefRent] = useState(
    myStudio?.defaultChairRentCents ? Math.round(myStudio.defaultChairRentCents / 100) : 350
  );

  const updateDefaultsMutation = trpc.studios.updateDefaults.useMutation({
    onSuccess: () => {
      toast.success("Studio settings saved");
      refetchStudio();
      setDfOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const setMoneyPasscodeMutation = trpc.studios.setMoneyPasscode.useMutation({
    onSuccess: () => {
      toast.success("Money passcode updated");
      refetchStudio();
      setPpOpen(false);
      setPpCurrent("");
      setPpNew("");
    },
    onError: (err) => toast.error(err.message),
  });

  // Defaults Sheet
  const [dfOpen, setDfOpen] = useState(false);

  // Money Passcode Sheet
  const [ppOpen, setPpOpen] = useState(false);
  const hasPasscode = !!myStudio?.moneyPasscodeHash;
  const [ppCurrent, setPpCurrent] = useState("");
  const [ppNew, setPpNew] = useState("");

  const handleSavePasscode = () => {
    if (ppNew.trim().length < 4) {
      toast.error("Passcode needs at least 4 characters");
      return;
    }
    if (!studioId) return;
    setMoneyPasscodeMutation.mutate({
      studioId,
      currentPasscode: hasPasscode ? ppCurrent : undefined,
      newPasscode: ppNew.trim(),
    });
  };

  const handleRemovePasscode = () => {
    if (!studioId) return;
    setMoneyPasscodeMutation.mutate({
      studioId,
      currentPasscode: ppCurrent,
      newPasscode: null,
    });
  };

  const copyBookingLink = () => {
    const link = `https://www.tattoi.app/f/${myStudio?.publicSlug || "harpoonandhighwater"}`;
    navigator.clipboard.writeText(link);
    toast.success("Studio booking link copied!");
  };

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
        <div className="text-[21px] font-medium text-[#ececee]">Profile</div>
      </div>

      {/* ── Studio Identity Block ── */}
      <div className="text-center py-3 pb-6">
        <div className="w-21 h-21 rounded-full mx-auto flex items-center justify-center font-bold text-2xl bg-gradient-to-br from-[#e7c563] to-[#8f6f2c] text-[#231b06] shadow-lg">
          {(myStudio?.name || "HH").slice(0, 2).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold text-white mt-3">{myStudio?.name || "Harpoon and highwater"}</h2>
        <p className="text-xs text-[#9b9ba1] mt-0.5">@{myStudio?.instagramHandle || "harpoonandhighwater"}</p>
        <p className="text-xs text-[#9b9ba1] mt-1">{myStudio?.address || "Fortitude Valley, QLD"}</p>

        <div className="flex gap-2 flex-wrap justify-center mt-3.5">
          {["Realism", "Fine Line", "Blackwork", "Neo-trad", "Anime", "Geometric"].map((t) => (
            <span key={t} className="text-xs px-3.5 py-1.5 rounded-full bg-[#2e2a4d] text-[#b3a7f5]">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-[640px] mx-auto space-y-5">
        {/* ── BUSINESS SECTION ── */}
        <div>
          <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2">
            BUSINESS
          </div>
          <div className="bg-[#1a1a1b] border border-white/[0.07] rounded-[18px] divide-y divide-white/5 overflow-hidden">
            {/* Defaults */}
            <div onClick={() => setDfOpen(true)} className="flex items-center gap-3.5 p-4 cursor-pointer hover:bg-white/[0.02]">
              <div className="w-9 h-9 rounded-full bg-[#eec95f]/15 text-[#eec95f] flex items-center justify-center font-bold text-sm shrink-0">
                %
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">Commission & chair rent</div>
                <div className="text-xs text-[#9b9ba1]">
                  Defaults: {defComm}% or ${defRent}/wk
                </div>
              </div>
              <span className="text-[#6e6e75] font-mono">›</span>
            </div>

            {/* Payment processing */}
            <div className="flex items-center gap-3.5 p-4 cursor-pointer hover:bg-white/[0.02]">
              <div className="w-9 h-9 rounded-full bg-[#57c97e]/15 text-[#57c97e] flex items-center justify-center font-bold text-sm shrink-0">
                $
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">Payment processing</div>
                <div className="text-xs text-[#9b9ba1]">Stripe Connect active ✓</div>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#57c97e] mr-1" />
              <span className="text-[#6e6e75] font-mono">›</span>
            </div>

            {/* Money passcode */}
            <div onClick={() => setPpOpen(true)} className="flex items-center gap-3.5 p-4 cursor-pointer hover:bg-white/[0.02]">
              <div className="w-9 h-9 rounded-full bg-[#e26565]/15 text-[#e26565] flex items-center justify-center text-sm shrink-0">
                🔒
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">Money passcode</div>
                <div className="text-xs text-[#9b9ba1]">
                  {hasPasscode ? "On — Money locks when you leave it" : "Off — set a passcode to lock Money"}
                </div>
              </div>
              <span className="text-[#6e6e75] font-mono">›</span>
            </div>

            {/* Studio booking link */}
            <div onClick={copyBookingLink} className="flex items-center gap-3.5 p-4 cursor-pointer hover:bg-white/[0.02]">
              <div className="w-9 h-9 rounded-full bg-[#a98ff2]/15 text-[#a98ff2] flex items-center justify-center text-sm shrink-0">
                ⚯
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">Studio booking link</div>
                <div className="text-xs text-[#9b9ba1] truncate">
                  tattoi.app/f/{myStudio?.publicSlug || "harpoonandhighwater"}
                </div>
              </div>
              <span className="text-[#6e6e75] font-mono">›</span>
            </div>
          </div>
        </div>

        {/* ── PREFERENCES SECTION ── */}
        <div>
          <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2">
            PREFERENCES
          </div>
          <div className="bg-[#1a1a1b] border border-white/[0.07] rounded-[18px] divide-y divide-white/5 overflow-hidden">
            <div className="flex items-center gap-3.5 p-4">
              <div className="w-9 h-9 rounded-full bg-[#e8a15c]/15 text-[#e8a15c] flex items-center justify-center text-sm shrink-0">
                ✎
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">Auto-brief new leads</div>
                <div className="text-xs text-[#9b9ba1]">Summarise inquiries before routing</div>
              </div>
              <button
                onClick={() => {
                  const next = !autoBriefOn;
                  setAutoBriefOn(next);
                  updateDefaultsMutation.mutate({ studioId, autoBriefEnabled: next });
                }}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  autoBriefOn ? "bg-[#f2cf63]" : "bg-[#48484c]"
                }`}
              >
                <div
                  className={`w-5.5 h-5.5 rounded-full bg-white absolute top-0.75 transition-all ${
                    autoBriefOn ? "left-[22px]" : "left-[3px]"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ── SYSTEM SECTION ── */}
        <div>
          <div className="text-[11px] font-semibold tracking-[1.8px] text-[#8d8d93] uppercase mb-2">
            SYSTEM
          </div>
          <div className="bg-[#1a1a1b] border border-white/[0.07] rounded-[18px] overflow-hidden">
            <div onClick={onOpenNotes} className="flex items-center gap-3.5 p-4 cursor-pointer hover:bg-white/[0.02]">
              <div className="w-9 h-9 rounded-full bg-white/10 text-[#c9c9ce] flex items-center justify-center text-xs font-bold shrink-0">
                i
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">Design notes</div>
                <div className="text-xs text-[#9b9ba1]">Architecture, settlement mechanics & rules</div>
              </div>
              <span className="text-[#6e6e75] font-mono">›</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* DEFAULTS SHEET */}
      {/* ══════════════════════════════════════════════ */}
      {dfOpen && (
        <div className="fixed inset-0 z-60 flex flex-col justify-end">
          <div onClick={() => setDfOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-[640px] mx-auto bg-[#28282b] rounded-t-[26px] p-5 sm:p-6 max-h-[86vh] overflow-y-auto border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between mb-3.5">
              <div className="text-[13px] font-semibold tracking-[2px] text-[#c9c9ce] uppercase">
                STUDIO DEFAULTS
              </div>
              <button onClick={() => setDfOpen(false)} className="text-[#e8e8ea] text-sm p-2">✕</button>
            </div>

            <div className="bg-[#2f2f33] rounded-2xl p-4 flex items-center gap-3 mb-3">
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">Default commission</div>
                <div className="text-xs text-[#9b9ba1]">For newly invited artists</div>
              </div>
              <button onClick={() => setDefComm(Math.max(5, defComm - 5))} className="w-9 h-9 rounded-full border border-white/15 text-white">−</button>
              <span className="text-base font-bold text-[#eec95f] min-w-[48px] text-center">{defComm}%</span>
              <button onClick={() => setDefComm(Math.min(70, defComm + 5))} className="w-9 h-9 rounded-full border border-white/15 text-white">+</button>
            </div>

            <div className="bg-[#2f2f33] rounded-2xl p-4 flex items-center gap-3 mb-4">
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">Default chair rent</div>
                <div className="text-xs text-[#9b9ba1]">Weekly · settled from payouts</div>
              </div>
              <button onClick={() => setDefRent(Math.max(100, defRent - 25))} className="w-9 h-9 rounded-full border border-white/15 text-white">−</button>
              <span className="text-base font-bold text-[#eec95f] min-w-[68px] text-center">${defRent}/wk</span>
              <button onClick={() => setDefRent(Math.min(1500, defRent + 25))} className="w-9 h-9 rounded-full border border-white/15 text-white">+</button>
            </div>

            <button
              onClick={() =>
                updateDefaultsMutation.mutate({
                  studioId,
                  defaultCommission: defComm,
                  defaultChairRentCents: defRent * 100,
                })
              }
              className="w-full bg-[#f2cf63] text-[#1c1503] font-bold rounded-full py-3.5 text-sm hover:bg-[#f6d97e] transition-colors"
            >
              Save Defaults
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* MONEY PASSCODE SHEET */}
      {/* ══════════════════════════════════════════════ */}
      {ppOpen && (
        <div className="fixed inset-0 z-60 flex flex-col justify-end">
          <div onClick={() => setPpOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-[640px] mx-auto bg-[#28282b] rounded-t-[26px] p-5 sm:p-6 max-h-[86vh] overflow-y-auto border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-semibold tracking-[2px] text-[#c9c9ce] uppercase">
                MONEY PASSCODE
              </div>
              <button onClick={() => setPpOpen(false)} className="text-[#e8e8ea] text-sm p-2">✕</button>
            </div>
            <p className="text-xs text-[#9b9ba1] leading-relaxed mb-4">
              Locks the Money area and masks balances on Home. Anyone opening Money will need this passcode.
            </p>

            {hasPasscode && (
              <input
                type="password"
                inputMode="numeric"
                value={ppCurrent}
                onChange={(e) => setPpCurrent(e.target.value)}
                placeholder="Current passcode"
                className="w-full bg-[#2f2f33] border border-white/10 rounded-full py-3 px-4 text-white text-sm tracking-[4px] text-center outline-none focus:border-[#eec95f] mb-2.5"
              />
            )}

            <input
              type="password"
              inputMode="numeric"
              value={ppNew}
              onChange={(e) => setPpNew(e.target.value)}
              placeholder={hasPasscode ? "New passcode" : "Choose a passcode (4+ digits)"}
              className="w-full bg-[#2f2f33] border border-white/10 rounded-full py-3 px-4 text-white text-sm tracking-[4px] text-center outline-none focus:border-[#eec95f]"
            />

            <button
              onClick={handleSavePasscode}
              className="mt-3.5 w-full bg-[#f2cf63] text-[#1c1503] font-bold rounded-full py-3.5 text-sm hover:bg-[#f6d97e] transition-colors"
            >
              {hasPasscode ? "Change passcode" : "Set passcode"}
            </button>

            {hasPasscode && (
              <button
                onClick={handleRemovePasscode}
                className="mt-2 w-full text-[#e26565] text-xs py-2 hover:underline"
              >
                Remove passcode
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
