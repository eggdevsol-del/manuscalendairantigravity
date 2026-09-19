import {
  useId,
  useState,
  useRef,
  useLayoutEffect,
  type ReactNode,
  type CSSProperties,
} from "react";
import { ChevronDown } from "lucide-react";

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
  onDetailsHeight,
}: {
  icon?: ReactNode;
  headerClassName?: string;
  headerStyle?: CSSProperties;
  onDetailsHeight?: (height: number) => void;
  title: ReactNode;
  detail?: ReactNode;
  children: ReactNode;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = expanded ?? localOpen;
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onHeight = useRef(onDetailsHeight);
  onHeight.current = onDetailsHeight;
  useLayoutEffect(() => {
    if (!open || !panel.current || !onHeight.current) return;
    const measure = () =>
      onHeight.current?.(panel.current!.getBoundingClientRect().height + 8);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, [open]);
  return (
    <div className="v3-sitting-card">
      <button
        type="button"
        className={headerClassName || "v3-row"}
        style={headerStyle}
        data-tour-repeat="sitting-disclosure"
        data-tour-title="Sitting details"
        data-tour-description="Select a sitting to expand its own details directly beneath the card. Its dates, status, forms, amounts and available actions belong to that sitting. Select it again to collapse."
        aria-expanded={open}
        aria-controls={id}
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
        <ChevronDown
          size={18}
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      <div
        id={id}
        ref={panel}
        hidden={!open}
        className={open ? "v3-sitting-details" : undefined}
      >
        {open && children}
      </div>
    </div>
  );
}
