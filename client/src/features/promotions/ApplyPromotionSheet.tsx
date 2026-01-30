/**
 * ApplyPromotionSheet - SSOT Compliant
 * 
 * Allows clients to select and apply a promotion during the booking acceptance flow.
 * Shows available promotions as stacked cards and calculates the discount.
 * 
 * @version 1.0.0
 */

import { useState } from "react";
import { HalfSheet } from "@/components/ui/ssot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Percent, CreditCard, Check, Tag } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PromotionCard, PromotionCardData } from "./PromotionCard";
import { formatPromotionValue } from "./cardTemplates";

interface AvailablePromotion {
  id: number;
  type: 'voucher' | 'discount' | 'credit';
  name: string;
  valueType: 'fixed' | 'percentage';
  value: number;
  remainingValue: number;
  templateDesign: string;
  primaryColor?: string | null;
  gradientFrom?: string | null;
  code: string;
  expiresAt?: string | null;
}

interface ApplyPromotionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  artistId: string;
  originalAmount: number; // in cents
  onApply: (promotion: AvailablePromotion, discountAmount: number, finalAmount: number) => void;
}

export function ApplyPromotionSheet({
  isOpen,
  onClose,
  artistId,
  originalAmount,
  onApply,
}: ApplyPromotionSheetProps) {
  const [selectedPromotion, setSelectedPromotion] = useState<AvailablePromotion | null>(null);
  
  // Fetch available promotions
  const { data: promotions, isLoading } = trpc.promotions.getAvailableForBooking.useQuery(
    { artistId },
    { enabled: isOpen }
  );
  
  // Calculate discount for selected promotion
  const calculateDiscount = (promo: AvailablePromotion): { discountAmount: number; finalAmount: number } => {
    let discountAmount: number;
    
    if (promo.valueType === 'percentage') {
      discountAmount = Math.round(originalAmount * (promo.remainingValue / 100));
    } else {
      discountAmount = Math.min(promo.remainingValue, originalAmount);
    }
    
    const finalAmount = Math.max(0, originalAmount - discountAmount);
    return { discountAmount, finalAmount };
  };
  
  const selectedDiscount = selectedPromotion ? calculateDiscount(selectedPromotion) : null;
  
  // Handle apply
  const handleApply = () => {
    if (selectedPromotion && selectedDiscount) {
      onApply(selectedPromotion, selectedDiscount.discountAmount, selectedDiscount.finalAmount);
      onClose();
    }
  };
  
  return (
    <HalfSheet
      open={isOpen}
      onClose={onClose}
      title="Apply Promotion"
    >
      <div className="space-y-6">
        {/* Original Amount Display */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-black/5 dark:bg-white/5">
          <span className="text-sm text-muted-foreground">Booking Total</span>
          <span className="text-xl font-bold text-foreground">
            ${(originalAmount / 100).toFixed(2)}
          </span>
        </div>
        
        {/* Available Promotions */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !promotions || promotions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Tag className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No Promotions Available
            </h3>
            <p className="text-sm text-muted-foreground">
              You don't have any promotions to apply to this booking.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Select a promotion to apply:
            </p>
            
            {promotions.map((promo) => {
              const isSelected = selectedPromotion?.id === promo.id;
              const { discountAmount, finalAmount } = calculateDiscount(promo as AvailablePromotion);
              const Icon = promo.type === 'voucher' ? Gift : promo.type === 'discount' ? Percent : CreditCard;
              
              return (
                <button
                  key={promo.id}
                  onClick={() => setSelectedPromotion(isSelected ? null : promo as AvailablePromotion)}
                  className={cn(
                    "w-full p-4 rounded-xl border transition-all text-left",
                    isSelected
                      ? "bg-primary/10 border-primary/50"
                      : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-black/10 dark:bg-white/10"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground truncate">
                          {promo.name}
                        </h4>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 ml-2">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formatPromotionValue(promo.remainingValue, promo.type, promo.valueType)}
                        {promo.valueType === 'fixed' && promo.remainingValue < promo.value && (
                          <span className="text-xs opacity-60 ml-1">
                            (of {formatPromotionValue(promo.value, promo.type, promo.valueType)})
                          </span>
                        )}
                      </p>
                      
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3 pt-3 border-t border-primary/20"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Discount:</span>
                            <span className="font-bold text-green-500">
                              -${(discountAmount / 100).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-muted-foreground">New Total:</span>
                            <span className="font-bold text-foreground">
                              ${(finalAmount / 100).toFixed(2)}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        
        {/* Summary & Apply Button */}
        {selectedPromotion && selectedDiscount && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Original:</span>
                <span className="text-sm line-through text-muted-foreground">
                  ${(originalAmount / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-green-500">Discount:</span>
                <span className="text-sm font-bold text-green-500">
                  -${(selectedDiscount.discountAmount / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-green-500/20">
                <span className="font-semibold text-foreground">New Total:</span>
                <span className="text-xl font-bold text-foreground">
                  ${(selectedDiscount.finalAmount / 100).toFixed(2)}
                </span>
              </div>
            </div>
            
            <Button
              className="w-full h-14 rounded-xl font-bold text-base"
              onClick={handleApply}
            >
              Apply {selectedPromotion.name}
            </Button>
          </motion.div>
        )}
        
        {/* Skip Button */}
        <Button
          variant="ghost"
          className="w-full"
          onClick={onClose}
        >
          Continue Without Promotion
        </Button>
      </div>
    </HalfSheet>
  );
}

export default ApplyPromotionSheet;
