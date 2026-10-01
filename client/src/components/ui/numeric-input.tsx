import * as React from "react";

/** Preserve the text being edited instead of letting Number("") force a zero back in. */
export const NumericInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function NumericInput({ value, onChange, onFocus, onBlur, ...props }, ref) {
    const [draft, setDraft] = React.useState<string | null>(null);
    return <input {...props} ref={ref} type="number" value={draft ?? value}
      onFocus={e => { setDraft(e.currentTarget.value); onFocus?.(e); }}
      onChange={e => { setDraft(e.currentTarget.value); onChange?.(e); }}
      onBlur={e => { onBlur?.(e); setDraft(null); }} />;
  }
);
