export function hasReadMessage(
  readBy: string | null | undefined,
  recipientId: string | null | undefined
) {
  if (!recipientId || !readBy) return false;
  try {
    const readers: unknown = JSON.parse(readBy);
    return Array.isArray(readers) && readers.includes(recipientId);
  } catch {
    return false;
  }
}
