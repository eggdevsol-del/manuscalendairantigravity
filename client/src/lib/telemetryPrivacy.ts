const publicRoutes = new Set([
  "login",
  "signup",
  "dashboard",
  "chat",
  "conversations",
  "calendar",
  "settings",
  "bookings",
  "projects",
  "pay",
  "deposit",
  "book",
  "shop",
  "profile",
  "reset-password",
  "invite",
]);
/** Only a route family is useful for diagnostics; never send tokens or identifiers. */
export function telemetryRoute(href: string) {
  try {
    const first = new URL(href).pathname.split("/")[1];
    return publicRoutes.has(first) ? `/${first}` : "/other";
  } catch {
    return "/unknown";
  }
}
/** Keep source line/column positions, not arbitrary exception text, URLs or query values. */
export function telemetryFrames(stack?: string) {
  return (stack || "")
    .split("\n")
    .slice(1)
    .flatMap(line => {
      const position = line.match(/:(\d+):(\d+)\)?\s*$/);
      return position ? [`frame:${position[1]}:${position[2]}`] : [];
    })
    .slice(0, 30)
    .join("\n");
}
