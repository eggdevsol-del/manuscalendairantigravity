/**
 * Email Service — Placeholder
 *
 * Console.log placeholder for transactional emails.
 * Replace with a real provider (SendGrid, Resend, etc.) before production.
 */

interface EmailPayload {
    to: string;
    subject: string;
    body: string;
}

/**
 * Send a transactional email. Currently logs to console.
 * Production: replace with SendGrid/Resend/SES call.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
    console.log(
        `[Email] TO: ${payload.to} | SUBJECT: ${payload.subject} | BODY: ${payload.body.substring(0, 200)}...`
    );
}
