/**
 * StudioDashboardSettings — "The Department of Tattoo Services"
 *
 * Settings sub-panel for Studio Management:
 * - Displays active studio status & resident roster summary
 * - 1-tap "Open Studio Dashboard" launcher
 * - Studio creation onboarding wizard trigger
 */

import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { StudioCreateModal } from "@/features/studio/StudioCreateModal";

interface StudioDashboardSettingsProps {
  onBack: () => void;
}

export function StudioDashboardSettings({ onBack }: StudioDashboardSettingsProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: studio, isLoading } = trpc.studios.getMyStudio.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: roster } = trpc.studios.getRoster.useQuery(
    { studioId: studio?.id || "" },
    { enabled: !!studio?.id }
  );

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative font-['Poppins',system-ui,sans-serif] text-foreground">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-border">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full bg-secondary/50 hover:bg-secondary/70 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Studio Management</h2>
          <p className="text-xs text-muted-foreground">The Department of Tattoo Services</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 w-full overflow-y-auto px-6 py-6 pb-28">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : studio ? (
          <div className="space-y-5 max-w-[560px] mx-auto">
            {/* Active Studio Card */}
            <div className="bg-[#1e1e22] border border-[#eec95f]/35 rounded-[22px] p-5 sm:p-6 shadow-xl">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#e7c563] to-[#8f6f2c] text-[#231b06] flex items-center justify-center font-bold text-lg">
                  {studio.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">{studio.name}</h3>
                  <p className="text-xs text-[#9b9ba1] truncate">
                    {studio.address || "Studio Headquarters"} · {roster?.length || 1} chair{(roster?.length || 1) > 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#57c97e]/15 text-[#57c97e] border border-[#57c97e]/30">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 my-4">
                <div className="bg-[#28282c] rounded-xl p-3">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8d8d93]">Default Terms</span>
                  <p className="text-base font-bold text-[#eec95f] mt-0.5">
                    {studio.defaultCommission ? `${studio.defaultCommission}% cut` : `$${Math.round((studio.defaultChairRentCents || 0) / 100)}/wk rent`}
                  </p>
                </div>
                <div className="bg-[#28282c] rounded-xl p-3">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8d8d93]">Resident Artists</span>
                  <p className="text-base font-bold text-white mt-0.5">{roster?.length || 1} of 10</p>
                </div>
              </div>

              <button
                onClick={() => setLocation("/studio")}
                className="w-full bg-[#f2cf63] text-[#1c1503] font-bold rounded-full py-3.5 text-sm hover:bg-[#f6d97e] transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                <span>Open Studio Dashboard</span>
                <span>→</span>
              </button>
            </div>

            {/* Explainer card */}
            <div className="bg-card border border-border rounded-2xl p-4 text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground mb-1">How Studio Mode Works:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Clients book with resident artists — the studio never holds client deposits.</li>
                <li>At every artist payout, the studio's settlement cut is automatically transferred to your studio Stripe balance.</li>
                <li>Use the Studio Dashboard to manage chairs, route inbound leads, and view shop analytics.</li>
              </ul>
            </div>
          </div>
        ) : (
          /* No Studio — Launch CTA */
          <div className="max-w-[480px] mx-auto text-center py-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#eec95f]/15 border border-[#8a7434] text-[#eec95f] flex items-center justify-center text-3xl mx-auto">
              🏛️
            </div>
            <h3 className="text-xl font-bold text-foreground">Manage Your Studio on Tattoi</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Have other artists working in your shop? Set up your studio to manage resident chairs, route incoming leads, and automate commission splits from payouts.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="bg-[#f2cf63] text-[#1c1503] font-bold rounded-full px-7 py-3.5 text-sm hover:bg-[#f6d97e] transition-colors shadow-lg"
              >
                + Launch Studio Dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      <StudioCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
