interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}
export function requireEmailDelivery(): void {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new Error("Email delivery is unavailable. Please contact support.");
}
/** Send via Resend. Never log recipients, recovery links or message bodies. */
export async function sendEmail(payload: EmailPayload, idempotencyKey?: string): Promise<void> {
  requireEmailDelivery();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [payload.to],
      subject: payload.subject,
      text: payload.body,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error("Email could not be delivered. Please try again later.");
}
