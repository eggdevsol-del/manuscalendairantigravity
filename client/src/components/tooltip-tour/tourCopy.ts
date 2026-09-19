import { controlLabel } from "./contextualTargets";

/** Authored product guidance shared by page, sheet and workflow tours. */
const topics: [RegExp, string][] = [
  [/^disconnect payment account/i, "Review the connection you are removing. Disconnecting stops new payment collection through this account in Tattoi; it does not close your Stripe account."],
  [/payment account|bank setup/i, "Set up or review the account used to collect payments and receive payouts. Complete Stripe’s business, identity and bank checks; returning to Tattoi alone does not confirm approval."],
  [/^artist map$/i, "Search for artists or move the map to explore an area. Select a pin to open that artist’s card; the map does not request a booking."],
  [/^artwork viewer$/i, "Inspect this artist’s work at full size. Use the previous and next controls to browse, or close the viewer to return to the portfolio."],
  [
    /booking|project|sitting|session/i,
    "Keep the dates, service, estimate, deposit and client together. Open a sitting for its own details; review changes before confirming them.",
  ],
  [
    /calendar|schedule/i,
    "Browse dates and appointments here. Select an appointment to manage it, or start a booking for an available time.",
  ],
  [
    /message|conversation|inbox/i,
    "Keep questions, reference images and booking plans in the same conversation. Sending a chat message does not confirm a booking.",
  ],
  [
    /payment|balance|deposit|checkout/i,
    "Review the itemised amount, platform fee and total before authorising payment. Confirmation comes from the payment service, not simply closing this screen.",
  ],
  [
    /payout|bank|money/i,
    "Review earnings, payment history and the connected payment account. Pending funds and money already paid to your bank are different balances.",
  ],
  [
    /refund/i,
    "Review the original charge, amount already refunded and the affected sessions before confirming a refund.",
  ],
  [
    /form|consent|procedure/i,
    "Review the required information carefully. Issued and signed records belong to the client and booking; editing a template does not rewrite those records.",
  ],
  [
    /working|hours|service/i,
    "Set the days, hours, breaks and services offered to clients. Availability uses these settings, including service duration and number of sittings.",
  ],
  [
    /studio|team|invitation/i,
    "Manage your shared studio workspace here. Available actions depend on membership, role and subscription; other artists’ bookings can have read-only details.",
  ],
  [
    /supply|supplies|supplier|catalogue|product/i,
    "Review products, variants, stock and prices. Check the final order and delivery details before buying. Catalogue editing may open your connected Shopify store.",
  ],
  [
    /order|purchase/i,
    "Review the recorded items, payment and fulfilment status. Open an order for its details or the supplier’s fulfilment handoff.",
  ],
  [
    /event|seminar/i,
    "Review the event format, dates, capacity and price. Publishing an event and purchasing a place are separate actions.",
  ],
  [
    /portfolio|artist profile/i,
    "Manage the work and profile information clients see. Review uploaded images and public details before sharing your profile.",
  ],
  [
    /discover/i,
    "Explore artists and their work, then open a profile to learn more or begin an enquiry.",
  ],
  [
    /notification|reminder|template/i,
    "Manage device permissions and saved wording. Saving a message template does not send it or schedule a notification.",
  ],
  [
    /import/i,
    "Select your source, review the preview and check duplicates or conflicts before importing. Review failed rows before retrying.",
  ],
  [
    /travel|trip|guest/i,
    "Record travel dates and find nearby clients. Saving a trip does not send messages or change your working hours.",
  ],
  [
    /waitlist|earlier|available time/i,
    "Review clients waiting for an earlier appointment or an offered time. An offer still needs acceptance and any required deposit.",
  ],
  [
    /subscription|plan|billing/i,
    "Compare the current prices and features. Review recurring charges and payment fees before starting or changing a subscription.",
  ],
  [
    /delete|danger/i,
    "Read the consequences before continuing. This walkthrough never confirms deletion or changes your account for you.",
  ],
  [
    /sign|password|welcome|account type/i,
    "Use your own account details. Keep passwords and sign-in links private; complete the sign-in or recovery action yourself.",
  ],
  [
    /profile|details|client/i,
    "Keep contact information and the relevant records up to date. Open a record to review its appointments, notes and forms.",
  ],
  [
    /settings|business/i,
    "Choose the area you want to manage. Each section and its dialogs has its own contextual walkthrough.",
  ],
  [
    /reconciliation|operation|error/i,
    "Review the diagnostic evidence before taking an administrative action. A retry or repair can affect live records.",
  ],
  [
    /home|today|store/i,
    "Review upcoming work and items needing attention, then open the relevant booking, client, order or business section.",
  ],
];
export function describeSurface(title: string) {
  return (
    (topics.find(([pattern]) => pattern.test(title))?.[1] ||
      "Explore the information and controls in this view. The guide follows the available controls as you open its features.") +
    " You can use the page while the island is open; Next only moves the guide."
  );
}
const actions: [RegExp, string][] = [
  [/continue with stripe/i, "Open Stripe’s hosted account setup to complete the required verification. This does not authorise a client payment."],
  [/^try again$|^check again$|^refresh status$/i, "Request the current result again after checking the displayed issue. A refreshed view does not by itself confirm payment or account approval."],
  [/^offer a time$/i, "Prepare an available date, duration, estimate, deposit and expiry for this waiting client. Opening the form does not send the offer."],
  [/^accept offer & review deposit$/i, "Check availability and accept this offered time for deposit review. The booking is confirmed only after the required payment and availability checks."],
  [/^continue to deposit$/i, "Reopen this accepted offer’s deposit review. Check the date, amount and platform fee before paying."],
  [/^withdraw$|^leave waitlist$/i, "Review the confirmation before removing this waitlist entry. This is separate from cancelling an existing appointment."],
  [/^clear signature$/i, "This clears the strokes in the signature pad so you can draw again. It does not remove a previously signed form."],
  [/^continue to signature$/i, "Open the signature step after reviewing this form and answering any required questions. Continuing does not sign or submit the form."],
  [/^review form again$/i, "Return to the form text and questions before signing. This does not submit your signature."],
  [/^next artwork$/i, "Display the next piece in this portfolio. This does not save, share or contact the artist."],
  [/^previous artwork$/i, "Display the previous piece in this portfolio. You can also use the left and right arrow keys while the viewer is focused."],
  [/^add client$/i,'Open a client record form. Enter their name and contact details, then review the record before saving.'],
  [/^add service|^edit service/i,'Open the service editor to review its name, price, duration and number of sittings. These values feed booking availability and proposals.'],
  [/^add trip|^edit trip/i,'Open the trip editor to set the destination and date range. Saving a trip does not message clients or change working hours.'],
  [/^add template|^edit template/i,'Edit reusable message wording. Saving the template does not send a message.'],
  [/^add event|^create event/i,'Open the event details. Review format, dates, capacity, location and ticket price before publishing.'],
  [/show password|hide password/i,'Show or conceal the password in this field. This does not change the password itself.'],
  [/add session|remove session/i,'Change the sittings in this draft. Review the resulting dates and totals before sending the plan.'],

  [
    /^send message$/i,
    "Send the text currently in the message box to this conversation. Check the recipient and wording first; this is a real message.",
  ],
  [
    /attach photo|upload.*image|add.*photo/i,
    "Choose an image to share or upload. Review the selected file and destination before completing the upload.",
  ],
  [
    /^book$|new booking/i,
    "Open the booking planner. Choose the client and service, then review dates, estimate and deposit before sending a plan.",
  ],
  [
    /find available dates/i,
    "Ask the availability engine for dates using the selected service, working hours and spacing. Review the suggestions before sending.",
  ],
  [
    /choose dates? myself/i,
    "Enter the dates and times yourself. The review step lets you check every sitting before proposing the plan.",
  ],
  [
    /review proposal/i,
    "Review the complete set of sittings, estimate and deposit before sending anything to the client.",
  ],
  [
    /send.*(plan|proposal)/i,
    "Send this booking plan to the client. It is not a chat-only note; the client reviews it and completes the required confirmation and payment.",
  ],
  [
    /accept.*(plan|proposal)|confirm.*dates/i,
    "Review all proposed dates and amounts before accepting. Follow the displayed payment steps to secure the booking.",
  ],
  [
    /platform fee/i,
    "This is the platform fee included in the payment breakdown. Review the displayed total before paying.",
  ],
  [
    /^(pay(?:\s|$)|checkout|purchase(?:\s|$)|buy(?:\s|$)|continue to (?:payment|checkout))/i,
    "Open or authorise the payment described by this control. Check the final breakdown, platform fee and total first. The tour does not pay for you.",
  ],
  [
    /refund/i,
    "Open or confirm the refund described here. Review the refund preview and affected payments before authorising it.",
  ],
  [
    /reschedule/i,
    "Review replacement dates and any associated payment before submitting a rescheduling request.",
  ],
  [
    /cancel.*(booking|sitting|session|plan)/i,
    "Review the cancellation details before confirming. Cancelling and refunding are separate actions unless this screen explicitly combines them.",
  ],
  [
    /mark.*(arrived|complete)|client arrived/i,
    "Update the appointment’s recorded status only when it matches what has happened.",
  ],
  [
    /signature|sign form/i,
    "Add your own signature after reading the complete form. Submitting it records your agreement.",
  ],
  [
    /copy.*link|share.*link/i,
    "Copy or share the saved public link. Check that the saved artist or store details are correct first.",
  ],
  [
    /connect.*stripe|payment account|payments.*payouts/i,
    "Review the payment account setup. Complete Stripe’s required business, identity and bank checks; returning here alone does not mean verification is complete.",
  ],
  [
    /shopify|catalogue/i,
    "Use the connected Shopify workflow for catalogue and fulfilment changes. Review the store connection before importing or opening the external admin.",
  ],
  [
    /instagram/i,
    "Review the public account and import selection. Importing copies media into your portfolio; it is not proof of account ownership.",
  ],
  [
    /import/i,
    "Review the selected file or account, mapping and preview before importing records. Do not retry successful rows unnecessarily.",
  ],
  [
    /invit/i,
    "Review who you are inviting and their access before sending a studio invitation.",
  ],
  [
    /disconnect|delete|remove/i,
    "Read which item or connection this affects before confirming. The tour will never perform this action automatically.",
  ],
  [
    /save|update|publish/i,
    "Apply the changes described by this control after reviewing the relevant fields. Leaving the form is not a substitute for its save action.",
  ],
  [
    /log out|sign out/i,
    "Sign out of this account on this device. Finish or save any work you want to keep first.",
  ],
  [
    /password/i,
    "Use this account’s password controls. Never share your password or recovery link.",
  ],
  [
    /notification|this device/i,
    "Review notification preferences and this device’s permission. Browser or iOS settings may also need to allow notifications.",
  ],
  [
    /dark appearance/i,
    "Switch the app’s appearance for this device. This changes presentation, not your bookings or account records.",
  ],
  [
    /^back|^close|^cancel$|^done$/i,
    "Return or dismiss this view using the displayed control. Check for any unsaved edits before leaving.",
  ],
  [
    /next month|previous month|next week|previous week|^today$/i,
    "Move the calendar’s displayed date. This does not reschedule any appointment.",
  ],
  [
    /add session|remove session/i,
    "Change the sittings in this draft. Review the resulting dates and totals before sending the plan.",
  ],
];
export function describeControl(el: HTMLElement, surface: string) {
  if (el.dataset.tourDescription) return el.dataset.tourDescription;
  const label = controlLabel(el),
    role = el.getAttribute("role"),
    tag = el.tagName;
  const disabled = el.matches(":disabled,[aria-disabled=true]")
    ? " This control is currently unavailable. Check validation, loading status and the access available to this account."
    : "";
  const section = el.closest('section')?.querySelector('h2')?.textContent || '';
  let body: string;
  if (el.matches("h2,h3,.v3-facts,.v3-attention,[role=status],[role=alert]"))
    body = el.matches("[role=alert]")
      ? "Read this message before continuing. Resolve the issue or use the offered retry action; the guide does not change the underlying result."
      : describeSurface(label);
  else if (role === "tab")
    body = `Switch to ${label} within ${surface}. The guide will follow the controls in the selected section.`;
  else if (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    role === "switch" ||
    role === "radio" ||
    role === "slider"
  ) {
    const type = (el as HTMLInputElement).type;
    body =
      tag === "SELECT"
        ? `Choose ${label.toLowerCase()} from the available options.`
        : type === "radio" || role === "radio"
          ? `Select ${label.toLowerCase()}${el.closest("fieldset")?.querySelector("legend")?.textContent ? " for “" + el.closest("fieldset")!.querySelector("legend")!.textContent!.trim() + "”" : ""}. Choose the option that accurately answers this question; selecting it replaces the other choice in this group.`
        : type === "checkbox" || role === "switch"
          ? `Turn ${label.toLowerCase()} on or off. Review its current state before changing it.`
          : type === "file"
            ? `Choose the file required for ${label.toLowerCase()}. Review the file before using the upload or import action.`
            : type === "range" || role === "slider"
              ? `Adjust ${label.toLowerCase()} with the slider or arrow keys and check the displayed value.`
              : `Enter ${label.toLowerCase()} for ${surface.toLowerCase()}. Follow any format, limits and validation shown alongside the field.`;
  } else if (tag === "IFRAME")
    body =
      "Complete these provider-hosted fields yourself. Card and identity information stays inside the secure provider interface; review the total before authorising payment.";
  else if (tag === "VIDEO")
    body =
      "Use playback, sound and progress controls to inspect this video. Playback does not contact the artist or change a booking.";
  else if (tag === "CANVAS")
    body =
      "Draw your own signature here after reading the form. Use the clear control if you need to start again.";
  else if (el.hasAttribute("aria-expanded") || tag === "SUMMARY")
    body = `Expand or collapse ${label.toLowerCase()} to see its related details and actions. The guide follows the newly revealed controls.`;
  else if (el.matches('button.v3-row') && /Who are you booking/i.test(section)) body='Choose this client for the draft booking. Their saved record stays attached to the plan; you will choose the service and dates next.';
  else if (el.matches('button.v3-row') && /What are we planning/i.test(section)) body='Choose this saved service. Its duration, price and sitting count populate the draft; review them with the dates before sending.';
  else if (el.matches('button.v3-row') && surface==='Clients') body='Open this client’s record to review their contact details, appointments, forms and notes. The guide will include those controls when the record opens.';
  else
    body =
      actions.find(([pattern]) => pattern.test(label))?.[1] ||
      (tag === "A"
        ? `Open ${label} from ${surface}. Follow the destination’s guide for its available features.`
        : `Use ${label} in ${surface}. Review the information shown by this control before completing any change.`);
  return body + disabled;
}
