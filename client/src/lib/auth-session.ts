export function finishSignIn(
  data: { token: string; user: { role: string } },
  remember = true
) {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem("authToken");
    storage.removeItem("user");
  }
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem("authToken", data.token);
  storage.setItem("user", JSON.stringify(data.user));
  const returnTo = sessionStorage.getItem("tattoi-return-to");
  sessionStorage.removeItem("tattoi-return-to");
  const safeReturn =
    returnTo?.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes("\\") &&
    !/^\/(login|signup|auth)(\/|\?|$)/.test(returnTo);
  window.location.assign(
    safeReturn && returnTo
      ? returnTo
      : data.user.role === "client"
        ? "/bookings"
        : "/dashboard"
  );
}
