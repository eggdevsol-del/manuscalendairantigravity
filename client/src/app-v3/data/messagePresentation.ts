import { PRACTICE_REFERENCE } from "@shared/practiceMedia";
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
          typeof s === "string" && (/^https?:\/\//i.test(s) || s === PRACTICE_REFERENCE)
      )
    : [];
}
export function messageText(content: string) {
  const data = objectFromJson(content);
  if (!Object.keys(data).length) return content;
  for (const key of ["message", "text", "label", "title"]) {
    if (typeof data[key] === "string" && data[key].trim()) return data[key];
  }
  return "Booking update";
}

/** Derive every reference view from the original conversation attachments. */
export function conversationMedia(
  messages: { content: string | null; messageType: string }[]
): string[] {
  return [
    ...new Set(
      messages.flatMap(message =>
        message.messageType === "image" &&
        (/^https?:\/\//i.test(message.content || "") || message.content === PRACTICE_REFERENCE)
          ? [message.content!]
          : mediaUrls(objectFromJson(message.content))
      )
    ),
  ];
}
