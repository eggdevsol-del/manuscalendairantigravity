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
import { Gift, Percent, CreditCard, Plus, Send, Calendar, Check, Info, Settings, Edit, Trash2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence, useAnimation, useMotionValue, PanInfo, useTransform, animate, MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PromotionCard,
  PromotionCardData,
  PromotionType,
  TYPE_DEFAULTS,
  getTypeDefaults,
  SendPromotionSheet,
  CreatePromotionWizard,
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
  const [focalIndex, setFocalIndex] = useState(0);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showSendSheet, setShowSendSheet] = useState(false);
  const [showAutoApplySheet, setShowAutoApplySheet] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<PromotionCardData | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Reset focalIndex when filter changes
  const handleFilterChange = (filter: 'all' | PromotionType) => {
    setActiveFilter(filter);
    setSelectedCardId(null);
    setFocalIndex(0);
  };

  // Fetch promotions (all or filtered by type)
  const { data: promotions = [], isLoading, refetch } = trpc.promotions.getPromotions.useQuery(
    { type: activeFilter === 'all' ? undefined : activeFilter },
    { enabled: !!user }
  );

  const deleteMutation = trpc.promotions.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success('Promotion deleted');
      setSelectedCardId(null);
      setShowDeleteDialog(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete promotion');
    }
  });

  const handleDelete = () => {
    if (selectedCardId) {
      deleteMutation.mutate({ templateId: selectedCardId });
    }
  };

  const handleEdit = () => {
    if (selectedCard) {
      setEditingPromotion(selectedCard as PromotionCardData);
      setShowCreateWizard(true);
    }
  };

  // For the 'All' view, we might want to sort them or group them, but stacking them by date (default) is fine.
  // The query already orders by createdAt desc.
  const filteredCards = promotions || [];
  const selectedCard = filteredCards.find(c => c.id === selectedCardId);
  const sharedDragY = useMotionValue(0);

  // Handle card selection
  const handleCardClick = (cardId: number) => {
    console.log('[Promotions] Card clicked:', cardId, 'Current selected:', selectedCardId);
    setSelectedCardId(prev => {
      const newState = prev === cardId ? null : cardId;
      console.log('[Promotions] Setting selected card to:', newState);
      return newState;
    });
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
      <GlassSheet className="bg-card flex flex-col h-full overflow-hidden">
        {/* Filter Navigation */}
        <div className="flex gap-2 mb-6 px-2 overflow-x-auto no-scrollbar">
          {FILTERS.map(filter => {
            const isActive = activeFilter === filter.id;
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => handleFilterChange(filter.id as any)}
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

        {/* Vertical Carousel Display */}
        <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="min-h-[300px] flex items-center justify-center">
              <EmptyState
                type={activeFilter === 'all' ? 'voucher' : activeFilter}
                isArtist={isArtist}
                onCreate={() => setShowCreateWizard(true)}
              />
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center overflow-visible">
              {/* Debug render */}
              {(() => { console.log('[Promotions] Render - Loading:', isLoading, 'Cards:', filteredCards.length); return null; })()}
              <AnimatePresence>
                {filteredCards.map((card, index) => {
                  // Use focalIndex for positioning
                  const position = index - focalIndex;
                  const isSelected = selectedCardId === card.id;
                  const isFocal = focalIndex === index;

                  // Visual constants
                  const cardOffset = 180; // Increased offset for better visibility
                  const scaleFactor = 0.05;
                  const blurAmount = 4;

                  return (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, y: 100 }}
                      animate={{
                        opacity: Math.max(0, 1 - Math.abs(position) * 0.4),
                        y: position * cardOffset,
                        scale: 1 - Math.abs(position) * scaleFactor,
                        zIndex: 50 - Math.abs(position),
                        filter: `blur(${Math.min(blurAmount, Math.abs(position) * 2)}px)`,
                      }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{
                        type: "spring",
                        stiffness: 280, // Faster spring (approx 20% speedup)
                        damping: 28,
                        mass: 0.8
                      }}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        // Remove maxWidth to allow edge-to-edge on narrower screens
                        transformOrigin: 'center center',
                        cursor: isFocal ? 'grab' : 'pointer',
                        touchAction: 'none'
                      }}
                      whileTap={{ cursor: isFocal ? 'grabbing' : 'pointer' }}
                      onClick={() => {
                        if (isFocal) {
                          // Toggle selection only for centered card
                          setSelectedCardId(prev => prev === card.id ? null : card.id);
                        } else {
                          // If clicking background card, move it to center
                          setFocalIndex(index);
                          setSelectedCardId(null);
                        }
                      }}
                    >
                      <SwipeableCardWrapper
                        isFocal={isFocal}
                        position={position}
                        sharedDragY={sharedDragY}
                        onSwipe={(direction) => {
                          if (direction === 'up' && focalIndex < filteredCards.length - 1) {
                            setFocalIndex(prev => prev + 1);
                            setSelectedCardId(null);
                          } else if (direction === 'down' && focalIndex > 0) {
                            setFocalIndex(prev => prev - 1);
                            setSelectedCardId(null);
                          }
                        }}
                      >
                        <div className="px-0 w-full"> {/* Container for edge-to-edge */}
                          <PromotionCard
                            data={card as PromotionCardData}
                            selected={isSelected}
                            size="lg"
                            className="w-full shadow-2xl rounded-2xl"
                          />
                        </div>
                      </SwipeableCardWrapper>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Vertical Guide indicators (optional but helpful) */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                {filteredCards.map((card, idx) => (
                  <div
                    key={`dot-${card.id}`}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-300",
                      focalIndex === idx
                        ? "bg-primary h-4"
                        : "bg-white/20"
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stable Footer Controls Area */}
        <div className="shrink-0 z-[60] bg-gradient-to-t from-card via-card to-transparent px-4 pb-24 pt-4 w-full relative min-h-[200px] flex items-center justify-center">
          <AnimatePresence mode="popLayout">
            {selectedCard ? (
              <motion.div
                key="actions"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="w-full space-y-2 absolute top-1/2 left-0 right-0 -translate-y-1/2 px-4"
              >
                {isArtist ? (
                  <>
                    <Button
                      className="w-full h-12 rounded-xl font-bold text-sm"
                      onClick={() => setShowSendSheet(true)}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send to Client
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="h-10 rounded-xl text-sm"
                        onClick={handleEdit}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 rounded-xl text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900/30"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full h-10 rounded-xl text-sm"
                      onClick={() => setShowAutoApplySheet(true)}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Auto-Apply
                    </Button>

                    {(selectedCard as PromotionCardData).isAutoApply && (
                      <Button
                        className="w-full h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-sm"
                        onClick={() => setShowAutoApplySheet(true)}
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Edit Auto-Apply
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      className="w-full h-12 rounded-xl font-bold text-sm"
                      disabled={selectedCard.status !== 'active'}
                      onClick={handleUseOnBooking}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Use on Next Booking
                    </Button>
                    {selectedCard.status !== 'active' && (
                      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
                        <Info className="w-3 h-3" />
                        Promotion already used
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            ) : isArtist ? (
              <motion.div
                key="create"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="w-full absolute top-1/2 left-0 right-0 -translate-y-1/2 px-4"
              >
                <Button
                  className="w-full h-14 rounded-2xl font-bold text-base shadow-lg"
                  onClick={() => setShowCreateWizard(true)}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create New {activeFilter === 'all' ? 'Voucher' : activeFilter === 'voucher' ? 'Voucher' : activeFilter === 'discount' ? 'Discount' : 'Credit'}
                </Button>
              </motion.div>
            ) : (
              <div className="h-14" /> // Spacer for client view when nothing selected
            )}
          </AnimatePresence>
        </div>
      </GlassSheet>

      {/* Create Wizard Sheet */}
      {showCreateWizard && (
        <CreatePromotionWizard
          onClose={() => {
            setShowCreateWizard(false);
            setEditingPromotion(null);
            refetch();
          }}
          initialData={editingPromotion}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Promotion?</DialogTitle>
            <DialogDescription>
              This will permanently delete "{selectedCard?.name}". This action cannot be undone.
              Existing client cards using this template will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

// ------------------------------------
// SwipeableCardWrapper
// ------------------------------------
interface SwipeableCardWrapperProps {
  children: React.ReactNode;
  isFocal: boolean;
  position: number;
  sharedDragY: MotionValue<number>;
  onSwipe: (direction: 'up' | 'down') => void;
}

function SwipeableCardWrapper({ children, isFocal, position, sharedDragY, onSwipe }: SwipeableCardWrapperProps) {
  // Define coupling factor based on position
  // pos 0 -> 1.0, pos 1 -> ~0.31, pos 2 -> ~0.19, etc.
  const factor = 1 / (1 + Math.abs(position) * 2.2);

  // Use sharedDragY directly if focal, otherwise derive it with the factor
  const derivedY = isFocal
    ? sharedDragY
    : useTransform(sharedDragY, v => v * factor);

  function onDragEnd(_: any, info: PanInfo) {
    const threshold = 50;
    const offset = info.offset.y;
    const velocity = info.velocity.y;

    if (offset < -threshold || (velocity < -500)) { // Up
      onSwipe('up');
    } else if (offset > threshold || (velocity > 500)) { // Down
      onSwipe('down');
    }

    // Always snap sharedDragY back to 0 with spring
    animate(sharedDragY, 0, { type: "spring", stiffness: 300, damping: 30 });
  }

  return (
    <motion.div
      drag={isFocal ? "y" : false}
      // Free drag (no constraints) to allow 1:1 following
      dragElastic={0.12} // Ignored without constraints but keeping for completeness 
      dragMomentum={false}
      style={{ y: derivedY }}
      onDragEnd={onDragEnd}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
