/** Guided actions on the real artist UI. External confirmations are the only simulated controls. */
export type PracticeTourStep = {
  title: string;
  body: string;
  target?: string;
  mutation?: string;
  simulation?:
    | "deposit"
    | "forms"
    | "balance"
    | "approve"
    | "decline"
    | "reference"
    | "offer";
  review?: boolean;
  route?: string;
};
const action = (
  title: string,
  target: string,
  body: string,
  mutation?: string
): PracticeTourStep => ({ title, target, body, mutation });
const review = (
  title: string,
  target: string,
  body: string,
  route?: string
): PracticeTourStep => ({ title, target, body, route, review: true });
const simulate = (
  title: string,
  simulation: PracticeTourStep["simulation"],
  body: string
): PracticeTourStep => ({ title, simulation, body });
const openTools = action(
  "Open the conversation tools",
  "^Conversation tools$",
  "Open the tools to book Alex in or create a promotion."
);
const wizard = (project = false): PracticeTourStep[] => [
  openTools,
  action(
    "Book from this conversation",
    "^Book in$",
    "Keep the proposal linked to Alex’s design discussion."
  ),
  action(
    "Choose your saved service",
    project ? "^Sleeve project" : "^Full-day tattoo",
    "Tap the service. Its duration, sitting count and price populate the wizard."
  ),
  ...(project
    ? [
        action(
          "Choose the sitting frequency",
          "^Weekly$",
          "Choose weekly sittings for this sleeve."
        ),
        action(
          "Find available dates",
          "^Find available dates$",
          "Available dates respect your working hours and existing bookings."
        ),
      ]
    : []),
  ...(!project
    ? [
        action(
          "Choose a future sitting date",
          "^Date$",
          "Choose a future weekday. Today already has a full-day sitting booked."
        ),
        action(
          "Set the full-day start time",
          "^Time$",
          "Set 09:00 in the time field so the eight-hour sitting fits your working day."
        ),
      ]
    : []),
  review(
    "Review the sitting details",
    "Session price",
    "Inspect the dates, duration, price and deposit. You can edit the fields before continuing."
  ),
  action(
    "Review the complete proposal",
    "^Review proposal$",
    "Use the wizard’s review action; invalid dates or amounts must be corrected here."
  ),
  action(
    "Send the proposal",
    "^Send proposal$",
    "Send the proposal so Alex can review the details and pay the deposit.",
    "sessionPlans.create"
  ),
  simulate(
    "Alex accepts and pays the deposit",
    "deposit",
    "Alex accepts the proposal and pays the deposit to confirm the booking."
  ),
  review(
    "See the confirmed booking",
    "Booking|Full-day|Sleeve|Alex",
    "Open Calendar or the project to see the same confirmed sitting and payment values.",
    "/calendar"
  ),
];
const offerBooking: PracticeTourStep[] = [
  simulate(
    "Alex asks to use the offer",
    "offer",
    "Alex chooses to use the offer. Gift cards become available to use after purchase."
  ),
  action(
    "Book using the offer",
    "^Book with this offer$",
    "Use the pinned offer card. Its pricing and eligibility carry into the wizard."
  ),
  action(
    "Choose an eligible service",
    "^Full-day tattoo",
    "Use your saved service and the promotion-aware date search."
  ),
  review(
    "Check the discounted proposal",
    "Session price",
    "Inspect the dates, offer adjustment and deposit before submitting."
  ),
  action(
    "Review the offer booking",
    "^Review proposal$",
    "Review the dates, pricing and deposit before sending."
  ),
  action(
    "Send the offer booking",
    "^Send proposal$",
    "The offer remains unconfirmed until the client deposit succeeds.",
    "sessionPlans.create"
  ),
  simulate(
    "Alex pays the deposit",
    "deposit",
    "The same booking, offer and payment records update across the app."
  ),
  review(
    "Review the confirmed offer booking",
    "Alex|Full-day|Booking",
    "Check the calendar and project.",
    "/calendar"
  ),
];
const promo = (fill = false, voucher = false): PracticeTourStep[] =>
  fill
    ? [
        action(
          "Open promotions",
          "Create a promotion|^Promotions$",
          "Open the Promotions manager from Today."
        ),
        action(
          "Create a promotion",
          "^Create promotion$",
          "Open the normal campaign editor."
        ),
        review(
          "Set the calendar offer terms",
          "^Name$",
          "Enter a name, value, eligible months and short book-by expiry in the form."
        ),
        action(
          "Save the promotion",
          "^Save promotion$",
          "Only the successful save completes this step.",
          "offers.save"
        ),
        action(
          "Choose the audience",
          "^Choose audience$",
          "Open the recipient picker."
        ),
        review(
          "Set filters and recipients",
          "^Audience$",
          "Select Match filters, then choose presets, birthday months or cities. Or manually select several clients."
        ),
        action(
          "Issue the offers",
          "^Add offers",
          "Check recipients and notification choices before using the send action.",
          "offers.issue"
        ),
        review(
          "Open Alex’s consultation",
          "Conversation tools|Alex",
          "Return to the message thread to continue the offer booking.",
          "/chat/1"
        ),
        ...offerBooking,
      ]
    : [
        openTools,
        action(
          "Create an offer for Alex",
          "^Create promo$",
          "Open the client-specific promotion flow."
        ),
        action(
          voucher ? "Choose a gift card" : "Choose a discount",
          voucher ? "^Sell a gift card" : "^Offer a discount",
          "Choose the offer type, using the same flow as a live client."
        ),
        review(
          "Edit the offer details",
          "Card title",
          "Set the value, card title, expiry and eligibility for Alex’s offer."
        ),
        action(
          "Preview the card",
          "^Preview$",
          "The form validates your terms before opening the review screen."
        ),
        action(
          "Send to Alex",
          "^Send to client$",
          "Both campaign save and issue must succeed. A failure keeps the form available for correction.",
          "offers.issue"
        ),
        action(
          "Return to the conversation",
          "^Done$",
          "Review the message thread and offer card."
        ),
        ...offerBooking,
      ];
export const PRACTICE_TOURS: Record<
  string,
  { route: string; steps: PracticeTourStep[] }
> = {
  enquiry: {
    route: "/conversations",
    steps: [
      action(
        "Open Alex’s conversation",
        "^Alex Taylor",
        "Alex has sent a booking enquiry. Open the conversation to discuss the design."
      ),
      action(
        "Write your reply",
        "^Message$|^Write a message",
        "Type a reply using the message composer."
      ),
      action(
        "Reply to the booking enquiry",
        "^Send message$",
        "Type a reply in the message composer asking about placement, size and style, then send it.",
        "messages.send"
      ),
      simulate(
        "Alex shares a reference",
        "reference",
        "Alex’s reference appears in Messages and Design & references."
      ),
      ...wizard(),
    ],
  },
  project: { route: "/chat/1", steps: wizard(true) },
  messages: {
    route: "/chat/1",
    steps: [
      action(
        "Write your reply",
        "^Message$|^Write a message",
        "Type a reply in the message composer."
      ),
      action(
        "Send Alex a message",
        "^Send message$",
        "Use the composer. Try text and a reference image.",
        "messages.send"
      ),
      review(
        "Review the conversation context",
        "Design brief|Client information|Conversation tools",
        "Review the brief, references and client history using the thread controls."
      ),
      openTools,
    ],
  },
  session: {
    route: "/projects/1?session=1",
    steps: [
      review(
        "Prepare for the full-day sitting",
        "Ready for the session|Payment received|Payment outstanding",
        "Open the sitting details and review Alex’s project, shared references and payment history."
      ),
      simulate(
        "Alex completes the forms",
        "forms",
        "Alex’s signed forms are available in the client record."
      ),
      action(
        "Finish the sitting",
        "^Finish session$|^Request remaining balance$",
        "Open the finish-session form."
      ),
      action(
        "Request the remaining balance",
        "Finish & request payment|Request payment",
        "Check the amount, then submit the form.",
        "appointments.update|dashboard.requestPayment|messages.requestBalance"
      ),
      simulate(
        "Alex pays the final balance",
        "balance",
        "The payment updates the sitting, project and earnings together."
      ),
      review(
        "Check the completed sitting",
        "completed|Payments|balance",
        "Review the project and payment records."
      ),
    ],
  },
  reschedule: {
    route: "/projects/1?session=1",
    steps: [
      action(
        "Reschedule this sitting",
        "^Reschedule$",
        "Open the reschedule form."
      ),
      review(
        "Choose a new available time",
        "New date",
        "Edit the date and time inputs. Existing payments stay linked to the sitting."
      ),
      action(
        "Save the new time",
        "Save new time|Review new time|Send.*approval",
        "The validation must succeed before the tutorial advances.",
        "appointments.reschedule"
      ),
      review(
        "Review the changed sitting",
        "Rescheduled|sitting|Alex",
        "See the updated date in the calendar and project.",
        "/calendar"
      ),
    ],
  },
  "promo-reschedule": {
    route: "/projects/1?session=1",
    steps: [
      action(
        "Move a promotional sitting",
        "^Reschedule$",
        "Open the date-change form."
      ),
      review(
        "Review the promotion terms",
        "New date|Keep.*promotion",
        "Choose an out-of-month date. Decide whether to keep the discount or ask Alex to approve revised terms."
      ),
      action(
        "Send the change for approval",
        "Send.*approval|Save new time|Review new time",
        "Submit the form and inspect any validation errors.",
        "appointments.reschedule"
      ),
      simulate(
        "Alex approves revised terms",
        "approve",
        "The original sitting stays booked until Alex accepts the revised terms."
      ),
      review(
        "Review updated records",
        "sitting|Payments|balance",
        "Check the project’s date and payment totals."
      ),
    ],
  },
  promotion: { route: "/chat/1", steps: promo() },
  "calendar-fill": { route: "/dashboard", steps: promo(true) },
  voucher: { route: "/chat/1", steps: promo(false, true) },
  today: {
    route: "/dashboard",
    steps: [
      review(
        "Your populated artist day",
        "Needs attention",
        "Review attention tasks, booked work and upcoming sittings."
      ),
      action(
        "Act on a follow-up",
        "Follow up",
        "Open the task in the message thread."
      ),
      action(
        "Send the follow-up",
        "^Send message$",
        "Edit and send the message.",
        "messages.send"
      ),
      review(
        "Review your week",
        "Next 7 days|Next seven|Booked work",
        "Check upcoming work and remaining balances.",
        "/dashboard"
      ),
    ],
  },
  clients: {
    route: "/clients",
    steps: [
      action(
        "Open Alex’s record",
        "^Alex Taylor",
        "Open the client record with history, contacts and references."
      ),
      review(
        "Review client history",
        "Session history|Client information|Notes",
        "Explore the record tabs and previous bookings."
      ),
      action("Open private notes", "^Notes$", "Open the client Notes tab."),
      action(
        "Save a private note",
        "^Add note$|^Save note$",
        "Write a note and submit the form.",
        "clientProfile.addClientNote"
      ),
    ],
  },
  availability: {
    route: "/work-hours",
    steps: [
      review(
        "Review working availability",
        "Monday|Mon|Availability",
        "Edit working-day, time and break controls."
      ),
      action(
        "Save working hours",
        "^Save hours$|^Save availability$|^Save schedule$",
        "Persist the schedule using the save action.",
        "artistSettings.upsert"
      ),
      action("Open services", "^Services$", "Use the services tab."),
      action(
        "Add a service",
        "^Add service$",
        "Open the normal editor and enter the service details."
      ),
      action(
        "Save the service",
        "^Save service$",
        "The service becomes available in the booking wizard.",
        "artistSettings.upsert"
      ),
    ],
  },
  waitlist: {
    route: "/waitlist",
    steps: [
      review(
        "Review the waitlist",
        "Alex|Sam|Waitlist",
        "Inspect the interested clients."
      ),
      action("Offer a time", "^Offer a time$", "Open the time-offer form."),
      review(
        "Set the sitting and offer expiry",
        "Offer date and time",
        "Edit the appointment time, estimate, deposit and expiry fields."
      ),
      action(
        "Send the offer",
        "^Send offer$",
        "The successful offer action saves the waitlist proposal.",
        "waitlist.offer"
      ),
    ],
  },
  forms: {
    route: "/settings?section=regulation",
    steps: [
      action(
        "Open your medical template",
        "^Medical$",
        "Use the form-management tabs."
      ),
      review(
        "Review the template wording",
        "Medical template",
        "Edit medical wording using the form."
      ),
      action(
        "Save the template",
        "^Save template$",
        "The save updates future forms only.",
        "forms.updateTemplates"
      ),
      simulate(
        "Alex signs the issued forms",
        "forms",
        "The client signature becomes visible in the project record."
      ),
      review(
        "Review signed forms",
        "Consent & medical forms|Client information",
        "Open Alex’s client record and Forms tab.",
        "/clients"
      ),
    ],
  },
  money: {
    route: "/money",
    steps: [
      review(
        "Review earnings",
        "Net|Income|earnings|Payments",
        "Track earnings and payments together, with links to each sitting."
      ),
      action(
        "Open payments",
        "Payments|Transactions|Income",
        "Inspect the transactions and project links."
      ),
      review(
        "Review a transaction",
        "Alex|Full-day|Deposit",
        "Check sitting, amount, fees and remaining balance in the financial view."
      ),
    ],
  },
  bank: {
    route: "/bank-payouts",
    steps: [
      action(
        "Set up payments",
        "^Set up payments$|^Review account details$",
        "Open payment setup to review your business, identity and bank details."
      ),
      action(
        "Complete verification",
        "^Complete verification$",
        "Complete verification to enable payments and payouts.",
        "artistSettings.submitStripeOnboarding"
      ),
      review(
        "Review payout readiness",
        "Payouts enabled|Payment account",
        "Check the connected-account status and payout controls."
      ),
    ],
  },
  profile: {
    route: "/artist-profile",
    steps: [
      review(
        "Edit your public profile",
        "Artist display name",
        "Use the display-name, website and visibility fields."
      ),
      action(
        "Save your public profile",
        "^Save public profile$",
        "The save updates your isolated profile.",
        "artistSettings.upsert"
      ),
      action(
        "Open your portfolio",
        "^Portfolio$",
        "Use the portfolio tab and its artwork."
      ),
      review(
        "Manage your portfolio",
        "Add to your portfolio|Add|Artwork",
        "Add artwork, arrange its order and remove images you no longer want to display."
      ),
    ],
  },
  imports: {
    route: "/settings?section=data-import",
    steps: [
      action(
        "Choose your client list",
        "^Choose client list$",
        "Open a client list to match its columns to your client records."
      ),
      review(
        "Review column mapping",
        "Name|Email",
        "Use the mapping controls and check each source column."
      ),
      action(
        "Review duplicates",
        "^Review matches & duplicates$",
        "The preview checks records.",
        "dataImport.preview"
      ),
      action(
        "Import ready rows",
        "^Import / retry",
        "Import the ready rows and review any records that need attention.",
        "dataImport.commit"
      ),
      review(
        "Check imported clients",
        "Casey|Clients|Search clients",
        "See the newly imported client in the client list.",
        "/clients"
      ),
    ],
  },
  supplies: {
    route: "/supplies",
    steps: [
      action(
        "Choose a supplier",
        "Practice|Demo|Supply|Supplier",
        "Browse a supplier’s products."
      ),
      action(
        "Choose a product",
        "Cartridge|Ink|Product",
        "Open the product detail and choose a variant and quantity."
      ),
      action("Add to cart", "Add to cart", "Use the cart action."),
      action("Open the cart", "Cart", "Review and adjust the cart quantities."),
      review(
        "Review checkout",
        "Checkout|Delivery",
        "Review delivery details, quantities and the total before checkout."
      ),
    ],
  },
  shopfront: {
    route: "/shopfront",
    steps: [
      action("Open products", "Products", "Use the artist shopfront controls."),
      action(
        "Create a product",
        "Add product|New product",
        "Open the product editor and use artwork."
      ),
      action(
        "Save the product",
        "Save|Create",
        "The mutation updates only the shopfront.",
        "storefront.createProduct"
      ),
      review(
        "Review shopfront visibility",
        "Publish|Unpublish|Product",
        "Use the publishing, event and order controls.",
        "/shopfront"
      ),
    ],
  },
  studio: {
    route: "/studio",
    steps: [
      review(
        "Name your studio",
        "Studio name",
        "Enter details in the studio-creation form."
      ),
      action(
        "Create the studio",
        "^Create studio$",
        "Create your studio to organise your team and shared workspace.",
        "studios.create"
      ),
      review(
        "Review team actions",
        "Invite|Team|Members|Studio",
        "Explore the studio controls, permissions and billing."
      ),
    ],
  },
  settings: {
    route: "/settings",
    steps: [
      action(
        "Open your account settings",
        "Account|Profile",
        "Use the settings navigation."
      ),
      review(
        "Edit account details",
        "Name|Phone|City",
        "Update your name, contact details and location."
      ),
      action(
        "Save your changes",
        "Save",
        "Persist the account using the submit action.",
        "auth.updateProfile|artistSettings.upsert"
      ),
      review(
        "Explore the other settings",
        "Notifications|Travel|Plans|Subscription",
        "Use the preference, travel, notification and plan pages.",
        "/settings"
      ),
    ],
  },
};
