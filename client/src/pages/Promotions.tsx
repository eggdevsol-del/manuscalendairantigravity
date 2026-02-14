/**
 * Promotions Page - SSOT Compliant
 * 
 * Powered by usePromotionsController for logic.
 * Uses centralized Button variants for styling.
 * 
 * @version 1.1.0
 */

import { useState } from "react";
import { useTeaser } from "@/contexts/TeaserContext";
import { InstallAppModal } from "@/components/modals/InstallAppModal";
import { Lock } from "lucide-react";
import { PageShell, PageHeader, GlassSheet, FullScreenSheet } from "@/components/ui/ssot";
import { Button } from "@/components/ui/button";
import { Gift, Percent, CreditCard, Plus, Send, Calendar, Check, Edit, Trash2 } from "lucide-react";
import { motion, AnimatePresence, useAnimation, useMotionValue, PanInfo } from "framer-motion";
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
  getTypeDefaults,
  SendPromotionSheet,
  CreatePromotionWizard,
  PromotionBurgerMenu,
  PromotionGrid
} from "@/features/promotions";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { usePromotionsController } from "./usePromotionsController";

export default function Promotions() {
  const {
    isArtist,
    promotions,
    isLoading,
    selectedCardId,
    setSelectedCardId,
    focalIndex,
    setFocalIndex,
    showCreateWizard,
    showSendSheet,
    setShowSendSheet,
    showAutoApplySheet,
    setShowAutoApplySheet,
    editingPromotion,
    showDeleteDialog,
    setShowDeleteDialog,
    deleteMutation,
    handleDelete,
    handleEdit,
    handleUseOnBooking,
    handleCreate,
    closeCreateWizard,
    refetch,
    setShowCreateWizard
  } = usePromotionsController();

  // Teaser Mode
  const { isTeaserClient } = useTeaser();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [viewMode, setViewMode] = useState<'swipe' | 'grid'>('grid');
  const [fabOpen, setFabOpen] = useState(false);

  const filteredCards = promotions || [];
  const selectedCard = filteredCards.find(c => c.id === selectedCardId);

  // Auto-select first card if none selected (for swipe view mainly) - actually logic handles this via focalIndex
  const activeCard = selectedCard || (viewMode === 'swipe' ? filteredCards[focalIndex] : null);

  const handleMenuAction = (action: 'create' | 'send' | 'auto-apply' | 'settings') => {
    switch (action) {
      case 'create':
        handleCreate();
        break;
      case 'send':
        if (activeCard) {
          // If we're using the focal card, we might want to ensure it's "selected" for other logic, but for now just using it for the sheet is enough.
          // However, for consistency, let's just use activeCard in the sheet render.
          setShowSendSheet(true);
        }
        else toast.error("Please select a promotion first");
        break;
      case 'auto-apply':
        if (activeCard) setShowAutoApplySheet(true);
        else toast.error("Please select a promotion first");
        break;
      case 'settings':
        // Placeholder for voucher settings or specific edit
        if (activeCard && isArtist) {
          // If using focal card, we should probably select it so edit works expectedly if it relies on selection
          if (!selectedCardId) setSelectedCardId(activeCard.id);
          handleEdit();
        }
        else toast.error("Select a voucher to edit settings");
        break;
    }
  };

  return (
    <PageShell>
      <InstallAppModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />

      <PageHeader
        title="Promotions"
      />

      <div className="relative flex-1 flex flex-col overflow-hidden h-full">
        {/* Teaser Mode Overlay */}
        {isTeaserClient && (
          <div
            className="absolute inset-0 z-50 bg-background/60 backdrop-blur-[2px] flex items-center justify-center cursor-pointer transition-all hover:bg-background/70"
            onClick={() => setShowInstallModal(true)}
          >
            <div className="flex flex-col items-center gap-3 p-8 rounded-[2rem] bg-card/90 border border-white/10 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Promotions Locked</h3>
              <button className="text-sm font-medium text-primary hover:underline">
                Install app to unlock
              </button>
            </div>
          </div>
        )}

        <div className={cn("flex flex-col h-full overflow-hidden relative", isTeaserClient && "filter blur-sm pointer-events-none")}>

          <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center pb pb-[80px]">
            {/* Added padding bottom to account for BottomNav area */}

            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="min-h-[300px] flex items-center justify-center">
                <EmptyState type="voucher" isArtist={isArtist} onCreate={handleCreate} />
              </div>
            ) : viewMode === 'swipe' ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-visible">
                <AnimatePresence>
                  {filteredCards.map((card, index) => {
                    const position = index - focalIndex;
                    const isSelected = selectedCardId === card.id;
                    const isFocal = focalIndex === index;
                    const cardOffset = 180;

                    // Only render cards within range to improve performance
                    if (Math.abs(position) > 2) return null;

                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 100 }}
                        animate={{
                          opacity: Math.max(0, 1 - Math.abs(position) * 0.4),
                          y: position * cardOffset, // Vertical Stack
                          scale: 1 - Math.abs(position) * 0.05,
                          zIndex: 50 - Math.abs(position),
                          filter: `blur(${Math.min(4, Math.abs(position) * 2)}px)`,
                        }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ type: "spring", stiffness: 280, damping: 28, mass: 0.8 }}
                        style={{ position: 'absolute', width: '100%', transformOrigin: 'center center', cursor: isFocal ? 'grab' : 'pointer', touchAction: 'none' }}
                        onClick={() => {
                          if (isFocal) {
                            const newId = selectedCardId === card.id ? null : card.id;
                            setSelectedCardId(newId);
                            if (newId) setFabOpen(true);
                          }
                          else { setFocalIndex(index); setSelectedCardId(null); }
                        }}
                      >
                        <SwipeableCardWrapper
                          isFocal={isFocal}
                          onSwipe={(direction) => {
                            if (direction === 'up' && focalIndex < filteredCards.length - 1) { setFocalIndex(prev => prev + 1); setSelectedCardId(null); }
                            else if (direction === 'down' && focalIndex > 0) { setFocalIndex(prev => prev - 1); setSelectedCardId(null); }
                          }}
                        >
                          <PromotionCard data={card as PromotionCardData} selected={isSelected} size="lg" className="w-full shadow-2xl rounded-2xl" />
                        </SwipeableCardWrapper>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              /* GRID VIEW */
              <PromotionGrid
                cards={filteredCards}
                onSelect={(card) => {
                  setSelectedCardId(card.id);
                  setFabOpen(true);
                  // Sync focal index for smooth transition back to swipe
                  const idx = filteredCards.findIndex(c => c.id === card.id);
                  if (idx !== -1) setFocalIndex(idx);
                }}
                selectedCardId={selectedCardId}
              />
            )}
          </div>
        </div>

        {/* FAB Menu */}
        {isArtist && (
          <PromotionBurgerMenu
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAction={handleMenuAction}
            isOpen={fabOpen}
            onOpenChange={setFabOpen}
          />
        )}

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Promotion?</DialogTitle>
              <DialogDescription>Permanently delete "{activeCard?.name}"? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {showSendSheet && activeCard && (
          <SendPromotionSheet isOpen={showSendSheet} onClose={() => setShowSendSheet(false)} promotion={activeCard as PromotionCardData} />
        )}

        {showAutoApplySheet && activeCard && (
          <AutoApplySheet isOpen={showAutoApplySheet} onClose={() => setShowAutoApplySheet(false)} promotion={activeCard as PromotionCardData} onSave={() => { setShowAutoApplySheet(false); refetch(); }} />
        )}
      </div>
    </PageShell>
  );
}

function EmptyState({ type, isArtist, onCreate }: { type: PromotionType; isArtist: boolean; onCreate: () => void; }) {
  const defaults = getTypeDefaults(type);
  const Icon = type === 'voucher' ? Gift : type === 'discount' ? Percent : CreditCard;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No {defaults.labelPlural} Yet</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        {isArtist ? `Create your first ${defaults.labelSingular.toLowerCase()} to reward your clients` : `You don't have any ${defaults.labelPlural.toLowerCase()} yet`}
      </p>
      {isArtist && <Button onClick={onCreate} variant="default"><Plus className="w-4 h-4 mr-2" /> Create {defaults.labelSingular}</Button>}
    </div>
  );
}

function AutoApplySheet({ isOpen, onClose, promotion, onSave }: { isOpen: boolean; onClose: () => void; promotion: PromotionCardData; onSave: () => void; }) {
  const [isAutoApply, setIsAutoApply] = useState(promotion.isAutoApply || false);
  const [startDate, setStartDate] = useState(promotion.autoApplyStartDate ? new Date(promotion.autoApplyStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(promotion.autoApplyEndDate ? new Date(promotion.autoApplyEndDate).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  const updateAutoApply = trpc.promotions.updateAutoApply.useMutation({
    onSuccess: () => { toast.success('Auto-apply settings saved'); onSave(); },
    onError: (error) => { toast.error('Failed to save settings', { description: error.message }); },
  });

  const handleSave = () => {
    updateAutoApply.mutate({ templateId: promotion.id, isAutoApply, startDate: isAutoApply ? startDate : undefined, endDate: isAutoApply ? endDate : undefined });
  };

  return (
    <FullScreenSheet open={isOpen} onClose={onClose} title="Auto-Apply Settings">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-xl">
          <div>
            <p className="font-medium text-foreground">Auto-apply to new clients</p>
            <p className="text-sm text-muted-foreground">Automatically give this promotion to new signups</p>
          </div>
          <button onClick={() => setIsAutoApply(!isAutoApply)} className={cn("w-14 h-8 rounded-full transition-colors relative", isAutoApply ? "bg-primary" : "bg-gray-300 dark:bg-gray-600")}>
            <div className={cn("absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform", isAutoApply ? "translate-x-7" : "translate-x-1")} />
          </button>
        </div>
        {isAutoApply && (
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-foreground mb-2">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 rounded-xl border border-border bg-background text-foreground" /></div>
            <div><label className="block text-sm font-medium text-foreground mb-2">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 rounded-xl border border-border bg-background text-foreground" /></div>
          </div>
        )}
        <Button variant="default" className="w-full" onClick={handleSave} disabled={updateAutoApply.isPending}>{updateAutoApply.isPending ? 'Saving...' : 'Save Settings'}</Button>
      </div>
    </FullScreenSheet>
  );
}

function SwipeableCardWrapper({ children, isFocal, onSwipe }: { children: React.ReactNode; isFocal: boolean; onSwipe: (direction: 'up' | 'down') => void; }) {
  const controls = useAnimation();
  const y = useMotionValue(0);
  function onDragEnd(_: any, info: PanInfo) {
    const threshold = 50;
    if (info.offset.y < -threshold || info.velocity.y < -500) onSwipe('up');
    else if (info.offset.y > threshold || info.velocity.y > 500) onSwipe('down');
    controls.start({ x: 0, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
  }
  return (
    <motion.div drag={isFocal ? "y" : false} dragElastic={0.12} dragMomentum={false} animate={controls} style={{ y }} onDragEnd={onDragEnd} className="w-full">
      {children}
    </motion.div>
  );
}
