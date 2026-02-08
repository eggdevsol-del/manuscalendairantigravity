/**
 * Android Diagnostic Script
 * 
 * Run this in the browser console on your Android device to diagnose loading issues.
 * This will help identify if the problem is:
 * - Service worker caching
 * - React Query state
 * - Network/API issues
 * - Auth issues
 */

console.log('=== ANDROID DIAGNOSTIC SCRIPT ===\n');

// 1. Check Service Worker Status
console.log('1. SERVICE WORKER STATUS');
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
            console.log('   ✅ Service Worker registered');
            console.log('   - State:', reg.active?.state);
            console.log('   - Scope:', reg.scope);
            console.log('   - Update found:', reg.waiting ? 'YES (needs refresh)' : 'NO');

            // Check for updates
            reg.update().then(() => {
                console.log('   - Update check complete');
            });
        } else {
            console.log('   ❌ No service worker registered');
        }
    });
} else {
    console.log('   ❌ Service Worker not supported');
}

// 2. Check Cache Status
console.log('\n2. CACHE STATUS');
caches.keys().then(cacheNames => {
    console.log('   Cache names:', cacheNames);
    cacheNames.forEach(cacheName => {
        caches.open(cacheName).then(cache => {
            cache.keys().then(keys => {
                console.log(`   - ${cacheName}: ${keys.length} entries`);
                // Show API cache entries
                const apiKeys = keys.filter(req => req.url.includes('/api/'));
                if (apiKeys.length > 0) {
                    console.log(`     API entries:`, apiKeys.map(k => k.url));
                }
            });
        });
    });
});

// 3. Check React Query State
console.log('\n3. REACT QUERY STATE');
setTimeout(() => {
    // Access React Query DevTools data if available
    const queryClient = window.__REACT_QUERY_DEVTOOLS_GLOBAL_HOOK__?.queryClient;
    if (queryClient) {
        const queryCache = queryClient.getQueryCache();
        const queries = queryCache.getAll();

        console.log(`   Total queries: ${queries.length}`);

        // Find conversations query
        const conversationsQuery = queries.find(q =>
            q.queryKey.includes('conversations') && q.queryKey.includes('list')
        );

        if (conversationsQuery) {
            console.log('   ✅ Conversations query found');
            console.log('   - State:', conversationsQuery.state.status);
            console.log('   - Data:', conversationsQuery.state.data ? `${conversationsQuery.state.data.length} items` : 'null');
            console.log('   - Error:', conversationsQuery.state.error);
            console.log('   - Fetching:', conversationsQuery.state.isFetching);
            console.log('   - Stale:', conversationsQuery.isStale());
        } else {
            console.log('   ❌ Conversations query NOT found');
        }

        // Show all query states
        console.log('\n   All queries:');
        queries.forEach(q => {
            console.log(`   - ${JSON.stringify(q.queryKey)}: ${q.state.status}`);
        });
    } else {
        console.log('   ❌ React Query DevTools not available');
        console.log('   Try accessing window.queryClient or check if app is loaded');
    }
}, 2000);

// 4. Check Network Connectivity
console.log('\n4. NETWORK STATUS');
console.log('   Online:', navigator.onLine);
console.log('   Connection:', navigator.connection?.effectiveType || 'unknown');

// 5. Test API Endpoint
console.log('\n5. API ENDPOINT TEST');
fetch('/api/trpc/conversations.list', {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json',
    },
    credentials: 'include',
}).then(response => {
    console.log('   ✅ API Response:', response.status, response.statusText);
    return response.text();
}).then(data => {
    console.log('   Response data:', data.substring(0, 200));
}).catch(error => {
    console.log('   ❌ API Error:', error.message);
});

// 6. Check Auth State
console.log('\n6. AUTH STATE');
setTimeout(() => {
    // Check localStorage for auth tokens
    const authKeys = Object.keys(localStorage).filter(k =>
        k.includes('auth') || k.includes('token') || k.includes('session')
    );
    console.log('   Auth-related localStorage keys:', authKeys);

    // Check cookies
    console.log('   Cookies:', document.cookie ? 'Present' : 'None');
}, 1000);

// 7. Check for Console Errors
console.log('\n7. CONSOLE ERRORS');
console.log('   Check above for any errors marked in red');
console.log('   Common issues:');
console.log('   - CORS errors → API configuration issue');
console.log('   - 401/403 errors → Auth issue');
console.log('   - Network errors → Connection issue');
console.log('   - Cache errors → Service worker issue');

console.log('\n=== DIAGNOSTIC COMPLETE ===');
console.log('Please share the output above for analysis');
