import { SummaryCard } from "../design/primitives";
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
      {headerClassName ? (
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
      ) : (
        <SummaryCard
          ref={trigger}
          title={title}
          detail={detail}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-tour-repeat="sitting-disclosure"
          data-tour-title="Sitting details"
          data-tour-description="Open this sitting’s details and actions in a bottom sheet. Close it to return to your place."
          onClick={() => {
            setLocalOpen(true);
            onExpandedChange?.(true);
          }}
        />
      )}
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
