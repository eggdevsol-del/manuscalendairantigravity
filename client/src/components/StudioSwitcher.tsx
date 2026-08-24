/**
 * StudioSwitcher — "The Department of Tattoo Services"
 *
 * Header pill component:
 * - If user owns a studio: displays "🏛️ [Studio Name] ›" with 1-tap navigation to /studio.
 * - If user doesn't own a studio yet: displays "+ Studio Mode" and opens StudioCreateModal.
 * - Inside Studio Mode: displays "← Switch to Artist Mode" to return to /dashboard.
 */

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { StudioCreateModal } from "@/features/studio/StudioCreateModal";

interface StudioSwitcherProps {
  currentMode?: "artist" | "studio";
  className?: string;
}

export function StudioSwitcher({ currentMode = "artist", className = "" }: StudioSwitcherProps) {
  const [location, setLocation] = useLocation();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: studio, isLoading } = trpc.studios.getMyStudio.useQuery();

  if (isLoading) return null;

  const isStudioPage = location.startsWith("/studio");

  if (isStudioPage || currentMode === "studio") {
    return (
      <button
        onClick={() => setLocation("/dashboard")}
        className={`flex items-center gap-2 bg-[#28282b] border border-white/15 hover:border-white/30 text-white rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm ${className}`}
      >
        <span className="text-sm">←</span>
        <span>Switch to Artist Mode</span>
      </button>
    );
  }

  return (
    <>
      {studio ? (
        <button
          onClick={() => setLocation("/studio")}
          className={`flex items-center gap-2 bg-gradient-to-r from-[#eec95f]/15 to-transparent border border-[#8a7434] hover:border-[#eec95f] text-[#eec95f] hover:text-white rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm ${className}`}
        >
          <span className="text-sm">🏛️</span>
          <span className="truncate max-w-[130px] sm:max-w-[200px]">{studio.name}</span>
          <span className="text-[10px] opacity-75 font-mono">›</span>
        </button>
      ) : (
        <button
          onClick={() => setModalOpen(true)}
          className={`flex items-center gap-1.5 bg-[#28282b] border border-dashed border-[#eec95f]/50 hover:border-[#eec95f] text-[#eec95f] hover:text-white rounded-full px-3 py-1.5 text-xs font-medium transition-all shadow-sm ${className}`}
        >
          <span className="text-xs font-bold">+</span>
          <span>Studio Mode</span>
        </button>
      )}

      <StudioCreateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
