import {
  Children,
  isValidElement,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { ChevronRight } from "lucide-react";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map(child =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement<{ children?: ReactNode }>(child)
          ? textOf(child.props.children)
          : ""
    )
    .join("");
}
/** Shared secondary-information control: the page never grows an inline detail panel. */
export function DetailsSheet({
  title,
  inline = false,
  sheetTitle,
  label,
  children,
  open,
  onOpenChange,
  className,
  reveal = false,
}: {
  inline?: boolean;
  title: ReactNode;
  sheetTitle?: string;
  label?: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  reveal?: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [localOpen, setLocalOpen] = useState(reveal);
  useEffect(() => {
    if (reveal) setLocalOpen(true);
  }, [reveal]);
  const visible = open ?? localOpen;
  const change = (value: boolean) => {
    setLocalOpen(value);
    onOpenChange?.(value);
  };
  return (
    <div className={className} data-details-sheet>
      <button
        ref={trigger}
        type="button"
        className="v3-row"
        aria-haspopup={inline ? undefined : "dialog"}
        aria-expanded={visible}
        onClick={() => change(inline ? !visible : true)}
      >
        <span className="v3-row-copy">{label || title}</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      {inline ? (
        visible && <div className="v3-stack">{children}</div>
      ) : (
        <SheetShell
          onCloseAutoFocus={event => {
            event.preventDefault();
            trigger.current?.focus({ preventScroll: true });
          }}
          isOpen={visible}
          onClose={() => change(false)}
          title={
            sheetTitle || textOf(title).replace(/\s+/g, " ").trim() || "Details"
          }
        >
          {visible && children}
        </SheetShell>
      )}
    </div>
  );
}
