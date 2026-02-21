const fs = require('fs');
const file = 'client/src/features/booking/BookingWizardContent.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add lucide icons
content = content.replace(
    `    ChevronDown,
    MessageCircle,
    FileSignature,
} from "lucide-react";`,
    `    ChevronDown,
    MessageCircle,
    FileSignature,
    Gift,
    Percent,
    CreditCard
} from "lucide-react";`
);

// 2. Remove ApplyPromotionSheet import
content = content.replace(
    `import { ApplyPromotionSheet } from "@/features/promotions";\n`,
    ``
);

// 3. Update state variables
content = content.replace(
    `    const [showPromotionSheet, setShowPromotionSheet] = useState(false);`,
    `    const [showVoucherList, setShowVoucherList] = useState(false);`
);

// 4. Add trpc query
content = content.replace(
    `    const signFormMutation = trpc.forms.signForm.useMutation({`,
    `    const { data: availablePromotions, isLoading: isLoadingPromotions } = trpc.promotions.getAvailableForBooking.useQuery(
        { artistId: artistId || "" },
        { enabled: showVoucherList && !!artistId }
    );

    const signFormMutation = trpc.forms.signForm.useMutation({`
);

// 5. Update header of PROPOSAL VIEW
content = content.replace(
    `                    {/* Header */}
                    <motion.div variants={fab.animation.item}>
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70 mb-0.5">
                            {clientNameOverride || "Project Proposal"}
                        </p>
                        <h3 className="text-sm font-bold text-foreground leading-tight">
                            {proposalMeta.serviceName}
                        </h3>
                    </motion.div>

                    {/* Stats */}`,
    `                    {/* Header */}
                    {!showVoucherList ? (
                        <motion.div variants={fab.animation.item}>
                            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70 mb-0.5">
                                {clientNameOverride || "Project Proposal"}
                            </p>
                            <h3 className="text-sm font-bold text-foreground leading-tight">
                                {proposalMeta.serviceName}
                            </h3>
                        </motion.div>
                    ) : (
                        <motion.div variants={fab.animation.item} className={fab.itemRow}>
                            <button onClick={() => setShowVoucherList(false)} className={fab.itemButton}>
                                <ArrowLeft className={fab.itemIconSize} />
                            </button>
                            <span className={fab.itemLabel + " uppercase tracking-widest font-bold flex-1"}>
                                Select Voucher
                            </span>
                        </motion.div>
                    )}

                    {/* Show Details when NOT showing voucher list */}
                    {!showVoucherList ? (
                        <>
                            {/* Stats */}`
);

// 6. Update Apply Voucher button
content = content.replace(
    `                                    onClick={() => setShowPromotionSheet(true)}`,
    `                                    onClick={() => setShowVoucherList(true)}`
);

// 7. Inject closing and voucher list
content = content.replace(
    `                            </p>
                        </motion.div>
                    )}

                    {/* Artist actions — pending */}`,
    `                            </p>
                        </motion.div>
                    )}
                    
                        </>
                    ) : (
                        /* VOUCHER LIST VIEW */
                        <div className="flex flex-col gap-1.5 -my-1 w-full pt-1 max-h-[250px] overflow-y-auto no-scrollbar">
                            {isLoadingPromotions ? (
                                <div className="p-3 flex items-center justify-center">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                </div>
                            ) : !availablePromotions || availablePromotions.length === 0 ? (
                                <div className={cn(card.base, card.bg, "p-4 text-center rounded-[4px]")}>
                                    <p className="text-[10px] text-muted-foreground">No vouchers available.</p>
                                </div>
                            ) : (
                                availablePromotions.map((promo: any) => {
                                    const isSelected = appliedPromotion?.id === promo.id;
                                    const Icon = promo.type === 'voucher' ? Gift : promo.type === 'discount' ? Percent : CreditCard;
                                    
                                    const calculateDiscount = (p: any) => {
                                        let dAmount;
                                        const orig = (proposalMeta?.totalCost || 0) * 100;
                                        if (p.valueType === 'percentage') {
                                            dAmount = Math.round(orig * (p.remainingValue / 100));
                                        } else {
                                            dAmount = Math.min(p.remainingValue, orig);
                                        }
                                        return { discountAmount: dAmount, finalAmount: Math.max(0, orig - dAmount) };
                                    };
                                    
                                    const { discountAmount, finalAmount } = calculateDiscount(promo);
                                    
                                    return (
                                        <button
                                            key={promo.id}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setAppliedPromotion(null);
                                                } else {
                                                    setAppliedPromotion({
                                                        id: promo.id,
                                                        name: promo.name,
                                                        discountAmount,
                                                        finalAmount
                                                    });
                                                }
                                                setShowVoucherList(false);
                                            }}
                                            className={cn(
                                                card.base,
                                                isSelected ? "bg-primary/10 border-primary/30" : card.bg,
                                                card.interactive,
                                                "p-2 flex items-center gap-2 rounded-[4px] text-left w-full border border-white/5"
                                            )}
                                        >
                                            <div className={cn(
                                                fab.itemButton,
                                                isSelected ? "!bg-primary/20 text-primary" : "!bg-white/5",
                                                "shrink-0 !w-8 !h-8"
                                            )}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                                <span className="text-[11px] font-bold text-foreground truncate">{promo.name}</span>
                                                <span className="text-[9px] text-emerald-500 font-medium tracking-wide">
                                                    Saves \${(discountAmount / 100).toFixed(2)}
                                                </span>
                                            </div>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 mr-1" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Artist actions — pending */}`
);

// 8. Delete Support Sheet component
content = content.replace(
    `            {/* Support Sheet */}
            {artistId && (
                <ApplyPromotionSheet
                    isOpen={showPromotionSheet}
                    onClose={() => setShowPromotionSheet(false)}
                    artistId={artistId}
                    originalAmount={(proposalMeta?.totalCost || 0) * 100}
                    onApply={(promo, discountAmount, finalAmount) => {
                        setAppliedPromotion({ id: promo.id, name: promo.name, discountAmount, finalAmount });
                    }}
                />
            )}`,
    `            {/* End Booking Wizard Content */}`
);

fs.writeFileSync(file, content);
console.log('done replacing string chunks');
