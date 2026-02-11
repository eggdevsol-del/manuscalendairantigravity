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
    refetch
  } = usePromotionsController();

  // Teaser Mode
  const { isTeaserClient } = useTeaser();
  const [showInstallModal, setShowInstallModal] = useState(false);

  const filteredCards = promotions || [];
  const selectedCard = filteredCards.find(c => c.id === selectedCardId);

  return (
    <PageShell>
      <InstallAppModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />

      <PageHeader title="Promotions" />

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

        <div className={cn("hidden px-6 pt-4 pb-8 z-10 shrink-0 flex-col justify-center h-[15vh] opacity-80", !isTeaserClient && "flex")}>
          <p className="text-4xl font-light text-foreground/90 tracking-tight">
            {isArtist ? 'Your Cards' : 'My Rewards'}
          </p>
          <p className="text-muted-foreground text-lg font-medium mt-1">
            {isArtist ? 'Create and send promotions to clients' : 'Redeem your vouchers and discounts'}
          </p>
        </div>

        <div className={cn("flex flex-col h-full overflow-hidden", isTeaserClient && "filter blur-sm pointer-events-none")}>
          {/* Elevated Create Action */}
          <div className="flex justify-center mb-2 px-4 pt-4 shrink-0">
            {isArtist && (
              <Button
                variant="hero"
                onClick={handleCreate}
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Voucher
              </Button>
            )}
          </div>

          <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="min-h-[300px] flex items-center justify-center">
                <EmptyState type="voucher" isArtist={isArtist} onCreate={handleCreate} />
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center overflow-visible">
                <AnimatePresence>
                  {filteredCards.map((card, index) => {
                    const position = index - focalIndex;
                    const isSelected = selectedCardId === card.id;
                    const isFocal = focalIndex === index;
                    const cardOffset = 180;
                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 100 }}
                        animate={{
                          opacity: Math.max(0, 1 - Math.abs(position) * 0.4),
                          y: position * cardOffset,
                          scale: 1 - Math.abs(position) * 0.05,
                          zIndex: 50 - Math.abs(position),
                          filter: `blur(${Math.min(4, Math.abs(position) * 2)}px)`,
                        }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ type: "spring", stiffness: 280, damping: 28, mass: 0.8 }}
                        style={{ position: 'absolute', width: '100%', transformOrigin: 'center center', cursor: isFocal ? 'grab' : 'pointer', touchAction: 'none' }}
                        onClick={() => {
                          if (isFocal) setSelectedCardId(prev => prev === card.id ? null : card.id);
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
            )}
          </div>

          {/* Stable Footer Actions */}
          <div className="shrink-0 z-[60] bg-gradient-to-t from-card via-card to-transparent px-4 pb-24 pt-4 w-full relative min-h-[160px] flex items-center justify-center">
            <AnimatePresence mode="popLayout">
              {selectedCard && (
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
                      <Button variant="default" className="w-full" onClick={() => setShowSendSheet(true)}>
                        <Send className="w-4 h-4 mr-2" /> Send to Client
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="w-full" onClick={handleEdit}>
                          <Edit className="w-4 h-4 mr-2" /> Edit
                        </Button>
                        <Button variant="outline" className="w-full text-red-500 border-red-200" onClick={() => setShowDeleteDialog(true)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </Button>
                      </div>
                      <Button variant="outline" className="w-full" onClick={() => setShowAutoApplySheet(true)}>
                        <Calendar className="w-4 h-4 mr-2" /> Auto-Apply
                      </Button>
                    </>
                  ) : (
                    <Button variant="default" className="w-full" disabled={selectedCard.status !== 'active'} onClick={handleUseOnBooking}>
                      <Check className="w-4 h-4 mr-2" /> Use on Next Booking
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {showCreateWizard && (
          <CreatePromotionWizard onClose={closeCreateWizard} initialData={editingPromotion} />
        )}

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Promotion?</DialogTitle>
              <DialogDescription>Permanently delete "{selectedCard?.name}"? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {showSendSheet && selectedCard && (
          <SendPromotionSheet isOpen={showSendSheet} onClose={() => setShowSendSheet(false)} promotion={selectedCard as PromotionCardData} />
        )}

        {showAutoApplySheet && selectedCard && (
          <AutoApplySheet isOpen={showAutoApplySheet} onClose={() => setShowAutoApplySheet(false)} promotion={selectedCard as PromotionCardData} onSave={() => { setShowAutoApplySheet(false); refetch(); }} />
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
