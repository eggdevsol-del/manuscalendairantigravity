const url = 'http://localhost:3000/api/trpc/funnel.getClientDepositLink';
try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      "0": {
        "json": {
          "conversationId": 1
        }
      }
    })
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
} catch (e) {
  console.error("Fetch failed", e);
}
