/**
 * PaymentRequestCard — SSOT Compliant
 *
 * Renders a rich payment request card in the chat stream,
 * matching the ProjectProposalMessage design language.
 * Uses tokens.card SSOT for consistent styling.
 */

import { DollarSign, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import { useLocation } from "wouter";

interface PaymentRequestMetadata {
  type: "payment_request";
  amountCents: number;
  bookingId: number;
  sittingTitle?: string;
  checkoutUrl?: string;
}

interface PaymentRequestCardProps {
  metadata: PaymentRequestMetadata;
  isArtist: boolean;
}

export function PaymentRequestCard({ metadata, isArtist }: PaymentRequestCardProps) {
  const [, setLocation] = useLocation();
  const card = tokens.card;
  const amountDollars = (metadata.amountCents / 100).toFixed(2);

  const handleClick = () => {
    if (!isArtist && metadata.bookingId) {
      // Client can navigate directly to the balance checkout
      setLocation(`/balance/${metadata.bookingId}`);
    }
  };

  return (
    <div
      className={cn(
        card.base,
        !isArtist ? card.interactive : "",
        "bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 hover:from-emerald-500/15 hover:to-emerald-500/10",
        "w-[85vw] max-w-[340px] p-0 self-center"
      )}
      onClick={handleClick}
    >
      {/* Left accent bar — emerald for payment */}
      <div className={cn(card.leftAccent, "bg-emerald-500")} />

      <div className="pl-4 pr-3 py-3 space-y-3">
        {/* Header */}
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-500/80">
            Payment Request
          </p>
          <h3 className="text-sm font-bold text-foreground leading-tight truncate">
            {metadata.sittingTitle || "Final Balance"}
          </h3>
        </div>

        {/* Amount Display */}
        <div
          className={cn(
            card.base,
            "flex items-center justify-center gap-3 rounded-[4px] bg-white/[0.03] py-3"
          )}
        >
          <DollarSign className="w-5 h-5 text-emerald-500" />
          <span className="text-xl font-bold text-foreground">${amountDollars}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {/* Status badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500">
            <DollarSign className="w-2.5 h-2.5" />
            Balance Due
          </div>

          {!isArtist && (
            <div className="text-emerald-500 text-[10px] font-bold flex items-center gap-0.5">
              Pay Now <ArrowRight className="w-3 h-3" />
            </div>
          )}

          {isArtist && (
            <div className="text-muted-foreground text-[10px] font-medium">
              Sent to client
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
