/**
 * StudioCreateModal — "The Department of Tattoo Services"
 *
 * Lightweight 30-second onboarding wizard for an artist to launch their studio,
 * set default chair terms, and transition into Studio Mode.
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface StudioCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StudioCreateModal({ isOpen, onClose }: StudioCreateModalProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useContext();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [brandLine, setBrandLine] = useState("STUDIO BY THE DEPT OF TATTOO SERVICES");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [model, setModel] = useState<"commission" | "rent">("commission");
  const [defComm, setDefComm] = useState(30);
  const [defRent, setDefRent] = useState(350);

  const createStudioMutation = trpc.studios.createStudio.useMutation({
    onSuccess: (studio) => {
      toast.success(`🎉 ${studio?.name || "Studio"} created! Welcome to your Studio Dashboard.`);
      utils.studios.getMyStudio.invalidate();
      onClose();
      setLocation("/studio");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create studio");
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a studio name");
      return;
    }

    createStudioMutation.mutate({
      name: name.trim(),
      address: address.trim() || undefined,
      brandLine: brandLine.trim() || undefined,
      instagramHandle: instagramHandle.trim().replace(/^@/, "") || undefined,
      defaultCommission: model === "commission" ? defComm : 0,
      defaultChairRentCents: model === "rent" ? defRent * 100 : 0,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 font-['Poppins',system-ui,sans-serif]">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-md" />

      {/* Modal Card */}
      <div className="relative z-10 bg-[var(--card)] border border-[#eec95f]/30 rounded-[24px] p-6 sm:p-7 max-w-[500px] w-full shadow-2xl text-[var(--foreground)] animate-in zoom-in-95">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10.5px] font-semibold tracking-[1.8px] text-[#eec95f] uppercase">
              THE DEPARTMENT OF TATTOO SERVICES
            </div>
            <h2 className="text-[22px] font-bold text-foreground mt-0.5">Launch Your Studio</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-foreground flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        <p className="text-[13px] text-[var(--muted-foreground)] leading-relaxed mb-5">
          Run a shop with other artists? The Studio Dashboard gives you multi-chair calendars, resident artist metrics, automatic settlement cuts from artist payouts, and lead routing.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Studio Name */}
          <div>
            <label className="block text-[11px] font-semibold tracking-[1.4px] text-[var(--muted-foreground)] uppercase mb-1.5">
              Studio Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Harpoon & Highwater"
              className="w-full bg-[var(--card)] border border-foreground/10 rounded-xl py-3 px-4 text-foreground text-sm outline-none focus:border-[#eec95f] transition-colors"
              required
            />
          </div>

          {/* Location & Instagram Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold tracking-[1.4px] text-[var(--muted-foreground)] uppercase mb-1.5">
                Location / City
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Fortitude Valley, QLD"
                className="w-full bg-[var(--card)] border border-foreground/10 rounded-xl py-3 px-4 text-foreground text-sm outline-none focus:border-[#eec95f] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold tracking-[1.4px] text-[var(--muted-foreground)] uppercase mb-1.5">
                Instagram Handle
              </label>
              <input
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="e.g. @harpoonandhighwater"
                className="w-full bg-[var(--card)] border border-foreground/10 rounded-xl py-3 px-4 text-foreground text-sm outline-none focus:border-[#eec95f] transition-colors"
              />
            </div>
          </div>

          {/* Default Chair Payment Model */}
          <div>
            <label className="block text-[11px] font-semibold tracking-[1.4px] text-[var(--muted-foreground)] uppercase mb-1.5">
              Default Chair Terms for Resident Artists
            </label>
            <div className="flex bg-[var(--card)] rounded-full p-1 mb-3 border border-foreground/5">
              <button
                type="button"
                onClick={() => setModel("commission")}
                className={`flex-1 py-2 rounded-full text-xs font-medium transition-all ${
                  model === "commission" ? "bg-[var(--secondary)] text-foreground shadow" : "text-[var(--muted-foreground)] hover:text-foreground"
                }`}
              >
                Commission %
              </button>
              <button
                type="button"
                onClick={() => setModel("rent")}
                className={`flex-1 py-2 rounded-full text-xs font-medium transition-all ${
                  model === "rent" ? "bg-[var(--secondary)] text-foreground shadow" : "text-[var(--muted-foreground)] hover:text-foreground"
                }`}
              >
                Weekly Chair Rent
              </button>
            </div>

            {model === "commission" ? (
              <div className="bg-[var(--card)] rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">Default Commission</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Taken automatically at artist payout</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDefComm(Math.max(5, defComm - 5))}
                    className="w-8 h-8 rounded-full border border-foreground/15 text-foreground hover:border-foreground/30"
                  >
                    −
                  </button>
                  <span className="text-base font-bold text-[#eec95f] min-w-[44px] text-center">{defComm}%</span>
                  <button
                    type="button"
                    onClick={() => setDefComm(Math.min(70, defComm + 5))}
                    className="w-8 h-8 rounded-full border border-foreground/15 text-foreground hover:border-foreground/30"
                  >
                    +
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--card)] rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">Weekly Chair Rent</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Deducted from weekly payouts</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDefRent(Math.max(100, defRent - 25))}
                    className="w-8 h-8 rounded-full border border-foreground/15 text-foreground hover:border-foreground/30"
                  >
                    −
                  </button>
                  <span className="text-base font-bold text-[#eec95f] min-w-[64px] text-center">${defRent}/wk</span>
                  <button
                    type="button"
                    onClick={() => setDefRent(Math.min(1500, defRent + 25))}
                    className="w-8 h-8 rounded-full border border-foreground/15 text-foreground hover:border-foreground/30"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={createStudioMutation.isPending}
              className="w-full bg-[#f2cf63] text-[#1c1503] font-bold rounded-full py-3.5 text-[15px] hover:bg-[#f6d97e] transition-colors shadow-lg disabled:opacity-50"
            >
              {createStudioMutation.isPending ? "Creating Studio..." : "Launch Studio Dashboard"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
