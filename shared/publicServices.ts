/** Only intentionally visible, valid service descriptions cross the public boundary. */
export function publicServices(
  raw: unknown
): { name: string; description: string }[] {
  try {
    const rows = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(rows)) return [];
    return rows
      .filter(
        row =>
          row &&
          row.showInFunnel !== false &&
          typeof row.name === "string" &&
          row.name.trim()
      )
      .map(row => ({
        name: row.name.trim(),
        description: typeof row.description === "string" ? row.description : "",
      }));
  } catch {
    return [];
  }
}
