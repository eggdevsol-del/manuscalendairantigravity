import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { useState, useRef, type ReactNode, type CSSProperties } from "react";
import { ChevronRight } from "lucide-react";

/** One disclosure contract for existing and proposed sitting cards. */
export function SittingCard({
  title,
  detail,
  children,
  expanded,
  onExpandedChange,
  icon,
  headerClassName,
  headerStyle,
}: {
  icon?: ReactNode;
  headerClassName?: string;
  headerStyle?: CSSProperties;
  title: ReactNode;
  detail?: ReactNode;
  children: ReactNode;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [localOpen, setLocalOpen] = useState(false);
  const open = expanded ?? localOpen;
  return (
    <div className="v3-sitting-card">
      <button
        ref={trigger}
        type="button"
        className={headerClassName || "v3-row"}
        style={headerStyle}
        data-tour-repeat="sitting-disclosure"
        data-tour-title="Sitting details"
        data-tour-description="Open this sitting’s dates, status, forms, amounts and actions in a bottom sheet. Close the sheet to return to your place."
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setLocalOpen(!open);
          onExpandedChange?.(!open);
        }}
      >
        {icon}
        <span className="v3-row-copy">
          <strong>{title}</strong>
          {detail && <span>{detail}</span>}
        </span>
        <ChevronRight
          size={18}
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      <SheetShell
        onCloseAutoFocus={event => {
          event.preventDefault();
          trigger.current?.focus({ preventScroll: true });
        }}
        isOpen={open}
        title={typeof title === "string" ? title : "Sitting details"}
        onClose={() => {
          setLocalOpen(false);
          onExpandedChange?.(false);
        }}
      >
        {open && <div className="v3-sitting-details">{children}</div>}
      </SheetShell>
    </div>
  );
}
