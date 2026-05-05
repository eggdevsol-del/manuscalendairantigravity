
async function testProd() {
  try {
    const res = await fetch('https://vidabiz.butterfly-effect.dev/api/trpc/dashboardSettings.get');
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text.substring(0, 200));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testProd();
