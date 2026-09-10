import { useState } from "react";
import { useSearch } from "wouter";
import { Settings, FileCheck, UserRound } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { InlineFormSigning } from "@/features/booking/components/InlineFormSigning";
import {
  Action,
  ActionLink,
  Avatar,
  Feedback,
  Row,
  Screen,
  Section,
  Status,
} from "../design/primitives";
import { AccountEditor } from "./SettingsEditors";
export default function Profile() {
  const { user } = useAuth();
  const search = useSearch();
  const forms = trpc.clientProfile.getConsentForms.useQuery();
  const [sign, setSign] = useState<number | null>(null);
  if (new URLSearchParams(search).get("edit") === "true")
    return <AccountEditor back="/profile" />;
  return (
    <Screen
      title="Your profile"
      subtitle="Your details and booking documents"
      action={
        <ActionLink href="/settings" tone="quiet">
          <Settings />
          Settings
        </ActionLink>
      }
    >
      <Row
        title={user?.name || "Your profile"}
        detail={user?.email}
        icon={<Avatar name={user?.name} src={user?.avatar} />}
      />
      <Section title="Personal details">
        <Row title="Phone" detail={user?.phone || "Not added"} />
        <Row
          title="Location"
          detail={
            [user?.city, user?.country].filter(Boolean).join(", ") ||
            "Not added"
          }
        />
        {user?.bio && <p>{user.bio}</p>}
        <ActionLink href="/profile?edit=true">
          <UserRound />
          Edit your details
        </ActionLink>
      </Section>
      <Section title="Your consent forms">
        <Feedback
          loading={forms.isLoading}
          error={forms.error}
          onRetry={() => forms.refetch()}
        />
        {forms.data?.map(form => (
          <Row
            key={form.id}
            title={form.title}
            detail={
              form.status === "signed"
                ? "Signed"
                : form.status === "pending"
                  ? "Ready for your review"
                  : form.status
            }
            icon={<FileCheck />}
            trailing={
              form.status === "pending" && form.appointmentId ? (
                <Action
                  tone="secondary"
                  onClick={() => setSign(form.appointmentId)}
                >
                  Review & sign
                </Action>
              ) : (
                <Status tone={form.status === "signed" ? "success" : "neutral"}>
                  {form.status === "signed" ? "Complete" : form.status}
                </Status>
              )
            }
          />
        ))}
        {!forms.isLoading && !forms.error && !forms.data?.length && (
          <Feedback empty="Forms from your artist will appear here when they’re ready." />
        )}
      </Section>
      <Row href="/purchases" title="Your purchases" />
      <Row href="/waitlist" title="Cancellation offers" />
      <SheetShell
        isOpen={sign !== null}
        onClose={() => setSign(null)}
        title="Review your consent forms"
      >
        {sign !== null && (
          <InlineFormSigning
            pendingForms={(forms.data || []).filter(
              f => f.appointmentId === sign && f.status === "pending"
            )}
            onSuccess={() => {
              void forms.refetch();
            }}
            onClose={() => setSign(null)}
          />
        )}
      </SheetShell>
    </Screen>
  );
}
