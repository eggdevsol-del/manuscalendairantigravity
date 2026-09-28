// /api/ navigation is network-only even in older Tattoi service workers.
// Keep the original path working for links already delivered.
export const CLIENT_PORTAL_ENTRY = "/api/client-portal";
export function isClientPortalPath(path: string) {
  const normalized = path.replace(/\/+$/, "");
  return normalized === "/client-portal" || normalized === CLIENT_PORTAL_ENTRY;
}
