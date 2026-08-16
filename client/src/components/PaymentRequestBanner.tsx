import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const PAID_KEY = "tattoi_paid_requests";

/** Read paid IDs from localStorage */
function getPaidIds(): Set<number> {
  try {
    const raw = localStorage.getItem(PAID_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/** Persist a paid ID so the banner never shows again for this request */
function markAsPaid(id: number) {
  const ids = getPaidIds();
  ids.add(id);
  localStorage.setItem(PAID_KEY, JSON.stringify([...ids]));
}

/**
 * PaymentRequestBanner
 *
 * Shows a non-blocking banner at the bottom of the screen when the client
 * has a pending payment request from an artist.
 *
 * Styled identically to UpdateBanner (SSOT).
 * Only renders for client users with pending requests.
 * Hidden on /pay/ routes (checkout page handles its own UI).
 * Paid requests are persisted in localStorage so they never reappear.
 *
 * Flow:
 *   artist sends requestPayment → payment_requests row created
 *   → client opens app → this banner polls getMyPaymentRequests
 *   → banner appears with "Pay $X" button
 *   → client taps "Pay" → navigates to /pay/:token
 */
export function PaymentRequestBanner() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState<Set<number>>(() => getPaidIds());

  // Only fetch for client users
  const isClient = user?.role === "client";
  const { data: requests } = trpc.clientProfile.getMyPaymentRequests.useQuery(
    undefined,
    {
      enabled: isClient,
      refetchOnWindowFocus: true,
      refetchInterval: 30_000, // Poll every 30s
    }
  );

  // Listen for payment-completed events from PaymentRequestSheet
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const id = e.detail?.requestId;
      if (id) {
        markAsPaid(id);
        setDismissed((prev) => new Set(prev).add(id));
      }
    };
    window.addEventListener("payment-request-paid" as any, handler);
    return () => window.removeEventListener("payment-request-paid" as any, handler);
  }, []);

  // Hide on /pay/ routes — the checkout page handles its own UI
  const isOnPayRoute = location.startsWith("/pay/");

  // Find the first non-dismissed pending request
  const pending = (requests || []).find((r) => !dismissed.has(r.id));

  if (!isClient || !pending || isOnPayRoute) return null;

  const amountDisplay = `$${(pending.amountCents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

  return (
    <AnimatePresence>
      <motion.div
        key={`payment-request-${pending.id}`}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-32px)] max-w-[420px]"
      >
        <div className="bg-popover/95 backdrop-blur-[12px] border border-border rounded-[var(--radius-md)] p-[14px_16px] flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div
            className="w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0"
            style={{ background: "#f2ca5c" }}
          >
            <CreditCard size={18} style={{ color: "#1a1a00" }} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="m-0 text-[14px] font-semibold text-foreground leading-[1.3]">
              Payment Requested
            </p>
            <p className="m-0 text-[12px] text-muted-foreground leading-[1.3]">
              {pending.artistName} · {amountDisplay} due
            </p>
          </div>

          <button
            onClick={() => {
              setDismissed((prev) => new Set(prev).add(pending.id));
            }}
            className="bg-transparent border-none text-muted-foreground text-[13px] cursor-pointer p-[4px_6px] shrink-0 hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            Later
          </button>

          <button
            onClick={() => setLocation(`/pay/${pending.token}`)}
            className="border-none rounded-[var(--radius-sm)] text-[13px] font-semibold px-[14px] py-2 cursor-pointer shrink-0 transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "#f2ca5c",
              color: "#1a1a00",
            }}
          >
            Pay {amountDisplay}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
