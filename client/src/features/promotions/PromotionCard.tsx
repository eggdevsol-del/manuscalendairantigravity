/**
 * PromotionCard - SSOT Virtual EFTPOS Card Component
 * 
 * Renders a promotion (voucher/discount/credit) as a virtual EFTPOS-style card.
 * Supports customizable templates, colors, gradients, branding, and artist name.
 * 
 * @version 1.1.0
 */

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Gift, Percent, CreditCard } from "lucide-react";
import {
  PromotionType,
  buildCardBackground,
  getTextColor,
  getTemplateById,
  getTypeDefaults,
  formatPromotionValue,
  getContrastTextColor,
} from "./cardTemplates";

export interface PromotionCardData {
  id: number;
  type: PromotionType;
  name: string;
  description?: string;
  valueType: 'fixed' | 'percentage';
  value: number; // Original value
  remainingValue?: number; // For partially used
  templateDesign: string;
  primaryColor?: string | null;
  gradientFrom?: string | null;
  gradientTo?: string | null;
  customText?: string | null;
  customColor?: string; // For custom color picker
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  backgroundScale?: number;
  backgroundPositionX?: number;
  backgroundPositionY?: number;
  artistName?: string; // Artist name to display
  code?: string;
  status?: 'active' | 'partially_used' | 'fully_used' | 'expired' | 'revoked';
  expiresAt?: string | null;
  // Auto-apply fields
  isAutoApply?: boolean;
  autoApplyStartDate?: string | null;
  autoApplyEndDate?: string | null;
  // Computed fields handling
  originalValue?: number;
}

interface PromotionCardProps {
  data: PromotionCardData;
  selected?: boolean;
  blurred?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const TypeIcon = {
  voucher: Gift,
  discount: Percent,
  credit: CreditCard,
};

export function PromotionCard({
  data,
  selected = false,
  blurred = false,
  onClick,
  className,
  size = 'md',
}: PromotionCardProps) {
  const template = getTemplateById(data.templateDesign) || getTemplateById('classic')!;
  const typeDefaults = getTypeDefaults(data.type);
  const Icon = TypeIcon[data.type];

  // Build base background style (Colors/Gradients only)
  // We handle the Image manually in a layer above
  const baseBackground = buildCardBackground(
    data.gradientFrom || null,
    data.primaryColor || null,
    data.customColor
  );

  // Image styles
  const imageStyles = data.backgroundImageUrl ? {
    backgroundImage: `url(${data.backgroundImageUrl})`,
    backgroundSize: `${(data.backgroundScale || 1) * 100}%`,
    backgroundPosition: `${data.backgroundPositionX ?? 50}% ${data.backgroundPositionY ?? 50}%`,
    backgroundRepeat: 'no-repeat',
  } : undefined;

  // Determine text color
  let textColor: 'white' | 'black' = 'white';
  if (data.customColor) {
    textColor = getContrastTextColor(data.customColor);
  } else if (data.gradientFrom || data.primaryColor) {
    // If we have a color background, calculate contrast
    textColor = getTextColor(data.gradientFrom, data.primaryColor);
  }

  // Size classes
  const sizeClasses = {
    sm: 'w-48 text-xs',
    md: 'w-72 text-sm',
    lg: 'w-96 text-base',
  };

  // Format display value
  const displayValue = formatPromotionValue(
    data.remainingValue ?? data.value,
    data.type,
    data.valueType
  );

  // Check if partially used
  const isPartiallyUsed = data.remainingValue !== undefined && data.remainingValue < data.value;

  return (
    <motion.div
      className={cn(
        "relative cursor-pointer transition-all duration-300",
        sizeClasses[size],
        blurred && "opacity-40 blur-[2px] scale-95",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 z-10",
        className
      )}
      style={{ aspectRatio: template.aspectRatio }}
      onClick={onClick}
      whileHover={{ scale: blurred ? 0.95 : 1.02 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      {/* Card Body */}
      <div
        className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl"
        style={{ background: baseBackground }}
      >
        {/* Background Image Layer */}
        {data.backgroundImageUrl && (
          <div
            className="absolute inset-0 transition-all duration-200"
            style={imageStyles}
          />
        )}

        {/* Overlay for background images - Optional, maybe only if no color selected? 
            Keeping it simple: If BG image exists, add slight overlay for text contrast if needed, 
            BUT user wants "actually transparent", so we should actully REMOVE any forced overlay 
            or make it very subtle/user controlled. 
            Removing standard overlay to respect transparency request.
        */}

        {/* Hologram effect for premium template */}
        {template.hasHologram && (
          <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gradient-to-br from-white/40 via-transparent to-white/20 animate-pulse z-10" />
        )}

        {/* Chip for EFTPOS style */}
        {template.hasChip && (
          <div className="absolute top-6 left-6">
            <div className="w-10 h-8 rounded-md bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 shadow-inner">
              <div className="absolute inset-1 grid grid-cols-2 gap-0.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-yellow-700/30 rounded-sm" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Magnetic stripe */}
        {template.hasMagStripe && (
          <div className="absolute bottom-12 left-0 right-0 h-8 bg-black/80" />
        )}

        {/* Logo area */}
        {data.logoUrl ? (
          <img
            src={data.logoUrl}
            alt="Logo"
            className={cn(
              "absolute w-12 h-12 object-contain bg-white/90 rounded-lg p-1",
              template.logoPosition === 'top-left' && "top-4 left-4",
              template.logoPosition === 'top-right' && "top-4 right-4",
              template.logoPosition === 'bottom-left' && "bottom-4 left-4",
              template.logoPosition === 'bottom-right' && "bottom-4 right-4",
              template.logoPosition === 'center' && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            )}
          />
        ) : (
          <div
            className={cn(
              "absolute flex items-center gap-2",
              template.logoPosition === 'top-left' && "top-4 left-4",
              template.logoPosition === 'top-right' && "top-4 right-4",
              template.logoPosition === 'bottom-left' && "bottom-4 left-4",
              template.logoPosition === 'bottom-right' && "bottom-4 right-4",
              template.logoPosition === 'center' && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              textColor === 'white' ? 'text-white' : 'text-black'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="font-semibold text-xs uppercase tracking-wider opacity-80">
              {typeDefaults.labelSingular}
            </span>
          </div>
        )}

        {/* Card name / Custom text */}
        <div
          className={cn(
            "absolute left-6 right-6",
            template.hasChip ? "top-16" : "top-6",
            textColor === 'white' ? 'text-white' : 'text-black'
          )}
        >
          <h3 className="font-bold text-lg truncate">
            {data.customText || data.name}
          </h3>
          {data.description && (
            <p className="text-xs opacity-70 truncate mt-0.5">
              {data.description}
            </p>
          )}
        </div>

        {/* Value display */}
        <div
          className={cn(
            "absolute",
            template.valuePosition === 'center' && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            template.valuePosition === 'bottom-left' && "bottom-4 left-6",
            template.valuePosition === 'bottom-right' && "bottom-4 right-6",
            textColor === 'white' ? 'text-white' : 'text-black'
          )}
        >
          <div className="font-bold text-2xl tracking-tight">
            {displayValue}
          </div>
          {isPartiallyUsed && (
            <div className="text-xs opacity-60">
              of {formatPromotionValue(data.value, data.type, data.valueType)}
            </div>
          )}
        </div>

        {/* Artist name - bottom right corner */}
        {data.artistName && (
          <div
            className={cn(
              "absolute bottom-3 right-4 text-xs font-medium opacity-80",
              textColor === 'white' ? 'text-white' : 'text-black'
            )}
          >
            {data.artistName}
          </div>
        )}

        {/* Code display (bottom center, only if no artist name or different position) */}
        {data.code && !data.artistName && (
          <div
            className={cn(
              "absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-xs tracking-widest opacity-60",
              textColor === 'white' ? 'text-white' : 'text-black'
            )}
          >
            {data.code}
          </div>
        )}

        {/* Code display (bottom left if artist name is shown) */}
        {data.code && data.artistName && (
          <div
            className={cn(
              "absolute bottom-3 left-4 font-mono text-xs tracking-widest opacity-60",
              textColor === 'white' ? 'text-white' : 'text-black'
            )}
          >
            {data.code}
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {data.isAutoApply && (
            <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-1">
              <span>Auto Apply</span>
            </div>
          )}

          {data.status && data.status !== 'active' && (
            <div
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium",
                data.status === 'partially_used' && "bg-yellow-500/80 text-yellow-900",
                data.status === 'fully_used' && "bg-gray-500/80 text-white",
                data.status === 'expired' && "bg-red-500/80 text-white",
                data.status === 'revoked' && "bg-red-700/80 text-white"
              )}
            >
              {data.status === 'partially_used' && 'Partially Used'}
              {data.status === 'fully_used' && 'Used'}
              {data.status === 'expired' && 'Expired'}
              {data.status === 'revoked' && 'Revoked'}
            </div>
          )}
        </div>

        {/* Expiry date - show above artist name if present */}
        {data.expiresAt && data.status === 'active' && (
          <div
            className={cn(
              "absolute text-xs opacity-60",
              data.artistName ? "bottom-8 right-4" : "bottom-4 right-6",
              textColor === 'white' ? 'text-white' : 'text-black'
            )}
          >
            Expires: {new Date(data.expiresAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Build card background with position controls for background images
 */
function buildCardBackgroundWithPosition(
  gradientId: string | null,
  colorId: string | null,
  customColor: string | undefined,
  backgroundImageUrl: string | null,
  scale: number,
  positionX: number,
  positionY: number
): string {
  // Priority: Background image > Custom color > Gradient > Solid color
  if (backgroundImageUrl) {
    const scalePercent = scale * 100;
    return `url(${backgroundImageUrl}) ${positionX}% ${positionY}% / ${scalePercent}% no-repeat`;
  }

  if (customColor) {
    return customColor;
  }

  // Use the existing buildCardBackground for gradients and solid colors
  return buildCardBackground(gradientId, colorId, null);
}

export default PromotionCard;
