import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Action,
  ActionLink,
  Avatar,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
  Status,
} from "../design/primitives";
export function InstagramImport() {
  const [username, setUsername] = useState("");
  const [checked, setChecked] = useState("");
  const [maxPosts, setMaxPosts] = useState(50);
  const [importId, setImportId] = useState<number | null>(null);
  const latest = trpc.instagram.getLatestImport.useQuery();
  const currentId = importId || latest.data?.id;
  const progress = trpc.instagram.getImportStatus.useQuery(
    { importId: currentId || 0 },
    {
      enabled: !!currentId,
      refetchInterval: query =>
        query.state.data?.status === "in_progress" ? 2000 : false,
    }
  );
  const account = trpc.instagram.verifyUsername.useQuery(
    { username: checked },
    { enabled: !!checked, retry: false }
  );
  const utils = trpc.useUtils();
  const start = trpc.instagram.startImport.useMutation({
    onSuccess: data => {
      setImportId(data.importId);
      void latest.refetch();
    },
  });
  const stop = trpc.instagram.stopImport.useMutation({
    onSuccess: () => {
      void progress.refetch();
      void latest.refetch();
    },
  });
  const status = progress.data || latest.data;
  const running = status?.status === "in_progress";
  const found =
    checked === username && account.data?.success && account.data.userInfo;
  const error = start.error || stop.error;
  useEffect(() => {
    if (status && ["completed", "cancelled"].includes(status.status || "")) {
      void utils.portfolio.invalidate();
      void utils.feed.invalidate();
    }
  }, [status?.status, utils]);
  return (
    <Screen
      title="Instagram import"
      subtitle="Bring your existing work into your portfolio."
      back="/settings"
    >
      <Feedback
        loading={latest.isLoading}
        error={latest.error}
        onRetry={() => latest.refetch()}
      />
      <Panel>
        <p>
          The current importer copies media into your Tattoi portfolio,
          including hosted copies for reliable playback. It does not use native
          Instagram embeds.
        </p>
        <ActionLink href="/artist-profile?view=Portfolio">
          Open your portfolio
        </ActionLink>
      </Panel>
      {status && (
        <Section title="Latest import">
          <Panel>
            <Row
              title={`@${status.instagramUsername}`}
              trailing={
                <Status
                  tone={
                    status.status === "completed"
                      ? "success"
                      : status.status === "failed"
                        ? "danger"
                        : "neutral"
                  }
                >
                  {(status.status || "unknown").replaceAll("_", " ")}
                </Status>
              }
            />
            <dl className="v3-facts">
              <div>
                <dt>Discovered</dt>
                <dd>{status.totalDiscovered || 0}</dd>
              </div>
              <div>
                <dt>Processed</dt>
                <dd>{status.totalProcessed || 0}</dd>
              </div>
              <div>
                <dt>Imported</dt>
                <dd>{status.totalAdded || 0}</dd>
              </div>
              <div>
                <dt>Skipped</dt>
                <dd>{status.totalSkipped || 0}</dd>
              </div>
            </dl>
            <Feedback
              error={progress.error}
              onRetry={() => progress.refetch()}
            />
            {running && (
              <Action
                tone="secondary"
                disabled={stop.isPending}
                onClick={() => stop.mutate({ importId: status.id })}
              >
                {stop.isPending ? "Stopping…" : "Stop import"}
              </Action>
            )}
            {status.status === "failed" && (
              <p role="alert">
                This import failed. Review the account and try again.
              </p>
            )}
          </Panel>
        </Section>
      )}
      {!running && (
        <Section title="Import your public account">
          <form
            className="v3-form"
            onSubmit={e => {
              e.preventDefault();
              if (checked === username) void account.refetch();
              else setChecked(username);
            }}
          >
            <label>
              Instagram username
              <input
                required
                pattern="[A-Za-z0-9._]+"
                maxLength={100}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={e => {
                  setUsername(e.target.value.replace(/^@/, "").trim());
                  start.reset();
                }}
                disabled={start.isPending}
              />
            </label>
            <Action
              type="submit"
              disabled={account.isFetching || start.isPending || !username}
            >
              {account.isFetching ? "Looking up account…" : "Check account"}
            </Action>
          </form>
          <Feedback error={account.error} onRetry={() => account.refetch()} />
          {checked === username && account.data?.success === false && (
            <p role="alert">
              {account.data.error || "Account could not be found."}
            </p>
          )}
          {found && (
            <Panel>
              <Row
                title={found.fullName || found.username}
                detail={`${found.mediaCount} posts`}
                icon={
                  <Avatar
                    name={found.fullName || found.username}
                    src={found.profilePicUrl}
                  />
                }
              />
              <div className="v3-form">
                <label>
                  Maximum posts
                  <select
                    aria-label="Maximum posts"
                    value={maxPosts}
                    disabled={start.isPending}
                    onChange={e => setMaxPosts(Number(e.target.value))}
                  >
                    {[10, 25, 50, 100, 200, 500].map(n => (
                      <option key={n} value={n}>
                        {n} posts
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Action
                disabled={start.isPending}
                onClick={() => start.mutate({ username: checked, maxPosts })}
              >
                {start.isPending ? "Starting…" : "Import portfolio"}
              </Action>
            </Panel>
          )}
        </Section>
      )}
      {error && <p role="alert">{error.message}</p>}
    </Screen>
  );
}
export function ShopifyCatalogue() {
  const profile = trpc.merchantAuth.getMerchantProfile.useQuery();
  const progress = trpc.merchantAuth.getSyncStatus.useQuery(undefined, {
    refetchInterval: query =>
      query.state.data?.status === "syncing" ? 3000 : false,
  });
  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");
  const [edit, setEdit] = useState(false);
  const save = trpc.merchantAuth.saveShopifyCredentials.useMutation({
    onSuccess: () => {
      setToken("");
      setEdit(false);
      void profile.refetch();
    },
  });
  const sync = trpc.merchantAuth.triggerShopifySync.useMutation({
    onSuccess: () => void progress.refetch(),
  });
  const connected = profile.data?.shopifyConnected;
  const busy = save.isPending || sync.isPending;
  return (
    <Section title="Shopify catalogue">
      <p>
        Import products and variants. New products start hidden so you can
        review pricing and delivery before publishing.
      </p>
      <p className="v3-muted">
        Stock is copied on first import. Later imports update catalogue details
        without replenishing sold or reserved stock. Manage your Tattoi
        allocation in Products.
      </p>
      <Feedback
        loading={profile.isLoading}
        error={profile.error}
        onRetry={() => profile.refetch()}
      />
      {connected && (
        <Panel>
          <Row
            title={profile.data?.shopifyDomain || "Shopify store"}
            trailing={<Status tone="success">Connected</Status>}
          />
          <Action
            tone="quiet"
            disabled={busy}
            onClick={() => {
              setEdit(!edit);
              setDomain(profile.data?.shopifyDomain || "");
              setToken("");
            }}
          >
            {edit ? "Cancel connection change" : "Change connection"}
          </Action>
        </Panel>
      )}
      {profile.data && (!connected || edit) && (
        <form
          className="v3-form"
          onSubmit={e => {
            e.preventDefault();
            save.mutate({ shopUrl: domain.trim(), accessToken: token.trim() });
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Store domain
              <input
                required
                autoCapitalize="none"
                autoCorrect="off"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
              />
            </label>
            <label>
              Admin API token
              <input
                type="password"
                required
                autoComplete="off"
                value={token}
                onChange={e => setToken(e.target.value)}
              />
            </label>
            <p className="v3-muted">
              Product-read permission is needed for catalogue imports. Supplier
              draft-order handoff also needs draft-order permission.
            </p>
            <Action type="submit">
              {save.isPending ? "Verifying…" : "Verify and save"}
            </Action>
          </fieldset>
        </form>
      )}
      {(save.error || sync.error) && (
        <p role="alert">{(save.error || sync.error)?.message}</p>
      )}
      {connected && (
        <Panel>
          <h3>Import status</h3>
          <Feedback
            loading={progress.isLoading}
            error={progress.error}
            onRetry={() => progress.refetch()}
          />
          {progress.data && (
            <p role="status">
              {progress.data.status === "failed"
                ? progress.data.error
                : progress.data.status === "idle"
                  ? "No import has been started."
                  : progress.data.message || progress.data.status}
            </p>
          )}
          <div className="v3-inline">
            <Action
              disabled={
                busy ||
                progress.isLoading ||
                progress.isError ||
                progress.data?.status === "syncing"
              }
              onClick={() => sync.mutate()}
            >
              {sync.isPending
                ? "Queuing import…"
                : progress.data?.status === "syncing"
                  ? "Import in progress…"
                  : "Sync catalogue"}
            </Action>
            <Action tone="secondary" onClick={() => progress.refetch()}>
              Refresh status
            </Action>
          </div>
        </Panel>
      )}
    </Section>
  );
}
