/**
 * Android Push Notification Diagnostic Script
 * 
 * This script helps diagnose why push notifications aren't showing as heads-up
 * on Android devices. Run this in the browser console on your Android device.
 */

console.log('=== Android Push Notification Diagnostics ===\n');

// 1. Check Notification Permission
console.log('1. Notification Permission:', Notification.permission);

// 2. Check if Service Worker is registered
navigator.serviceWorker.ready.then(async (registration) => {
    console.log('2. Service Worker Status:', registration.active ? 'Active' : 'Not Active');

    // 3. Check Push Subscription
    const subscription = await registration.pushManager.getSubscription();
    console.log('3. Push Subscription:', subscription ? 'Subscribed' : 'Not Subscribed');

    if (subscription) {
        console.log('   Endpoint:', subscription.endpoint.substring(0, 50) + '...');
    }

    // 4. Check Notification API capabilities
    console.log('\n4. Notification API Capabilities:');
    console.log('   - maxActions:', Notification.maxActions || 'Not supported');
    console.log('   - vibrate supported:', 'vibrate' in navigator);

    // 5. Browser Info
    console.log('\n5. Browser Information:');
    console.log('   User Agent:', navigator.userAgent);
    console.log('   Platform:', navigator.platform);
    console.log('   Standalone Mode (PWA):', window.matchMedia('(display-mode: standalone)').matches);

    // 6. Test Notification with all possible options
    console.log('\n6. Testing notification with maximum options...');

    try {
        const testNotification = await registration.showNotification('Diagnostic Test', {
            body: 'Testing heads-up notification',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200],
            tag: 'diagnostic-test',
            requireInteraction: true,
            renotify: true,
            silent: false,
            // Try to add image for more visibility
            image: '/icon-512.png',
            actions: [
                { action: 'open', title: 'Open' }
            ],
            data: { url: '/' }
        });

        console.log('   Test notification shown successfully!');
        console.log('   Check if it appeared as heads-up or went to drawer.');

    } catch (error) {
        console.error('   Error showing test notification:', error);
    }

    // 7. Check Android-specific settings
    console.log('\n7. Android-Specific Checks:');
    console.log('   To enable heads-up notifications on Android:');
    console.log('   - Go to: Settings > Apps > Chrome (or your browser) > Notifications');
    console.log('   - Find your site/app in the list');
    console.log('   - Tap on it and check:');
    console.log('     * Notifications are enabled');
    console.log('     * "Show as pop-up" or "Heads-up" is enabled');
    console.log('     * Priority is set to "High" or "Urgent"');
    console.log('     * Sound is enabled');

    console.log('\n=== Diagnostics Complete ===');
    console.log('Please share the output above for analysis.');

}).catch(error => {
    console.error('Service Worker Error:', error);
});
