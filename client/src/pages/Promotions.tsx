/**
 * Promotions Page - SSOT Compliant
 * 
 * Artist view: Create and manage gift vouchers, discount cards, and credits
 * Client view: View and redeem promotions
 * 
 * Features stacked virtual EFTPOS card display with selection animation.
 * 
 * @version 1.0.1
 */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageShell, PageHeader, GlassSheet, FullScreenSheet } from "@/components/ui/ssot";
import { Button } from "@/components/ui/button";
import { Plus, Gift, Percent, CreditCard, Send, Calendar, Users, Check, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  PromotionCard,
  PromotionCardData,
  PromotionType,
  TYPE_DEFAULTS,
  getTypeDefaults,
  CreatePromotionWizard,
  SendPromotionSheet,
} from "@/features/promotions";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Filter configuration
const FILTERS = [
  { id: 'all', label: 'All', icon: CollectionIcon },
  { id: 'voucher' as PromotionType, label: 'Vouchers', icon: Gift },
  { id: 'discount' as PromotionType, label: 'Discounts', icon: Percent },
  { id: 'credit' as PromotionType, label: 'Credits', icon: CreditCard },
];

function CollectionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01" />
      <path d="M10 10h.01" />
      <path d="M14 10h.01" />
    </svg>
  )
}

export default function Promotions() {
  const { user } = useAuth();
  const isArtist = user?.role === 'artist';

  const [activeFilter, setActiveFilter] = useState<'all' | PromotionType>('all');
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showSendSheet, setShowSendSheet] = useState(false);
  const [showAutoApplySheet, setShowAutoApplySheet] = useState(false);

  // Fetch promotions (all or filtered by type)
  const { data: promotions, isLoading, refetch } = trpc.promotions.getPromotions.useQuery(
    { type: activeFilter === 'all' ? undefined : activeFilter },
    { enabled: !!user }
  );

  // For the 'All' view, we might want to sort them or group them, but stacking them by date (default) is fine.
  // The query already orders by createdAt desc.
  const filteredCards = promotions || [];
  const selectedCard = filteredCards.find(c => c.id === selectedCardId);

  // Handle card selection
  const handleCardClick = (cardId: number) => {
    setSelectedCardId(prev => prev === cardId ? null : cardId);
  };

  // Handle client using promotion on booking
  const handleUseOnBooking = () => {
    if (!selectedCard) return;

    // Store the selected promotion in sessionStorage for use in booking flow
    sessionStorage.setItem('pendingPromotion', JSON.stringify({
      id: selectedCard.id,
      type: selectedCard.type,
      name: selectedCard.name,
      value: selectedCard.value,
      valueType: selectedCard.valueType,
      code: selectedCard.code,
    }));

    toast.success('Promotion ready to use!', {
      description: 'This will be applied to your next booking acceptance.',
    });
  };

  return (
    <PageShell>
      {/* Header */}
      <PageHeader
        title="Promotions"
      />

      {/* Context Area */}
      <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[15vh] opacity-80">
        <p className="text-4xl font-light text-foreground/90 tracking-tight">
          {isArtist ? 'Your Cards' : 'My Rewards'}
        </p>
        <p className="text-muted-foreground text-lg font-medium mt-1">
          {isArtist
            ? 'Create and send promotions to clients'
            : 'Redeem your vouchers and discounts'
          }
        </p>
      </div>

      {/* Glass Sheet */}
      <GlassSheet className="bg-card">
        {/* Filter Navigation */}
        <div className="flex gap-2 mb-6 px-2 overflow-x-auto no-scrollbar">
          {FILTERS.map(filter => {
            const isActive = activeFilter === filter.id;
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => {
                  setActiveFilter(filter.id as any);
                  setSelectedCardId(null);
                }}
                className={cn(
                  "flex items-center gap-2 py-2 px-4 rounded-full transition-all whitespace-nowrap border",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-lg"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{filter.label}</span>
              </button>
            );
          })}
        </div>

        {/* Card Stack Display */}
        <div className="relative min-h-[300px] flex flex-col items-center justify-center py-8">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredCards.length === 0 ? (
            <EmptyState
              type={activeFilter === 'all' ? 'voucher' : activeFilter}
              isArtist={isArtist}
              onCreate={() => setShowCreateWizard(true)}
            />
          ) : (
            <div className="relative w-full flex flex-col items-center min-h-[500px]">
              {filteredCards.map((card, index) => {
                const isSelected = selectedCardId === card.id;
                const anySelected = selectedCardId !== null;

                // Simplified Animation Logic:
                // 1. Stack vertically (y = index * 60)
                // 2. No translation on select (y stays same)
                // 3. Scale 5% on select (scale 1.05)
                // 4. Blur others 4px if any selected
                // 5. Z-index bump on select to float above

                const baseTop = index * 60; // Keep natural stack spacing

                return (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ opacity: 0, y: baseTop + 50 }}
                    animate={{
                      opacity: 1,
                      y: baseTop, // Maintain stack position
                      zIndex: isSelected ? 50 : index, // Pop to top if selected
                      scale: isSelected ? 1.05 : 1,
                      filter: anySelected && !isSelected ? "blur(4px)" : "blur(0px)",
                    }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30
                    }}
                    style={{
                      position: 'absolute',
                      top: 20,
                      width: '90%',
                      maxWidth: '400px',
                      transformOrigin: 'center center'
                    }}
                  >
                    <PromotionCard
                      data={card as PromotionCardData}
                      selected={isSelected}
                      blurred={anySelected && !isSelected}
                      onClick={() => handleCardClick(card.id)}
                      size="lg"
                    />
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons (when card selected) */}
        <AnimatePresence>
          {selectedCard && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 space-y-3 px-4"
            >
              {isArtist ? (
                <>
                  <Button
                    className="w-full h-14 rounded-xl font-bold text-base"
                    onClick={() => setShowSendSheet(true)}
                  >
                    <Send className="w-5 h-5 mr-2" />
                    Send to Client
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl"
                    onClick={() => setShowAutoApplySheet(true)}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Auto-Apply to New Clients
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="w-full h-14 rounded-xl font-bold text-base"
                    disabled={selectedCard.status !== 'active'}
                    onClick={handleUseOnBooking}
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Use on Next Booking
                  </Button>
                  {selectedCard.status !== 'active' && (
                    <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                      <Info className="w-4 h-4" />
                      This promotion has already been used
                    </p>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create New Button - Only visible for artists when no card is selected */}
        {isArtist && !selectedCardId && (
          <div className="sticky bottom-24 left-0 right-0 px-4 pt-6 pb-2 mt-8 bg-gradient-to-t from-card via-card to-transparent">
            <Button
              className="w-full h-14 rounded-2xl font-bold text-base shadow-lg"
              onClick={() => setShowCreateWizard(true)}
            >
              <Plus className="w-5 h-5 mr-2" />
              Create New {activeFilter === 'all' ? 'Voucher' : activeFilter === 'voucher' ? 'Voucher' : activeFilter === 'discount' ? 'Discount' : 'Credit'}
            </Button>
          </div>
        )}

        {/* Spacer for bottom nav */}
        <div className="h-32" />
      </GlassSheet>

      {/* Create Wizard Sheet */}
      {showCreateWizard && (
        <CreatePromotionWizard
          isOpen={showCreateWizard}
          onClose={() => {
            setShowCreateWizard(false);
            refetch();
          }}
          defaultType={activeFilter === 'all' ? 'voucher' : activeFilter}
        />
      )}

      {/* Send to Client Sheet */}
      {showSendSheet && selectedCard && (
        <SendPromotionSheet
          isOpen={showSendSheet}
          onClose={() => setShowSendSheet(false)}
          promotion={selectedCard as PromotionCardData}
        />
      )}

      {/* Auto-Apply Settings Sheet */}
      {showAutoApplySheet && selectedCard && (
        <AutoApplySheet
          isOpen={showAutoApplySheet}
          onClose={() => setShowAutoApplySheet(false)}
          promotion={selectedCard as PromotionCardData}
          onSave={() => {
            setShowAutoApplySheet(false);
            refetch();
          }}
        />
      )}
    </PageShell>
  );
}

// Empty state component
function EmptyState({
  type,
  isArtist,
  onCreate
}: {
  type: PromotionType;
  isArtist: boolean;
  onCreate: () => void;
}) {
  const defaults = getTypeDefaults(type);
  const Icon = type === 'voucher' ? Gift : type === 'discount' ? Percent : CreditCard;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No {defaults.labelPlural} Yet
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        {isArtist
          ? `Create your first ${defaults.labelSingular.toLowerCase()} to reward your clients`
          : `You don't have any ${defaults.labelPlural.toLowerCase()} yet`
        }
      </p>
      {isArtist && (
        <Button onClick={onCreate} className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          Create {defaults.labelSingular}
        </Button>
      )}
    </div>
  );
}

// Auto-Apply Settings Sheet
function AutoApplySheet({
  isOpen,
  onClose,
  promotion,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  promotion: PromotionCardData;
  onSave: () => void;
}) {
  const [isAutoApply, setIsAutoApply] = useState(promotion.isAutoApply || false);
  const [startDate, setStartDate] = useState(
    promotion.autoApplyStartDate
      ? new Date(promotion.autoApplyStartDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    promotion.autoApplyEndDate
      ? new Date(promotion.autoApplyEndDate).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const updateAutoApply = trpc.promotions.updateAutoApply.useMutation({
    onSuccess: () => {
      toast.success('Auto-apply settings saved');
      onSave();
    },
    onError: (error) => {
      toast.error('Failed to save settings', { description: error.message });
    },
  });

  const handleSave = () => {
    updateAutoApply.mutate({
      templateId: promotion.id,
      isAutoApply,
      startDate: isAutoApply ? startDate : undefined,
      endDate: isAutoApply ? endDate : undefined,
    });
  };

  return (
    <FullScreenSheet
      open={isOpen}
      onClose={onClose}
      title="Auto-Apply Settings"
    >
      <div className="p-6 space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-xl">
          <div>
            <p className="font-medium text-foreground">Auto-apply to new clients</p>
            <p className="text-sm text-muted-foreground">
              Automatically give this promotion to new signups
            </p>
          </div>
          <button
            onClick={() => setIsAutoApply(!isAutoApply)}
            className={cn(
              "w-14 h-8 rounded-full transition-colors relative",
              isAutoApply ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
            )}
          >
            <div
              className={cn(
                "absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform",
                isAutoApply ? "translate-x-7" : "translate-x-1"
              )}
            />
          </button>
        </div>

        {/* Date Range */}
        {isAutoApply && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-border bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-border bg-background text-foreground"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              New clients who sign up between these dates will automatically receive this promotion.
            </p>
          </div>
        )}

        {/* Save Button */}
        <Button
          className="w-full h-14 rounded-xl font-bold"
          onClick={handleSave}
          disabled={updateAutoApply.isPending}
        >
          {updateAutoApply.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </FullScreenSheet>
  );
}
