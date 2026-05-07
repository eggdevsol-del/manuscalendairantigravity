/**
 * BalanceSheet Component
 *
 * Public-facing balance payment page for clients.
 * Accessed via link sent in proposal.
 */

import { useState, useEffect } from "react";
import { useRoute, useSearch } from "wouter";
import {
  CreditCard,
  Building2,
  Smartphone,
  Upload,
  Check,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getBankDetailLabels } from "@shared/utils/bankDetails";

type PaymentMethod = "stripe" | "paypal" | "bank" | "cash";

interface BalanceInfo {
  bookingId: number;
  artistName: string;
  artistImage?: string;
  businessCountry?: string;
  clientName: string;
  projectType?: string;
  selectedDate: string;
  selectedTime: string;
  remainingBalanceCents: number;
  clientTotalCents: number;
  platformFeeCents: number;
  paymentMethods: {
    stripe: boolean;
    paypal: boolean;
    bank: boolean;
    cash: boolean;
  };
  bankDetails?: {
    bankName: string;
    accountName: string;
    bsb: string;
    accountNumber: string;
  };
}

export function BalanceSheet() {
  const [, params] = useRoute("/balance/:id");
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const token = urlParams.get("token") || "";

  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    null
  );
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Detect success/cancel from URL query params (after Stripe redirect)
  const paymentStatus = urlParams.get("status");
  const messageIdRaw = urlParams.get("messageId");
  const messageId = messageIdRaw ? parseInt(messageIdRaw, 10) : undefined;

  // Fetch balance info
  const { data, isLoading, isError } = trpc.funnel.getBalanceInfo.useQuery(
    { bookingId: parseInt(params?.id || "0", 10), token },
    { enabled: !!params?.id && !!token }
  );

  // We don't have a confirmBalance endpoint yet, but maybe not needed if Stripe webhook handles it.
  const createBalanceCheckout = trpc.funnel.createBalanceCheckout.useMutation();

  useEffect(() => {
    if (data) {
      setBalanceInfo(data as BalanceInfo);
      setLoading(false);
    }
    if (isError) {
      setError("This balance link is invalid or has expired.");
      setLoading(false);
    }
  }, [data, isError]);

  // Handle Stripe redirect success
  useEffect(() => {
    if (paymentStatus === "success" && data) {
      setIsComplete(true);
      setBalanceInfo(data as BalanceInfo);
      setLoading(false);
    }
  }, [paymentStatus, data]);

  const handleStripePayment = async () => {
    if (!token || !balanceInfo) return;
    setIsSubmitting(true);
    try {
      const result = await createBalanceCheckout.mutateAsync({
        bookingId: balanceInfo.bookingId,
        balanceToken: token,
      });
      if (result.url) {
        window.location.href = result.url;
      } else {
        alert("Failed to create checkout session. Please try again.");
      }
    } catch (err: any) {
      alert(err.message || "Payment failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayPalPayment = async () => {
    // Redirect to PayPal
    setIsSubmitting(true);
    try {
      // This would integrate with PayPal
      alert("PayPal integration coming soon");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBankTransferConfirm = async () => {
    if (!screenshotFile) {
      alert("Please upload a screenshot of your transfer");
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload screenshot and confirm
      const formData = new FormData();
      formData.append("file", screenshotFile);

      // In production, this would upload to S3 and get URL
      const screenshotUrl = "placeholder-url";

      await confirmBalance.mutateAsync({
        token: token || "",
        paymentMethod: "bank",
        proofUrl: screenshotUrl,
      });

      setIsComplete(true);
    } catch (err) {
      alert("Failed to confirm balance. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCashConfirm = async () => {
    setIsSubmitting(true);
    try {
      await confirmBalance.mutateAsync({
        token: token || "",
        paymentMethod: "cash",
      });
      setIsComplete(true);
    } catch (err) {
      alert("Failed to confirm. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#7C5CFC] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !balanceInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] flex items-center justify-center p-4">
        <div className="bg-white/5 rounded-[4px] p-6 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-white text-xl font-semibold mb-2">
            Link Invalid
          </h1>
          <p className="text-white/60">
            {error || "This balance link is no longer valid."}
          </p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] flex items-center justify-center p-4">
        <div className="bg-white/5 rounded-[4px] p-6 text-center max-w-md">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-white text-xl font-semibold mb-2">
            Balance Confirmed!
          </h1>
          <p className="text-white/60 mb-4">
            Your booking with {balanceInfo.artistName} is now confirmed.
          </p>
          <div className="bg-white/5 rounded-[4px] p-4 text-left">
            <p className="text-white/60 text-sm">Appointment</p>
            <p className="text-white font-medium">{balanceInfo.selectedDate}</p>
            <p className="text-white/80">{balanceInfo.selectedTime}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a]">
      {/* Header */}
      <div className="p-4 pt-8">
        <div className="flex items-center gap-3 mb-6">
          {balanceInfo.artistImage ? (
            <img
              src={balanceInfo.artistImage}
              alt={balanceInfo.artistName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#7C5CFC]/20 flex items-center justify-center">
              <span className="text-[#7C5CFC] font-medium">
                {balanceInfo.artistName.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-white font-semibold">
              {balanceInfo.artistName}
            </h1>
            <p className="text-white/60 text-sm">Booking Balance</p>
          </div>
        </div>

        {/* Booking Summary */}
        <div className="bg-white/5 rounded-[4px] p-4 mb-6">
          <h2 className="text-white font-medium mb-3">Booking Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Client</span>
              <span className="text-white">{balanceInfo.clientName}</span>
            </div>
            {balanceInfo.projectType && (
              <div className="flex justify-between">
                <span className="text-white/60">Project</span>
                <span className="text-white">
                  {balanceInfo.projectType.replace(/-/g, " ")}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-white/60">Date</span>
              <span className="text-white">{balanceInfo.selectedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Time</span>
              <span className="text-white">{balanceInfo.selectedTime}</span>
            </div>
            <div className="border-t border-white/10 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-white font-medium">Balance</span>
                <span className="text-[#7C5CFC] font-semibold">
                  ${(balanceInfo.clientTotalCents / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <h2 className="text-white font-medium mb-3">Select Payment Method</h2>
        <div className="space-y-3">
          {balanceInfo.paymentMethods.stripe && (
            <button
              onClick={() => setSelectedMethod("stripe")}
              className={`w-full p-4 rounded-[4px] flex items-center gap-3 transition-colors ${selectedMethod === "stripe"
                ? "bg-[#7C5CFC]/20 border-2 border-[#7C5CFC]"
                : "bg-white/5 border-2 border-transparent"
                }`}
            >
              <CreditCard className="w-5 h-5 text-[#7C5CFC]" />
              <div className="text-left">
                <p className="text-white font-medium">Card Payment</p>
                <p className="text-white/60 text-sm">
                  Pay securely with Stripe
                </p>
              </div>
            </button>
          )}

          {balanceInfo.paymentMethods.paypal && (
            <button
              onClick={() => setSelectedMethod("paypal")}
              className={`w-full p-4 rounded-[4px] flex items-center gap-3 transition-colors ${selectedMethod === "paypal"
                ? "bg-[#7C5CFC]/20 border-2 border-[#7C5CFC]"
                : "bg-white/5 border-2 border-transparent"
                }`}
            >
              <Smartphone className="w-5 h-5 text-[#7C5CFC]" />
              <div className="text-left">
                <p className="text-white font-medium">PayPal</p>
                <p className="text-white/60 text-sm">Pay with PayPal account</p>
              </div>
            </button>
          )}

          {balanceInfo.paymentMethods.bank && (
            <button
              onClick={() => setSelectedMethod("bank")}
              className={`w-full p-4 rounded-[4px] flex items-center gap-3 transition-colors ${selectedMethod === "bank"
                ? "bg-[#7C5CFC]/20 border-2 border-[#7C5CFC]"
                : "bg-white/5 border-2 border-transparent"
                }`}
            >
              <Building2 className="w-5 h-5 text-[#7C5CFC]" />
              <div className="text-left">
                <p className="text-white font-medium">Bank Transfer</p>
                <p className="text-white/60 text-sm">Direct bank transfer</p>
              </div>
            </button>
          )}

          {balanceInfo.paymentMethods.cash && (
            <button
              onClick={() => setSelectedMethod("cash")}
              className={`w-full p-4 rounded-[4px] flex items-center gap-3 transition-colors ${selectedMethod === "cash"
                ? "bg-[#7C5CFC]/20 border-2 border-[#7C5CFC]"
                : "bg-white/5 border-2 border-transparent"
                }`}
            >
              <span className="w-5 h-5 text-[#7C5CFC] font-bold">$</span>
              <div className="text-left">
                <p className="text-white font-medium">Cash</p>
                <p className="text-white/60 text-sm">Pay in person</p>
              </div>
            </button>
          )}
        </div>

        {/* Payment Details */}
        {selectedMethod === "bank" && balanceInfo.bankDetails && (
          <div className="mt-6 bg-white/5 rounded-[4px] p-4">
            <h3 className="text-white font-medium mb-3">Bank Details</h3>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-white/60">Bank</span>
                <span className="text-white">
                  {balanceInfo.bankDetails.bankName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Account Name</span>
                <span className="text-white">
                  {balanceInfo.bankDetails.accountName}
                </span>
              </div>
              {balanceInfo.bankDetails.bsb && getBankDetailLabels(balanceInfo.businessCountry || "AU").bankCodeLabel && (
                <div className="flex justify-between">
                  <span className="text-white/60">
                    {getBankDetailLabels(balanceInfo.businessCountry || "AU").bankCodeLabel}
                  </span>
                  <span className="text-white font-mono">
                    {balanceInfo.bankDetails.bsb}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-white/60">
                  {getBankDetailLabels(balanceInfo.businessCountry || "AU").accountLabel}
                </span>
                <span className="text-white font-mono">
                  {balanceInfo.bankDetails.accountNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Amount</span>
                <span className="text-[#7C5CFC] font-semibold">
                  ${(balanceInfo.clientTotalCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Reference</span>
                <span className="text-white font-mono">
                  {balanceInfo.clientName
                    .replace(/\s/g, "")
                    .toUpperCase()
                    .slice(0, 10)}
                </span>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-white/60 text-sm mb-3">
                After transferring, upload a screenshot of your receipt:
              </p>
              <label className="block">
                <div
                  className={`border-2 border-dashed rounded-[4px] p-4 text-center cursor-pointer transition-colors ${screenshotFile
                    ? "border-green-500 bg-green-500/10"
                    : "border-white/20 hover:border-white/40"
                    }`}
                >
                  {screenshotFile ? (
                    <div className="flex items-center justify-center gap-2 text-green-400">
                      <Check className="w-5 h-5" />
                      <span>{screenshotFile.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-white/60">
                      <Upload className="w-5 h-5" />
                      <span>Upload Screenshot</span>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setScreenshotFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {selectedMethod === "cash" && (
          <div className="mt-6 bg-white/5 rounded-[4px] p-4">
            <p className="text-white/80 text-sm">
              By selecting cash payment, you confirm that you will pay the
              balance of{" "}
              <span className="text-[#7C5CFC] font-semibold">
                ${(balanceInfo.clientTotalCents / 100).toFixed(2)}
              </span>{" "}
              in person before your appointment.
            </p>
          </div>
        )}

        {/* Action Button */}
        {selectedMethod && (
          <div className="mt-6 pb-8">
            <button
              onClick={() => {
                if (selectedMethod === "stripe") handleStripePayment();
                else if (selectedMethod === "paypal") handlePayPalPayment();
                else if (selectedMethod === "bank") handleBankTransferConfirm();
                else if (selectedMethod === "cash") handleCashConfirm();
              }}
              disabled={
                isSubmitting || (selectedMethod === "bank" && !screenshotFile)
              }
              className="w-full bg-[#7C5CFC] text-white py-4 rounded-[4px] font-medium disabled:opacity-50"
            >
              {isSubmitting
                ? "Processing..."
                : selectedMethod === "stripe" || selectedMethod === "paypal"
                  ? `Pay $${(balanceInfo.clientTotalCents / 100).toFixed(2)}`
                  : "Confirm Balance"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BalanceSheet;
