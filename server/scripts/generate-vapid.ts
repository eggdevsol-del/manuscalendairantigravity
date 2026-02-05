/**
 * Generate VAPID Keys for Web Push
 * Run: tsx server/scripts/generate-vapid.ts
 */
import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID KEYS GENERATED ===');
console.log('Add these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VITE_FEATURE_WEBPUSH_TEST=true`);
console.log('\nAlso add VAPID_SUBJECT=mailto:your@email.com');
console.log('============================\n');
