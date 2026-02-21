import { useState } from "react";
import { format } from "date-fns";
import { Check, Calendar as CalendarIcon, DollarSign, Clock, AlertCircle, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Card } from "@/components/ui/card";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft } from "lucide-react";

interface ProposalMetadata {
    type: "project_proposal";
    serviceName: string;
    totalCost: number;
    sittings: number;
    dates: string[]; // ISO strings
    status: 'pending' | 'accepted' | 'rejected';
    serviceDuration?: number;
    depositAmount?: number;
    policies?: string[];
    discountApplied?: boolean;
    discountAmount?: number;
    finalAmount?: number;
    promotionName?: string;
}

interface ProjectProposalModalProps {
    isOpen: boolean;
    onClose: () => void;
    metadata: ProposalMetadata | null;
    isArtist: boolean;
    onAccept: (appliedPromotion?: { id: number; discountAmount: number; finalAmount: number }) => void;
    onReject: () => void;
    isPendingAction: boolean;
    artistId?: string;
    onRevoke?: () => void;
}

export function ProjectProposalModal({
    isOpen,
    onClose,
    metadata,
    isArtist,
    onAccept,
    onReject,
    isPendingAction,
    artistId,
    onRevoke,
}: ProjectProposalModalProps) {
    const [showVoucherList, setShowVoucherList] = useState(false);
    const [appliedPromotion, setAppliedPromotion] = useState<{
        id: number;
        name: string;
        discountAmount: number;
        finalAmount: number;
    } | null>(null);

    const { data: availablePromotions, isLoading: isLoadingPromotions } = trpc.promotions.getAvailableForBooking.useQuery(
        { artistId: artistId || "" },
        { enabled: isOpen && showVoucherList && !!artistId }
    );

    if (!metadata) return null;

    const { serviceName, totalCost, sittings, dates, status, serviceDuration, depositAmount, discountApplied, discountAmount: storedDiscountAmount, finalAmount: storedFinalAmount, promotionName } = metadata;

    const hasStoredDiscount = discountApplied && storedFinalAmount !== undefined;
    const hasCurrentDiscount = appliedPromotion !== null;
    const hasDiscount = hasCurrentDiscount || hasStoredDiscount;

    const displayTotal = hasCurrentDiscount
        ? appliedPromotion.finalAmount / 100
        : hasStoredDiscount
            ? (storedFinalAmount || 0) / 100
            : totalCost;

    const displayDiscountAmount = hasCurrentDiscount
        ? appliedPromotion.discountAmount / 100
        : hasStoredDiscount
            ? (storedDiscountAmount || 0) / 100
            : 0;

    const displayPromotionName = hasCurrentDiscount
        ? appliedPromotion.name
        : promotionName || 'Promotion';

    const dateList = Array.isArray(dates) ? dates : [];
    const totalMinutes = (sittings || 1) * (serviceDuration || 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const ProposalDatesList = () => (
        <Card className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
                <span className={tokens.proposalModal.sectionLabel}>SCHEDULE BREAKDOWN</span>
                <span className={cn("bg-primary/20 text-primary px-2 py-0.5", tokens.proposalModal.badgeText, tokens.proposalModal.badgeRadius)}>{dateList.length} Sessions</span>
            </div>
            <div className="max-h-[160px] overflow-y-auto no-scrollbar space-y-3 pr-1">
                {dateList.map((dateStr, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <div className={cn("flex items-center justify-center text-muted-foreground font-bold text-xs", tokens.proposalModal.sessionBadge)}>
                            #{i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground">{format(new Date(dateStr), "EEEE, MMM do")}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                {format(new Date(dateStr), "h:mm a")} • {format(new Date(dateStr), "yyyy")}
                            </p>
                        </div>
                        <div className={cn("whitespace-nowrap", tokens.proposalModal.durationBadge)}>
                            {serviceDuration}m
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );

    const ProposalPolicies = () => (
        <Card className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-4">
            <h4 className={cn("mb-4", tokens.proposalModal.sectionLabel)}>Policies & Terms</h4>
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="cancellation" className="border-white/5">
                    <AccordionTrigger className={tokens.proposalModal.accordionTrigger}>Cancellation Policy</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground px-2 pb-3 text-xs leading-relaxed">
                        Deposits are non-refundable. Cancellations made within 48 hours of the appointment may forfeit the deposit. Please contact the artist directly for rescheduling.
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="deposit" className="border-white/5">
                    <AccordionTrigger className={tokens.proposalModal.accordionTrigger}>Deposit Information</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground px-2 pb-3 text-xs leading-relaxed">
                        A deposit of ${depositAmount || 0} is required to secure these dates. The remaining balance of ${totalCost - (depositAmount || 0)} is due upon completion of the service.
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    );

    const ProposalActions = () => (
        <div className="space-y-3 w-full pt-2">
            {!isArtist && status === 'pending' && (
                <>
                    {appliedPromotion && (
                        <div className={cn("border", tokens.proposalModal.statusPadding, tokens.proposalModal.statusRadius, tokens.proposalModal.successBg, tokens.proposalModal.successBorder)}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-green-500" />
                                    <span className="text-sm font-medium text-green-500">{appliedPromotion.name} applied</span>
                                </div>
                                <span className="text-sm font-bold text-green-500">-${(appliedPromotion.discountAmount / 100).toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {!appliedPromotion && artistId && (
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setShowVoucherList(true)}
                            className={cn("w-full", tokens.proposalModal.buttonHeight, tokens.proposalModal.buttonRadius, tokens.proposalModal.voucherButton)}
                        >
                            <Tag className="w-4 h-4 mr-2" />
                            Apply Voucher or Discount
                        </Button>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={onReject}
                            disabled={isPendingAction}
                            className={cn(tokens.proposalModal.buttonHeight, tokens.proposalModal.buttonRadius, tokens.proposalModal.declineButton)}
                        >
                            Decline
                        </Button>
                        <Button
                            size="lg"
                            onClick={() => onAccept(appliedPromotion ? {
                                id: appliedPromotion.id,
                                discountAmount: appliedPromotion.discountAmount,
                                finalAmount: appliedPromotion.finalAmount,
                            } : undefined)}
                            disabled={isPendingAction}
                            className={cn("relative overflow-hidden group border-0", tokens.proposalModal.buttonHeight, tokens.proposalModal.buttonRadius, tokens.proposalModal.acceptButton)}
                        >
                            {isPendingAction ? "Processing..." : "Accept & Continue"}
                        </Button>
                    </div>
                </>
            )}

            {isArtist && status === 'pending' && (
                <div className="col-span-2 flex flex-col gap-2">
                    <Button
                        variant="destructive"
                        className={cn("w-full opacity-60 hover:opacity-100", tokens.proposalModal.buttonHeight, tokens.proposalModal.buttonRadius)}
                        onClick={onRevoke}
                        disabled={isPendingAction}
                    >
                        {isPendingAction ? "Revoking..." : "Revoke Proposal"}
                    </Button>
                    <div className={cn("flex items-center justify-center gap-2 text-amber-500 text-xs font-medium border rounded-lg", tokens.proposalModal.statusPadding, tokens.proposalModal.warningBg, tokens.proposalModal.warningBorder)}>
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        Waiting for client response
                    </div>
                </div>
            )}

            {status === 'accepted' && (
                <div className="col-span-2 space-y-2">
                    {hasStoredDiscount && (
                        <div className={cn("border", tokens.proposalModal.statusPadding, tokens.proposalModal.statusRadius, tokens.proposalModal.successBg, tokens.proposalModal.successBorder)}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-green-500" />
                                    <span className="text-sm font-medium text-green-500">{displayPromotionName} applied</span>
                                </div>
                                <span className="text-sm font-bold text-green-500">-${displayDiscountAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                    <div className={cn("border text-center", tokens.proposalModal.statusPaddingLarge, tokens.proposalModal.statusRadius, tokens.proposalModal.successBg, tokens.proposalModal.successBorder)}>
                        <p className="text-green-500 font-bold flex items-center justify-center gap-2">
                            <Check className="w-5 h-5" /> Proposal Accepted
                        </p>
                    </div>
                </div>
            )}

            {status === 'rejected' && (
                <div className={cn("col-span-2 border text-center", tokens.proposalModal.statusPaddingLarge, tokens.proposalModal.statusRadius, tokens.proposalModal.errorBg, tokens.proposalModal.errorBorder)}>
                    <p className="text-red-500 font-bold flex items-center justify-center gap-2">
                        <AlertCircle className="w-5 h-5" /> Proposal Declined
                    </p>
                </div>
            )}
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                setShowVoucherList(false);
                onClose();
            }
        }}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content
                    className="fixed inset-0 z-[101] w-full h-[100dvh] outline-none flex flex-col justify-end overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-in-from-bottom-10 data-[state=open]:slide-in-from-bottom-0"
                >
                    <div className={cn("w-full h-full flex flex-col px-0 overflow-hidden relative mt-0 md:mt-4", tokens.proposalModal.sheetBg, tokens.proposalModal.sheetBlur, tokens.proposalModal.sheetRadius, tokens.proposalModal.sheetShadow)}>
                        <div className={cn("absolute top-0 inset-x-0 h-px pointer-events-none", tokens.proposalModal.highlightGradient, tokens.proposalModal.highlightOpacity)} />
                        <div className="absolute top-6 right-6 z-30">
                            <Button variant="ghost" size="icon" className={cn("text-foreground", tokens.proposalModal.closeButton)} onClick={onClose}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y pt-12 px-4">
                            {showVoucherList ? (
                                <div className="pb-32 max-w-lg mx-auto space-y-4">
                                    <div className="mb-6 px-2 flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setShowVoucherList(false)}
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                        </Button>
                                        <div>
                                            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Select Voucher</p>
                                            <h2 className="text-xl font-bold text-foreground">Available Vouchers</h2>
                                        </div>
                                    </div>

                                    <div className="space-y-3 px-2">
                                        {isLoadingPromotions && (
                                            <div className="flex items-center justify-center py-12">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
                                            </div>
                                        )}

                                        {availablePromotions?.map((promo) => {
                                            const originalCents = totalCost * 100;
                                            let discountAmount = 0;
                                            if (promo.valueType === 'fixed') discountAmount = promo.value;
                                            else if (promo.valueType === 'percentage') discountAmount = Math.floor(originalCents * (promo.value / 100));

                                            const finalAmount = Math.max(0, originalCents - discountAmount);

                                            return (
                                                <Card
                                                    key={promo.id}
                                                    onClick={() => {
                                                        setAppliedPromotion({
                                                            id: promo.id,
                                                            name: promo.name,
                                                            discountAmount,
                                                            finalAmount
                                                        });
                                                        setShowVoucherList(false);
                                                    }}
                                                    className="bg-white/5 border-white/10 hover:bg-white/[0.08] transition-colors cursor-pointer group"
                                                >
                                                    <div className="p-4 flex flex-col gap-1">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-foreground">{promo.name}</span>
                                                            <span className="text-emerald-500 font-bold">
                                                                {promo.valueType === 'fixed' ? `$${promo.value / 100}` : `${promo.value}% OFF`}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Redeem this voucher for your project.
                                                        </p>
                                                    </div>
                                                </Card>
                                            );
                                        })}

                                        {!isLoadingPromotions && availablePromotions?.length === 0 && (
                                            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                                                <Tag className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                                                <p className="text-muted-foreground font-medium">No vouchers found</p>
                                                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-1">Check back later</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="pb-32 max-w-lg mx-auto space-y-4">
                                    <div className="mb-6 px-2">
                                        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Review Proposal</p>
                                        <DialogTitle className={cn("mb-6 pr-12 line-clamp-2", tokens.proposalModal.title)}>{serviceName}</DialogTitle>
                                        <div className="w-full">
                                            <div className="flex flex-wrap items-center justify-between gap-y-4 gap-x-2">
                                                <div className="flex items-center gap-3">
                                                    {hasDiscount ? (
                                                        <>
                                                            <span className="text-lg line-through text-muted-foreground">${totalCost}</span>
                                                            <span className="text-2xl font-bold text-green-500 tracking-tight">${displayTotal}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-2xl font-bold text-foreground tracking-tight">${totalCost}</span>
                                                    )}
                                                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground self-end mb-1.5">Total</span>
                                                </div>
                                                <div className="w-px h-8 bg-white/10 hidden sm:block" />
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl font-bold text-foreground tracking-tight">
                                                        {hours}<span className="text-lg font-normal text-muted-foreground/60 ml-0.5">h</span>
                                                        {minutes > 0 && <span className="ml-1">{minutes}<span className="text-lg font-normal text-muted-foreground/60 ml-0.5">m</span></span>}
                                                    </span>
                                                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground self-end mb-1.5">Duration</span>
                                                </div>
                                                <div className="w-px h-8 bg-white/10 hidden sm:block" />
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl font-bold text-foreground tracking-tight">{sittings}</span>
                                                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground self-end mb-1.5">Sittings</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <ProposalDatesList />
                                    <ProposalPolicies />
                                    <ProposalActions />
                                </div>
                            )}
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </Dialog>
    );
}
