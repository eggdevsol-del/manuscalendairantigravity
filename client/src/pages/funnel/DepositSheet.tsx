/**
 * DepositSheet Component
 * 
 * Public-facing deposit payment page for clients.
 * Accessed via link sent in proposal.
 */

import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { CreditCard, Building2, Smartphone, Upload, Check, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';

type PaymentMethod = 'stripe' | 'paypal' | 'bank' | 'cash';

interface DepositInfo {
  proposalId: number;
  artistName: string;
  artistImage?: string;
  clientName: string;
  projectType?: string;
  selectedDate: string;
  selectedTime: string;
  depositAmount: number;
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

export function DepositSheet() {
  const [, params] = useRoute('/deposit/:token');
  const token = params?.token;

  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Fetch deposit info
  const { data, isLoading, isError } = trpc.funnel.getDepositInfo.useQuery(
    { token: token || '' },
    { enabled: !!token }
  );

  const confirmDeposit = trpc.funnel.confirmDeposit.useMutation();

  useEffect(() => {
    if (data) {
      setDepositInfo(data as DepositInfo);
      setLoading(false);
    }
    if (isError) {
      setError('This deposit link is invalid or has expired.');
      setLoading(false);
    }
  }, [data, isError]);

  const handleStripePayment = async () => {
    // Redirect to Stripe checkout
    setIsSubmitting(true);
    try {
      // This would integrate with Stripe
      alert('Stripe integration coming soon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayPalPayment = async () => {
    // Redirect to PayPal
    setIsSubmitting(true);
    try {
      // This would integrate with PayPal
      alert('PayPal integration coming soon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBankTransferConfirm = async () => {
    if (!screenshotFile) {
      alert('Please upload a screenshot of your transfer');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload screenshot and confirm
      const formData = new FormData();
      formData.append('file', screenshotFile);
      
      // In production, this would upload to S3 and get URL
      const screenshotUrl = 'placeholder-url';

      await confirmDeposit.mutateAsync({
        token: token || '',
        paymentMethod: 'bank',
        proofUrl: screenshotUrl,
      });

      setIsComplete(true);
    } catch (err) {
      alert('Failed to confirm deposit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCashConfirm = async () => {
    setIsSubmitting(true);
    try {
      await confirmDeposit.mutateAsync({
        token: token || '',
        paymentMethod: 'cash',
      });
      setIsComplete(true);
    } catch (err) {
      alert('Failed to confirm. Please try again.');
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

  if (error || !depositInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] flex items-center justify-center p-4">
        <div className="bg-white/5 rounded-2xl p-6 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-white text-xl font-semibold mb-2">Link Invalid</h1>
          <p className="text-white/60">{error || 'This deposit link is no longer valid.'}</p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] flex items-center justify-center p-4">
        <div className="bg-white/5 rounded-2xl p-6 text-center max-w-md">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-white text-xl font-semibold mb-2">Deposit Confirmed!</h1>
          <p className="text-white/60 mb-4">
            Your booking with {depositInfo.artistName} is now confirmed.
          </p>
          <div className="bg-white/5 rounded-xl p-4 text-left">
            <p className="text-white/60 text-sm">Appointment</p>
            <p className="text-white font-medium">{depositInfo.selectedDate}</p>
            <p className="text-white/80">{depositInfo.selectedTime}</p>
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
          {depositInfo.artistImage ? (
            <img
              src={depositInfo.artistImage}
              alt={depositInfo.artistName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#7C5CFC]/20 flex items-center justify-center">
              <span className="text-[#7C5CFC] font-medium">
                {depositInfo.artistName.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-white font-semibold">{depositInfo.artistName}</h1>
            <p className="text-white/60 text-sm">Booking Deposit</p>
          </div>
        </div>

        {/* Booking Summary */}
        <div className="bg-white/5 rounded-2xl p-4 mb-6">
          <h2 className="text-white font-medium mb-3">Booking Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Client</span>
              <span className="text-white">{depositInfo.clientName}</span>
            </div>
            {depositInfo.projectType && (
              <div className="flex justify-between">
                <span className="text-white/60">Project</span>
                <span className="text-white">{depositInfo.projectType.replace(/-/g, ' ')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-white/60">Date</span>
              <span className="text-white">{depositInfo.selectedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Time</span>
              <span className="text-white">{depositInfo.selectedTime}</span>
            </div>
            <div className="border-t border-white/10 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-white font-medium">Deposit Required</span>
                <span className="text-[#7C5CFC] font-semibold">
                  ${(depositInfo.depositAmount / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <h2 className="text-white font-medium mb-3">Select Payment Method</h2>
        <div className="space-y-3">
          {depositInfo.paymentMethods.stripe && (
            <button
              onClick={() => setSelectedMethod('stripe')}
              className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-colors ${
                selectedMethod === 'stripe'
                  ? 'bg-[#7C5CFC]/20 border-2 border-[#7C5CFC]'
                  : 'bg-white/5 border-2 border-transparent'
              }`}
            >
              <CreditCard className="w-5 h-5 text-[#7C5CFC]" />
              <div className="text-left">
                <p className="text-white font-medium">Card Payment</p>
                <p className="text-white/60 text-sm">Pay securely with Stripe</p>
              </div>
            </button>
          )}

          {depositInfo.paymentMethods.paypal && (
            <button
              onClick={() => setSelectedMethod('paypal')}
              className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-colors ${
                selectedMethod === 'paypal'
                  ? 'bg-[#7C5CFC]/20 border-2 border-[#7C5CFC]'
                  : 'bg-white/5 border-2 border-transparent'
              }`}
            >
              <Smartphone className="w-5 h-5 text-[#7C5CFC]" />
              <div className="text-left">
                <p className="text-white font-medium">PayPal</p>
                <p className="text-white/60 text-sm">Pay with PayPal account</p>
              </div>
            </button>
          )}

          {depositInfo.paymentMethods.bank && (
            <button
              onClick={() => setSelectedMethod('bank')}
              className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-colors ${
                selectedMethod === 'bank'
                  ? 'bg-[#7C5CFC]/20 border-2 border-[#7C5CFC]'
                  : 'bg-white/5 border-2 border-transparent'
              }`}
            >
              <Building2 className="w-5 h-5 text-[#7C5CFC]" />
              <div className="text-left">
                <p className="text-white font-medium">Bank Transfer</p>
                <p className="text-white/60 text-sm">Direct bank transfer</p>
              </div>
            </button>
          )}

          {depositInfo.paymentMethods.cash && (
            <button
              onClick={() => setSelectedMethod('cash')}
              className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-colors ${
                selectedMethod === 'cash'
                  ? 'bg-[#7C5CFC]/20 border-2 border-[#7C5CFC]'
                  : 'bg-white/5 border-2 border-transparent'
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
        {selectedMethod === 'bank' && depositInfo.bankDetails && (
          <div className="mt-6 bg-white/5 rounded-2xl p-4">
            <h3 className="text-white font-medium mb-3">Bank Details</h3>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-white/60">Bank</span>
                <span className="text-white">{depositInfo.bankDetails.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Account Name</span>
                <span className="text-white">{depositInfo.bankDetails.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">BSB</span>
                <span className="text-white font-mono">{depositInfo.bankDetails.bsb}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Account Number</span>
                <span className="text-white font-mono">{depositInfo.bankDetails.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Amount</span>
                <span className="text-[#7C5CFC] font-semibold">
                  ${(depositInfo.depositAmount / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Reference</span>
                <span className="text-white font-mono">{depositInfo.clientName.replace(/\s/g, '').toUpperCase().slice(0, 10)}</span>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-white/60 text-sm mb-3">
                After transferring, upload a screenshot of your receipt:
              </p>
              <label className="block">
                <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                  screenshotFile ? 'border-green-500 bg-green-500/10' : 'border-white/20 hover:border-white/40'
                }`}>
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
                  onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {selectedMethod === 'cash' && (
          <div className="mt-6 bg-white/5 rounded-2xl p-4">
            <p className="text-white/80 text-sm">
              By selecting cash payment, you confirm that you will pay the deposit of{' '}
              <span className="text-[#7C5CFC] font-semibold">
                ${(depositInfo.depositAmount / 100).toFixed(2)}
              </span>{' '}
              in person before your appointment.
            </p>
          </div>
        )}

        {/* Action Button */}
        {selectedMethod && (
          <div className="mt-6 pb-8">
            <button
              onClick={() => {
                if (selectedMethod === 'stripe') handleStripePayment();
                else if (selectedMethod === 'paypal') handlePayPalPayment();
                else if (selectedMethod === 'bank') handleBankTransferConfirm();
                else if (selectedMethod === 'cash') handleCashConfirm();
              }}
              disabled={isSubmitting || (selectedMethod === 'bank' && !screenshotFile)}
              className="w-full bg-[#7C5CFC] text-white py-4 rounded-2xl font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : (
                selectedMethod === 'stripe' || selectedMethod === 'paypal'
                  ? `Pay $${(depositInfo.depositAmount / 100).toFixed(2)}`
                  : 'Confirm Deposit'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DepositSheet;
