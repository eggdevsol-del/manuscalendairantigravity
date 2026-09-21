/** Each entry describes an actual business task, its effect and its value. */
const guidance: [RegExp, string][] = [
  [
    /new booking|find available dates|find dates automatically/i,
    "Build a proposal from your saved service, working hours and existing bookings. Review every sitting before sending; this gives the client clear dates and costs while protecting your time from clashes.",
  ],
  [
    /project completed by/i,
    "Set the client’s finish-by date. Every sitting must finish before it; consecutive dates are preferred and unavoidable gaps are marked. Agreeing a feasible deadline early avoids promises the calendar cannot support.",
  ],
  [
    /start looking from/i,
    "Choose the earliest date to search for this project. Use the completion deadline as the other boundary so the proposal fits both your availability and the client’s plans.",
  ],
  [
    /consecutive dates|weekly|every two weeks|monthly/i,
    "Choose how the project is spaced. Consecutive means adjoining calendar days; with a finish-by date, the search may split the project if no full run fits. Check the gap notes before agreeing the plan with your client.",
  ],
  [
    /send proposal|review proposal/i,
    "Review the client, all sitting dates, total estimate and deposit before sending. The proposal gives both parties one agreed plan; sending it is not the same as receiving the deposit.",
  ],
  [
    /services.*availability|working hours|choose service|add service/i,
    "Save your sitting duration, price, sitting count and working hours. Booking proposals reuse these settings, keeping quotes consistent and reducing time spent rebuilding each project.",
  ],
  [
    /deposit|review.*pay|pay now|payment request|review balance|finish session|remaining balance/i,
    "Check the recorded payments and remaining amount before requesting or taking money. The payment workflow confirms receipt and updates the booking; accurate balances prevent duplicate collection and make unpaid work easier to follow up.",
  ],
  [
    /income.*payout|net earnings|earnings|money|payout history/i,
    "Review earned income separately from transfers to your bank. The chart uses the same net calculation as the total, including artist fees and refunds, so you can spot changes in trading without mistaking a payout for new revenue.",
  ],
  [
    /consent|medical|forms|sign/i,
    "Check that the correct client and sitting have the required forms completed. Signed records stay attached to that appointment, helping you prepare safely and keep a reliable record of the work.",
  ],
  [
    /reschedule/i,
    "Choose a replacement time for this sitting. Existing payments stay linked to the same booking; reviewing the new time before saving prevents accidental clashes and duplicate deposits.",
  ],
  [
    /cancel session|confirm cancellation|no-show/i,
    "Review the affected sitting and scope before changing its status. Payment records remain available and a cancellation does not automatically issue a refund, so you can resolve the client’s account separately.",
  ],
  [
    /refund/i,
    "Check the original transaction and the amount still refundable. Review carefully before confirming so the refund is linked to the correct payment and your earnings remain reconcilable.",
  ],
  [
    /design brief/i,
    "Read the design context gathered from this conversation and refresh it after important changes. Use it to prepare for the tattoo, then verify placement, style and scope with the client rather than treating an automated summary as final approval.",
  ],
  [
    /private notes|client records|notes/i,
    "Record preparation details and follow-up context for this client. Private notes help you deliver a consistent experience across several sittings without sending internal reminders into the chat.",
  ],
  [
    /project|sitting details/i,
    "Keep each tattoo project separate, even for returning clients. Expand a project to check its progress, sittings, forms and payments together; this reduces the chance of acting on the wrong booking.",
  ],
  [
    /waitlist|cancellation offers|earlier appointment/i,
    "Use the waitlist to match available appointments with clients who want an earlier date. This helps recover otherwise unused studio time while keeping the final offer and booking explicit.",
  ],
  [
    /profile.*portfolio|booking link|portfolio|add photo/i,
    "Keep your portfolio and public booking information accurate. Clear examples and services help prospective clients decide whether you are the right artist and send a more useful enquiry.",
  ],
  [
    /shopfront|products|orders|events|workshops/i,
    "Manage the offer, price, availability and fulfilment details clients will rely on. Review the saved information before publishing or completing an order so your public offering matches what you can deliver.",
  ],
  [
    /supplies|stock/i,
    "Review stock and supplier orders alongside upcoming work. Keeping consumables available reduces last-minute purchases and avoidable interruptions to booked sittings.",
  ],
  [
    /studio|team|invite artist/i,
    "Manage the artists and permissions in your shared workspace. Give each person the access they need so scheduling and client information stay organised across the studio.",
  ],
  [
    /notifications|reminders|templates/i,
    "Set permissions and reusable reminder wording for your workflow. Templates are saved wording, not sent messages; check the sending or scheduling action separately so important client communication is intentional.",
  ],
  [
    /import|mapping/i,
    "Match imported fields to the correct client and booking information before applying an import. Review the preview to avoid duplicated records or dates being assigned to the wrong person.",
  ],
];
export function businessGuidance(label: string): string | undefined {
  return guidance.find(([pattern]) => pattern.test(label))?.[1];
}
