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
  window.location.assign(
    data.user.role === "client" ? "/discover" : "/dashboard"
  );
}
