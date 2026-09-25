import type { CSSProperties } from "react";
import { CalendarDays } from "lucide-react";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { Action } from "../design/primitives";
import "./import-progress.css";

type Kind = "calendar" | "instagram" | "shopify";
const logos = {
  instagram: "https://upload.wikimedia.org/wikipedia/commons/2/21/Instagram_Glyph_Gradient_RGB_logo.svg",
  shopify: "https://cdn.shopify.com/shopifycloud/brochure/assets/brand-assets/shopify-logo-shopping-bag-full-color-66166b2e55d67988b56b4bd28b63c271e2b9713358cb723070a92bde17ad7d63.svg",
};
function ImportIcon({ kind }: { kind: Kind }) {
  return kind === "calendar" ? <CalendarDays aria-hidden="true" /> : <img src={logos[kind]} alt="" />;
}
export function ImportProgressSheet({ open, onClose, kind, task, complete = false, error, percent, detail, title, stopped = false }: {
  open: boolean; onClose: () => void; kind: Kind; task: string; complete?: boolean;
  stopped?: boolean; error?: string; percent?: number; detail?: string; title?: string;
}) {
  const value = complete ? 100 : percent == null ? undefined : Math.max(0, Math.min(99, Math.round(percent)));
  return <SheetShell isOpen={open} onClose={onClose} title={title || (kind === "instagram" ? "Your work, in Tattoi" : kind === "shopify" ? "Your store, coming together" : "Bringing your clients over")}
    className="import-progress-sheet" footer={<Action onClick={onClose}>{error ? "Back to import" : complete ? "Review import" : "Hide progress"}</Action>}>
    <div className={`import-progress-layout ${complete ? "is-complete" : ""} ${error || stopped ? "is-failed" : ""}`}>
      <div className="import-transfer" aria-hidden="true">
        <div className="import-source"><ImportIcon kind={kind} /></div>
        <div className="import-flight">{Array.from({ length: 4 }, (_, i) => <div key={i} className="import-flyer" style={{ "--flight-index": i } as CSSProperties}><ImportIcon kind={kind} /></div>)}</div>
        <div className="import-target">tattoi</div>
      </div>
      <div className="import-current">
        <div className="import-task" role="status"><span>{error ? "Import needs attention" : complete ? "Ready to review" : stopped ? "Import stopped" : task}</span><span aria-label="Overall completion">{value == null ? "Calculating…" : `${value}%`}</span></div>
        <div className="import-meter" role="progressbar" aria-label="Overall import progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={value == null ? "Calculating overall completion" : `${value}%`}><i style={{ width: value == null ? "0%" : `${value}%` }} /></div>
        <p className="v3-muted" role={error ? "alert" : undefined}>{error || detail || "Overall import progress"}</p>
      </div>
    </div>
  </SheetShell>;
}
