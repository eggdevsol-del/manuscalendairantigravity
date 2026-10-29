import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { money } from "@/features/workspace/bookingPresentation";
import type { OfferRules } from "@shared/offerRules";
import { Action, Feedback, Panel, Screen, Section } from "../design/primitives";
import { LiveStage, TouchSlider } from "../design/live";
import { parseSchedule } from "../design/calendarDays";
import { OfferAudience, PromotionsManager } from "../components/Offers";

const DAY = 86400000;

/** Offers & vouchers, as in the prototype: slide to design a discount and watch the voucher change, then
 *  create it and choose who receives it. Your existing offers, with their full editor, sit below. */
export default function Offers() {
  const { user } = useAuth();
  const settings = trpc.artistSettings.get.useQuery();
  const offers = trpc.offers.list.useQuery();
  const save = trpc.offers.save.useMutation();
  const utils = trpc.useUtils();
  const [percent, setPercent] = useState(15);
  const [days, setDays] = useState(30);
  const [created, setCreated] = useState<number | null>(null);
  const [sent, setSent] = useState("");
  const name = settings.data?.displayName || user?.name || "Your studio";
  const services = parseSchedule(settings.data?.services) as {
    name: string;
    price: number;
  }[];
  const service = services.find(s => s.price > 0);
  const until = new Date(Date.now() + days * DAY);
  const untilText = until.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
  const rules: OfferRules = {
    name: `${percent}% off your next sitting`,
    description: `${percent}% off a sitting booked before ${untilText}.`,
    kind: "discount",
    valueType: "percentage",
    value: percent,
    currency: "AUD",
    eligibility: "new",
    expiresAt: until.toISOString(),
    sittingFrom: null,
    sittingUntil: null,
    backgroundImageUrl: "",
  };
  const whole = (c: number) => money(c).replace(/\.00$/, "");
  return (
    <Screen
      title="Offers & vouchers"
      subtitle="Slide to design an offer. The voucher updates as you go."
    >
      <Feedback
        loading={offers.isLoading}
        error={offers.error}
        onRetry={() => offers.refetch()}
      />
      {offers.data?.enabled === false ? (
        <Panel>
          <h2>Promotions aren’t switched on yet</h2>
          <p>This server needs promotions turned on before you can create offers.</p>
        </Panel>
      ) : (
        <>
          <LiveStage className="iosm-voucher-stage" label={rules.name}>
            <span className="iosm-voucher">
              <small>{name}</small>
              <b>{percent}% off</b>
              <em>your next sitting</em>
              <span>
                Valid for {days} days · until {untilText}
              </span>
              <i aria-hidden="true" />
              <s>
                {service
                  ? `On a ${whole(Math.round(service.price * 100))} ${service.name.toLowerCase()} the client saves ${whole(Math.round(service.price * percent))}`
                  : "Add a priced service to see what clients save"}
              </s>
            </span>
          </LiveStage>
          {sent ? (
            <Panel>
              <p role="status">{sent}</p>
              <Action
                tone="secondary"
                onClick={() => {
                  setSent("");
                  setCreated(null);
                }}
              >
                Design another offer
              </Action>
            </Panel>
          ) : created ? (
            <Section title="Who receives it">
              <OfferAudience
                id={created}
                onDone={message => {
                  setSent(message);
                  void utils.offers.list.invalidate();
                }}
              />
            </Section>
          ) : (
            <>
              <TouchSlider
                label="Discount"
                tone="money"
                value={percent}
                min={5}
                max={50}
                step={5}
                format={v => `${v}% off`}
                onChange={setPercent}
              />
              <TouchSlider
                label="Valid for"
                tone="time"
                value={days}
                min={7}
                max={90}
                format={v => `${v} days`}
                onChange={setDays}
              />
              {save.error && <p role="alert">{save.error.message}</p>}
              <Action
                disabled={save.isPending}
                onClick={async () => {
                  const result = await save.mutateAsync({ rules }).catch(() => null);
                  if (result) {
                    setCreated(result.id);
                    void utils.offers.list.invalidate();
                  }
                }}
              >
                {save.isPending ? "Creating…" : "Create this offer"}
              </Action>
            </>
          )}
          <Section title="Your offers">
            <PromotionsManager />
          </Section>
        </>
      )}
    </Screen>
  );
}
