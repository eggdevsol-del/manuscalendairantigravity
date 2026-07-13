/**
 * UserAvatar — SSOT Avatar Component
 *
 * Single source of truth for all user avatar rendering.
 * Displays the user's profile image, or a two-letter initials fallback
 * using SSOT design tokens (DM Sans font, primary gradient).
 *
 * EVERY avatar in the app MUST use this component.
 *
 * @version 1.0.0
 */

import { cn } from "@/lib/utils";
import { getAssetUrl } from "@/lib/assets";
import { useState } from "react";

export interface UserAvatarProps {
  /** User's display name — used to generate initials */
  name?: string | null;
  /** Avatar image URL (can be relative or absolute) */
  avatar?: string | null;
  /** Predefined size */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /** Additional CSS classes */
  className?: string;
  /** Whether to show a ring/border */
  ring?: boolean;
}

const SIZE_MAP = {
  xs: { container: "w-7 h-7", text: "text-[10px]" },
  sm: { container: "w-8 h-8", text: "text-[11px]" },
  md: { container: "w-10 h-10", text: "text-[13px]" },
  lg: { container: "w-12 h-12", text: "text-[15px]" },
  xl: { container: "w-16 h-16", text: "text-[20px]" },
  "2xl": { container: "w-[112px] h-[112px]", text: "text-[36px]" },
} as const;

/**
 * Extract up to two initials from a name.
 * "John Smith" → "JS", "alice" → "A", "" → "?"
 */
function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  name,
  avatar,
  size = "lg",
  className,
  ring = false,
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeConfig = SIZE_MAP[size];
  const resolvedUrl = avatar ? getAssetUrl(avatar) : null;
  const showImage = resolvedUrl && !imgError;

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center overflow-hidden shrink-0",
        sizeConfig.container,
        !showImage && "bg-gradient-to-br from-primary to-accent",
        ring && "ring-2 ring-background shadow-md",
        className
      )}
    >
      {showImage ? (
        <img
          src={resolvedUrl}
          alt={name || "User"}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className={cn(
            'font-["DM_Sans"] font-bold text-white select-none',
            sizeConfig.text
          )}
        >
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
