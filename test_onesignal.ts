import 'dotenv/config';
import { ENV } from './server/_core/env';

async function testOneSignal() {
    const APP_ID = ENV.oneSignalAppId;
    const API_KEY = ENV.oneSignalApiKey;
    const userId = "user_ce549c0b4b6f90aaafad0546a0928050"; // Artist

    console.log(`Checking OneSignal for external_id: ${userId}`);
    const url = `https://onesignal.com/api/v1/apps/${APP_ID}/users/by/external_id/${userId}`;

    const res = await fetch(url, {
        headers: {
            'Authorization': `Basic ${API_KEY}`
        }
    });

    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

testOneSignal().catch(console.error);
