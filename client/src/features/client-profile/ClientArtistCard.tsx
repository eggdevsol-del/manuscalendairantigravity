/**
 * ClientArtistCard.tsx
 * Artist card used in "My Artists" (client home → conversations).
 *
 * Tap behaviour:
 *   - Tap card body (banner / name area) → toggle portfolio expand
 *   - 💬 icon button → navigate to chat
 */

import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { PortfolioExpand } from "@/features/client-profile/PortfolioExpand";

interface ClientArtistCardProps {
  conv: any;
  onShopToggle?: (expanded: boolean) => void;
}


export function ClientArtistCard({ conv, onShopToggle }: ClientArtistCardProps) {
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState<boolean>(false);

  const artist = conv.otherUser;
  if (!artist) return null;

  const bannerUrl = artist.funnelBannerUrl || null;
  const artistName = artist.name || artist.firstName || "Artist";
  const avatarUrl = artist.avatar || null;

  const togglePortfolio = () => {
    setExpanded(prev => !prev);
  };

  return (
    <div className="w-full relative rounded-2xl overflow-hidden group bg-[#111] transition-all duration-300 shadow-xl border border-border">
      {/* Banner — tap to toggle portfolio */}
      <button
        className="w-full text-left focus:outline-none"
        onClick={togglePortfolio}
      >
        {/* Banner Background */}
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt=""
            className="absolute top-0 left-0 w-full h-[140px] object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute top-0 left-0 w-full h-[140px] bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10" />
        )}

        {/* Overlay */}
        <div className="absolute top-0 left-0 w-full h-[140px] bg-gradient-to-t from-[#111] via-black/50 to-black/10" />

        {/* Header row */}
        <div className="relative z-10 flex items-end p-4 h-[140px]">
          <div className="flex items-center gap-3 w-full">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-secondary/50 border-2 border-border overflow-hidden shrink-0 shadow-lg">
              {avatarUrl ? (
                <img src={avatarUrl} alt={artistName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent">
                  <span className="text-white font-bold text-lg">{artistName.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Name + unread */}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white font-bold text-lg leading-tight truncate drop-shadow-md">{artistName}</p>
              {conv.unreadCount > 0 && (
                <p className="text-primary text-xs font-medium mt-0.5">
                  {conv.unreadCount} unread message{conv.unreadCount > 1 ? "s" : ""}
                </p>
              )}
              {/* Subtle hint when collapsed */}
              {!expanded && (
                <p className="text-white/30 text-[10px] mt-0.5">Tap to view portfolio</p>
              )}
            </div>

            {/* Action buttons — stop propagation so they don't toggle portfolio */}
            <div
              className="flex items-center gap-2"
              onClick={e => e.stopPropagation()}
            >
              {/* Chat */}
              <button
                onClick={() => setLocation(`/chat/${conv.id}`)}
                className="relative shrink-0 w-10 h-10 rounded-full bg-secondary/50 backdrop-blur-xl border border-border flex items-center justify-center hover:bg-secondary/70 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-white" />
                {conv.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-white text-[10px] font-bold shadow-lg ring-2 ring-black">
                    {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </button>

      {/* ── Expandable areas ───────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="portfolio"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative z-10 bg-[#111] border-t border-border overflow-hidden"
          >
            <PortfolioExpand
              artistId={artist.id}
              artistName={artistName}
              onMessage={() => setLocation(`/chat/${conv.id}`)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
