/**
 * FavouriteHeartButton.tsx
 * Reusable heart icon toggle for artist favouriting.
 * Used on DiscoverArtistCard, ClientArtistCard, and ArtistMapOverlay.
 */
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface FavouriteHeartButtonProps {
  artistId: string;
  isFavourited: boolean;
  onToggle: (artistId: string) => void;
  className?: string;
  size?: "sm" | "md";
}

export function FavouriteHeartButton({
  artistId,
  isFavourited,
  onToggle,
  className,
  size = "md",
}: FavouriteHeartButtonProps) {
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const btnSize = size === "sm" ? "w-8 h-8" : "w-9 h-9";

  return (
    <button
      onClick={e => {
        e.stopPropagation();
        e.preventDefault();
        onToggle(artistId);
      }}
      className={cn(
        btnSize,
        "rounded-full border flex items-center justify-center transition-all",
        isFavourited
          ? "bg-red-500/20 border-red-500/50 text-red-500"
          : "bg-secondary/50 text-white/60 border-border hover:text-red-400 hover:border-red-400/50",
        className
      )}
      aria-label={isFavourited ? "Remove from favourites" : "Add to favourites"}
    >
      <Heart
        className={cn(iconSize, "transition-all", isFavourited && "fill-current")}
      />
    </button>
  );
}
