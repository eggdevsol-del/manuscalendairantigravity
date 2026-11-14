import { useEffect, useId, useState } from "react";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { trpc } from "@/lib/trpc";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_THANKS,
  type ReportReason,
} from "@shared/safety";
import { Action } from "../design/primitives";

export type ReportTarget = {
  reportedUserId?: string;
  conversationId?: number;
  messageId?: number;
  artistSlug?: string;
};

/** Report a person, conversation, message or public profile. One sheet: reason, optional details, thanks. */
export function ReportDialog({
  open,
  onClose,
  target,
  subject,
}: {
  open: boolean;
  onClose: () => void;
  target: ReportTarget;
  /** Who or what is being reported, as the reader knows it, e.g. the person's name. */
  subject: string;
}) {
  const formId = useId();
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const report = trpc.safety.report.useMutation({
    onSuccess: () => setSent(true),
  });
  // Each opening starts a new report.
  useEffect(() => {
    if (open) {
      setReason("");
      setDetails("");
      setSent(false);
      report.reset();
    }
  }, [open]);

  return (
    <SheetShell
      isOpen={open}
      onClose={onClose}
      title={sent ? "Report sent" : `Report ${subject}`}
    >
      {sent ? (
        <div className="v3-stack">
          <p role="status">{REPORT_THANKS}</p>
          <p className="v3-muted">
            We remove content and accounts that break our terms. You can also
            block this person so they can’t message you.
          </p>
          <Action onClick={onClose}>Done</Action>
        </div>
      ) : (
        <form
          className="v3-form v3-stack"
          onSubmit={e => {
            e.preventDefault();
            if (!reason || report.isPending) return;
            report.mutate({
              ...target,
              reason,
              details: details.trim() || undefined,
            });
          }}
        >
          <fieldset className="v3-check-list">
            <legend>What’s wrong?</legend>
            {REPORT_REASONS.map(value => (
              <label key={value}>
                <input
                  type="radio"
                  name={`${formId}-reason`}
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                />
                {REPORT_REASON_LABELS[value]}
              </label>
            ))}
          </fieldset>
          <label htmlFor={`${formId}-details`}>Details (optional)</label>
          <textarea
            id={`${formId}-details`}
            value={details}
            maxLength={REPORT_DETAILS_MAX}
            rows={3}
            placeholder="Anything that helps us understand what happened"
            onChange={e => setDetails(e.target.value)}
          />
          <small>
            The other person is not told who reported them. If someone is in
            immediate danger, call emergency services.
          </small>
          {report.error && (
            <p role="alert">
              {report.error.message ||
                "We couldn’t send your report. Please try again."}
            </p>
          )}
          <Action type="submit" disabled={!reason || report.isPending}>
            {report.isPending ? "Sending…" : "Send report"}
          </Action>
          <Action tone="quiet" onClick={onClose}>
            Cancel
          </Action>
        </form>
      )}
    </SheetShell>
  );
}
