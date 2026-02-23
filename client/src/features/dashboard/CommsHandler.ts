import { ActionType } from "./types";

export const CommsHandler = {
    openPrefilledEmail: (to: string, subject?: string, body?: string) => {
        const params = new URLSearchParams();
        if (subject) params.append('subject', subject);
        if (body) params.append('body', body);

        const url = `mailto:${to}?${params.toString()}`;

        const a = document.createElement('a');
        a.href = url;
        a.target = '_top';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    openPrefilledSms: (phone: string, body?: string, platform: 'ios' | 'android' | 'desktop' = 'ios') => {
        // SMS handling varies slightly by platform ('&' vs '?') but modern OS usually handle both.
        // iOS: sms:123&body=Text
        // Android: sms:123?body=Text

        const separator = platform === 'ios' ? '&' : '?';
        const url = `sms:${phone}${body ? `${separator}body=${encodeURIComponent(body)}` : ''}`;

        if (platform === 'desktop') {
            // Desktop fallback: prompt copy
            return false; // Signal that we failed to open native and need fallback UI
        }

        const a = document.createElement('a');
        a.href = url;
        a.target = '_top';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
    }
};
