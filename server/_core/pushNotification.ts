import { ENV } from './env';

const ONESIGNAL_APP_ID = ENV.oneSignalAppId;
const ONESIGNAL_API_KEY = ENV.oneSignalApiKey;
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

interface PushNotificationOptions {
  userIds: string[];
  title: string;
  message: string;
  url?: string;
  data?: Record<string, any>;
}

/**
 * Send push notification to specific users via OneSignal
 * @param options Notification options including user IDs, title, and message
 * @returns Success status
 */
export async function sendPushNotification(options: PushNotificationOptions): Promise<boolean> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.warn('[PushNotification] OneSignal credentials not configured');
    return false;
  }

  if (!options.userIds || options.userIds.length === 0) {
    console.warn('[PushNotification] No user IDs provided');
    return false;
  }

  try {
    const payload = {
      app_id: ONESIGNAL_APP_ID,
      target_channel: "push",
      include_aliases: {
        external_id: options.userIds
      },
      headings: { en: options.title },
      contents: { en: options.message },
      ...(options.url && { url: options.url }),
      ...(options.data && { data: options.data }),
    };

    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[PushNotification] Failed to send notification:', error);
      return false;
    }

    const result = await response.json();

    // In OneSignal REST API, returning 200 OK with 0 recipients means the user ID was not found.
    if (result.errors || result.recipients === 0) {
      console.error('[PushNotification] Validation failed or 0 devices matched the User ID:', JSON.stringify(result));
      return false;
    }

    console.log('[PushNotification] Notification queued successfully by OneSignal:', result);
    return true;
  } catch (error) {
    console.error('[PushNotification] Error sending notification:', error);
    return false;
  }
}

/**
 * Send notification about a new message
 */
export async function notifyNewMessage(
  recipientUserId: string,
  senderName: string,
  messagePreview: string,
  conversationId: number
): Promise<boolean> {
  return sendPushNotification({
    userIds: [recipientUserId],
    title: `New message from ${senderName}`,
    message: messagePreview.substring(0, 100),
    url: `/chat/${conversationId}`,
    data: {
      type: 'new_message',
      conversationId,
    },
  });
}

/**
 * Send notification about appointment confirmation
 */
export async function notifyAppointmentConfirmed(
  recipientUserId: string,
  clientName: string,
  appointmentDate: string,
  conversationId: number
): Promise<boolean> {
  return sendPushNotification({
    userIds: [recipientUserId],
    title: 'Appointment Confirmed',
    message: `${clientName} confirmed an appointment on ${appointmentDate}`,
    url: `/calendar`,
    data: {
      type: 'appointment_confirmed',
      conversationId,
    },
  });
}

/**
 * Send notification about new consultation request
 */
export async function notifyNewConsultation(
  artistUserId: string,
  clientName: string,
  consultationId: number
): Promise<boolean> {
  return sendPushNotification({
    userIds: [artistUserId],
    title: 'New Consultation Request',
    message: `${clientName} has requested a consultation`,
    url: `/conversations`,
    data: {
      type: 'new_consultation',
      consultationId,
    },
  });
}

