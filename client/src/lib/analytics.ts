/** Optional analytics must not emit broken requests in unconfigured environments. */
export function initializeAnalytics() {
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
  if (!endpoint || !websiteId) return;
  try {
    const url = new URL(
      endpoint.replace(/\/$/, "") + "/umami",
      window.location.origin
    );
    if (url.protocol !== "https:" && url.origin !== window.location.origin)
      return;
    const script = document.createElement("script");
    script.src = url.href;
    script.defer = true;
    script.dataset.websiteId = websiteId;
    document.head.appendChild(script);
  } catch {
    /* Analytics does not block the application. */
  }
}
