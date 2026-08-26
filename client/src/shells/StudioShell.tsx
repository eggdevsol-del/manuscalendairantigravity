import React, { useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Home, MessageSquare, Calendar, User } from "lucide-react";
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

  // Design system token colors matching Artist App BottomNav
  const bgColor = "var(--color-bg-header, #141416)";
  const borderColor = "var(--color-border, rgba(255,255,255,0.08))";
  const activeColor = "var(--color-accent-violet, #eec95f)";
  const inactiveColor = "var(--color-text-secondary, #8A8A92)";
  const badgeBorder = "var(--color-bg-header, #141416)";
  const dangerColor = "var(--color-danger, #ef4444)";

  const navTabs = [
    { id: "home" as const, label: "Home", icon: Home },
    { id: "msg" as const, label: "Messages", icon: MessageSquare },
    { id: "cal" as const, label: "Calendar", icon: Calendar },
    { id: "prof" as const, label: "Profile", icon: User },
  ];

  return (
    <div className="fixed inset-0 w-full h-[100dvh] flex flex-col overflow-hidden bg-background">
      {/* ── Main Viewport Content ── */}
      <div className="flex-1 w-full h-full overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !studio ? (
          <div className="flex-1 overflow-y-auto mobile-scroll px-6 py-16 text-center space-y-4 max-w-[480px] mx-auto flex flex-col justify-center items-center">
            <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary text-primary flex items-center justify-center text-3xl mx-auto">
              🏛️
            </div>
            <h2 className="text-2xl font-bold text-foreground">No Studio Found</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You haven't set up a studio space yet. Launch your multi-chair studio to manage resident artists and track shop payouts.
            </p>
            <div className="pt-3">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="bg-primary text-primary-foreground font-bold rounded-full px-7 py-3.5 text-sm hover:opacity-90 transition-opacity shadow-lg"
              >
                + Launch Multi-artist Studio
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

      {/* ── Fixed Bottom Navigation Bar (Identical to Artist App BottomNav) ── */}
      <nav
        id="studio-bottom-nav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          userSelect: "none",
          backgroundColor: bgColor,
          borderTop: `1px solid ${borderColor}`,
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: "transform",
        }}
      >
        {/* Tab row — 62px icon area matching Artist App */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 62,
            paddingTop: 14,
          }}
        >
          {navTabs.map((item) => {
            const active = activeTab === item.id;
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  flex: 1,
                  height: "100%",
                  background: "none",
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                  color: active ? activeColor : inactiveColor,
                  WebkitTapHighlightColor: "transparent",
                  padding: 0,
                }}
              >
                {/* Icon with badges */}
                <div style={{ position: "relative" }}>
                  <IconComponent
                    style={{ width: 24, height: 24, color: "inherit" }}
                    strokeWidth={active ? 2.5 : 1.8}
                    fill={active ? "currentColor" : "none"}
                    fillOpacity={active ? 0.15 : 0}
                  />
                </div>

                {/* Label — 10px, active=600, inactive=400 */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: active ? 600 : 400,
                    color: "inherit",
                    lineHeight: 1.2,
                    letterSpacing: "0.01em",
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom safe-area fill */}
        <div
          style={{
            height: "env(safe-area-inset-bottom, 20px)",
            backgroundColor: bgColor,
            minHeight: 20,
          }}
        />
      </nav>

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
