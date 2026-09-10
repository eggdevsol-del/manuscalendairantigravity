import { useState } from "react";
import { CircleHelp, ArrowLeft, Check } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { guidesForRole, type WorkflowGuide } from "./workflows";

export function WorkflowHelp({
  page,
  expanded = false,
}: {
  page?: string;
  expanded?: boolean;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<WorkflowGuide | null>(null);
  const [step, setStep] = useState(0);
  const [revision, setRevision] = useState(0);
  const all = guidesForRole(user?.role);
  const contextual = all.filter(g =>
    g.pages.some(p => p.toLowerCase() === page?.toLowerCase())
  );
  const ordered = [...contextual, ...all.filter(g => !contextual.includes(g))];
  if (!ordered.length) return null;
  const key = `tattoi-guides-v1:${user?.id}`;
  const read = (id: string) => {
    try {
      return (
        JSON.parse(localStorage.getItem(key) || "[]") as string[]
      ).includes(id);
    } catch {
      return false;
    }
  };
  const complete = () => {
    try {
      const ids = all.filter(g => read(g.id)).map(g => g.id);
      localStorage.setItem(
        key,
        JSON.stringify([...new Set([...ids, selected!.id])])
      );
    } catch {
      /* Guidance remains usable when device storage is unavailable. */
    }
    setRevision(revision + 1);
    setSelected(null);
  };
  return (
    <>
      <Button
        variant="ghost"
        size={expanded ? "default" : "icon"}
        className="min-h-11 min-w-11 shrink-0"
        aria-label={page ? `Help with ${page}` : "Workflow guides"}
        onClick={() => {
          setSelected(null);
          setOpen(true);
        }}
      >
        <CircleHelp className="h-5 w-5" />
        {expanded && <span className="ml-2">Workflow guides</span>}
      </Button>
      <SheetShell
        isOpen={open}
        onClose={() => setOpen(false)}
        title={selected?.title || "Workflow guides"}
        description={
          selected
            ? `Step ${step + 1} of ${selected.steps.length}`
            : "Practical help, whenever you need it. Reading a guide does not change your business data."
        }
      >
        {selected ? (
          <div className="space-y-5 pb-4">
            <Button variant="ghost" onClick={() => setSelected(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              All guides
            </Button>
            <div
              aria-live="polite"
              className="rounded-2xl border bg-card p-5 space-y-3"
            >
              <h2 className="text-lg font-semibold">
                {selected.steps[step].title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {selected.steps[step].body}
              </p>
            </div>
            <div className="flex justify-between gap-3">
              <Button
                variant="outline"
                className="w-auto"
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
              >
                Previous
              </Button>
              <Button
                className="w-auto flex-1 min-w-0 whitespace-normal"
                onClick={() =>
                  step === selected.steps.length - 1
                    ? complete()
                    : setStep(step + 1)
                }
              >
                {step === selected.steps.length - 1 ? "Finish guide" : "Next"}
              </Button>
            </div>
            <a
              href={selected.route}
              className="min-h-11 flex items-center justify-center underline text-sm"
            >
              Open this feature
            </a>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {contextual.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Guides for this page appear first.
              </p>
            )}
            {ordered.map(g => (
              <button
                key={g.id}
                onClick={() => {
                  setSelected(g);
                  setStep(0);
                }}
                className="w-full text-left rounded-2xl border bg-card p-4 flex items-center justify-between gap-3 min-h-14"
              >
                <span>
                  <span className="font-medium block">{g.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.steps.length} steps ·{" "}
                    {read(g.id) ? "Read — replay anytime" : "Read guide"}
                  </span>
                </span>
                {read(g.id) && (
                  <Check className="h-5 w-5 shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </SheetShell>
    </>
  );
}
