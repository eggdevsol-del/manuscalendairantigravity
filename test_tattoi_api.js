fetch("https://tattoi.app/api/trpc/auth.login?batch=1", {
  method: "POST",
  body: JSON.stringify({ "0": { "json": { "email": "bob@gmail.com", "password": "Password123!" } } }),
  headers: { "content-type": "application/json" }
}).then(r => r.text()).then(t => console.log(t.substring(0, 500))).catch(console.error);
