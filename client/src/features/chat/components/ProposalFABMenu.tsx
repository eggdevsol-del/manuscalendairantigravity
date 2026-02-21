/**
 * ProposalFABMenu — FAB-based proposal details view
 *
 * Replaces the full-screen ProjectProposalModal Dialog.
 * Uses SSOT FABMenu shell in `children` mode with card tokens.
 */

import { useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Check, X as XIcon, AlertCircle, Tag, Calendar as CalendarIcon, Clock, DollarSign, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { tokens } from "@/ui/tokens";
import { FABMenu } from "@/ui/FABMenu";

interface ProposalMetadata {
    type: "project_proposal";
    serviceName: string;
    totalCost: number;
    sittings: number;
    dates: string[];
    status: 'pending' | 'accepted' | 'rejected' | 'canceled';
    serviceDuration?: number;
    depositAmount?: number;
    discountApplied?: boolean;
    discountAmount?: number;
    finalAmount?: number;
    promotionName?: string;
}

interface ProposalFABMenuProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    metadata: ProposalMetadata | null;
    message: any;
    isArtist: boolean;
    onAccept: (appliedPromotion?: { id: number; discountAmount: number; finalAmount: number }) => void;
    onReject: () => void;
    onCancel: () => void;
    isPendingAction: boolean;
    artistId?: string;
}

export function ProposalFABMenu({
    isOpen,
    onOpenChange,
    metadata,
    isArtist,
    onAccept,
    onReject,
    onCancel,
    isPendingAction,
    artistId,
}: ProposalFABMenuProps) {
    const [showVoucherList, setShowVoucherList] = useState(false);
    const [appliedPromotion, setAppliedPromotion] = useState<{
        id: number; name: string; discountAmount: number; finalAmount: number;
    } | null>(null);

    const { data: availablePromotions, isLoading: isLoadingPromotions } = trpc.promotions.getAvailableForBooking.useQuery(
        { artistId: artistId || "" },
        { enabled: isOpen && showVoucherList && !!artistId }
    );

    if (!metadata) return null;

    const { serviceName, totalCost, sittings, dates, status, serviceDuration, depositAmount,
        discountApplied, discountAmount: storedDiscountAmount, finalAmount: storedFinalAmount, promotionName } = metadata;

    const card = tokens.card;
    const fab = tokens.fab;
    const dateList = Array.isArray(dates) ? dates : [];

    const totalMinutes = (sittings || 1) * (serviceDuration || 60);
    const hours = Math.floor(totalMinutes / 60);

    // Discount logic
    const hasStoredDiscount = discountApplied && storedFinalAmount !== undefined;
    const hasCurrentDiscount = appliedPromotion !== null;
    const hasDiscount = hasCurrentDiscount || hasStoredDiscount;

    const displayTotal = hasCurrentDiscount
        ? appliedPromotion.finalAmount / 100
        : hasStoredDiscount ? storedFinalAmount / 100 : totalCost;

    const displayDiscountAmount = hasCurrentDiscount
        ? appliedPromotion.discountAmount / 100
        : hasStoredDiscount ? (storedDiscountAmount || 0) / 100 : 0;

    const displayPromotionName = hasCurrentDiscount
        ? appliedPromotion.name : promotionName || 'Promotion';

    return (
        <>
            <FABMenu
                isOpen={isOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowVoucherList(false);
                    }
                    onOpenChange(open);
                }}
                toggleIcon={<CalendarIcon className="h-6 w-6" />}
                className="fixed bottom-[176px] left-5 z-[55] flex flex-col items-start gap-3"
            >
                {/* Voucher List Inline View */}
                {showVoucherList && (
                    <div className="flex flex-col w-full h-full pt-2 pb-6 px-1">
                        <motion.div variants={fab.animation.item} className={fab.itemRow}>
                            <button onClick={() => setShowVoucherList(false)} className={fab.itemButton}>
                                <ArrowLeft className={fab.itemIconSize} />
                            </button>
                            <span className={fab.itemLabel + " uppercase tracking-widest font-bold flex-1"}>
                                Available Vouchers
                            </span>
                        </motion.div>

                        <div className="flex flex-col flex-1 mt-4 px-1 gap-2 overflow-y-auto no-scrollbar">
                            {isLoadingPromotions && (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                </div>
                            )}
                            {availablePromotions?.map((promo) => {
                                const originalCents = totalCost * 100;
                                let discountAmount = 0;
                                if (promo.valueType === 'fixed') discountAmount = promo.value;
                                else if (promo.valueType === 'percentage') discountAmount = Math.floor(originalCents * (promo.value / 100));

                                const finalAmount = Math.max(0, originalCents - discountAmount);

                                return (
                                    <motion.button
                                        key={promo.id}
                                        variants={fab.animation.item}
                                        className={cn(card.base, card.bg, card.interactive, "p-3 flex flex-col gap-1 w-full text-left")}
                                        onClick={() => {
                                            setAppliedPromotion({
                                                id: promo.id,
                                                name: promo.name,
                                                discountAmount,
                                                finalAmount
                                            });
                                            setShowVoucherList(false);
                                        }}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">{promo.name}</span>
                                            <span className="text-[10px] font-bold text-emerald-500">
                                                {promo.valueType === 'fixed' ? `$${promo.value / 100}` : `${promo.value}% OFF`}
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-muted-foreground line-clamp-2">
                                            Use this voucher on your next booking.
                                        </p>
                                    </motion.button>
                                );
                            })}
                            {!isLoadingPromotions && availablePromotions?.length === 0 && (
                                <p className="text-[10px] text-muted-foreground text-center py-8 font-bold uppercase tracking-widest opacity-50">
                                    No vouchers available
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {!showVoucherList && (
                    <div className="flex flex-col gap-2 w-full">
                        {/* Header: Service name */}
                        <motion.div variants={fab.animation.item}>
                            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70 mb-0.5">
                                Project Proposal
                            </p>
                            <h3 className="text-sm font-bold text-foreground leading-tight">
                                {serviceName}
                            </h3>
                        </motion.div>

                        {/* Stats card */}
                        <motion.div
                            variants={fab.animation.item}
                            className={cn(card.base, "grid grid-cols-3 gap-px rounded-[4px] overflow-hidden bg-white/[0.03]")}
                        >
                            {[
                                { label: "Total", value: hasDiscount ? `$${displayTotal}` : `$${totalCost}`, strike: hasDiscount ? `$${totalCost}` : null },
                                { label: "Time", value: `${hours}h`, strike: null },
                                { label: "Sittings", value: String(sittings), strike: null },
                            ].map(({ label, value, strike }) => (
                                <div key={label} className="p-2 flex flex-col items-center gap-0.5">
                                    <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
                                    {strike && <span className="text-[8px] line-through text-muted-foreground">{strike}</span>}
                                    <span className={cn("text-xs font-bold", hasDiscount && label === "Total" ? "text-emerald-500" : "text-foreground")}>{value}</span>
                                </div>
                            ))}
                        </motion.div>

                        {/* Discount badge */}
                        {hasDiscount && (
                            <motion.div
                                variants={fab.animation.item}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-emerald-500/10"
                            >
                                <Tag className="w-3 h-3 text-emerald-500" />
                                <span className="text-[9px] font-medium text-emerald-500">{displayPromotionName} −${displayDiscountAmount.toFixed(2)}</span>
                            </motion.div>
                        )}

                        {/* Dates list */}
                        {dateList.length > 0 && (
                            <motion.div variants={fab.animation.item} className="space-y-1">
                                <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Schedule</p>
                                <div className="max-h-[220px] overflow-y-auto pr-1 -mr-1 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                    {dateList.map((dateStr, i) => (
                                        <div key={i} className={cn(card.base, card.bg, "flex items-center gap-2 p-1.5 rounded-[4px]")}>
                                            <span className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-semibold text-foreground truncate">
                                                    {format(new Date(dateStr), "EEE, MMM d")}
                                                </p>
                                                <p className="text-[8px] text-muted-foreground">
                                                    {format(new Date(dateStr), "h:mm a")} · {serviceDuration}m
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Actions */}
                        {/* Client actions — pending */}
                        {!isArtist && status === 'pending' && (
                            <motion.div variants={fab.animation.item} className="space-y-2 pt-1">
                                {/* Apply Voucher */}
                                {!appliedPromotion && artistId && (
                                    <button
                                        className={cn(card.base, card.bg, card.interactive, "flex items-center gap-2 p-2 w-full rounded-[4px]")}
                                        onClick={() => setShowVoucherList(true)}
                                    >
                                        <div className={cn(fab.itemButton, "shrink-0 !w-7 !h-7")}>
                                            <Tag className="w-3 h-3" />
                                        </div>
                                        <span className="text-[10px] font-semibold text-foreground">Apply Voucher</span>
                                    </button>
                                )}

                                {/* Accept / Decline */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={onReject}
                                        disabled={isPendingAction}
                                        className={cn(
                                            "py-2 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95",
                                            "bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                                        )}
                                    >
                                        Decline
                                    </button>
                                    <button
                                        onClick={() => onAccept(appliedPromotion ? {
                                            id: appliedPromotion.id,
                                            discountAmount: appliedPromotion.discountAmount,
                                            finalAmount: appliedPromotion.finalAmount,
                                        } : undefined)}
                                        disabled={isPendingAction}
                                        className={cn(
                                            "py-2 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95",
                                            "bg-primary text-primary-foreground hover:bg-primary/90"
                                        )}
                                    >
                                        {isPendingAction ? "..." : "Accept"}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Artist actions — pending */}
                        {isArtist && status === 'pending' && (
                            <motion.div variants={fab.animation.item} className="space-y-2 pt-1">
                                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] bg-orange-500/10">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
                                    </span>
                                    <span className="text-[9px] font-medium text-orange-500">Awaiting client response</span>
                                </div>
                                <button
                                    onClick={onCancel}
                                    className={cn(
                                        "w-full py-2 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95",
                                        "bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                                    )}
                                >
                                    Cancel Proposal
                                </button>
                            </motion.div>
                        )}

                        {/* Status — accepted */}
                        {status === 'accepted' && (
                            <motion.div variants={fab.animation.item} className="flex items-center gap-1.5 px-2 py-2 rounded-[4px] bg-emerald-500/10">
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-[10px] font-bold text-emerald-500">Accepted</span>
                            </motion.div>
                        )}

                        {/* Status — rejected */}
                        {status === 'rejected' && (
                            <motion.div variants={fab.animation.item} className="flex items-center gap-1.5 px-2 py-2 rounded-[4px] bg-red-500/10">
                                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                <span className="text-[10px] font-bold text-red-500">Declined</span>
                            </motion.div>
                        )}
                    </div>
                )}
            </FABMenu>
        </>
    );
}
