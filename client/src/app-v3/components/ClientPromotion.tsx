import { useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Gift, Heart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Action } from "../design/primitives";
import { OfferCard } from "./Offers";
import { OFFER_TERMS, offerRulesSchema, type OfferRules } from "../../../../shared/offerRules";
import "./offers.css";

const choices = [
  { id: "sale", title: "Sell a gift card", text: "Your client pays, then uses it or gifts it to someone.", icon: Gift },
  { id: "discount", title: "Offer a discount", text: "Give them a reason to book your available dates.", icon: CalendarDays },
  { id: "gift", title: "Give credit", text: "A complimentary amount towards their tattoo.", icon: Heart },
] as const;

export function ClientPromotion({ clientId, clientName, onDone }: {
  clientId: string; clientName: string; onDone: () => void;
}) {
  const [step, setStep] = useState<"choose" | "details" | "review" | "sent">("choose");
  const [rules, setRules] = useState<OfferRules>({ name: "", description: "", kind: "voucher", funding: "sale", valueType: "fixed", value: 10000, currency: "AUD", eligibility: "new", expiresAt: null, sittingFrom: null, sittingUntil: null, backgroundImageUrl: "", validityYears: 3 });
  const [error, setError] = useState("");
  const saved = useRef<number | null>(null);
  const sending = useRef(false);
  const save = trpc.offers.save.useMutation();
  const issue = trpc.offers.issue.useMutation();
  const busy = save.isPending || issue.isPending;
  const change = <K extends keyof OfferRules>(key: K, value: OfferRules[K]) => setRules(r => ({ ...r, [key]: value }));
  const dateField = (key: "expiresAt" | "sittingFrom" | "sittingUntil", label: string) => <label>{label}<input type="date" value={rules[key]?.slice(0, 10) || ""} onChange={e => change(key, e.target.value ? new Date(`${e.target.value}T${key === "sittingFrom" ? "00:00:00" : "23:59:59"}`).toISOString() : null)} /></label>;
  async function send() {
    if (sending.current) return;
    sending.current = true;
    setError("");
    try {
      const campaign = await save.mutateAsync({ id: saved.current ?? undefined, rules });
      saved.current = campaign.id;
      await issue.mutateAsync({ id: campaign.id, filters: { clientId, minSpendCents: 0, minBookings: 0, inactiveDays: 0 }, expectedCount: 1, channels: { sms: false, push: false } });
      setStep("sent");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t send. Please try again."); }
    finally { sending.current = false; }
  }
  return <div className="ivory-promo-flow ivory-offer-form">
    <p className="ivory-promo-recipient">Just for <strong>{clientName}</strong></p>
    {step === "choose" && <>
      <div><h2>Make their next tattoo happen.</h2><p className="v3-muted">Choose what you’d like to send.</p></div>
      <div className="ivory-promo-choices">{choices.map(({ id, title, text, icon: Icon }) => <button key={id} type="button" onClick={() => {
        setRules(r => ({ ...r, name: id === "sale" ? "A gift of ink" : id === "gift" ? "Something towards your next tattoo" : "Your next tattoo", kind: id === "discount" ? "discount" : "voucher", funding: id === "sale" ? "sale" : "gift", valueType: id === "discount" ? "percentage" : "fixed", value: id === "discount" ? 10 : 10000, expiresAt: null }));
        setStep("details");
      }}><Icon aria-hidden="true" /><span><strong>{title}</strong><small>{text}</small></span><span aria-hidden="true">›</span></button>)}</div>
    </>}
    {step === "details" && <form className="ivory-promo-fields" onSubmit={e => {
      e.preventDefault();
      const result = offerRulesSchema.safeParse(rules);
      if (!result.success) { setError(result.error.issues[0].message); return; }
      setError(""); setStep("review");
    }}>
      <h2>{rules.kind === "discount" ? "A reason to book." : rules.funding === "sale" ? "A gift worth giving." : "A little extra, from you."}</h2>
      <label>{rules.valueType === "percentage" ? "Discount (%)" : "Value (AUD)"}<input className="ivory-promo-amount" type="number" inputMode="decimal" required min={rules.valueType === "percentage" ? 1 : rules.funding === "sale" ? 1 : 0.01} max={rules.valueType === "percentage" ? 100 : 100000} step={rules.valueType === "percentage" ? 1 : 0.01} value={rules.value / (rules.valueType === "fixed" ? 100 : 1)} onChange={e => change("value", Math.round(Number(e.target.value) * (rules.valueType === "fixed" ? 100 : 1)))} /></label>
      {rules.kind === "discount" && <label>Discount type<select value={rules.valueType} onChange={e => setRules(r => ({ ...r, valueType: e.target.value as "fixed" | "percentage", value: e.target.value === "fixed" ? 10000 : 10 }))}><option value="percentage">Percentage off</option><option value="fixed">Amount off</option></select></label>}
      <label>Card title<input required minLength={2} maxLength={80} value={rules.name} onChange={e => change("name", e.target.value)} /></label>
      {rules.kind === "discount" ? dateField("expiresAt", "Book by (optional)") : rules.funding === "sale" ? <label>Valid after purchase<select value={rules.validityYears === null ? "none" : rules.validityYears ?? 3} onChange={e => change("validityYears", e.target.value === "none" ? null : Number(e.target.value))}><option value="3">3 years</option><option value="5">5 years</option><option value="none">No expiry</option></select></label> : dateField("expiresAt", "Expiry (optional, at least 3 years)")}
      <label>Can be used for<select value={rules.eligibility} onChange={e => change("eligibility", e.target.value as "new" | "unpaid")}><option value="new">New bookings only</option><option value="unpaid">New bookings & unpaid balances</option></select></label>
      <details><summary>Personalise & set conditions</summary><div className="ivory-promo-fields">
        <label>Personal message (optional)<textarea maxLength={500} value={rules.description} onChange={e => change("description", e.target.value)} /></label>
        {dateField("sittingFrom", "Sittings from (optional)")}{dateField("sittingUntil", "Sittings until (optional)")}
        <label>Background image URL (optional)<input type="url" value={rules.backgroundImageUrl} onChange={e => change("backgroundImageUrl", e.target.value)} /></label>
        <label className="ivory-offer-check"><input type="checkbox" checked={!!rules.allowStacking} onChange={e => change("allowStacking", e.target.checked)} />Allow prior voucher credit or discount. Two discounts cannot be combined.</label>
      </div></details>
      {error && <p role="alert">{error}</p>}
      <footer className="ivory-promo-footer"><Action type="button" tone="quiet" onClick={() => setStep("choose")}><ArrowLeft size={18} />Back</Action><Action type="submit">Preview</Action></footer>
    </form>}
    {step === "review" && <>
      <div><h2>Ready for {clientName}.</h2><p className="v3-muted">This is the card they’ll receive.</p></div>
      <OfferCard rules={rules} />
      <p>{rules.funding === "sale" ? "Your client checks out securely before this gift card can be used or transferred. Any fees appear before payment." : "The offer will be available in their account as soon as you send it."}</p>
      {(rules.sittingFrom || rules.sittingUntil) && <p className="v3-muted">Only sittings within the dates shown qualify.</p>}
      <p className="v3-muted">{rules.allowStacking ? "Prior credit or discount allowed; two discounts cannot combine." : "Cannot combine with prior credit or discounts."}</p>
      <details><summary>Terms</summary><p>{OFFER_TERMS}</p></details>
      {error && <p role="alert">{error}</p>}
      <footer className="ivory-promo-footer"><Action tone="quiet" disabled={busy} onClick={() => setStep("details")}>Edit</Action><Action disabled={busy} onClick={send}>{busy ? "Sending…" : "Send to client"}</Action></footer>
    </>}
    {step === "sent" && <div className="ivory-promo-success"><Check size={40} aria-hidden="true" /><h2>Sent to {clientName}.</h2><p>The card is in their account and a notice is in your conversation.</p><Action onClick={onDone}>Done</Action></div>}
  </div>;
}
