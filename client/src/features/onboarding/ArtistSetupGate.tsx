import { useEffect, useRef, type ReactNode } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Action, Feedback, Screen } from "@/app-v3/design/primitives";
import { AccountEditor, BusinessEditor } from "@/app-v3/pages/SettingsEditors";
import WorkingHours from "@/app-v3/pages/WorkingHours";
import Bank from "@/app-v3/pages/Bank";
import { ArtistSetupContext } from "./ArtistSetupContext";
export function ArtistSetupGate({ children }: { children: ReactNode }) {
  const { user, refresh, logout } = useAuth();
  const [path, go] = useLocation();
  const required = user?.role === "artist" && user.hasCompletedOnboarding !== 1;
  const query = trpc.auth.artistSetup.useQuery(undefined, {
    enabled: required && path !== "/practice",
    refetchOnWindowFocus: true,
    refetchInterval: required && path === "/artist-setup" ? 10000 : false,
  });
  const completing = useRef(false);
  const complete = trpc.auth.completeOnboarding.useMutation({
    onSuccess: async () => {
      await refresh();
      go("/dashboard");
    },
  });
  useEffect(() => {
    if (
      required &&
      path === "/artist-setup" &&
      query.data?.complete &&
      !completing.current
    ) {
      completing.current = true;
      complete.mutate();
    }
  }, [required, path, query.data?.complete]);
  if (!required)
    return path === "/artist-setup" ? (
      <Redirect to="/dashboard" />
    ) : (
      <>{children}</>
    );
  // Tutorials remain safe and available; live artist routes stay behind setup.
  if (path === "/practice") return <>{children}</>;
  if (path !== "/artist-setup") return <Redirect to="/artist-setup" />;
  const progress = query.data;
  if (!progress || progress.complete)
    return (
      <Screen title="Finish setup">
        <Feedback
          loading={query.isLoading || complete.isPending}
          error={query.error || complete.error}
          onRetry={() => {
            if (complete.error) {
              complete.reset();
              complete.mutate();
            } else void query.refetch();
          }}
        />
        {progress?.complete && !complete.error && (
          <p role="status">Finishing your setup…</p>
        )}
        <Action tone="quiet" onClick={() => void logout()}>
          Sign out
        </Action>
      </Screen>
    );
  const step = progress.nextStep!;
  return (
    <ArtistSetupContext.Provider
      key={`${user?.id}:${step}`}
      value={{
        step,
        progress: (
          <div className="v3-setup-progress" aria-label="Required artist setup">
            <p>
              <strong>
                Finish setup · {progress.steps.filter(s => s.done).length} of{" "}
                {progress.steps.length} complete
              </strong>
            </p>
            <p className="v3-muted">
              Save each step to continue. Your progress is saved to your
              account.
            </p>
            <ol className="v3-inline" style={{ flexWrap: "wrap", gap: 12 }}>
              {progress.steps.map(s => (
                <li
                  key={s.id}
                  aria-current={s.id === step ? "step" : undefined}
                >
                  {s.done ? "✓ " : ""}
                  {s.title}
                </li>
              ))}
            </ol>
            <Feedback
              error={query.error}
              onRetry={() => void query.refetch()}
            />
            <Action tone="quiet" onClick={() => void logout()}>
              Sign out
            </Action>
          </div>
        ),
        onSaved: async () => {
          await query.refetch();
        },
      }}
    >
      {step === "profile" ? (
        <AccountEditor />
      ) : step === "business" ? (
        <BusinessEditor />
      ) : step === "hours" ? (
        <WorkingHours />
      ) : step === "services" ? (
        <WorkingHours />
      ) : (
        <Bank />
      )}
    </ArtistSetupContext.Provider>
  );
}
