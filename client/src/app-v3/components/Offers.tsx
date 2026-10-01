import { OfferAppearance } from "./OfferAppearance";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Gift, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { Action, Feedback, Panel, Section } from "../design/primitives";
import { money } from "@/features/workspace/bookingPresentation";
import { OFFER_TERMS, type OfferRules, type OfferAudience as AudienceFilters } from "../../../../shared/offerRules";
import "./offers.css";
const dateLabel = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No expiry";
export function OfferCard({
  rules,
  remaining,
  artist,
  children,
}: {
  rules: OfferRules;
  remaining?: number;
  artist?: string | null;
  children?: ReactNode;
}) {
  return (
    <article className="ivory-offer">
      {rules.backgroundImageUrl && (
        <img
          className="ivory-offer-image"
          src={rules.backgroundImageUrl}
          alt=""
        />
      )}
      <div className="ivory-offer-body">
        <small className="ivory-offer-eyebrow">
          {rules.kind === "voucher" ? (
            <Gift size={16} />
          ) : (
            <Sparkles size={16} />
          )}{" "}
          {artist ||
            (rules.kind === "voucher" ? "Gift voucher" : "Calendar offer")}
        </small>
        <h2>{rules.name}</h2>
        <strong className="ivory-offer-value">
          {rules.valueType === "percentage"
            ? `${rules.value}% off`
            : money(remaining ?? rules.value, rules.currency)}
          {rules.kind === "discount" && rules.valueType === "fixed"
            ? " off"
            : ""}
        </strong>
        {rules.description && <p>{rules.description}</p>}
        <small>
          {rules.eligibility === "new"
            ? "New bookings only"
            : "New & existing unpaid balances"}{" "}
          ·{" "}
          {rules.expiresAt
            ? `Use by ${dateLabel(rules.expiresAt)}`
            : rules.funding === "sale" && rules.validityYears !== null
              ? `Valid ${rules.validityYears ?? 3} years after purchase`
              : "No expiry"}
        </small>
        {!!rules.sittingMonths?.length && <small>Offer for: {rules.sittingMonths.map(m => new Intl.DateTimeFormat(undefined, {month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${m}-01T00:00:00Z`))).join(", ")}</small>}
        {(rules.sittingFrom || rules.sittingUntil) && (
          <small>
            Sittings:{" "}
            {rules.sittingFrom ? dateLabel(rules.sittingFrom) : "any date"} –{" "}
            {rules.sittingUntil ? dateLabel(rules.sittingUntil) : "onwards"}
          </small>
        )}
        {children}
      </div>
    </article>
  );
}
const fresh: OfferRules = {
  name: "",
  description: "",
  kind: "discount",
  valueType: "percentage",
  value: 10,
  currency: "AUD",
  eligibility: "new",
  expiresAt: null,
  sittingFrom: null,
  sittingUntil: null,
  backgroundImageUrl: "",
};
export function PromotionsManager() {
  const query = trpc.offers.list.useQuery();
  const [editing, setEditing] = useState<{
    id?: number;
    rules: OfferRules;
  } | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [deliveryId, setDeliveryId] = useState<number | null>(null);
  const archive = trpc.offers.archive.useMutation({
    onSuccess: () => query.refetch(),
  });
  if (query.data?.enabled === false)
    return (
      <Panel>
        <h2>Promotions testing is not activated</h2>
        <p>
          This server needs the Ivory offers migration and activation setting
          before promotions can be created.
        </p>
      </Panel>
    );
  if (editing)
    return (
      <OfferEditor
        initial={editing}
        onDone={() => {
          setEditing(null);
          void query.refetch();
        }}
      />
    );
  if (sending)
    return (
      <OfferAudience
        id={sending}
        onDone={message => {
          setSending(null);
          setNotice(message);
          void query.refetch();
        }}
      />
    );
  return (
    <div className="v3-stack">
      <Action onClick={() => setEditing({ rules: fresh })}>
        Create promotion
      </Action>
      <Feedback
        loading={query.isLoading}
        error={query.error || archive.error}
        onRetry={() => query.refetch()}
      />
      {notice && <p role="status">{notice}</p>}
      {!query.isLoading && !query.error && !query.data?.campaigns.length && (
        <p>
          Create a short-lived offer to fill your calendar, or a gift voucher to
          give a client credit.
        </p>
      )}
      {query.data?.campaigns.map(c => (
        <OfferCard key={c.id} rules={c.rules}>
          <div className="ivory-offer-actions">
            <Action onClick={() => setSending(c.id)}>Choose audience</Action>
            <Action
              tone="quiet"
              onClick={() => setEditing({ id: c.id, rules: c.rules })}
            >
              Edit
            </Action>
            <Action
              tone="quiet"
              disabled={archive.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Archive this promotion? Issued offers will remain valid."
                  )
                )
                  archive.mutate({ id: c.id });
              }}
            >
              Archive
            </Action>
          </div>
          <Action tone="quiet" onClick={() => setDeliveryId(c.id)}>
            Delivery activity
          </Action>
        </OfferCard>
      ))}
      <SheetShell
        isOpen={deliveryId !== null}
        onClose={() => setDeliveryId(null)}
        title="Delivery activity"
      >
        {deliveryId && <OfferDeliveryActivity id={deliveryId} />}
      </SheetShell>
      <p className="v3-muted">{OFFER_TERMS}</p>
    </div>
  );
}
function OfferEditor({
  initial,
  onDone,
}: {
  initial: { id?: number; rules: OfferRules };
  onDone: () => void;
}) {
  const [r, set] = useState(initial.rules);
  const [uploading, setUploading] = useState(false);
  const change = <K extends keyof OfferRules>(key: K, value: OfferRules[K]) =>
    set({ ...r, [key]: value });
  const save = trpc.offers.save.useMutation({ onSuccess: onDone });
  const dateField = (
    key: "expiresAt" | "sittingFrom" | "sittingUntil",
    label: string
  ) => (
    <label>
      {label}
      <input
        type="date"
        value={r[key]?.slice(0, 10) || ""}
        onChange={e =>
          change(
            key,
            e.target.value
              ? new Date(
                  `${e.target.value}T${key === "sittingFrom" ? "00:00:00" : "23:59:59"}`
                ).toISOString()
              : null
          )
        }
      />
    </label>
  );
  return (
    <form
      className="ivory-offer-form v3-stack"
      onSubmit={e => {
        e.preventDefault();
        save.mutate({ id: initial.id, rules: r });
      }}
    >
      <label>
        Purpose
        <select
          value={r.kind}
          onChange={e =>
            set({
              ...r,
              kind: e.target.value as OfferRules["kind"],
              valueType: e.target.value === "voucher" ? "fixed" : "percentage",
              value: e.target.value === "voucher" ? 10000 : 10,
              expiresAt: null,
              funding: "gift",
              validityYears: 3,
              eligibility: e.target.value === "voucher" ? "unpaid" : "new",
            })
          }
        >
          <option value="discount">Fill my calendar</option>
          <option value="voucher">Gift voucher</option>
        </select>
      </label>
      <label>
        Name
        <input
          required
          maxLength={80}
          value={r.name}
          onChange={e => change("name", e.target.value)}
        />
      </label>
      <label>
        Details
        <textarea
          maxLength={500}
          value={r.description}
          onChange={e => change("description", e.target.value)}
        />
      </label>
      <div className="ivory-offer-fields">
        <label>
          Value type
          <select
            value={r.valueType}
            onChange={e =>
              set({ ...r, valueType: e.target.value as OfferRules["valueType"], ...(e.target.value === "percentage" ? {kind: "discount", funding: "gift", value: 10} : {value: 10000}) })
            }
          >
            <option value="fixed">Amount</option>
            <option value="percentage">Discount %</option>
          </select>
        </label>
        <label>
          {r.valueType === "percentage" ? "Percent" : "Amount"}
          <input
            type="number"
            required
            min="0.01"
            step={r.valueType === "percentage" ? "1" : "0.01"}
            max={r.valueType === "percentage" ? 100 : 100000}
            value={r.valueType === "fixed" ? r.value / 100 : r.value}
            onChange={e =>
              change(
                "value",
                Math.round(
                  Number(e.target.value) * (r.valueType === "fixed" ? 100 : 1)
                )
              )
            }
          />
        </label>
      </div>
      <label>
        Currency
        <select
          value={r.currency}
          onChange={e => change("currency", e.target.value as "AUD" | "NZD")}
        >
          <option>AUD</option>
          <option disabled>NZD</option>
        </select>
      </label>
      <label>
        Applies to
        <select
          value={r.eligibility}
          onChange={e =>
            change("eligibility", e.target.value as OfferRules["eligibility"])
          }
        >
          <option value="new">New bookings only</option>
          <option value="unpaid">New and existing unpaid balances</option>
        </select>
      </label>
      {r.kind === "voucher" && (
        <label>
          How is this voucher funded?
          <select
            value={r.funding || "gift"}
            onChange={e =>
              set({
                ...r,
                funding: e.target.value as "gift" | "sale",
                expiresAt: null,
                validityYears: 3,
              })
            }
          >
            <option value="gift">Complimentary credit from me</option>
            <option value="sale">Client purchases the gift voucher</option>
          </select>
        </label>
      )}
      {r.kind === "voucher" && r.funding === "sale" ? (
        <label>
          Valid after purchase
          <select
            value={
              r.validityYears === null ? "none" : String(r.validityYears ?? 3)
            }
            onChange={e =>
              change(
                "validityYears",
                e.target.value === "none" ? null : Number(e.target.value)
              )
            }
          >
            <option value="3">3 years</option>
            <option value="5">5 years</option>
            <option value="none">No expiry</option>
          </select>
        </label>
      ) : (
        dateField(
          "expiresAt",
          r.kind === "voucher"
            ? "Voucher expiry (optional, minimum 3 years)"
            : "Book by (optional)"
        )
      )}
      <label className="ivory-offer-check">
        <input
          type="checkbox"
          checked={!!r.allowStacking}
          onChange={e => change("allowStacking", e.target.checked)}
        />
        Allow this offer with prior voucher credit or a prior discount (never
        two discounts)
      </label>
      <OfferAppearance rules={r} onChange={set} onUploading={setUploading} />
      {r.kind === "voucher" && (
        <p className="v3-muted">
          {r.funding === "sale"
            ? "The client purchases this voucher securely before using or transferring it. Fees are shown before payment."
            : "This issues complimentary credit without collecting a payment."}{" "}
          Transfer keeps its balance, artist, currency and expiry.
        </p>
      )}
      {initial.id && (
        <p className="v3-muted">
          Edits apply to future recipients. Existing clients keep their issued
          terms.
        </p>
      )}
      <OfferCard rules={r} />
      <p className="v3-muted">{OFFER_TERMS}</p>
      {save.error && <p role="alert">{save.error.message}</p>}
      <div className="ivory-offer-actions">
        <Action type="submit" disabled={save.isPending || uploading}>
          {save.isPending ? "Saving…" : "Save promotion"}
        </Action>
        <Action type="button" tone="quiet" onClick={onDone}>
          Cancel
        </Action>
      </div>
    </form>
  );
}
function OfferAudience({
  id,
  onDone,
}: {
  id: number;
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const clients = trpc.offers.audienceClients.useQuery();
  const [channels, setChannels] = useState({ sms: false, push: false });
  const [filters, setFilters] = useState<AudienceFilters>({
    minSpendCents: 0,
    minBookings: 0,
    inactiveDays: 0,
  });
  const active = mode === "filtered" ? filters : { minSpendCents: 0, minBookings: 0, inactiveDays: 0, ...(mode === "manual" ? { clientIds: selected } : {}) };
  const cities = [...new Set((clients.data || []).map(c => c.city?.trim()).filter((c): c is string => !!c))].sort();
  const visible = (clients.data || []).filter(c => `${c.name || ""} ${c.city || ""}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => sort === "city" ? (a.city || "").localeCompare(b.city || "") || (a.name || "").localeCompare(b.name || "") : (a.name || "").localeCompare(b.name || ""));
  const query = trpc.offers.audience.useQuery(active);
  const issue = trpc.offers.issue.useMutation({
    onSuccess: r =>
      onDone(
        `${r.issued} offers added to client accounts. ${r.skipped} already received this offer.`
      ),
  });
  return (
    <div className="ivory-offer-form v3-stack">
      <h2>Who is this for?</h2>
      <label>
        Audience
        <select
          value={mode}
          onChange={e => setMode(e.target.value)}
        >
          <option value="all">All my clients</option>
          <option value="filtered">Match filters</option>
          <option value="manual">Select clients</option>
        </select>
      </label>
      {mode === "filtered" && <>
        <label>Lifetime paid<select value={filters.minSpendCents} onChange={e => setFilters({ ...filters, minSpendCents: Number(e.target.value) })}>
          <option value={0}>Any amount</option>{[500,1000,2500,5000].map(n => <option key={n} value={n*100}>${n.toLocaleString()} or more</option>)}
        </select></label>
        <label>Completed bookings<select value={filters.minBookings} onChange={e => setFilters({ ...filters, minBookings: Number(e.target.value) })}>
          <option value={0}>Any number</option>{[1,3,5,10].map(n => <option key={n} value={n}>{n} or more</option>)}
        </select></label>
        <label>Time since last sitting<select value={filters.inactiveDays} onChange={e => setFilters({ ...filters, inactiveDays: Number(e.target.value) })}>
          <option value={0}>Any time</option>{[30,90,180,365].map(n => <option key={n} value={n}>At least {n} days</option>)}
        </select></label>
        <label>Birthday month<select value={filters.birthdayMonth || ""} onChange={e => setFilters({ ...filters, birthdayMonth: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">Any month</option>{Array.from({length:12},(_,i) => <option key={i} value={i+1}>{new Intl.DateTimeFormat("en",{month:"long"}).format(new Date(2020,i,1))}</option>)}
        </select></label>
        <label>City<select value={filters.city || ""} onChange={e => setFilters({ ...filters, city: e.target.value || undefined })}>
          <option value="">Any city</option>{cities.map(city => <option key={city}>{city}</option>)}
        </select></label>
        <p className="v3-muted">Clients must match every selected filter. Birthday and city use saved profile information; missing details won’t match those filters.</p>
      </>}
      <label>Search clients<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or city" /></label>
      <label>Sort clients<select value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name A–Z</option><option value="city">City A–Z</option></select></label>
      {mode === "manual" && <p>{selected.length} selected · Search keeps your selections.</p>}
      <div className="ivory-audience-list" aria-label="Client recipients">
        {visible.filter(c => mode === "manual" || query.data?.clientIds.includes(c.id)).map(c => mode === "manual" ? <label className="ivory-offer-check" key={c.id}><input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids,c.id] : ids.filter(id => id !== c.id))} /><span>{c.name || "Unnamed client"}{c.city && <small className="v3-muted"> · {c.city}</small>}</span></label> : <p key={c.id}>{c.name || "Unnamed client"}{c.city && <small className="v3-muted"> · {c.city}</small>}</p>)}
      </div>
      <Feedback
        loading={query.isFetching}
        error={query.error || clients.error || issue.error}
        onRetry={() => query.refetch()}
      />
      <Panel>
        <h2>{query.data?.count ?? "…"} clients</h2>
        <p>
          Offers appear in Discover and Bookings. Each client receives this
          promotion once.
        </p>
        <p className="v3-muted">
          Only clients who opted in receive promotional notifications. Device
          acceptance is not proof the client read the message.
        </p>
      </Panel>
      <label className="ivory-offer-check">
        <input
          type="checkbox"
          disabled={!query.data?.pushAvailable}
          checked={channels.push}
          onChange={e => setChannels({ ...channels, push: e.target.checked })}
        />
        Push · {query.data?.pushCount ?? 0} opted in
        {!query.data?.pushAvailable ? " · Provider not configured" : ""}
      </label>
      <label className="ivory-offer-check">
        <input
          type="checkbox"
          disabled={!query.data?.smsAvailable}
          checked={channels.sms}
          onChange={e => setChannels({ ...channels, sms: e.target.checked })}
        />
        SMS · {query.data?.smsCount ?? 0} verified and opted in
        {!query.data?.smsAvailable ? " · Provider not configured" : ""}
      </label>
      <div className="ivory-offer-actions">
        <Action
          disabled={!query.data?.count || !!query.error || !!clients.error || query.isFetching || issue.isPending}
          onClick={() =>
            issue.mutate({
              id,
              filters: active,
              expectedCount: query.data!.count,
              channels,
            })
          }
        >
          {issue.isPending ? "Adding…" : "Add offers to these clients"}
        </Action>
        <Action tone="quiet" onClick={() => onDone("")}>
          Cancel
        </Action>
      </div>
    </div>
  );
}
export function ClientOffers({ index }: { index?: number }) {
  const query = trpc.offers.list.useQuery();
  const [, go] = useLocation();
  const [transfer, setTransfer] = useState<number | null>(null);
  const [purchaseId, setPurchaseId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const use = trpc.offers.use.useMutation({
    onSuccess: r => go(`/chat/${r.conversationId}`),
  });
  const move = trpc.offers.transfer.useMutation({
    onSuccess: () => {
      setTransfer(null);
      setEmail("");
      void query.refetch();
    },
  });
  const resolve = trpc.offers.resolveTransfer.useMutation({
    onSuccess: () => query.refetch(),
  });
  const offers = (query.data?.offers || []).filter(
    o =>
      (o.remainingValue > 0 || o.purchaseRequired) &&
      (!o.rules.expiresAt || +new Date(o.rules.expiresAt) > Date.now())
  );
  const shown = index === undefined ? offers : offers.slice(index, index + 1);
  if (!shown.length && !query.data?.incoming.length && !query.error)
    return null;
  return (
    <section className="v3-stack ivory-client-offers" aria-label="Your offers">
      {index === undefined && (
        <Feedback error={query.error} onRetry={() => query.refetch()} />
      )}
      {shown.map(o => (
        <OfferCard
          key={o.id}
          rules={o.rules}
          remaining={o.purchaseRequired ? o.rules.value : o.remainingValue}
          artist={o.artistName}
        >
          <div className="ivory-offer-actions">
            {o.purchaseRequired ? (
              <Action onClick={() => setPurchaseId(o.id)}>
                Buy gift voucher
              </Action>
            ) : o.transferTo ? (
              <>
                <span>Transfer awaiting acceptance</span>
                <Action
                  tone="quiet"
                  onClick={() => resolve.mutate({ id: o.id, accept: false })}
                >
                  Cancel transfer
                </Action>
              </>
            ) : (
              <>
                <Action
                  disabled={use.isPending}
                  onClick={() => use.mutate({ id: o.id })}
                >
                  Use offer
                </Action>
                {o.rules.kind === "voucher" && (
                  <Action tone="quiet" onClick={() => setTransfer(o.id)}>
                    Transfer gift
                  </Action>
                )}
              </>
            )}
          </div>
        </OfferCard>
      ))}
      {index === undefined &&
        query.data?.incoming.map(o => (
          <Panel key={o.id}>
            <h2>A gift for you</h2>
            <p>
              {o.rules.name} · {money(o.remainingValue, o.rules.currency)}
            </p>
            <div className="ivory-offer-actions">
              <Action
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: o.id, accept: true })}
              >
                Accept gift
              </Action>
              <Action
                tone="quiet"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: o.id, accept: false })}
              >
                Decline
              </Action>
            </div>
          </Panel>
        ))}
      {(use.error || resolve.error) && (
        <p role="alert">{use.error?.message || resolve.error?.message}</p>
      )}
      <SheetShell
        isOpen={purchaseId !== null}
        onClose={() => setPurchaseId(null)}
        title="Buy gift voucher"
      >
        {purchaseId && <VoucherPurchase id={purchaseId} />}
      </SheetShell>
      <SheetShell
        isOpen={transfer !== null}
        onClose={() => setTransfer(null)}
        title="Transfer your gift"
      >
        <form
          className="ivory-offer-form v3-stack"
          onSubmit={e => {
            e.preventDefault();
            if (transfer) move.mutate({ id: transfer, email });
          }}
        >
          <p>
            The recipient must have a Tattoi client account. Your whole
            remaining balance moves after they accept; the expiry stays the
            same.
          </p>
          <label>
            Recipient email
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </label>
          <p>
            Check the email carefully. You can cancel before the gift is
            accepted.
          </p>
          {move.error && <p role="alert">{move.error.message}</p>}
          <Action type="submit" disabled={move.isPending}>
            Offer transfer
          </Action>
        </form>
      </SheetShell>
    </section>
  );
}
export function CheckoutOffers({
  sessionPlanId,
  onChanged,
}: {
  sessionPlanId: number;
  onChanged: () => void;
}) {
  const query = trpc.sessionPlans.offerOptions.useQuery({ sessionPlanId });
  const cancel = trpc.sessionPlans.cancelOfferCheckout.useMutation({
    onSuccess: () => {
      void query.refetch();
      onChanged();
    },
  });
  const change = trpc.sessionPlans.setOffer.useMutation({
    onSuccess: () => {
      void query.refetch();
      onChanged();
    },
  });
  if (!query.data?.choices.length && !query.error) return null;
  return (
    <Section title="Your offers">
      <Feedback
        error={query.error || change.error || cancel.error}
        onRetry={() => query.refetch()}
      />
      <label className="ivory-offer-form">
        Use an eligible offer
        <select
          aria-label="Booking offer"
          disabled={change.isPending || query.data?.checkoutStarted}
          value={query.data?.applied?.offerId || ""}
          onChange={e =>
            change.mutate({
              sessionPlanId,
              offerId: e.target.value ? Number(e.target.value) : null,
            })
          }
        >
          <option value="">No offer</option>
          {query.data?.choices.map((c: any) => (
            <option key={c.id} value={c.id} disabled={!!c.reason}>
              {c.name}
              {c.reason ? ` — ${c.reason}` : ""}
            </option>
          ))}
        </select>
      </label>
      {query.data?.checkoutStarted && (
        <Action
          tone="quiet"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate({ sessionPlanId })}
        >
          Cancel checkout to change offer
        </Action>
      )}
      <small className="v3-muted">{OFFER_TERMS}</small>
      {query.data?.applied && (
        <p>
          {query.data.applied.discountCents
            ? `${money(query.data.applied.discountCents)} discount applied`
            : `${money(query.data.applied.creditCents)} voucher credit applied`}
          . Reserved until this booking is paid or cancelled.
        </p>
      )}
    </Section>
  );
}

function OfferDeliveryActivity({ id }: { id: number }) {
  const q = trpc.offers.deliveries.useQuery({ id }, { refetchInterval: 10000 });
  const retry = trpc.offers.retryDelivery.useMutation({
    onSuccess: () => q.refetch(),
  });
  return (
    <div className="v3-stack">
      <p>
        Accepted means the provider accepted delivery. SMS updates to delivered
        when confirmed. Unknown deliveries are not resent automatically.
      </p>
      <Feedback
        loading={q.isLoading}
        error={q.error || retry.error}
        onRetry={() => q.refetch()}
      />
      {!q.isLoading && !q.data?.length && (
        <p>
          No notifications requested. Offers are available in client accounts.
        </p>
      )}
      {q.data?.map(d => (
        <Panel key={d.id}>
          <strong>
            {d.channel.toUpperCase()} · {d.status}
          </strong>
          {d.error && <p>{d.error}</p>}
          {d.status === "failed" && d.attempts < 5 && (
            <Action
              disabled={retry.isPending}
              onClick={() => retry.mutate({ id: d.id })}
            >
              Retry failed delivery
            </Action>
          )}
        </Panel>
      ))}
    </div>
  );
}
export function OfferNotificationPreferences() {
  const q = trpc.offers.preferences.useQuery();
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState("");
  const save = trpc.offers.setPreferences.useMutation({
    onSuccess: () => q.refetch(),
  });
  const request = trpc.offers.requestSmsCode.useMutation();
  const verify = trpc.offers.verifySmsCode.useMutation({
    onSuccess: () => {
      setCode("");
      void q.refetch();
    },
  });
  if (!q.data?.enabled) return null;
  return (
    <Section title="Promotions from your artists">
      <div className="ivory-offer-form v3-stack">
        <p>
          Optional offers and gift vouchers. Turn these off any time; booking
          notifications stay separate.
        </p>
        <label className="ivory-offer-check">
          <input
            type="checkbox"
            checked={q.data.push}
            disabled={save.isPending}
            onChange={e =>
              save.mutate({ sms: q.data!.sms, push: e.target.checked })
            }
          />
          Receive promotional push notifications on my enabled devices
        </label>
        {q.data.verifiedPhone && (
          <>
            <p>Verified mobile: {q.data.verifiedPhone}</p>
            <label className="ivory-offer-check">
              <input
                type="checkbox"
                checked={q.data.sms}
                disabled={save.isPending}
                onChange={e =>
                  save.mutate({ push: q.data!.push, sms: e.target.checked })
                }
              />
              Receive promotional SMS. I can unsubscribe in each message.
            </label>
          </>
        )}
        {q.data.smsAvailable && (
          <>
            <label>
              Mobile number
              <input
                type="tel"
                autoComplete="tel"
                placeholder="+61…"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </label>
            <Action
              tone="secondary"
              disabled={request.isPending || !phone}
              onClick={() => request.mutate({ phone })}
            >
              Send verification code
            </Action>
            {request.isSuccess && (
              <>
                <label>
                  Six-digit code
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value)}
                  />
                </label>
                <Action
                  disabled={verify.isPending || code.length !== 6}
                  onClick={() => verify.mutate({ code })}
                >
                  Verify mobile
                </Action>
              </>
            )}
          </>
        )}
        <Feedback error={save.error || request.error || verify.error} />
      </div>
    </Section>
  );
}
function VoucherPurchase({ id }: { id: number }) {
  const [submitted, setSubmitted] = useState(false),
    [pay, setPay] = useState(false);
  const q = trpc.offers.list.useQuery(undefined, {
    refetchInterval: submitted ? 2000 : false,
  });
  const purchase = trpc.offers.purchase.useMutation();
  const offer = q.data?.offers.find(o => o.id === id);
  if (offer && !offer.purchaseRequired)
    return (
      <Panel>
        <h2>Your gift is ready</h2>
        <p>
          Use your voucher on an eligible booking or transfer it to another
          client.
        </p>
        <OfferCard rules={offer.rules} remaining={offer.remainingValue} />
      </Panel>
    );
  if (submitted)
    return (
      <Panel>
        <h2>Confirming your purchase</h2>
        <p>
          Payment was submitted. Your voucher will appear after confirmation.
          Please don’t pay again.
        </p>
        <Action onClick={() => q.refetch()}>Check confirmation</Action>
      </Panel>
    );
  const details = purchase.data;
  return (
    <div className="v3-stack">
      {offer && <OfferCard rules={offer.rules} />}
      {details && pay ? (
        <DotsCheckout
          clientSecret={details.clientSecret}
          amountCents={details.fees.clientTotalCents}
          artistName={offer?.artistName || "Your artist"}
          onBack={() => setPay(false)}
          onComplete={() => {
            setSubmitted(true);
            void q.refetch();
          }}
        />
      ) : (
        <>
          {details && (
            <dl className="v3-facts">
              <div>
                <dt>Voucher credit</dt>
                <dd>{money(details.fees.baseAmountCents)}</dd>
              </div>
              <div>
                <dt>Platform fee</dt>
                <dd>{money(details.fees.platformFeeCents)}</dd>
              </div>
              <div>
                <dt>Total · AUD</dt>
                <dd>{money(details.fees.clientTotalCents)}</dd>
              </div>
            </dl>
          )}
          <p>
            {offer?.rules.validityYears === null
              ? "No expiry."
              : `Valid for ${offer?.rules.validityYears ?? 3} years after purchase.`}{" "}
            {OFFER_TERMS}
          </p>
          <Feedback error={purchase.error || q.error} />
          <Action
            disabled={purchase.isPending}
            onClick={() => (details ? setPay(true) : purchase.mutate({ id }))}
          >
            {purchase.isPending
              ? "Preparing…"
              : details
                ? "Pay securely"
                : "Review price & fees"}
          </Action>
        </>
      )}
    </div>
  );
}
export function OfferBalancePayment({
  bookingId,
  requestId,
  artistName,
  onSubmitted,
}: {
  bookingId: number;
  requestId?: number;
  artistName?: string | null;
  onSubmitted: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null),
    [pay, setPay] = useState(false);
  const q = trpc.offers.balanceQuote.useQuery({
    bookingId,
    requestId,
    offerId: selected,
  });
  const create = trpc.offers.balanceCheckout.useMutation({
    onSuccess: r => {
      if (r.confirmed) onSubmitted();
      else setPay(true);
    },
  });
  const cancel = trpc.offers.cancelBalanceCheckout.useMutation({
    onSuccess: () => {
      setPay(false);
      create.reset();
      void q.refetch();
    },
  });
  const quote = q.data?.quote;
  if (pay && create.data?.clientSecret)
    return (
      <div className="v3-stack">
        <DotsCheckout
          clientSecret={create.data.clientSecret}
          amountCents={create.data.totalCents}
          artistName={artistName || "Your artist"}
          onBack={() => setPay(false)}
          onComplete={onSubmitted}
        />
        <Action
          tone="quiet"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate({ bookingId })}
        >
          Cancel checkout & release offer
        </Action>
        <Feedback error={cancel.error} />
      </div>
    );
  return (
    <div className="v3-stack ivory-offer-form">
      <Feedback
        loading={q.isFetching}
        error={q.error || create.error || cancel.error}
        onRetry={() => q.refetch()}
      />
      {quote && (
        <>
          <label>
            Apply an offer
            <select
              disabled={q.data?.active || create.isPending}
              value={q.data?.active ? (quote.offerId ?? "") : (selected ?? "")}
              onChange={e =>
                setSelected(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">No offer</option>
              {q.data?.choices.map(
                (o: { id: number; name: string; reason: string | null }) => (
                  <option key={o.id} value={o.id} disabled={!!o.reason}>
                    {o.name}
                    {o.reason ? ` — ${o.reason}` : ""}
                  </option>
                )
              )}
            </select>
          </label>
          <Panel>
            <dl className="v3-facts">
              <div>
                <dt>Payment before offers</dt>
                <dd>{money(quote.due)}</dd>
              </div>
              {!!quote.discountCents && (
                <div>
                  <dt>Discount</dt>
                  <dd>−{money(quote.discountCents)}</dd>
                </div>
              )}
              {!!quote.creditCents && (
                <div>
                  <dt>Voucher credit</dt>
                  <dd>−{money(quote.creditCents)}</dd>
                </div>
              )}
              <div>
                <dt>Platform fee</dt>
                <dd>{money(quote.platformFeeCents)}</dd>
              </div>
              <div>
                <dt>Total · AUD</dt>
                <dd>{money(quote.totalCents)}</dd>
              </div>
            </dl>
          </Panel>
          <small>{OFFER_TERMS}</small>
          <Action
            disabled={create.isPending || q.isFetching || !!q.error}
            onClick={() =>
              create.mutate({
                bookingId,
                requestId,
                offerId: q.data?.active ? quote.offerId : selected,
              })
            }
          >
            {quote.totalCents
              ? "Continue to secure checkout"
              : "Confirm with voucher / discount"}
          </Action>
          {q.data?.active && (
            <Action
              tone="quiet"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ bookingId })}
            >
              Cancel checkout to change offer
            </Action>
          )}
        </>
      )}
    </div>
  );
}
