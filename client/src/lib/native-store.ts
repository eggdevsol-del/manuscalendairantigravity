
import { Capacitor } from '@capacitor/core';

/**
 * NativeStore
 * 
 * A Single Source of Truth bridge for sharing data between the React Web App
 * and Native Platforms (iOS/Android) specifically for Widgets.
 * 
 * iOS: Uses UserDefaults with a shared App Group.
 * Android: Uses SharedPreferences.
 */

const APP_GROUP = 'group.com.manus.calendair';

export const NativeStore = {
    /**
     * Syncs a JSON object to the native platform.
     * This is what the Widgets will read from.
     */
    async syncData(key: string, data: any) {
        if (!Capacitor.isNativePlatform()) {
            console.log(`[NativeStore] Web placeholder sync: ${key}`, data);
            return;
        }

        const jsonString = JSON.stringify(data);

        try {
            // We use the Capacitor Preferences plugin (built-in) or a custom bridge
            // For real widgets, we often need a custom bridge to hit the App Group.
            // For now, we'll implement the logic that the native side can listen to.

            // @ts-ignore - standard capacitor bridge for custom data
            if (window.Capacitor?.Plugins?.NativeWidgetBridge) {
                // @ts-ignore
                await window.Capacitor.Plugins.NativeWidgetBridge.updateWidgetData({
                    key,
                    data: jsonString,
                    group: APP_GROUP
                });
            }

            console.log(`[NativeStore] Synced ${key} to Native`);
        } catch (e) {
            console.error('[NativeStore] Sync failed', e);
        }
    },

    /**
     * Helper to specifically sync the 'Next Appointment' for the widget
     */
    async syncNextAppointment(appointment: any) {
        await this.syncData('next_appointment', appointment);
    }
};
