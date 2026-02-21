import "dotenv/config";

async function main() {
    const ONESIGNAL_APP_ID = process.env.VITE_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID;
    const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
    const externalId = "user_ce549c0b4b6f90aaafad0546a0928050";

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
        console.error("Missing credentials");
        return;
    }

    console.log(`Checking OneSignal for external_id: ${externalId}`);

    const res = await fetch(`https://onesignal.com/api/v1/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${externalId}`, {
        headers: {
            'Authorization': `Basic ${ONESIGNAL_API_KEY}`
        }
    });

    if (res.ok) {
        const data = await res.json();
        console.log("USER RECORD FOUND:", JSON.stringify(data, null, 2));
    } else {
        const err = await res.text();
        console.error("FAILED TO FIND USER:", res.status, err);
    }
}

main().catch(console.error);
