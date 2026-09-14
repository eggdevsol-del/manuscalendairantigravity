/**
 * ClientArtistCard.tsx
 * Artist card used in "My Artists" (client home → conversations).
 *
 * Tap behaviour:
 *   - Tap card body (banner / name area) → toggle portfolio expand
 *   - 💬 icon button → navigate to chat
 */

import React, { useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MessageCircle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { PortfolioExpand } from "@/features/client-profile/PortfolioExpand";
import { trpc } from "@/lib/trpc";

interface ClientArtistCardProps {
  conv: any;
  onShopToggle?: (expanded: boolean) => void;
}
export function ClientArtistCard({
  conv,
  onShopToggle,
}: ClientArtistCardProps) {
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState<boolean>(false);
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const createConversation = trpc.conversations.getOrCreate.useMutation();
  const openingChat = useRef(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const artist = conv.otherUser;
  if (!artist) return null;

  const bannerUrl = artist.funnelBannerUrl || null;
  const artistName = artist.name || artist.firstName || "Artist";
  const avatarUrl = artist.avatar || null;

  const togglePortfolio = () => {
    setExpanded(prev => !prev);
  };

  const openChat = async () => {
    if (openingChat.current) return;
    if (!conv._isFavouriteOnly) {
      setLocation(`/chat/${conv.id}`);
      return;
    }
    if (!user?.id) {
      setChatError("Please sign in again to open this chat.");
      return;
    }

    openingChat.current = true;
    setIsOpeningChat(true);
    setChatError(null);
    try {
      const conversation = await createConversation.mutateAsync({
        artistId: artist.id,
        clientId: user.id,
      });
      if (!conversation?.id) throw new Error("Conversation was not returned");
      void utils.conversations.list.invalidate();
      setLocation(`/chat/${conversation.id}`);
    } catch {
      setChatError("Chat couldn't open. Please try again.");
    } finally {
      openingChat.current = false;
      setIsOpeningChat(false);
    }
  };

  return (
    <div className="w-full relative rounded-2xl overflow-hidden group bg-[#111] transition-all duration-300 shadow-xl border border-border">
      {/* Keep portfolio and chat as separate controls with independent targets. */}
      <div className="relative h-[140px]">
        <button
          type="button"
          className="w-full h-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          aria-label={`${expanded ? "Hide" : "View"} ${artistName}'s portfolio`}
          aria-expanded={expanded}
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
          <div className="relative z-10 flex items-end p-4 pr-[76px] h-[140px]">
            <div className="flex items-center gap-3 w-full">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-secondary/50 border-2 border-border overflow-hidden shrink-0 shadow-lg">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={artistName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent">
                    <span className="text-white font-bold text-lg">
                      {artistName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Name + unread */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-white font-bold text-lg leading-tight truncate drop-shadow-md">
                  {artistName}
                </p>
                {conv.unreadCount > 0 && (
                  <p className="text-primary text-xs font-medium mt-0.5">
                    {conv.unreadCount} unread message
                    {conv.unreadCount > 1 ? "s" : ""}
                  </p>
                )}
                {/* Subtle hint when collapsed */}
                {!expanded && (
                  <p className="text-white/30 text-[10px] mt-0.5">
                    Tap to view portfolio
                  </p>
                )}
              </div>
            </div>
          </div>
        </button>
        <button
          type="button"
          aria-label={
            isOpeningChat ? "Opening chat" : `Chat with ${artistName}`
          }
          aria-busy={isOpeningChat}
          disabled={isOpeningChat}
          onClick={openChat}
          className="absolute z-10 bottom-[18px] right-4 shrink-0 w-11 h-11 rounded-full bg-secondary/50 backdrop-blur-xl border border-border flex items-center justify-center hover:bg-secondary/70 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {isOpeningChat ? (
            <Loader2
              className="w-4 h-4 animate-spin text-white"
              aria-hidden="true"
            />
          ) : (
            <MessageCircle className="w-4 h-4 text-white" aria-hidden="true" />
          )}
          {conv.unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-white text-[10px] font-bold shadow-lg ring-2 ring-black"
            >
              {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
            </span>
          )}
        </button>
      </div>

      {chatError && (
        <div className="px-3 py-2 border-t border-border bg-card text-card-foreground">
          <p role="alert" className="text-sm text-[var(--v3-red)]">
            {chatError}
          </p>
          <button
            type="button"
            onClick={openChat}
            className="min-h-11 font-semibold text-sm text-primary"
          >
            Retry chat
          </button>
        </div>
      )}

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
              showMessageCTA={false}
            />
            <div className="px-3 pb-4">
              <button
                type="button"
                onClick={openChat}
                disabled={isOpeningChat}
                aria-busy={isOpeningChat}
                className="w-full flex items-center justify-center gap-2 min-h-11 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {isOpeningChat ? (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                )}
                {isOpeningChat ? "Opening chat…" : `Message ${artistName}`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
