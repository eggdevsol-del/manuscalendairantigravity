/** Reporting and blocking: the words and limits the server and the app must agree on. */
export const REPORT_REASONS = [
  "harassment",
  "sexual_content",
  "hate",
  "scam",
  "underage",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment or bullying",
  sexual_content: "Sexual or explicit content",
  hate: "Hate speech or discrimination",
  scam: "Scam or fraud",
  underage: "Involves someone under 18",
  other: "Something else",
};

export const REPORT_DETAILS_MAX = 1000;
/** Reports one person may send in any 24 hours. */
export const REPORTS_PER_DAY = 10;
/** Shown after a report is sent, and promised in the Terms of Service. */
export const REPORT_THANKS = "Thanks. We review reports within 24 hours.";
/** Shown to either side of a block. It never says who blocked whom. */
export const MESSAGING_BLOCKED = "You can’t message this person.";
/** Where reports are sent when SUPPORT_EMAIL is not set; the contact address in the legal pages. */
export const SAFETY_CONTACT = "privacy@tattoi.app";
