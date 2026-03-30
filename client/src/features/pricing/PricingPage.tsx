/**
 * PricingPage — Presentational Component (Spec §7)
 *
 * Props-only, stateless, no tRPC or routing awareness.
 * Shows Free vs Pro comparison, fee disclosure FAQ, break-even messaging.
 *
 * Rules from spec §7:
 * - Two public tiers only: Free + Pro. Top tier is NEVER shown publicly.
 * - No mention of "take rate" anywhere in public-facing copy.
 * - Fee disclosure: client pays 3.4%, never deducted from artist earnings.
 */

import {
    Check,
    X,
    ArrowRight,
    Zap,
    Shield,
    HelpCircle,
    TrendingUp,
    CreditCard,
    Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import { motion } from "framer-motion";

export interface SubscriptionStatus {
    tier: "free" | "pro" | "top";
    tierLabel: string;
    artistFeeRate: number;
    platformFeeRate: number;
    bnplEnabled: boolean;
    subscriptionPriceCents: number;
    stripeSubscriptionId: string | null;
    renewalDate: string | null;
    cancelAtPeriodEnd: boolean;
    isActive: boolean;
}

export interface PricingPageProps {
    status: SubscriptionStatus;
    onUpgradePro: () => void;
    onManageSubscription: () => void;
    isLoading: boolean;
}

const FREE_FEATURES = [
    { label: "Unlimited bookings", included: true },
    { label: "Client messaging", included: true },
    { label: "Automated deposits", included: true },
    { label: "Booking wizard", included: true },
    { label: "2.0% artist fee per transaction", included: true, highlight: true },
    { label: "Deposit locked at 37%", included: true },
    { label: "Buy Now Pay Later (BNPL)", included: false },
    { label: "Customisable deposit %", included: false },
    { label: "Upfront payment option", included: false },
    { label: "Priority support", included: false },
];

const PRO_FEATURES = [
    { label: "Everything in Free", included: true },
    { label: "1.0% artist fee per transaction", included: true, highlight: true },
    { label: "Buy Now Pay Later (BNPL)", included: true },
    { label: "Customisable deposit %", included: true },
    { label: "Upfront payment option", included: true },
    { label: "Priority support", included: true },
    { label: "Remove Tattoi branding", included: true },
    { label: "Custom booking funnel theme", included: true },
];

export function PricingPage({
    status,
    onUpgradePro,
    onManageSubscription,
    isLoading,
}: PricingPageProps) {
    const isPro = status.tier === "pro" || status.tier === "top";

    return (
        <div className="pb-32 max-w-lg mx-auto space-y-8 px-4">
            {/* Hero */}
            <div className="text-center pt-4">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                    Simple, Fair Pricing
                </h1>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto text-sm">
                    You set your day rate — we never deduct from your earnings.
                </p>
            </div>

            {/* ── Free Tier Card ── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className={cn(
                    "relative rounded-2xl p-5 border overflow-hidden",
                    !isPro
                        ? "bg-card border-primary/30 shadow-lg shadow-primary/5"
                        : "bg-white/5 border-white/10"
                )}
            >
                {!isPro && (
                    <span className="absolute top-3 right-3 bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                        Current Plan
                    </span>
                )}
                <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-foreground/70" />
                    <h2 className="text-lg font-bold text-foreground">Free</h2>
                </div>
                <div className="flex items-baseline gap-1 mb-5">
                    <span className="text-3xl font-extrabold text-foreground">$0</span>
                    <span className="text-muted-foreground font-medium">/forever</span>
                </div>
                <div className="space-y-2.5">
                    {FREE_FEATURES.map((f, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                            {f.included ? (
                                <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                </div>
                            ) : (
                                <div className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                    <X className="w-2.5 h-2.5 text-muted-foreground/40" />
                                </div>
                            )}
                            <span
                                className={cn(
                                    "text-sm leading-tight",
                                    f.included
                                        ? f.highlight
                                            ? "text-amber-400 font-medium"
                                            : "text-foreground/80"
                                        : "text-muted-foreground/50 line-through"
                                )}
                            >
                                {f.label}
                            </span>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* ── Pro Tier Card ── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className={cn(
                    "relative rounded-2xl p-5 border overflow-hidden",
                    isPro
                        ? "bg-card border-primary/30 shadow-lg shadow-primary/10"
                        : "bg-card border-white/20 shadow-xl"
                )}
            >
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 to-primary" />

                {isPro && (
                    <span className="absolute top-3 right-3 bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                        Current Plan
                    </span>
                )}

                <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">Pro</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                    $39/month · 1.0% artist fee · BNPL enabled · Priority support
                </p>

                <div className="flex items-baseline gap-1 mb-5">
                    <span className="text-3xl font-extrabold text-foreground">$39</span>
                    <span className="text-muted-foreground font-medium">/month</span>
                </div>

                <div className="space-y-2.5 mb-6">
                    {PRO_FEATURES.map((f, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 text-primary" />
                            </div>
                            <span
                                className={cn(
                                    "text-sm leading-tight",
                                    f.highlight
                                        ? "text-emerald-400 font-medium"
                                        : "text-foreground/80"
                                )}
                            >
                                {f.label}
                            </span>
                        </div>
                    ))}
                </div>

                {isPro ? (
                    <button
                        onClick={onManageSubscription}
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl border border-white/20 text-foreground font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                        Manage Subscription
                    </button>
                ) : (
                    <button
                        onClick={onUpgradePro}
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
                    >
                        {isLoading ? "Loading..." : "Upgrade to Pro"}
                        {!isLoading && <ArrowRight className="w-4 h-4" />}
                    </button>
                )}

                {/* Renewal info */}
                {isPro && status.renewalDate && (
                    <p className="text-center text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" />
                        {status.cancelAtPeriodEnd
                            ? `Cancels on ${new Date(status.renewalDate).toLocaleDateString("en-AU")}`
                            : `Renews ${new Date(status.renewalDate).toLocaleDateString("en-AU")}`}
                    </p>
                )}
            </motion.div>

            {/* ── Break-even Messaging ── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 }}
                className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5"
            >
                <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-emerald-400 text-sm">
                        Pro pays for itself
                    </h3>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                    With just <strong className="text-emerald-400">4 bookings per month</strong>,
                    the 1% fee saving covers the $39 subscription cost.
                    Every booking after that puts more money in your pocket.
                </p>
            </motion.div>

            {/* ── Fee Disclosure FAQ ── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.3 }}
                className={cn(tokens.card.base, tokens.card.bg, "border-0 p-5 space-y-4")}
            >
                <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-bold text-foreground text-sm">
                        How fees work
                    </h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Platform Fee (3.4%)
                        </h4>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                            Your clients pay a 3.4% platform fee at checkout.
                            You set your day rate — the fee is added on top,{" "}
                            <strong>never deducted from your earnings</strong>.
                        </p>
                    </div>

                    <div className="border-t border-white/5 pt-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Artist Fee
                        </h4>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                            A small per-transaction fee for payment processing and platform maintenance.
                            Free tier: 2.0%. Pro tier: 1.0%.
                        </p>
                    </div>

                    <div className="border-t border-white/5 pt-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Example: $1,000 booking
                        </h4>
                        <div className="bg-white/5 rounded-lg p-3 space-y-1.5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-foreground/70">Your day rate</span>
                                <span className="font-medium">$1,000.00</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-foreground/70">Client pays (+ 3.4%)</span>
                                <span className="font-medium">$1,034.00</span>
                            </div>
                            <div className="flex justify-between border-t border-white/10 pt-1.5">
                                <span className="text-foreground/70">
                                    You receive ({isPro ? "Pro 1.0%" : "Free 2.0%"} fee)
                                </span>
                                <span className="font-bold text-emerald-400">
                                    {isPro ? "$990.00" : "$980.00"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/5 pt-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" />
                            Buy Now Pay Later
                        </h4>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                            BNPL options (Afterpay, Zip) are available exclusively on the Pro plan.
                            This lets your clients split payments into interest-free instalments.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
