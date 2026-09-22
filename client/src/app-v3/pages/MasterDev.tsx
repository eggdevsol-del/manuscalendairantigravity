import { useState, type ComponentProps } from "react";
import { Redirect } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  Action,
  Feedback as BaseFeedback,
  Panel,
  Row,
  Screen,
  Section,
  Tabs,
} from "../design/primitives";

function needsDeveloperSignIn(error: unknown) {
  const code = (error as { data?: { code?: string } } | null)?.data?.code;
  return code === "UNAUTHORIZED" || code === "FORBIDDEN";
}
function developerSignOut() {
  for (const storage of [sessionStorage, localStorage]) {
    storage.removeItem("authToken");
    storage.removeItem("user");
  }
  window.location.assign("/login");
}
function Feedback(props: ComponentProps<typeof BaseFeedback>) {
  if (needsDeveloperSignIn(props.error)) return (
    <Panel>
      <div role="alert">
        <h2>Sign in to continue</h2>
        <p>Your developer session has expired or is no longer authorised. Sign in again to access platform information.</p>
      </div>
      <Action onClick={developerSignOut}>Sign in again</Action>
    </Panel>
  );
  return <BaseFeedback {...props} />;
}

const amount = (cents: number, country?: string | null) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: country === "NZ" ? "NZD" : "AUD",
    currencyDisplay: "code",
  }).format(cents / 100);
export function MasterDevLogin() {
  const login = trpc.masterDev.login.useMutation({
    onSuccess: data => {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      sessionStorage.setItem("authToken", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));
      window.location.assign("/dev");
    },
  });
  return (
    <Screen title="Private sign-in" action={<span />}>
      <Panel>
        <form
          className="v3-form"
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            login.mutate({
              username: String(f.get("username")),
              password: String(f.get("password")),
            });
          }}
        >
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              required
              maxLength={100}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <Feedback error={login.error} />
          <Action type="submit" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </Action>
        </form>
      </Panel>
    </Screen>
  );
}
export function MasterDev() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState("Overview");
  const overview = trpc.masterDev.overview.useQuery(undefined, {
    enabled: user?.role === "master_dev",
    retry: false,
  });
  if (loading)
    return (
      <Screen title="Developer">
        <Feedback loading />
      </Screen>
    );
  if (!user || user.role !== "master_dev") return <Redirect to="/login" />;
  if (needsDeveloperSignIn(overview.error)) return <Screen title="Developer"><Feedback error={overview.error} /></Screen>;
  const data = overview.data;
  return (
    <Screen
      title="Developer"
      subtitle="Private platform operations"
      action={
        <Action
          tone="quiet"
          onClick={developerSignOut}
        >
          Sign out
        </Action>
      }
      subheader={
        <Tabs
          label="Developer sections"
          items={["Overview", "People", "Suppliers", "Insights"]}
          value={tab}
          onChange={setTab}
        />
      }
    >
      <Feedback
        loading={overview.isLoading}
        error={overview.error}
        onRetry={() => overview.refetch()}
      />
      {data && tab === "Overview" && (
        <>
          <Section title="Last 30 days">
            <div className="dev-metrics">
              <Panel>
                <h2>
                  {data.bookings
                    .filter(b => b.status !== "cancelled")
                    .reduce((n, b) => n + b.count, 0)}
                </h2>
                <p>Bookings created · excluding cancelled</p>
              </Panel>
              <Panel>
                <h2>{data.active.reduce((n, r) => n + r.count, 0)}</h2>
                <p>Accounts with recorded actions</p>
              </Panel>
            </div>
            {data.money.map((m, i) => (
              <Row
                key={i}
                title={
                  m.country === "AU" || m.country === "NZ"
                    ? amount(m.amountCents, m.country)
                    : "Currency unverified"
                }
                detail={`${m.country || "Unknown country"} · recorded net earnings · ${m.artists} earning artists`}
              />
            ))}
            <p className="v3-muted">
              Ledger receipts less artist fees and refunds; excludes payouts and
              unpaid estimates. Country identifies the reporting currency;
              unsupported countries require reconciliation.
            </p>
          </Section>
          <Section title="Registered accounts">
            {data.people.map(p => (
              <Row
                key={p.role}
                title={p.role.replace("disabled_", "Inactive ")}
                detail={`${p.count} accounts`}
              />
            ))}
          </Section>
          <p className="v3-muted">
            {data.averageBookingsPerAccount.toFixed(2)} new bookings per
            registered account in the last 30 days.{" "}
            {(data.averageActionsPerAccount || 0).toFixed(2)} recorded business
            actions per registered account. Activity measures recorded
            successful actions, not time spent in the app.
          </p>
        </>
      )}
      {data && tab === "People" && <People />}
      {data && tab === "Suppliers" && <Suppliers />}
      {data && tab === "Insights" && (
        <>
          <Section title="Recorded activity · last 30 days">
            {data.activity.map(a => (
              <Row
                key={a.task}
                title={a.task.replaceAll(".", " · ")}
                detail={`${a.count} completed actions`}
              />
            ))}
            {!data.activity.length && (
              <Feedback empty="No activity recorded yet. Historical app usage and session duration are unavailable." />
            )}
            {data.active.map(a => (
              <Row
                key={a.role}
                title={`${a.role} activity`}
                detail={`${a.count} accounts with recorded actions`}
              />
            ))}
          </Section>
          <Section title="Geographic concentration">
            {data.locations.map((l, i) => (
              <Row
                key={i}
                title={[l.city || "Not supplied", l.country]
                  .filter(Boolean)
                  .join(", ")}
                detail={`${l.count} ${l.role} accounts · ${l.bookings || 0} bookings · ${l.active || 0} active in 30 days`}
              />
            ))}
            <p className="v3-muted">
              Profile locations only; no GPS tracking. Groups smaller than five
              are withheld ({data.suppressedLocations} accounts).
            </p>
          </Section>
          <Section title="Artist style offerings">
            {data.styles.map(s => (
              <Row
                key={s.style}
                title={s.style}
                detail={`${s.artists} artists`}
              />
            ))}
            <p className="v3-muted">
              Artist-configured styles; not inferred from private chats. One
              artist can offer multiple styles. Booking conversion by style is
              not currently recorded.
            </p>
          </Section>
          <Section title="Average recorded earnings">
            {data.money.map((m, i) => (
              <Row
                key={i}
                title={
                  m.country === "AU" || m.country === "NZ"
                    ? amount(
                        m.artists ? m.amountCents / m.artists : 0,
                        m.country
                      )
                    : "Currency unverified"
                }
                detail={`${m.country || "Unknown"} · per artist with a ledger entry in the last 30 days`}
              />
            ))}
          </Section>
        </>
      )}
    </Screen>
  );
}
function People() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const q = trpc.masterDev.people.useQuery({ search, role, page }, { retry: false });
  if (needsDeveloperSignIn(q.error)) return <Feedback error={q.error} />;
  return (
    <>
      <div className="v3-form">
        <label>
          Find an account
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Name or email"
          />
        </label>
        <label>
          Account type
          <select
            value={role}
            onChange={e => {
              setRole(e.target.value);
              setPage(0);
            }}
          >
            {[
              "all",
              "artist",
              "client",
              "merchant",
              "studio",
              "disabled_artist",
              "disabled_client",
              "disabled_merchant",
              "disabled_studio",
            ].map(r => (
              <option key={r} value={r}>
                {r.replace("disabled_", "Inactive ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Action onClick={() => setSelected("new")}>Add account</Action>
      <Feedback loading={q.isLoading} error={q.error} />
      {q.data?.rows.map(p => (
        <button
          className="dev-list-row"
          key={p.id}
          onClick={() => setSelected(p.id)}
        >
          <strong>{p.name || "Unnamed account"}</strong>
          <span>
            {p.role.replace("disabled_", "Inactive ")} ·{" "}
            {p.city || "Location not supplied"}
          </span>
          <small>{p.email}</small>
        </button>
      ))}
      {q.data && !q.data.rows.length && (
        <Feedback empty="No matching accounts" />
      )}
      <div className="v3-inline">
        <Action tone="quiet" disabled={!page} onClick={() => setPage(page - 1)}>
          Previous
        </Action>
        <span>
          {page + 1} / {Math.max(1, Math.ceil((q.data?.total || 0) / 30))}
        </span>
        <Action
          tone="quiet"
          disabled={(page + 1) * 30 >= (q.data?.total || 0)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Action>
      </div>
      {selected && (
        <Person
          key={selected}
          id={selected}
          close={() => setSelected(null)}
          refresh={() => q.refetch()}
        />
      )}
    </>
  );
}
function Person({
  id,
  close,
  refresh,
}: {
  id: string;
  close: () => void;
  refresh: () => unknown;
}) {
  const q = trpc.masterDev.person.useQuery({ id }, { enabled: id !== "new" });
  const [editing, setEditing] = useState(id === "new");
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const save = trpc.masterDev.savePerson.useMutation({
    onSuccess: () => {
      refresh();
      if (id === "new") {
        setNotice(
          "Account created. The owner can use password recovery to set their password and complete onboarding."
        );
        setEditing(false);
      } else {
        q.refetch();
        setEditing(false);
      }
    },
  });
  const toggle = trpc.masterDev.setAccountEnabled.useMutation({
    onSuccess: () => {
      refresh();
      q.refetch();
      setConfirm(false);
    },
  });
  const authError = [q.error, save.error, toggle.error].find(needsDeveloperSignIn);
  if (authError) return <SheetShell isOpen onClose={close} title="Developer session"><Feedback error={authError} /></SheetShell>;
  const p = q.data?.person;
  return (
    <SheetShell isOpen onClose={close} title={p?.name || "Add account"}>
      <div className="v3-form dev-sheet">
        <Feedback
          loading={id !== "new" && q.isLoading}
          error={q.error || save.error || toggle.error}
        />
        {notice && <p role="status">{notice}</p>}
        {editing ? (
          <form
            className="v3-form"
            onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save.mutate({
                id: id === "new" ? undefined : id,
                name: String(f.get("name")),
                email: String(f.get("email")),
                city: String(f.get("city")),
                country: String(f.get("country")),
                ...(id === "new"
                  ? { role: String(f.get("role")) as "client" }
                  : {}),
              });
            }}
          >
            {["name", "email", "city", "country"].map(field => (
              <label key={field}>
                {field}
                <input
                  name={field}
                  type={field === "email" ? "email" : "text"}
                  defaultValue={p?.[field as "name"] || ""}
                  required={field === "name" || field === "email"}
                />
              </label>
            ))}
            {id === "new" && (
              <label>
                Role
                <select name="role">
                  {["client", "artist", "merchant", "studio"].map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            )}
            <Action type="submit" disabled={save.isPending}>
              Save account
            </Action>
            <Action
              type="button"
              tone="quiet"
              onClick={() => (id === "new" ? close() : setEditing(false))}
            >
              Cancel
            </Action>
          </form>
        ) : (
          p && (
            <>
              <p>
                {p.email} · {p.role.replace("disabled_", "Inactive ")}
              </p>
              <Section title="Booking history">
                {q.data?.bookings.map(b => (
                  <Row
                    key={b.status}
                    title={b.status}
                    detail={`${b.count} sittings`}
                  />
                ))}
              </Section>
              <Section title="Recorded finances">
                {q.data?.ledger.map(l => (
                  <Row
                    key={l.type}
                    title={l.type}
                    detail={
                      l.country === "AU" || l.country === "NZ"
                        ? `${amount(l.amountCents, l.country)} · artist fees ${amount(l.feeCents, l.country)}`
                        : "Currency unverified"
                    }
                  />
                ))}
                {!q.data?.ledger.length && (
                  <p>No ledger reporting for this account.</p>
                )}
              </Section>
              <Section title="Store purchases and sales">
                {q.data?.commerce.map(c => (
                  <Row
                    key={c.currency}
                    title={`${c.count} paid orders`}
                    detail={new Intl.NumberFormat("en-AU", {
                      style: "currency",
                      currency: c.currency,
                    }).format(c.amountCents / 100)}
                  />
                ))}
              </Section>
              <Section title="Recorded actions">
                {q.data?.activity.map(a => (
                  <Row
                    key={a.task}
                    title={a.task.replaceAll(".", " · ")}
                    detail={`${a.count} actions`}
                  />
                ))}
              </Section>
              <Action onClick={() => setEditing(true)}>Edit account</Action>
              {confirm ? (
                <>
                  <p>
                    {p.role.startsWith("disabled_")
                      ? "Restore access for this account?"
                      : "Deactivate this account? Access will be blocked. Bookings, payments and records remain intact; billing is not cancelled."}
                  </p>
                  <Action
                    disabled={toggle.isPending}
                    onClick={() =>
                      toggle.mutate({
                        id,
                        enabled: p.role.startsWith("disabled_"),
                      })
                    }
                  >
                    Confirm{" "}
                    {p.role.startsWith("disabled_")
                      ? "restore"
                      : "deactivation"}
                  </Action>
                  <Action tone="quiet" onClick={() => setConfirm(false)}>
                    Cancel
                  </Action>
                </>
              ) : (
                <Action tone="quiet" onClick={() => setConfirm(true)}>
                  {p.role.startsWith("disabled_")
                    ? "Restore account"
                    : "Deactivate account"}
                </Action>
              )}
            </>
          )
        )}
      </div>
    </SheetShell>
  );
}
function Suppliers() {
  const q = trpc.masterDev.suppliers.useQuery(undefined, { retry: false });
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(false);
  const save = trpc.masterDev.saveSupplier.useMutation({
    onSuccess: () => {
      q.refetch();
      setSelected(null);
    },
  });
  const remove = trpc.masterDev.setSupplierVisible.useMutation({
    onSuccess: () => {
      q.refetch();
      setSelected(null);
    },
  });
  const authError = [q.error, save.error, remove.error].find(needsDeveloperSignIn);
  if (authError) return <Feedback error={authError} />;
  const item = q.data?.find(s => s.id === selected);
  return (
    <>
      <label>
        Find supplier
        <input value={search} onChange={e => setSearch(e.target.value)} />
      </label>
      <Action
        onClick={() => {
          setSelected(0);
          setConfirm(false);
        }}
      >
        Add supplier
      </Action>
      <Feedback loading={q.isLoading} error={q.error} />
      {q.data
        ?.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
        .map(s => (
          <button
            className="dev-list-row"
            key={s.id}
            onClick={() => {
              setSelected(s.id);
              setConfirm(false);
              save.reset();
              remove.reset();
            }}
          >
            <strong>
              {s.name}
              {s.isActive === 0 ? " · Hidden" : ""}
            </strong>
            <span>
              {s.metrics.length
                ? s.metrics
                    .map(
                      m =>
                        `${m.orders} paid orders · ${new Intl.NumberFormat("en-AU", { style: "currency", currency: m.currency }).format(m.salesCents / 100)}`
                    )
                    .join(" / ")
                : "No paid orders"}
            </span>
          </button>
        ))}
      {selected !== null && (
        <SheetShell
          isOpen
          onClose={() => setSelected(null)}
          title={item?.name || "Add supplier"}
        >
          <div className="dev-sheet">
            <form
              className="v3-form"
              onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                save.mutate({
                  id: selected || undefined,
                  name: String(f.get("name")),
                  websiteUrl: String(f.get("websiteUrl")),
                  contactEmail: String(f.get("contactEmail")),
                });
              }}
            >
              {["name", "websiteUrl", "contactEmail"].map(field => (
                <label key={field}>
                  {field === "websiteUrl"
                    ? "Store URL"
                    : field === "contactEmail"
                      ? "Contact email"
                      : "Name"}
                  <input
                    name={field}
                    type={
                      field === "websiteUrl"
                        ? "url"
                        : field === "contactEmail"
                          ? "email"
                          : "text"
                    }
                    required={field !== "contactEmail"}
                    defaultValue={item?.[field as "name"] || ""}
                  />
                </label>
              ))}
              <Feedback error={save.error || remove.error} />
              <Action type="submit" disabled={save.isPending}>
                Save supplier
              </Action>
            </form>
            {item &&
              (confirm ? (
                <>
                  <p>
                    {item.isActive === 0
                      ? "Restore this supplier to the directory?"
                      : "Remove this supplier from the directory and block new checkouts? Existing orders and records are preserved."}
                  </p>
                  <Action
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate({
                        id: item.id,
                        visible: item.isActive === 0,
                      })
                    }
                  >
                    Confirm {item.isActive === 0 ? "restore" : "removal"}
                  </Action>
                  <Action tone="quiet" onClick={() => setConfirm(false)}>
                    Cancel
                  </Action>
                </>
              ) : (
                <Action tone="quiet" onClick={() => setConfirm(true)}>
                  {item.isActive === 0
                    ? "Restore supplier"
                    : "Remove from directory"}
                </Action>
              ))}
          </div>
        </SheetShell>
      )}
    </>
  );
}
