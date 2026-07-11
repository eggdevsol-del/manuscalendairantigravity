/**
 * PortfolioExpand.tsx
 * Shared inline portfolio grid that expands inside an artist card.
 * Used by both ClientArtistCard (My Artists) and DiscoverArtistCard (Discover section).
 *
 * Features:
 * - Fetches portfolio images for a given artistId
 * - Masonry-style 3-column grid
 * - Tap an image → fullscreen lightbox (swipeable)
 * - Empty state with prompt to start a conversation
 * - "Message {artist}" CTA at the bottom
 */

import { useState } from "react";
import { Images, X, ChevronLeft, ChevronRight, MessageCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";

interface PortfolioExpandProps {
  artistId: string;
  artistName: string;
  onMessage?: () => void;         // fires when client taps "Message {artist}"
  showMessageCTA?: boolean;       // default true
}

export function PortfolioExpand({
  artistId,
  artistName,
  onMessage,
  showMessageCTA = true,
}: PortfolioExpandProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: portfolio = [], isLoading } = trpc.portfolio.list.useQuery(
    { artistId },
    { staleTime: 60000 }
  );

  // ── Lightbox controls ──────────────────────────────────────
  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () =>
    setLightboxIndex(i => (i !== null ? (i - 1 + portfolio.length) % portfolio.length : null));
  const nextImage = () =>
    setLightboxIndex(i => (i !== null ? (i + 1) % portfolio.length : null));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="px-3 pt-3 pb-4">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-3">
          <Images className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Portfolio
          </p>
          {portfolio.length > 0 && (
            <span className="text-[10px] text-muted-foreground/60">
              {portfolio.length} work{portfolio.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {portfolio.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center py-6 text-center gap-2">
            <Images className="w-8 h-8 text-muted-foreground/25" />
            <p className="text-muted-foreground text-xs">No portfolio images yet</p>
          </div>
        ) : (
          /* 3-col image grid */
          <div className="grid grid-cols-3 gap-1.5">
            {portfolio.map((item: any, index: number) => (
              <button
                key={item.id}
                onClick={() => openLightbox(index)}
                className="relative aspect-square rounded-xl overflow-hidden bg-secondary/30 active:scale-95 transition-transform"
              >
                <img
                  src={item.imageUrl}
                  alt={item.description || `Portfolio ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {/* Message CTA */}
        {showMessageCTA && onMessage && (
          <button
            onClick={onMessage}
            className="mt-4 w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-white font-semibold text-sm"
          >
            <MessageCircle className="w-4 h-4" />
            Message {artistName}
          </button>
        )}
      </div>

      {/* ── Fullscreen lightbox ───────────────────────────────── */}
      <AnimatePresence>
        {lightboxIndex !== null && portfolio[lightboxIndex] && (
          <motion.div
            className="fixed z-[900] bg-black/95 flex items-center justify-center"
            style={{
              top: 'env(safe-area-inset-top, 0px)',
              left: 0,
              right: 0,
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Back button — top left */}
            <button
              onClick={closeLightbox}
              className="absolute top-3 left-3 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>

            {/* Close button — top right */}
            <button
              onClick={closeLightbox}
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Counter */}
            <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-xs font-medium z-10">
              {lightboxIndex + 1} / {portfolio.length}
            </p>

            {/* Image */}
            <motion.img
              key={lightboxIndex}
              src={portfolio[lightboxIndex].imageUrl}
              alt=""
              className="max-w-full max-h-full object-contain select-none px-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              draggable={false}
            />

            {/* Prev / Next — only show when multiple images */}
            {portfolio.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </>
            )}

            {/* Caption */}
            {portfolio[lightboxIndex].description && (
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs text-center max-w-[280px]">
                {portfolio[lightboxIndex].description}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
