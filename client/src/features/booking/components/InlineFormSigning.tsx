import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Action, Panel, Status } from "@/app-v3/design/primitives";
import { SignatureCapture } from "@/app-v3/design/SignatureCapture";

type Form = {
  id: number;
  title: string | null;
  content: string | null;
  formType: string;
  status?: string;
};
interface Props {
  pendingForms: Form[];
  initialForm?: Form;
  onSuccess?: () => void;
  onClose?: () => void;
}
export function InlineFormSigning({
  pendingForms,
  initialForm,
  onSuccess,
  onClose,
}: Props) {
  const [completed, setCompleted] = useState<number[]>([]);
  const queue = [initialForm, ...pendingForms]
    .filter((form): form is Form => !!form)
    .filter(
      (form, index, all) =>
        form.status !== "signed" &&
        !completed.includes(form.id) &&
        all.findIndex(other => other.id === form.id) === index
    );
  const form = queue[0];
  return form ? (
    <SignForm
      key={form.id}
      form={form}
      remaining={queue.length}
      onClose={onClose}
      onSigned={() => {
        setCompleted(previous => [...previous, form.id]);
        onSuccess?.();
        if (queue.length === 1) onClose?.();
      }}
    />
  ) : (
    <Status tone="success">All forms reviewed and signed</Status>
  );
}
function SignForm({
  form,
  remaining,
  onSigned,
  onClose,
}: {
  form: Form;
  remaining: number;
  onSigned: () => void;
  onClose?: () => void;
}) {
  const [step, setStep] = useState<"review" | "signature">("review");
  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>({});
  const [photoPermission, setPhotoPermission] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const profile = trpc.auth.me.useQuery();
  const sign = trpc.forms.signForm.useMutation();
  const utils = trpc.useUtils();
  const questions =
    form.formType === "medical_release"
      ? Array.from((form.content || "").matchAll(/^(\d+)\.\s(.*)/gm)).map(
          match => ({ id: match[1], label: match[2] })
        )
      : [];
  const answered = questions.every(question => !!answers[question.id]);
  async function submit(signature: string) {
    if (!acknowledged || !answered || sign.isPending) return;
    try {
      await sign.mutateAsync({
        formId: form.id,
        signature,
        answers,
        photoPermission,
      });
      [0, 600, 1500].forEach(delay =>
        setTimeout(() => {
          void utils.forms.invalidate();
          void utils.clientProfile.invalidate();
          void utils.projects.invalidate();
          void utils.dashboard.invalidate();
        }, delay)
      );
      onSigned();
    } catch {}
  }
  return (
    <div className="v3-stack">
      <h2>{form.title || "Your form"}</h2>
      <p className="v3-muted">
        {remaining} form{remaining === 1 ? "" : "s"} remaining
      </p>
      {step === "review" ? (
        <>
          <Panel>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {(form.content || "").split("\n").map((line, index) => {
                const match =
                  form.formType === "medical_release"
                    ? /^(\d+)\.\s(.*)/.exec(line)
                    : null;
                return match ? (
                  <fieldset
                    key={index}
                    className="v3-form"
                    disabled={sign.isPending}
                  >
                    <legend>{match[2]}</legend>
                    <div className="v3-inline">
                      {(["yes", "no"] as const).map(answer => (
                        <label key={answer} className="v3-inline">
                          <input
                            type="radio"
                            name={`medical-${form.id}-${match[1]}`}
                            value={answer}
                            checked={answers[match[1]] === answer}
                            onChange={() =>
                              setAnswers(current => ({
                                ...current,
                                [match[1]]: answer,
                              }))
                            }
                          />
                          {answer === "yes" ? "Yes" : "No"}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <div key={index}>{line || "\u00a0"}</div>
                );
              })}
            </div>
          </Panel>
          <Action disabled={!answered} onClick={() => setStep("signature")}>
            {answered
              ? "Continue to signature"
              : "Answer every medical question to continue"}
          </Action>
          {onClose && (
            <Action tone="quiet" onClick={onClose}>
              Finish later
            </Action>
          )}
        </>
      ) : (
        <>
          <Action
            tone="quiet"
            disabled={sign.isPending}
            onClick={() => setStep("review")}
          >
            Review form again
          </Action>
          {form.formType === "procedure_consent" && (
            <label className="v3-inline">
              <input
                type="checkbox"
                checked={photoPermission}
                disabled={sign.isPending}
                onChange={event => setPhotoPermission(event.target.checked)}
              />
              <span>
                I allow my artist to publish photos of this tattoo. Optional;
                leaving this unchecked does not affect my booking.
              </span>
            </label>
          )}
          <label className="v3-inline">
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={sign.isPending}
              onChange={event => setAcknowledged(event.target.checked)}
            />
            <span>
              I have read this form and my answers are accurate. I agree to sign
              this version.
            </span>
          </label>
          {profile.data?.savedSignature && (
            <Panel>
              <img
                className="v3-saved-signature"
                src={profile.data.savedSignature}
                alt="Your saved signature"
              />
              <Action
                disabled={!acknowledged || sign.isPending}
                onClick={() => submit(profile.data!.savedSignature!)}
              >
                Sign with saved signature
              </Action>
            </Panel>
          )}
          <SignatureCapture
            disabled={!acknowledged || sign.isPending}
            onSave={submit}
          />
          {sign.isPending && <p role="status">Recording your signed form…</p>}
          {sign.error && <p role="alert">{sign.error.message}</p>}
        </>
      )}
    </div>
  );
}
