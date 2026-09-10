/** Only recognised app destinations can survive an authentication redirect. */
export function safeReturnPath(value: string | null): string | null {
  if (
    !value ||
    !/^\/(?:bookings|conversations|projects\/\d+|chat\/\d+|dashboard|calendar|clients|settings)(?:\?[^#]*)?$/.test(
      value
    )
  )
    return null;
  return value;
}

export function finishSignIn(
  data: { token: string; user: { role: string } },
  remember = true
) {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem("authToken");
    storage.removeItem("user");
  }
  localStorage.removeItem("calendair_teaser_mode");
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem("authToken", data.token);
  storage.setItem("user", JSON.stringify(data.user));
  const destination = safeReturnPath(
    new URLSearchParams(window.location.search).get("returnTo")
  );
  window.location.assign(
    destination || (data.user.role === "client" ? "/bookings" : "/dashboard")
  );
}
