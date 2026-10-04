import { usePractice } from "@/features/practice/PracticeContext";
import { NumericInput } from "@/components/ui/numeric-input";
import { useEffect, useState } from "react";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { trpc } from "@/lib/trpc";
import { trpcVanilla } from "@/lib/trpcVanilla";
import { useTheme } from "@/contexts/ThemeContext";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { money } from "@/features/workspace/bookingPresentation";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Status,
} from "../design/primitives";

export default function Bank() {
  const status = trpc.artistSettings.getStripeConnectStatus.useQuery(
    undefined,
    { refetchInterval: 10000 }
  );
  const config = trpc.artistSettings.getStripeOnboardingConfig.useQuery();
  const create = trpc.artistSettings.connectStripe.useMutation();
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState("");
  const data = status.data;
  const busy = create.isPending;
  async function start() {
    setError("");
    try {
      if (!data?.connected) await create.mutateAsync({ embedded: true });
      // The AccountSession supports existing Standard/Express as well as Custom accounts.
      // Open immediately; a status refresh must not delay the onboarding sheet.
      setSetup(true);
      void status.refetch();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn’t open bank setup. Try again."
      );
    }
  }
  return (
    <Screen
      title="Bank & payouts"
      subtitle="Your payment account, in one place."
      back="/money"
    >
      <Feedback
        loading={status.isLoading}
        error={status.error}
        onRetry={() => status.refetch()}
      />
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <Panel>
            <div className="v3-inline">
              <h2>
                {data.connected
                  ? "Your payment account"
                  : "Get paid for your work"}
              </h2>
              {data.connected && (
                <Status
                  tone={
                    data.statusAvailable && data.payoutsEnabled
                      ? "success"
                      : "warning"
                  }
                >
                  {!data.statusAvailable
                    ? "Status unavailable"
                    : data.payoutsEnabled
                      ? "Payouts enabled"
                      : data.pendingVerification
                        ? "Verification in progress"
                        : "Setup needs attention"}
                </Status>
              )}
            </div>
            <p>
              {!data.connected
                ? "Connect your bank and verify your details to receive booking payments. Stripe securely collects the information it needs."
                : !data.statusAvailable
                  ? "Stripe’s account status could not be checked. Refresh before making changes."
                  : data.pendingVerification
                    ? "Stripe is reviewing your details. This page will show when payments and payouts are enabled."
                    : "Payment collection and bank payouts have separate verification requirements."}
            </p>
            {data.connected && data.statusAvailable && (
              <dl className="v3-facts">
                <div>
                  <dt>Accept payments</dt>
                  <dd>{data.chargesEnabled ? "Enabled" : "Not enabled"}</dd>
                </div>
                <div>
                  <dt>Pay out to bank</dt>
                  <dd>{data.payoutsEnabled ? "Enabled" : "Not enabled"}</dd>
                </div>
              </dl>
            )}
            {!data.connected && (
              <ol
                className="ivory-bank-setup-steps"
                aria-label="Payment setup steps"
              >
                <li>
                  <strong>Your business</strong>
                  <span>Confirm your business and contact details.</span>
                </li>
                <li>
                  <strong>Your identity</strong>
                  <span>Complete the checks Stripe requests securely.</span>
                </li>
                <li>
                  <strong>Your bank</strong>
                  <span>Add the account where payouts should arrive.</span>
                </li>
              </ol>
            )}
            <div className="v3-inline">
              <Action
                disabled={
                  busy ||
                  status.isLoading ||
                  (data.connected && !data.statusAvailable)
                }
                onClick={start}
              >
                {busy
                  ? "Opening…"
                  : data.connected
                    ? "Review account details"
                    : "Set up payments"}
              </Action>
              <Action
                tone="secondary"
                disabled={status.isFetching}
                onClick={() => status.refetch()}
              >
                Refresh status
              </Action>
            </div>
          </Panel>
          {data.connected && (
            <PayoutSettings onDisconnect={() => status.refetch()} />
          )}
        </>
      )}
      {setup && (
        <SheetShell
          isOpen
          title="Set up your payment account"
          description="Review business, identity and bank verification."
          onClose={() => {
            setSetup(false);
            void status.refetch();
          }}
        >
          <EmbeddedSetup
            publishableKey={
              config.data?.publishableKey ||
              import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
            }
            configLoading={config.isLoading}
            onExit={() => {
              setSetup(false);
              void status.refetch();
            }}
          />
        </SheetShell>
      )}
    </Screen>
  );
}

export function EmbeddedSetup({
  onExit,
  publishableKey,
  configLoading = false,
}: {
  onExit: () => void;
  publishableKey?: string | null;
  configLoading?: boolean;
}) {
  const practice = usePractice();
  const { theme } = useTheme();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [instance, setInstance] = useState<ReturnType<
    typeof loadConnectAndInitialize
  > | null>(null);
  const fallback = trpc.artistSettings.getStripeAccountLink.useMutation();
  useEffect(() => {
    if (practice || configLoading) return;
    const key = publishableKey;
    if (!key) {
      setError(
        "Payment configuration is unavailable. You can continue securely with Stripe below."
      );
      return;
    }
    setError("");
    let active = true;
    const styles = getComputedStyle(document.documentElement);
    const value = (name: string) => styles.getPropertyValue(name).trim();
    let next: ReturnType<typeof loadConnectAndInitialize>;
    try {
      next = loadConnectAndInitialize({
        publishableKey: key,
        fetchClientSecret: async () => {
          try {
            return (
              await trpcVanilla.artistSettings.createStripeAccountSession.mutate()
            ).clientSecret;
          } catch (e) {
            if (active)
              setError(
                e instanceof Error ? e.message : "Couldn’t load verification."
              );
            throw e;
          }
        },
        appearance: {
          overlays: "dialog",
          variables: {
            colorPrimary: value("--v3-ink"),
            colorBackground: value("--v3-paper"),
            colorText: value("--v3-ink"),
            borderRadius: "12px",
            fontFamily: getComputedStyle(document.body).fontFamily,
          },
        },
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn’t initialise payment setup. Try again."
      );
      return;
    }
    setInstance(next);
    return () => {
      active = false;
      void next.logout();
    };
  }, [attempt, theme, publishableKey, configLoading, practice]);
  if (practice)
    return (
      <div className="v3-stack">
        <h3>Practice verification</h3>
        <p>
          Fictional studio · Alex Artist · Mock bank ending 0000. No identity
          documents, bank details or Stripe connection are collected.
        </p>
        <Action
          onClick={() => {
            practice.simulate("Verify practice payment account");
            onExit();
          }}
        >
          Simulate verification approved
        </Action>
        <Action tone="quiet" onClick={onExit}>
          Return without completing
        </Action>
      </div>
    );
  return (
    <div className="v3-stack">
      <p
        data-tour-title="Payment account verification"
        data-tour-description="Complete Stripe’s identity and bank checks before accepting online payments. Returning to Tattoi does not confirm approval; check the account status so you know whether clients can pay and funds can reach your bank."
      >
        Your identity and bank details are collected securely by Stripe.
        Returning here does not itself confirm verification.
      </p>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <Action
            tone="secondary"
            onClick={() => {
              setError("");
              setAttempt(n => n + 1);
            }}
          >
            Try again
          </Action>
        </>
      ) : instance ? (
        <ConnectComponentsProvider connectInstance={instance}>
          <ConnectAccountOnboarding
            onExit={onExit}
            onLoadError={({ error }) =>
              setError(
                error.message ||
                  "Stripe verification could not load. Try again."
              )
            }
          />
        </ConnectComponentsProvider>
      ) : (
        <Feedback loading />
      )}
      {fallback.error && <p role="alert">{fallback.error.message}</p>}
      <Action
        tone="quiet"
        disabled={fallback.isPending}
        onClick={() =>
          fallback.mutate(undefined, {
            onSuccess: result => window.location.assign(result.url),
          })
        }
      >
        Having trouble? Continue with Stripe
      </Action>
    </div>
  );
}

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
function PayoutSettings({ onDisconnect }: { onDisconnect: () => unknown }) {
  const query = trpc.artistSettings.getPayoutSchedule.useQuery();
  const save = trpc.artistSettings.updatePayoutSchedule.useMutation({
    onSuccess: () => {
      setEditing(false);
      void query.refetch();
    },
  });
  const disconnect = trpc.artistSettings.disconnectStripe.useMutation({
    onSuccess: () => {
      setConfirm(false);
      onDisconnect();
    },
  });
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [interval, setInterval] = useState<
    "daily" | "weekly" | "monthly" | "manual"
  >("daily");
  const [weekly, setWeekly] = useState<(typeof DAYS)[number]>("monday");
  const [monthly, setMonthly] = useState(1);
  const data = query.data;
  return (
    <>
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {data && (
        <>
          <Section title="Bank balance">
            <Panel>
              <dl className="v3-facts">
                <div>
                  <dt>Available</dt>
                  <dd>{money(data.availableBalance, data.currency)}</dd>
                </div>
                <div>
                  <dt>Pending</dt>
                  <dd>{money(data.pendingBalance, data.currency)}</dd>
                </div>
              </dl>
              <p className="v3-muted">
                {data.currency.toUpperCase()} · Pending funds are not yet
                available for payout.
              </p>
              <Row
                title={
                  data.bankLast4
                    ? `${data.bankName || "Bank account"} •••• ${data.bankLast4}`
                    : "No bank account added"
                }
              />
            </Panel>
          </Section>
          <Section
            title="Payout schedule"
            action={
              <Action
                tone="quiet"
                disabled={save.isPending}
                onClick={() => {
                  setInterval(data.interval);
                  setWeekly(
                    DAYS.includes(data.weeklyAnchor as (typeof DAYS)[number])
                      ? (data.weeklyAnchor as (typeof DAYS)[number])
                      : "monday"
                  );
                  setMonthly(data.monthlyAnchor || 1);
                  save.reset();
                  setEditing(!editing);
                }}
              >
                {editing ? "Cancel" : "Change"}
              </Action>
            }
          >
            {editing ? (
              <form
                className="v3-form"
                onSubmit={e => {
                  e.preventDefault();
                  save.mutate({
                    interval,
                    weeklyAnchor: interval === "weekly" ? weekly : undefined,
                    monthlyAnchor: interval === "monthly" ? monthly : undefined,
                  });
                }}
              >
                <fieldset disabled={save.isPending}>
                  <label>
                    Frequency
                    <select
                      aria-label="Frequency"
                      value={interval}
                      onChange={e =>
                        setInterval(e.target.value as typeof interval)
                      }
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      {data.interval === "manual" && (
                        <option value="manual">
                          Manual (current schedule)
                        </option>
                      )}
                    </select>
                  </label>
                  {interval === "weekly" && (
                    <label>
                      Payout day
                      <select
                        aria-label="Payout day"
                        value={weekly}
                        onChange={e =>
                          setWeekly(e.target.value as typeof weekly)
                        }
                      >
                        {DAYS.map(day => (
                          <option key={day}>{day}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {interval === "monthly" && (
                    <label>
                      Day of month
                      <NumericInput
                        type="number"
                        min={1}
                        max={31}
                        required
                        aria-label="Day of month"
                        value={monthly}
                        onChange={e => setMonthly(Number(e.target.value))}
                      />
                      <small>
                        If the month is shorter, Stripe uses its last day.
                      </small>
                    </label>
                  )}
                  {save.error && <p role="alert">{save.error.message}</p>}
                  <Action type="submit">
                    {save.isPending ? "Saving…" : "Save payout schedule"}
                  </Action>
                </fieldset>
              </form>
            ) : (
              <Panel>
                <p>
                  {data.interval === "manual"
                    ? "Automatic payouts are off."
                    : data.interval === "weekly"
                      ? `Weekly on ${data.weeklyAnchor}.`
                      : data.interval === "monthly"
                        ? `Monthly on day ${data.monthlyAnchor}.`
                        : "Daily automatic payouts."}
                </p>
                <p className="v3-muted">
                  Funds must become available first. Your settlement delay is{" "}
                  {data.delayDays} days; bank arrival can take additional time.
                </p>
                {save.isSuccess && <p role="status">Payout schedule saved.</p>}
              </Panel>
            )}
          </Section>
          <ActionLink href="/payout-history">View payment history</ActionLink>
          <Section title="Account connection">
            <p className="v3-muted">
              Disconnecting removes this payment account from Tattoi. It does
              not close your Stripe account.
            </p>
            <Action tone="quiet" onClick={() => setConfirm(true)}>
              Disconnect payment account
            </Action>
          </Section>
          {confirm && (
            <SheetShell
              isOpen
              title="Disconnect payment account?"
              onClose={() => {
                if (!disconnect.isPending) setConfirm(false);
              }}
            >
              <div className="v3-stack">
                <p>
                  You will need to reconnect before collecting new booking
                  payments. Check any unsettled payments and payouts first.
                </p>
                {disconnect.error && (
                  <p role="alert">{disconnect.error.message}</p>
                )}
                <Action
                  tone="danger"
                  disabled={disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                >
                  {disconnect.isPending
                    ? "Disconnecting…"
                    : "Disconnect account"}
                </Action>
                <Action
                  tone="secondary"
                  disabled={disconnect.isPending}
                  onClick={() => setConfirm(false)}
                >
                  Keep connected
                </Action>
              </div>
            </SheetShell>
          )}
        </>
      )}
    </>
  );
}
