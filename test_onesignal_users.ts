import 'dotenv/config';
import { ENV } from './server/_core/env';

async function testOneSignalUsers() {
    const APP_ID = ENV.oneSignalAppId;
    const API_KEY = ENV.oneSignalApiKey;

    console.log(`Fetching users for app: ${APP_ID}`);
    const url = `https://onesignal.com/api/v1/players?app_id=${APP_ID}&limit=10`;

    const res = await fetch(url, {
        headers: {
            'Authorization': `Basic ${API_KEY}`
        }
    });

    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

testOneSignalUsers().catch(console.error);
