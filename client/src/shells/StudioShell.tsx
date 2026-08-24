/**
 * StudioShell — "The Department of Tattoo Services"
 *
 * Root layout shell for the Studio Role:
 * - 4-tab bottom navigation (Home, Messages, Calendar, Profile)
 * - Top role switcher ("← Switch to Artist Mode")
 * - Dynamic tab navigation and sub-routing
 * - Design notes modal
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { StudioHome } from "../features/studio/StudioHome";
import { StudioMessages } from "../features/studio/StudioMessages";
import { StudioCalendar } from "../features/studio/StudioCalendar";
import { StudioProfile } from "../features/studio/StudioProfile";
import { StudioCreateModal } from "../features/studio/StudioCreateModal";

export default function StudioShell() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"home" | "msg" | "cal" | "prof">("home");
  const [notesOpen, setNotesOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Load real studio data from DB
  const { data: studio, isLoading } = trpc.studios.getMyStudio.useQuery();

  // Cross-tab navigation state (e.g. clicking lead -> Messages with lead selected)
  const [navOptions, setNavOptions] = useState<any>({});

  const handleNavigate = (tab: "home" | "msg" | "cal" | "prof", options?: any) => {
    if (options) setNavOptions(options);
    setActiveTab(tab);
  };

  return (
    <div className="h-full min-h-[100dvh] flex flex-col bg-[#1b1b1b] text-[#f2f2f3] font-['Poppins',system-ui,sans-serif] selection:bg-[#eec95f]/30">
      {/* ── Top Role Switcher Bar ── */}
      <div className="shrink-0 bg-[#141415] border-b border-white/[0.07] px-4 py-2 flex items-center justify-between z-40">
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-2 bg-[#252528] hover:bg-[#303035] border border-white/10 text-white rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm"
        >
          <span>←</span>
          <span>Switch to Artist Mode</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#8d8d93] hidden sm:inline">STUDIO MODE</span>
          <div className="w-2 h-2 rounded-full bg-[#57c97e] animate-pulse" />
        </div>
      </div>

      {/* ── Main Viewport Content ── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#eec95f]" />
          </div>
        ) : !studio ? (
          <div className="max-w-[480px] mx-auto text-center py-16 px-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#eec95f]/15 border border-[#8a7434] text-[#eec95f] flex items-center justify-center text-3xl mx-auto">
              🏛️
            </div>
            <h2 className="text-2xl font-bold text-white">No Studio Found</h2>
            <p className="text-sm text-[#9b9ba1] leading-relaxed">
              You haven't set up a studio space yet. Launch your multi-chair studio to manage resident artists and track shop payouts.
            </p>
            <div className="pt-3">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="bg-[#f2cf63] text-[#1c1503] font-bold rounded-full px-7 py-3.5 text-sm hover:bg-[#f6d97e] transition-colors shadow-lg"
              >
                + Launch Your Studio
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "home" && (
              <StudioHome
                onNavigateTab={handleNavigate}
                onOpenNotes={() => setNotesOpen(true)}
              />
            )}
            {activeTab === "msg" && (
              <StudioMessages
                initialLeadId={navOptions.leadId}
                initialThreadAid={navOptions.artistId}
              />
            )}
            {activeTab === "cal" && (
              <StudioCalendar
                initialDate={navOptions.date}
                initialArtistId={navOptions.artistId}
              />
            )}
            {activeTab === "prof" && (
              <StudioProfile
                onNavigateHomeArtists={() => {
                  setActiveTab("home");
                }}
                onOpenNotes={() => setNotesOpen(true)}
              />
            )}
          </>
        )}
      </div>

      {/* ── Fixed Bottom Navigation Bar (z-50) ── */}
      <div className="shrink-0 bg-[#161616] border-t border-white/[0.06] py-2.5 pb-safe z-50">
        <div className="max-w-[640px] mx-auto grid grid-cols-4">
          {/* Home */}
          <button
            onClick={() => handleNavigate("home")}
            className={`flex flex-col items-center gap-1 py-1 transition-colors ${
              activeTab === "home" ? "text-white" : "text-[#7d7d84] hover:text-white"
            }`}
          >
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-4.6v-5.6H9.6V21H5a1 1 0 0 1-1-1z" />
            </svg>
            <span className="text-[11.5px] font-medium">Home</span>
          </button>

          {/* Messages */}
          <button
            onClick={() => handleNavigate("msg")}
            className={`flex flex-col items-center gap-1 py-1 transition-colors ${
              activeTab === "msg" ? "text-white" : "text-[#7d7d84] hover:text-white"
            }`}
          >
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L4 21l1.5-4.3A8.5 8.5 0 1 1 21 12z" />
            </svg>
            <span className="text-[11.5px] font-medium">Messages</span>
          </button>

          {/* Calendar */}
          <button
            onClick={() => handleNavigate("cal")}
            className={`flex flex-col items-center gap-1 py-1 transition-colors ${
              activeTab === "cal" ? "text-white" : "text-[#7d7d84] hover:text-white"
            }`}
          >
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="5" width="17" height="16" rx="3" />
              <path d="M3.5 9.5h17M8.5 3v4M15.5 3v4" />
            </svg>
            <span className="text-[11.5px] font-medium">Calendar</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => handleNavigate("prof")}
            className={`flex flex-col items-center gap-1 py-1 transition-colors ${
              activeTab === "prof" ? "text-white" : "text-[#7d7d84] hover:text-white"
            }`}
          >
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.6" />
              <path d="M5 20.4c.8-4 3.6-6 7-6s6.2 2 7 6" />
            </svg>
            <span className="text-[11.5px] font-medium">Profile</span>
          </button>
        </div>
      </div>

      {/* ── DESIGN NOTES SHEET ── */}
      {notesOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div onClick={() => setNotesOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-[640px] mx-auto bg-[#28282b] rounded-t-[26px] p-5 sm:p-6 max-h-[86vh] overflow-y-auto border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold tracking-[2px] text-[#c9c9ce] uppercase">
                DESIGN NOTES
              </div>
              <button onClick={() => setNotesOpen(false)} className="text-[#e8e8ea] p-2 hover:text-white">✕</button>
            </div>

            <div className="text-[13.5px] leading-relaxed text-[#c9c9ce] space-y-3">
              <div>
                <div className="text-[#eec95f] font-semibold mb-1">Core Architecture & Business Logic</div>
                <ul className="list-disc list-inside space-y-1 text-[#9b9ba1]">
                  <li>Studio app mirrors the artist app's language: dark surfaces, gold accents, pill segments, outlined status chips, bottom nav.</li>
                  <li>Nav is Home · Messages · Calendar · Profile; Artists and Money live as Home segments.</li>
                  <li>Studios never hold client money — deposits and payments go directly to the artist who takes the client.</li>
                  <li>At each artist payout (daily or weekly), the studio's cut is transferred from the artist's Stripe balance to the studio's.</li>
                  <li>3.5% platform studio fee applies on studio withdrawal only (Stripe 1.7% + 30c + 1.8% platform).</li>
                  <li>Leads that message the studio land in Studio inbox; routing creates a provisional hold the artist confirms in Dept Messages.</li>
                  <li>Invites carry proposed terms — commission %, weekly chair rent, or dynamic commission (3 tiers).</li>
                  <li>Clients belong to the artist who books them; if an artist leaves, their clients leave with them.</li>
                </ul>
              </div>

              <div>
                <div className="text-[#eec95f] font-semibold mb-1">Interactive Features & Workflows</div>
                <ul className="list-disc list-inside space-y-1 text-[#9b9ba1]">
                  <li><b className="text-white">Messages → Lead → Send to artist</b>: pick artist by style fit, day, time → Send referral hold.</li>
                  <li><b className="text-white">Home → Artists → tap an artist</b>: view 8 live 30d metrics, change terms with artist approval note, or remove.</li>
                  <li><b className="text-white">Home → Money → Withdraw</b>: inspect the real 3.5% fee breakdown (Stripe 1.7% + 30c + platform).</li>
                </ul>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── CREATE STUDIO MODAL ── */}
      <StudioCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
