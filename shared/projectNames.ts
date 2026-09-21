/** Operational activity is never a tattoo's identity. Shared by repair and generation. */
export function isDesignProjectName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 60 &&
    !/[\r\n]/.test(value) &&
    !/\b(reschedul\w*|reshedul\w*|schedul\w*|pricing|price|quote|logistics|date change|payment\w*|deposit\w*|appointment\w*|proposal\w*|booking\w*|discussion\w*|confirm\w*|cancel\w*|invoice\w*|refund\w*|availability|balance|checkout|reminder\w*|session\w*)\b/i.test(
      value
    ) &&
    !/^(tattoo project|custom piece|full day|half day)$/i.test(value.trim())
  );
}

export function designProjectName(value: unknown): string | null {
  return isDesignProjectName(value) ? value : null;
}
