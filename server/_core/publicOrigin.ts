/** Public links must belong to this deployment, never an implicit production site. */
export function publicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.APP_URL || env.VITE_APP_URL;
  if (!value) throw new Error("Set APP_URL before generating public links.");
  const url = new URL(value);
  if (url.username || url.password || (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))
    throw new Error("APP_URL must use HTTPS (localhost HTTP is allowed for development).");
  return url.origin;
}
