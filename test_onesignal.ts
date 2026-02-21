import "dotenv/config";
import { sendPushNotification } from "./server/_core/pushNotification";

async function main() {
    const userId = "user_ce549c0b4b6f90aaafad0546a0928050"; // Found in DB JSON
    console.log("Sending explicit test push to OneSignal only for User ID:", userId);

    const success = await sendPushNotification({
        userIds: [userId],
        title: "Test Script Push",
        message: "Are you there OneSignal?",
    });

    console.log("Result:", success ? "SUCCESS" : "FAILED (0 matching devices)");
}

main().catch(console.error);
