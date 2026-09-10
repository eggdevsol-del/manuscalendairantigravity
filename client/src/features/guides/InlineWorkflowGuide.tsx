import { WORKFLOW_GUIDES } from "./workflows";

/** Help inside a workflow: never opens another overlay or performs an action. */
export function InlineWorkflowGuide({ id }: { id: string }) {
  const guide = WORKFLOW_GUIDES.find(g => g.id === id);
  if (!guide) return null;
  return (
    <details className="rounded-xl border bg-card text-foreground mb-4">
      <summary className="cursor-pointer min-h-11 px-4 py-3 text-sm font-medium">
        Quick guide: {guide.title}
      </summary>
      <ol className="list-decimal pl-9 pr-4 pb-4 space-y-3">
        {guide.steps.map(step => (
          <li key={step.title} className="text-sm pl-1">
            <strong>{step.title}</strong>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </details>
  );
}
export function guideForOverlay(title: string): string | undefined {
  if (/^(Add product|Edit product)$/.test(title)) return "supplier-products";
  if (title === "Connect Shopify") return "supplier-shopify";
  if (/^(New Template|Edit Template|Send Test Push)$/.test(title))
    return "artist-notifications";
  if (title === "Add New Client") return "artist-clients";
  if (title === "Request Consultation") return "artist-consultations";
  if (/^(Pro|Studio) subscription$/.test(title)) return "artist-plan";
  return undefined;
}
