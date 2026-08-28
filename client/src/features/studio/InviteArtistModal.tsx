import React, { useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, UserPlus, Mail, ShieldCheck } from "lucide-react";

interface InviteArtistModalProps {
  studioId: string;
  open: boolean;
  onClose: () => void;
}

export function InviteArtistModal({ studioId, open, onClose }: InviteArtistModalProps) {
  const [email, setEmail] = useState("");
  const [paymentModel, setPaymentModel] = useState<"commission" | "rent">("commission");
  const [commissionPct, setCommissionPct] = useState(30);
  const [chairRentWeekly, setChairRentWeekly] = useState(350);

  const inviteMutation = trpc.studios.inviteArtist.useMutation({
    onSuccess: () => {
      toast.success(`Invitation sent to ${email}`);
      onClose();
      setEmail("");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send invitation");
    },
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter the artist's email");
      return;
    }

    inviteMutation.mutate({
      studioId,
      email: email.trim(),
      paymentModel,
      commissionPct: paymentModel === "commission" ? commissionPct : undefined,
      weeklyChairRentCents: paymentModel === "rent" ? chairRentWeekly * 100 : undefined,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1c1c1f] border border-white/10 rounded-[24px] w-full max-w-md p-6 shadow-2xl relative font-['DM_Sans',system-ui,sans-serif] text-foreground space-y-5">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#9b9ba1] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#eec95f]/15 border border-[#eec95f]/30 text-[#eec95f] flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Invite Resident Artist</h3>
            <p className="text-xs text-[#9b9ba1]">Invite artist chair to your studio</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#c9c9ce] block mb-1.5">Artist Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="artist@example.com"
                className="w-full bg-[#26262a] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#eec95f]/60"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#c9c9ce] block mb-1.5">Payment Terms Model</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentModel("commission")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border ${
                  paymentModel === "commission"
                    ? "bg-[#eec95f]/20 border-[#eec95f] text-[#eec95f]"
                    : "bg-[#26262a] border-white/5 text-[#9b9ba1]"
                }`}
              >
                % Commission Split
              </button>
              <button
                type="button"
                onClick={() => setPaymentModel("rent")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border ${
                  paymentModel === "rent"
                    ? "bg-[#eec95f]/20 border-[#eec95f] text-[#eec95f]"
                    : "bg-[#26262a] border-white/5 text-[#9b9ba1]"
                }`}
              >
                Weekly Chair Rent
              </button>
            </div>
          </div>

          {paymentModel === "commission" ? (
            <div>
              <label className="text-xs font-semibold text-[#c9c9ce] block mb-1.5">
                Studio Commission Cut ({commissionPct}%)
              </label>
              <input
                type="range"
                min={0}
                max={70}
                step={5}
                value={commissionPct}
                onChange={(e) => setCommissionPct(Number(e.target.value))}
                className="w-full accent-[#eec95f]"
              />
              <div className="flex justify-between text-[11px] text-[#9b9ba1] mt-1">
                <span>0%</span>
                <span className="text-[#eec95f] font-bold">{commissionPct}% to Studio / {100 - commissionPct}% to Artist</span>
                <span>70%</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-[#c9c9ce] block mb-1.5">
                Weekly Chair Rent ($ AUD)
              </label>
              <input
                type="number"
                min={50}
                max={3000}
                step={25}
                value={chairRentWeekly}
                onChange={(e) => setChairRentWeekly(Number(e.target.value))}
                className="w-full bg-[#26262a] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#eec95f]/60"
              />
            </div>
          )}

          <div className="bg-[#26262a] rounded-xl p-3 text-[11px] text-[#9b9ba1] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#57c97e] shrink-0 mt-0.5" />
            <span>
              All client bookings procured by the artist remain 100% their intellectual and commercial property.
            </span>
          </div>

          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="w-full bg-[#eec95f] hover:bg-[#f6d97e] text-[#1c1503] font-bold py-3 rounded-full text-xs transition-colors shadow-lg disabled:opacity-50"
          >
            {inviteMutation.isPending ? "Sending Invitation..." : "Send Studio Invitation"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
