/** Message data is untrusted and older messages may not contain valid metadata. */
export function objectFromJson(
  value: string | null | undefined
): Record<string, any> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
export function messagePreview(content?: string | null, type?: string | null) {
  if (type === "image") return "Photo";
  const data = objectFromJson(content);
  if (data.type === "reference_grid") return "Reference photos";
  if (data.type === "placement_grid") return "Placement photos";
  if (Object.keys(data).length) return "Booking update";
  return content || "Open conversation";
}
export function mediaUrls(data: Record<string, any>): string[] {
  return Array.isArray(data.images)
    ? data.images.filter(
        (s: unknown): s is string =>
          typeof s === "string" && /^https?:\/\//i.test(s)
      )
    : [];
}
