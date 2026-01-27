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

// Tab configuration
const TABS = [
  { id: 'voucher' as PromotionType, label: 'Vouchers', icon: Gift },
  { id: 'discount' as PromotionType, label: 'Discounts', icon: Percent },
  { id: 'credit' as PromotionType, label: 'Credits', icon: CreditCard },
];

export default function Promotions() {
  const { user } = useAuth();
  const isArtist = user?.role === 'artist';

  const [activeTab, setActiveTab] = useState<PromotionType>('voucher');
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showSendSheet, setShowSendSheet] = useState(false);
  const [showAutoApplySheet, setShowAutoApplySheet] = useState(false);

  // Fetch promotions based on role
  const { data: promotions, isLoading, refetch } = trpc.promotions.getPromotions.useQuery(
    { type: activeTab },
    { enabled: !!user }
  );

  // Filter cards by type
  const filteredCards = (promotions || []).filter(p => p.type === activeTab);
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
      value: selectedCard.value || selectedCard.originalValue,
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
        rightElement={
          isArtist && (
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full bg-white/5 hover:bg-white/10"
              onClick={() => setShowCreateWizard(true)}
            >
              <Plus className="w-5 h-5" />
            </Button>
          )
        }
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
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 px-2">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedCardId(null);
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-black/5 dark:bg-white/5 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
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
              type={activeTab}
              isArtist={isArtist}
              onCreate={() => setShowCreateWizard(true)}
            />
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="relative w-full flex flex-col items-center min-h-[400px]">
                {filteredCards.map((card, index) => {
                  const isSelected = selectedCardId === card.id;

                  // Calculate visual properties based on selection state
                  // If a card is selected, it goes to top (y=0) and full opacity/no blur
                  // If no card is selected, they stack naturally
                  // If ANOTHER card is selected, this one steps back and blurs

                  let yOffset = 0;
                  let zIndex = 0;
                  let blurAmount = 0;
                  let scale = 1;

                  if (selectedCardId === null) {
                    // No selection: Stack normally
                    yOffset = index * 60; // Increased spacing for visibility
                    zIndex = index;
                    blurAmount = 0;
                  } else {
                    if (isSelected) {
                      // This is the selected card
                      yOffset = 0; // Moves to top/center
                      zIndex = 50; // High z-index
                      blurAmount = 0;
                      scale = 1.0; // Normal size (relative to container)
                    } else {
                      // This is an unselected card
                      // Stacked tighter and scaled down more to create "deck" effect
                      yOffset = 160 + (index * 12); // Tighter spacing (was 15)
                      zIndex = index; // Keep original order relative to each other
                      blurAmount = 4; // More blur to distinguish (was 2)
                      scale = 0.90; // Smaller scale for unselected (was 0.95)
                    }
                  }

                  return (
                    <motion.div
                      key={card.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: 1,
                        y: yOffset,
                        zIndex: zIndex,
                        scale: scale,
                        filter: `blur(${blurAmount}px)`,
                      }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 25
                      }}
                      style={{
                        position: 'absolute',
                        top: 20, // Base top position
                        width: '90%', // limit width to 90% of screenspace
                        maxWidth: '400px', // Ensure cards don't get too wide
                      }}
                    >
                      <PromotionCard
                        data={card as PromotionCardData}
                        selected={isSelected}
                        blurred={blurAmount > 0}
                        onClick={() => handleCardClick(card.id)}
                        size="lg"
                      />
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
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
              Create New {activeTab === 'voucher' ? 'Voucher' : activeTab === 'discount' ? 'Discount' : 'Credit'}
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
          defaultType={activeTab}
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
      isOpen={isOpen}
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
