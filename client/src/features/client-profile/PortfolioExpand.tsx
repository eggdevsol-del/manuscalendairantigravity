import { TourHelp } from "@/components/tooltip-tour/TourHelp";
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

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Images,
  X,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Loader2,
  Play,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";

interface PortfolioExpandProps {
  artistId: string;
  artistName: string;
  onMessage?: () => void; // fires when client taps "Message {artist}"
  showMessageCTA?: boolean; // default true
}

export function PortfolioExpand({
  artistId,
  artistName,
  onMessage,
  showMessageCTA = true,
}: PortfolioExpandProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const { data: portfolio = [], isLoading } = trpc.portfolio.list.useQuery(
    { artistId },
    { staleTime: 60000 }
  );

  // ── Lightbox controls ──────────────────────────────────────
  const openLightbox = (index: number, button: HTMLButtonElement) => {
    opener.current = button;
    setLightboxIndex(index);
  };
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () =>
    setLightboxIndex(i =>
      i !== null ? (i - 1 + portfolio.length) % portfolio.length : null
    );
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
            <p className="text-muted-foreground text-xs">
              No portfolio images yet
            </p>
          </div>
        ) : (
          /* 3-col image grid */
          <div className="grid grid-cols-3 gap-1.5">
            {portfolio.map((item: any, index: number) => (
              <button
                key={item.id}
                type="button"
                aria-label={`View ${item.description || `artwork ${index + 1}`}`}
                onClick={event => openLightbox(index, event.currentTarget)}
                className="relative aspect-square rounded-xl overflow-hidden bg-secondary/30 active:scale-95 transition-transform"
              >
                <img
                  src={item.displayUrl || item.imageUrl}
                  alt={item.description || `Portfolio ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {item.mediaType === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>
                )}
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
      <Dialog.Root
        open={lightboxIndex !== null}
        onOpenChange={open => {
          if (!open) closeLightbox();
        }}
      >
        <AnimatePresence>
          {lightboxIndex !== null && portfolio[lightboxIndex] && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay className="fixed inset-0 z-[9999] bg-black" />
              <Dialog.Content
                asChild
                aria-describedby={undefined}
                onCloseAutoFocus={event => {
                  event.preventDefault();
                  if (opener.current?.isConnected) opener.current.focus();
                }}
                onKeyDown={event => {
                  if (
                    portfolio.length < 2 ||
                    event.target instanceof HTMLVideoElement
                  )
                    return;
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    prevImage();
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    nextImage();
                  }
                }}
              >
                <motion.div
                  data-tour-surface="Artwork viewer"
                  className="fixed inset-0 z-[9999] bg-black flex items-center justify-center outline-none"
                  style={{
                    paddingTop: "calc(var(--app-safe-top, 0px) + 64px)",
                    paddingBottom: "calc(var(--app-safe-bottom, 0px) + 64px)",
                    paddingLeft: "var(--app-safe-left, 0px)",
                    paddingRight: "var(--app-safe-right, 0px)",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Dialog.Title className="sr-only">
                    {artistName}’s portfolio
                  </Dialog.Title>
                  <div className="absolute z-10" style={{
                    top: "calc(var(--app-safe-top, 0px) + 12px)",
                    left: "calc(var(--app-safe-left, 0px) + 12px)",
                  }}>
                    <TourHelp feature />
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close artwork"
                      className="absolute z-10 w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
                      style={{
                        top: "calc(var(--app-safe-top, 0px) + 12px)",
                        right: "calc(var(--app-safe-right, 0px) + 12px)",
                      }}
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </Dialog.Close>

                  {/* Counter */}
                  <p
                    className="absolute left-1/2 -translate-x-1/2 text-white/60 text-xs font-medium z-10"
                    style={{ top: "calc(var(--app-safe-top, 0px) + 26px)" }}
                    aria-live="polite"
                  >
                    {lightboxIndex + 1} / {portfolio.length}
                  </p>

                  {/* Media — video or image */}
                  {portfolio[lightboxIndex].mediaType === "video" ? (
                    <motion.video
                      key={lightboxIndex}
                      src={
                        (portfolio[lightboxIndex] as any).videoUrl ||
                        `/api/ig-video/${portfolio[lightboxIndex].id}`
                      }
                      poster={portfolio[lightboxIndex].imageUrl}
                      className="max-w-full max-h-full object-contain select-none px-4"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      autoPlay
                      muted
                      loop
                      playsInline
                      controls
                    />
                  ) : (
                    <motion.img
                      key={lightboxIndex}
                      src={portfolio[lightboxIndex].imageUrl}
                      alt={
                        portfolio[lightboxIndex].description ||
                        `Artwork ${lightboxIndex + 1}`
                      }
                      className="max-w-full max-h-full object-contain select-none px-4"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      draggable={false}
                    />
                  )}

                  {/* Prev / Next — only show when multiple images */}
                  {portfolio.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous artwork"
                        onClick={prevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center"
                      >
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next artwork"
                        onClick={nextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center"
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    </>
                  )}

                  {/* Caption */}
                  {portfolio[lightboxIndex].description && (
                    <p
                      className="absolute left-1/2 -translate-x-1/2 text-white/70 text-xs text-center max-w-[280px]"
                      style={{
                        bottom: "calc(var(--app-safe-bottom, 0px) + 16px)",
                      }}
                    >
                      {portfolio[lightboxIndex].description}
                    </p>
                  )}
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
}
