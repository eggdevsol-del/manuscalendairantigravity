import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Safe conversion for TS downlevelIteration
function arrayBufferToBase64(buffer: ArrayBuffer | null) {
    if (!buffer) return '';
    const binary = new Uint8Array(buffer);
    let str = '';
    for (let i = 0; i < binary.length; i++) {
        str += String.fromCharCode(binary[i]);
    }
    return btoa(str);
}

export type WebPushStatus = 'default' | 'granted' | 'denied' | 'unsupported' | 'loading';

export function useWebPush() {
    const [status, setStatus] = useState<WebPushStatus>('loading');
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [isSubscribing, setIsSubscribing] = useState(false);

    // tRPC mutations
    const subscribeMutation = trpc.push.subscribe.useMutation();
    const unsubscribeMutation = trpc.push.unsubscribe.useMutation();
    const testPushMutation = trpc.push.test.useMutation();
    const publicKeyQuery = trpc.push.getPublicKey.useQuery(undefined, {
        enabled: false, // Only fetch on demand
        staleTime: Infinity,
    });

    // Check support and current status
    useEffect(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setStatus('unsupported');
            return;
        }

        // Check permission
        if (Notification.permission === 'denied') {
            setStatus('denied');
        } else if (Notification.permission === 'granted') {
            setStatus('granted');
        } else {
            setStatus('default');
        }

        // Check if already subscribed
        navigator.serviceWorker.ready.then(registration => {
            registration.pushManager.getSubscription().then(sub => {
                setSubscription(sub);
            });
        });
    }, []);

    const subscribe = useCallback(async () => {
        if (status === 'unsupported' || status === 'denied') {
            toast.error("Notifications are blocked or unsupported.");
            return;
        }

        setIsSubscribing(true);
        try {
            // 1. Request Permission
            const permission = await Notification.requestPermission();
            if (permission === 'denied') {
                setStatus('denied');
                throw new Error('Permission denied by user');
            }
            setStatus('granted');

            // 2. Get Public Key from server
            const { data: keyData } = await publicKeyQuery.refetch();
            if (!keyData?.publicKey) {
                throw new Error('VAPID public key not configured on server');
            }

            // 3. Register with PushManager
            const registration = await navigator.serviceWorker.ready;

            // Unsubscribe existing to ensure fresh key usage
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) {
                await existingSub.unsubscribe();
            }

            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
            });

            // 4. Send to backend
            const p256dh = sub.getKey('p256dh');
            const auth = sub.getKey('auth');

            if (!p256dh || !auth) throw new Error('Failed to generate keys');

            await subscribeMutation.mutateAsync({
                endpoint: sub.endpoint,
                keys: {
                    p256dh: arrayBufferToBase64(p256dh),
                    auth: arrayBufferToBase64(auth),
                },
                userAgent: navigator.userAgent,
            });

            setSubscription(sub);
            toast.success('Notifications enabled!');
        } catch (error: any) {
            console.error('Subscription failed', error);
            // Show explicit error to user
            toast.error('Failed to enable: ' + (error.message || 'Unknown error'));
        } finally {
            setIsSubscribing(false);
        }
    }, [status, publicKeyQuery, subscribeMutation]);

    const sendTestPush = useCallback(async (options?: { title?: string, body?: string, targetUserId?: string }) => {
        try {
            const result = await testPushMutation.mutateAsync({
                title: options?.title,
                body: options?.body,
                targetUserId: options?.targetUserId,
            });
            if (result.success) {
                const sentCount = result.results?.filter((r: any) => r.status === 'sent').length || 0;
                const failCount = result.results?.length ? result.results.length - sentCount : 0;

                if (sentCount > 0) {
                    toast.success(`Successfully sent to ${sentCount} device${sentCount !== 1 ? 's' : ''}`);
                }
                if (failCount > 0) {
                    toast.warning(`Failed to send to ${failCount} device${failCount !== 1 ? 's' : ''} (expired/invalid)`);
                }
                if (sentCount === 0 && failCount === 0 && result.results?.length === 0) {
                    // Should be covered by "No subscriptions found" check in backend, but just in case
                    toast.info("No active subscriptions found for this user.");
                }
            } else {
                toast.error('Failed to send test push: ' + result.message);
            }
        } catch (error: any) {
            toast.error('Test push error: ' + error.message);
        }
    }, [testPushMutation]);

    return {
        status,
        subscription,
        subscribe,
        isSubscribing,
        sendTestPush,
        isTesting: testPushMutation.isPending
    };
}
