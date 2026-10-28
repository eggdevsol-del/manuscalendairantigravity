/* iOS Modern live displays: a stage that shows the result of a setting as you change it, and the touch
   fill slider, where the whole bar is the control (press anywhere and drag, like Control Center's volume). */
import { useRef, type CSSProperties, type ReactNode } from "react";

export function LiveStage({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={`iosm-stage ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-live="polite"
    >
      {children}
    </div>
  );
}

/** A big number with a caption above and below, the headline of most stages. */
export function StageNumber({
  over,
  value,
  under,
}: {
  over?: ReactNode;
  value: ReactNode;
  under?: ReactNode;
}) {
  return (
    <div className="iosm-stage-num">
      {over && <small>{over}</small>}
      <b>{value}</b>
      {under && <em>{under}</em>}
    </div>
  );
}

export const clampStep = (v: number, min: number, max: number, step: number) =>
  Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));

export function TouchSlider({
  label,
  value,
  min,
  max,
  step = 1,
  format = String,
  onChange,
  disabled = false,
  tone,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
  tone?: "money" | "time";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const fraction = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const fromPointer = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / (r.width || 1)));
    const v = clampStep(min + f * (max - min), min, max, step);
    if (v !== value) onChange(v);
  };
  return (
    <div
      ref={ref}
      className={`iosm-slider${tone ? ` ${tone}` : ""}${disabled ? " locked" : ""}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      aria-disabled={disabled || undefined}
      style={{ "--fill": `${fraction * 100}%` } as CSSProperties}
      onPointerDown={e => {
        if (disabled) return;
        dragging.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.currentTarget.classList.add("on");
        fromPointer(e.clientX);
      }}
      onPointerMove={e => {
        if (dragging.current) fromPointer(e.clientX);
      }}
      onPointerUp={e => {
        dragging.current = false;
        e.currentTarget.classList.remove("on");
      }}
      onPointerCancel={e => {
        dragging.current = false;
        e.currentTarget.classList.remove("on");
      }}
      onKeyDown={e => {
        if (disabled) return;
        const dir =
          e.key === "ArrowRight" || e.key === "ArrowUp"
            ? 1
            : e.key === "ArrowLeft" || e.key === "ArrowDown"
              ? -1
              : 0;
        const edge = e.key === "Home" ? min : e.key === "End" ? max : null;
        if (!dir && edge === null) return;
        e.preventDefault();
        onChange(edge ?? clampStep(value + dir * step, min, max, step));
      }}
    >
      <i aria-hidden="true" />
      <span>
        <b>{label}</b>
        <em>{format(value)}</em>
      </span>
    </div>
  );
}
