import { trpc } from "@/lib/trpc";
import { FullScreenSheet } from "@/components/ui/ssot/FullScreenSheet";
import { InlineFormSigning } from "@/features/booking/components/InlineFormSigning";
import { Button } from "@/components/ui/button";

export function ProjectFormsSheet({
  appointmentId,
  onClose,
  onSigned,
}: {
  appointmentId: number;
  onClose: () => void;
  onSigned: () => void;
}) {
  const forms = trpc.forms.getPendingForms.useQuery({ appointmentId });
  return (
    <FullScreenSheet
      open
      onClose={onClose}
      title="Appointment forms"
      contextTitle="Review & sign"
      contextSubtitle="Read each form before signing."
      contextHeight="h-auto py-5"
    >
      {forms.isLoading ? (
        <p role="status">Loading your forms…</p>
      ) : forms.error ? (
        <div role="alert">
          <p>We couldn't load your forms.</p>
          <Button onClick={() => void forms.refetch()}>Try again</Button>
        </div>
      ) : forms.data?.length ? (
        <InlineFormSigning
          pendingForms={forms.data}
          onSuccess={onSigned}
          onClose={onClose}
        />
      ) : (
        <div className="space-y-4">
          <p>There are no pending forms for this session.</p>
          <Button onClick={onClose}>Back to project</Button>
        </div>
      )}
    </FullScreenSheet>
  );
}
