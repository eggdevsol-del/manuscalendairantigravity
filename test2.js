fetch('https://tattoi.app/api/trpc/auth.login?batch=1', {
  method: 'POST',
  body: JSON.stringify({ "0": {} }),
  headers: { 'content-type': 'application/json' }
}).then(r => r.text()).then(console.log).catch(console.error);
