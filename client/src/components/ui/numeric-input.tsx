import * as React from "react";

/** Preserve the text being edited instead of letting Number("") force a zero back in. */
export const NumericInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function NumericInput({ value, onChange, onFocus, onBlur, ...props }, ref) {
    const [draft, setDraft] = React.useState<string | null>(null);
    const editing = React.useRef(false);
    const last = React.useRef(value);
    React.useEffect(() => {
      if (!editing.current && value !== last.current) setDraft(null);
      last.current = value;
    }, [value]);
    return <input {...props} ref={ref} type="number" value={draft ?? value}
      onFocus={e => { editing.current = true; if (draft === null) setDraft(e.currentTarget.value); onFocus?.(e); }}
      onChange={e => { setDraft(e.currentTarget.value); onChange?.(e); }}
      onBlur={e => { editing.current = false; onBlur?.(e); }} />;
  }
);
