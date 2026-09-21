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
  const documentsOnly = new URLSearchParams(search).get("tab") === "forms";
  const forms = trpc.clientProfile.getConsentForms.useQuery();
  const [sign, setSign] = useState<number | null>(null);
  if (new URLSearchParams(search).get("edit") === "true")
    return <AccountEditor back="/profile" />;
  return (
    <Screen
      title={documentsOnly ? "Your consent forms" : "Your profile"}
      subtitle={
        documentsOnly
          ? "Review the documents for your appointments"
          : "Your details and booking documents"
      }
      back={documentsOnly ? "/profile" : undefined}
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
      {!documentsOnly && (
        <div className="simple-business-list">
          <Row
            title="Personal details"
            detail="Your contact and appointment information"
            href="/profile?edit=true"
            icon={<UserRound />}
          />
          <Row
            title="Forms & documents"
            detail={
              forms.data
                ? `${forms.data.filter(f => f.status === "pending").length} awaiting your review`
                : "Consent forms from your artists"
            }
            href="/profile?tab=forms"
            icon={<FileCheck />}
          />
          <Row
            title="Your tattoos"
            detail="Appointments and completed projects"
            href="/bookings"
          />
          <Row title="Purchases" href="/purchases" />
          <Row title="Cancellation offers" href="/waitlist" />
          <Row
            title="Account & settings"
            href="/settings"
            icon={<Settings />}
          />
        </div>
      )}
      {documentsOnly && (
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
                  <Status
                    tone={form.status === "signed" ? "success" : "neutral"}
                  >
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
      )}
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
