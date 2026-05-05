import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, ChevronRight, ChevronLeft, Check, Upload, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
const NZ_REGIONS = ["Auckland", "Bay of Plenty", "Canterbury", "Gisborne", "Hawke's Bay", "Manawatu-Wanganui", "Marlborough", "Nelson", "Northland", "Otago", "Southland", "Taranaki", "Tasman", "Waikato", "Wellington", "West Coast"];

type Step = "personal" | "address" | "bank" | "id" | "review";
const STEPS: Step[] = ["personal", "address", "bank", "id", "review"];
const STEP_LABELS = ["Personal", "Address", "Bank", "ID", "Review"];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [idFile, setIdFile] = useState<{ base64: string; name: string } | null>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    dobDay: "", dobMonth: "", dobYear: "",
    country: "AU" as "AU" | "NZ",
    addressLine1: "", addressCity: "", addressState: "", addressPostalCode: "",
    bankBsb: "", bankAccountNumber: "",
  });

  const submitOnboarding = trpc.artistSettings.submitStripeOnboarding.useMutation();
  const uploadDoc = trpc.artistSettings.uploadStripeDocument.useMutation();

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const canNext = (): boolean => {
    const s = STEPS[step];
    if (s === "personal") return !!(form.firstName && form.lastName && form.email && form.phone && form.dobDay && form.dobMonth && form.dobYear);
    if (s === "address") return !!(form.addressLine1 && form.addressCity && form.addressState && form.addressPostalCode);
    if (s === "bank") return form.bankBsb.length >= 6 && form.bankAccountNumber.length >= 5;
    if (s === "id") return !!idFile;
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setIdFile({ base64, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Format BSB: NZ uses bank+branch (already 6 digits), AU uses BSB
      const bsb = form.bankBsb.replace(/[-\s]/g, "");

      await submitOnboarding.mutateAsync({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone.startsWith("+") ? form.phone : (form.country === "AU" ? `+61${form.phone.replace(/^0/, "")}` : `+64${form.phone.replace(/^0/, "")}`),
        dobDay: parseInt(form.dobDay),
        dobMonth: parseInt(form.dobMonth),
        dobYear: parseInt(form.dobYear),
        country: form.country,
        addressLine1: form.addressLine1,
        addressCity: form.addressCity,
        addressState: form.addressState,
        addressPostalCode: form.addressPostalCode,
        bankBsb: bsb,
        bankAccountNumber: form.bankAccountNumber,
      });

      // Upload ID document
      if (idFile) {
        await uploadDoc.mutateAsync({ fileBase64: idFile.base64, fileName: idFile.name });
      }

      toast.success("Onboarding complete! 🎉");
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit. Please check your details.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#E09F3E]/50 focus:ring-1 focus:ring-[#E09F3E]/30 transition-colors text-sm";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
  const selectClass = `${inputClass} appearance-none`;

  return (
    <div className="w-full space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-1 px-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
            <div className={`h-1.5 w-full rounded-full transition-colors ${i <= step ? "bg-[#E09F3E]" : "bg-white/10"}`} />
            <span className={`text-[10px] font-medium transition-colors ${i <= step ? "text-[#E09F3E]" : "text-muted-foreground/40"}`}>{STEP_LABELS[i]}</span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[300px]">

        {/* Step 1: Personal */}
        {STEPS[step] === "personal" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">Personal Details</h2>
            <p className="text-xs text-muted-foreground">Your legal name as it appears on your ID.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>First Name</label><input className={inputClass} value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="Jane" /></div>
              <div><label className={labelClass}>Last Name</label><input className={inputClass} value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Smith" /></div>
            </div>
            <div><label className={labelClass}>Email</label><input className={inputClass} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="jane@example.com" /></div>
            <div><label className={labelClass}>Phone</label><input className={inputClass} type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="0412 345 678" /></div>
            <div>
              <label className={labelClass}>Date of Birth</label>
              <div className="grid grid-cols-3 gap-3">
                <input className={inputClass} value={form.dobDay} onChange={e => set("dobDay", e.target.value)} placeholder="DD" maxLength={2} inputMode="numeric" />
                <input className={inputClass} value={form.dobMonth} onChange={e => set("dobMonth", e.target.value)} placeholder="MM" maxLength={2} inputMode="numeric" />
                <input className={inputClass} value={form.dobYear} onChange={e => set("dobYear", e.target.value)} placeholder="YYYY" maxLength={4} inputMode="numeric" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {STEPS[step] === "address" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">Your Address</h2>
            <p className="text-xs text-muted-foreground">Must match the address on your ID.</p>
            <div>
              <label className={labelClass}>Country</label>
              <select className={selectClass} value={form.country} onChange={e => { set("country", e.target.value); set("addressState", ""); }}>
                <option value="AU">Australia</option>
                <option value="NZ">New Zealand</option>
              </select>
            </div>
            <div><label className={labelClass}>Street Address</label><input className={inputClass} value={form.addressLine1} onChange={e => set("addressLine1", e.target.value)} placeholder="123 Ink Street" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>City</label><input className={inputClass} value={form.addressCity} onChange={e => set("addressCity", e.target.value)} placeholder={form.country === "AU" ? "Sydney" : "Auckland"} /></div>
              <div>
                <label className={labelClass}>{form.country === "AU" ? "State" : "Region"}</label>
                <select className={selectClass} value={form.addressState} onChange={e => set("addressState", e.target.value)}>
                  <option value="">Select...</option>
                  {(form.country === "AU" ? AU_STATES : NZ_REGIONS).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div><label className={labelClass}>Postcode</label><input className={inputClass} value={form.addressPostalCode} onChange={e => set("addressPostalCode", e.target.value)} placeholder={form.country === "AU" ? "2000" : "1010"} maxLength={4} inputMode="numeric" /></div>
          </div>
        )}

        {/* Step 3: Bank Account */}
        {STEPS[step] === "bank" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">Bank Account</h2>
            <p className="text-xs text-muted-foreground">Where your booking deposits will be paid out.</p>
            <div>
              <label className={labelClass}>{form.country === "AU" ? "BSB" : "Bank + Branch Code"}</label>
              <input className={inputClass} value={form.bankBsb} onChange={e => set("bankBsb", e.target.value.replace(/[^0-9-]/g, ""))} placeholder={form.country === "AU" ? "110-000" : "01-0001"} maxLength={7} inputMode="numeric" />
              <p className="text-[10px] text-muted-foreground/50 mt-1">{form.country === "AU" ? "6 digits, found on your bank statement" : "2-digit bank + 4-digit branch code"}</p>
            </div>
            <div>
              <label className={labelClass}>Account Number</label>
              <div className="relative">
                <input className={inputClass} type={showAccount ? "text" : "password"} value={form.bankAccountNumber} onChange={e => set("bankAccountNumber", e.target.value.replace(/[^0-9]/g, ""))} placeholder="000123456" maxLength={10} inputMode="numeric" />
                <button type="button" onClick={() => setShowAccount(!showAccount)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors">
                  {showAccount ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: ID Verification */}
        {STEPS[step] === "id" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">ID Verification</h2>
            <p className="text-xs text-muted-foreground">Upload a photo of your driver's licence or passport. This is required to enable payouts.</p>
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-[#E09F3E]/30 transition-colors bg-white/[0.02]">
              {idFile ? (
                <div className="flex flex-col items-center gap-2">
                  <Check className="w-8 h-8 text-emerald-400" />
                  <span className="text-sm text-foreground font-medium">{idFile.name}</span>
                  <span className="text-[10px] text-muted-foreground">Tap to change</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground/50" />
                  <span className="text-sm text-muted-foreground">Tap to upload photo</span>
                  <span className="text-[10px] text-muted-foreground/50">JPG, PNG or PDF — max 10MB</span>
                </div>
              )}
              <input type="file" className="hidden" accept="image/*,.pdf" capture="environment" onChange={handleFileSelect} />
            </label>
          </div>
        )}

        {/* Step 5: Review */}
        {STEPS[step] === "review" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">Review & Submit</h2>
            <p className="text-xs text-muted-foreground">Please confirm your details are correct.</p>
            <div className="space-y-3 text-sm">
              {[
                ["Name", `${form.firstName} ${form.lastName}`],
                ["Email", form.email],
                ["Phone", form.phone],
                ["DOB", `${form.dobDay}/${form.dobMonth}/${form.dobYear}`],
                ["Address", `${form.addressLine1}, ${form.addressCity} ${form.addressState} ${form.addressPostalCode}`],
                ["Country", form.country === "AU" ? "Australia" : "New Zealand"],
                [form.country === "AU" ? "BSB" : "Bank+Branch", form.bankBsb],
                ["Account", `••••${form.bankAccountNumber.slice(-4)}`],
                ["ID Document", idFile?.name || "Not uploaded"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground font-medium text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
            </div>
            <div className="bg-white/5 rounded-xl p-3 mt-4">
              <p className="text-[11px] text-muted-foreground">
                By submitting, you agree to Stripe's{" "}
                <a href="https://stripe.com/connect-account/legal" target="_blank" rel="noreferrer" className="text-[#E09F3E] underline">Connected Account Agreement</a>{" "}
                and authorize Tattoi to process payments on your behalf.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1 gap-2" disabled={submitting}>
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="flex-1 gap-2 bg-[#E09F3E]/75 text-white hover:bg-[#E09F3E]">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} className="flex-1 gap-2 bg-emerald-500/80 text-white hover:bg-emerald-500">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><Check className="w-4 h-4" /> Submit & Enable Payouts</>}
          </Button>
        )}
      </div>
    </div>
  );
}
