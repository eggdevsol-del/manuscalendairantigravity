export type GuideRole = "artist" | "merchant" | "client";
export interface WorkflowGuide {
  id: string;
  title: string;
  role: GuideRole;
  route: string;
  pages: string[];
  steps: { title: string; body: string }[];
}
const guide = (
  id: string,
  title: string,
  role: GuideRole,
  route: string,
  pages: string[],
  steps: [string, string][]
): WorkflowGuide => ({
  id,
  title,
  role,
  route,
  pages,
  steps: steps.map(([title, body]) => ({ title, body })),
});
export const WORKFLOW_GUIDES: WorkflowGuide[] = [
  guide(
    "artist-start",
    "Get ready for your first request",
    "artist",
    "/dashboard",
    ["Today"],
    [
      [
        "Make your profile recognisable",
        "Add your name, photo and location in Business. Open Profile & booking link to check what clients see.",
      ],
      [
        "Set your working hours and services",
        "Set the times you work and the services you offer. Check durations and prices before sending a proposal.",
      ],
      [
        "Connect payments",
        "Complete bank payout setup. Returning from Stripe does not itself mean verification is complete; check the account status.",
      ],
      [
        "Share your booking link",
        "Copy the link from your profile. A client can complete the request in a browser and create their password afterwards. Check Today and Inbox for their enquiry.",
      ],
    ]
  ),
  guide(
    "artist-day",
    "Run your working day",
    "artist",
    "/dashboard",
    ["Today", "Calendar"],
    [
      [
        "Check today's sessions",
        "Review the clients, times and payment flags in Today. Open Calendar for the full schedule.",
      ],
      [
        "Work through Needs you",
        "Expand a task and choose its action. Reply to enquiries and resolve outstanding deposits before doing routine follow-ups.",
      ],
      [
        "Keep the project together",
        "Open the client conversation and choose Project for the original brief, sessions, forms and payment history.",
      ],
      [
        "Finish the appointment",
        "Use the appointment actions to record arrival and complete the balance workflow. Check the confirmed result before treating a payment as received.",
      ],
    ]
  ),
  guide(
    "artist-enquiry",
    "Turn an enquiry into a booking",
    "artist",
    "/conversations",
    ["Inbox", "Messages", "Conversations", "Project"],
    [
      [
        "Read the request",
        "Open the conversation and review the brief and reference images. Ask for missing information in the same thread.",
      ],
      [
        "Agree the work",
        "Discuss the design, placement, timing and estimate. Keep changes in the conversation so the client has a clear record.",
      ],
      [
        "Propose sessions",
        "Use Book in the conversation. Select a service, session frequency and available dates, then review the price and deposit.",
      ],
      [
        "Send and check the outcome",
        "Send the proposal once. The client reviews it and pays through the custom checkout. Check the resulting session and payment status in Project.",
      ],
    ]
  ),
  guide(
    "artist-calendar",
    "Plan and change appointments",
    "artist",
    "/calendar",
    ["Calendar"],
    [
      [
        "Find the right date",
        "Use the date strip and calendar views to inspect existing sessions before arranging a new booking.",
      ],
      [
        "Open the session",
        "Review its client, time and payment details. Open the linked conversation if you need to agree a change.",
      ],
      [
        "Reschedule deliberately",
        "Choose the reschedule action and an available time. Review the new date before saving, then check the updated session.",
      ],
      [
        "Handle cancellations",
        "Use the cancellation action for the selected appointment. Review any deposit or refund implications separately; cancelling a date is not proof of a refund.",
      ],
    ]
  ),
  guide(
    "artist-clients",
    "Manage clients and project history",
    "artist",
    "/clients",
    ["Clients"],
    [
      [
        "Find your client",
        "Search your client directory and open the matching record. Check the identity before adding or editing information.",
      ],
      [
        "Review the relationship",
        "Use the client record for previous sessions and notes. Use Project in the conversation for the current brief, forms and payments.",
      ],
      [
        "Continue the conversation",
        "Message the client from their record to arrange further work. Keep personal notes separate from messages intended for the client.",
      ],
    ]
  ),
  guide(
    "artist-profile",
    "Profile, portfolio and booking link",
    "artist",
    "/artist-profile",
    ["Profile", "Portfolio", "Booking Link", "Booking link"],
    [
      [
        "Review your public profile",
        "Check your display name, bio, location and portfolio as a client would see them.",
      ],
      [
        "Edit and save",
        "Use Edit profile to make changes. Add relevant portfolio work and wait for uploads to finish before leaving.",
      ],
      [
        "Check your booking form",
        "Review the booking-link settings and the questions clients see. Keep the information needed to assess a request clear.",
      ],
      [
        "Share the public link",
        "Copy your booking link and open it in a signed-out browser to check the client journey. Clients do not need to install the app.",
      ],
    ]
  ),
  guide(
    "artist-hours",
    "Set availability and services",
    "artist",
    "/work-hours",
    ["Work Hours", "Work Hours & Services", "Availability"],
    [
      [
        "Set your weekly hours",
        "Choose the days and working windows you want to offer. Check the business timezone when reviewing dates.",
      ],
      [
        "Define services",
        "Give each service a clear name, duration, price and session count. Decide whether it should appear in the booking form.",
      ],
      [
        "Check before sharing",
        "Save changes, then review availability in a booking proposal. Existing appointments still need to be managed individually.",
      ],
    ]
  ),
  guide(
    "artist-payments",
    "Deposits, balances and payouts",
    "artist",
    "/bank-payouts",
    ["Bank & Payouts", "Bank Payouts", "Payouts", "Money", "Payment history"],
    [
      [
        "Check payment readiness",
        "Complete Stripe setup and review any outstanding account requirements.",
      ],
      [
        "Request a deposit",
        "Use the booking proposal or payment action in the client conversation. Review the amount and fees before sending.",
      ],
      [
        "Collect the balance",
        "Open the appointment's balance workflow and check recorded payments first. Cash or bank-transfer claims may require verification.",
      ],
      [
        "Reconcile the result",
        "Use Project for the session ledger and the money screen for business totals. A pending balance is not the same as money available for payout.",
      ],
    ]
  ),
  guide(
    "artist-plan",
    "Choose and manage your plan",
    "artist",
    "/subscriptions",
    ["Subscriptions", "Your plan", "Plans"],
    [
      [
        "Compare costs",
        "Review the current Free, Pro and Studio terms and the artist fee for each. Choose based on your business volume and team needs.",
      ],
      [
        "Review checkout",
        "Check the recurring amount and billing terms in the in-app checkout before confirming.",
      ],
      [
        "Confirm activation",
        "Wait for the subscription status to update. If you close checkout or a payment fails, check the status before retrying.",
      ],
      [
        "Manage billing",
        "Use the subscription management controls for billing changes and cancellation. Review when the change takes effect.",
      ],
    ]
  ),
  guide(
    "artist-notifications",
    "Set useful reminders",
    "artist",
    "/settings?section=notifications",
    ["Notifications", "Notifications Management"],
    [
      [
        "Choose your automation mode",
        "Review the notification settings before enabling automated outreach. Keep appointment and payment messages clear.",
      ],
      [
        "Set quiet hours",
        "Choose when routine notifications should stay quiet. Review the message templates and timing for your workflow.",
      ],
      [
        "Check delivery",
        "Enable browser or device permissions if you want push alerts. Use the test control for your own device and check the result.",
      ],
      [
        "Maintain templates",
        "Review each template before saving. Keep dates, amounts and instructions accurate; avoid adding promotional text to essential booking updates.",
      ],
    ]
  ),
  guide(
    "artist-import",
    "Import existing clients",
    "artist",
    "/settings?section=data-import",
    ["Import your data"],
    [
      [
        "Prepare the file",
        "Use the supported CSV format and check names and contact information before uploading.",
      ],
      [
        "Review the preview",
        "Inspect column matches, invalid rows and duplicate matches. Correct the file or selections before committing the import.",
      ],
      [
        "Import and reconcile",
        "Run the import, review the result and retry only failed rows as appropriate. Verify a sample of records in Clients.",
      ],
    ]
  ),
  guide(
    "artist-forms",
    "Prepare appointment forms",
    "artist",
    "/settings?section=regulation",
    ["Regulation & Forms"],
    [
      [
        "Review your requirements",
        "Check the available form settings and requirements for your practice before accepting appointments.",
      ],
      [
        "Check each session",
        "Open Project to see forms linked to each booked session and whether the client has completed them.",
      ],
      [
        "Resolve missing forms",
        "Ask the client to complete outstanding forms through the appointment flow. Review the signed result before proceeding with the session.",
      ],
    ]
  ),
  guide(
    "artist-travel",
    "Plan travel dates",
    "artist",
    "/settings?section=travel",
    ["Travel Dates"],
    [
      [
        "Add your travel period",
        "Enter the destination and dates for a guest spot or travel period.",
      ],
      [
        "Check the details",
        "Review the location and date range before saving. Check any sessions already arranged during the period.",
      ],
      [
        "Communicate changes",
        "Confirm the location with affected clients in their conversations and review their appointment details.",
      ],
    ]
  ),
  guide(
    "artist-consultations",
    "Arrange a consultation",
    "artist",
    "/settings?section=consultations",
    ["Consultations"],
    [
      [
        "Review the request",
        "Check what the client wants to discuss and whether you need more reference material.",
      ],
      [
        "Arrange the consultation",
        "Use the consultation controls to propose the details. Review the client and timing before sending.",
      ],
      [
        "Record the outcome",
        "Keep the agreed design and next steps in the conversation, then send a session proposal when ready.",
      ],
    ]
  ),
  guide(
    "artist-instagram",
    "Import portfolio work",
    "artist",
    "/settings?section=instagram",
    ["Instagram Import", "Instagram"],
    [
      [
        "Choose your account",
        "Enter the Instagram profile you want to import work from. Import only work you have permission to use.",
      ],
      [
        "Start the import",
        "Choose the offered import options and start once. Let the import process finish before starting another.",
      ],
      [
        "Review the portfolio",
        "Check imported items and playback in your profile. Remove unsuitable work and use the original Instagram page if an item is unavailable.",
      ],
    ]
  ),
  guide(
    "artist-studio",
    "Manage a studio team",
    "artist",
    "/studio",
    ["Studio", "Studio Dashboard"],
    [
      [
        "Check studio access",
        "Review your studio membership and subscription status before inviting a team.",
      ],
      [
        "Invite artists",
        "Use the team controls to invite the intended artists. Confirm their membership state before relying on shared scheduling.",
      ],
      [
        "Review the team calendar",
        "Use the shared calendar to coordinate availability. Keep private client information within the access available to your role.",
      ],
      [
        "Manage departures",
        "Review the effect of removing a member before confirming. Check studio appointments and ownership responsibilities afterwards.",
      ],
    ]
  ),
  guide(
    "artist-supplies",
    "Order and track supplies",
    "artist",
    "/supplies",
    ["Supplies", "Supply orders"],
    [
      [
        "Choose your supplier",
        "Open a linked supplier or browse the available stores. Review the product and variant carefully.",
      ],
      [
        "Review checkout",
        "Check quantity, delivery or pickup, shipping costs and the order total before paying.",
      ],
      [
        "Track your order",
        "Open supply order history for confirmed orders and fulfilment status. Contact the supplier for delivery questions.",
      ],
    ]
  ),
  guide(
    "supplier-start",
    "Set up your supplier business",
    "merchant",
    "/settings",
    ["Your store", "Store settings"],
    [
      [
        "Save business details",
        "Enter your business name, contact details and address in Store settings. Check the public-facing information.",
      ],
      [
        "Connect Stripe",
        "Complete Payments and payouts setup, then use Check status. Resolve verification requirements before expecting payments.",
      ],
      [
        "Add your first product",
        "Open Products and add a title, description, price, available stock and fulfilment method.",
      ],
      [
        "Review the store",
        "Check the catalogue and customer-facing details. Return to Your store to monitor paid orders ready to fulfil.",
      ],
    ]
  ),
  guide(
    "supplier-products",
    "Create and edit products",
    "merchant",
    "/merchant/products",
    ["Products"],
    [
      [
        "Add or find a product",
        "Use Add product for a new item, or search and open an existing product to edit it.",
      ],
      [
        "Describe the item",
        "Set a clear title, description and image. Check the price, stock, fulfilment method and shipping charge.",
      ],
      [
        "Review variants",
        "For products with variants, check each option's price and available stock so customers select the correct item.",
      ],
      [
        "Save and verify",
        "Save once and wait for confirmation. Check the updated product in the list; use its active setting to control availability.",
      ],
    ]
  ),
  guide(
    "supplier-orders",
    "Fulfil a paid order",
    "merchant",
    "/merchant/orders",
    ["Orders"],
    [
      [
        "Start with To fulfil",
        "The default list focuses on paid orders. Search by order number or customer to find a particular purchase.",
      ],
      [
        "Review the order",
        "Check the purchased items, quantities, variants and delivery or pickup details. Use the order snapshot rather than current catalogue prices.",
      ],
      [
        "Prepare the order",
        "Pack the correct items and arrange the promised delivery or collection. Do not treat a pending checkout as a paid order.",
      ],
      [
        "Record fulfilment",
        "Use the fulfilment control after the order is fulfilled. Check it appears under Fulfilled; use All orders when investigating another status.",
      ],
    ]
  ),
  guide(
    "supplier-shopify",
    "Import a Shopify catalogue",
    "merchant",
    "/merchant/products",
    ["Products", "Store settings"],
    [
      [
        "Open the Shopify integration",
        "Use the Shopify controls in Products or Store settings. Review the supported connection method.",
      ],
      [
        "Import carefully",
        "Enter the requested shop information and start the import once. Review any errors before retrying.",
      ],
      [
        "Review local stock",
        "Check imported products and variants. Catalogue imports preserve local stock for existing items; do not assume two-way inventory synchronisation.",
      ],
      [
        "Check order handoff",
        "If your integration offers order handoff, review its status separately. A catalogue import alone does not prove an order reached Shopify.",
      ],
    ]
  ),
  guide(
    "supplier-messages",
    "Handle customer questions",
    "merchant",
    "/conversations",
    ["Inbox", "Messages", "Conversations"],
    [
      [
        "Open the conversation",
        "Read the customer's question and identify the relevant order or product.",
      ],
      [
        "Check the record",
        "Use Orders or Products to confirm payment, fulfilment or availability before replying.",
      ],
      [
        "Reply clearly",
        "Keep instructions and expected delivery or collection details in the conversation. Record fulfilment in Orders when complete.",
      ],
    ]
  ),
  guide(
    "supplier-account",
    "Account and notification settings",
    "merchant",
    "/account-settings",
    ["Settings", "Notifications"],
    [
      [
        "Review your account",
        "Open Account, notifications and sign out from Store settings to manage your personal account.",
      ],
      [
        "Choose notifications",
        "Review notification preferences and device permissions. Check a test alert on your own device if the control is available.",
      ],
      [
        "Keep access secure",
        "Use password recovery if needed and sign out on shared devices. Update business contact details in Store settings separately.",
      ],
    ]
  ),
  guide(
    "client-project",
    "Follow your tattoo booking",
    "client",
    "/bookings",
    ["Bookings", "Project"],
    [
      [
        "Find your request",
        "Open Inbox for enquiries still in discussion. Accepted sessions and pending proposals appear in Bookings.",
      ],
      [
        "Review your project",
        "Open Project from your artist conversation for your brief, sessions, forms and payment history.",
      ],
      [
        "Complete the next step",
        "Review the proposal, pay the requested deposit and complete forms when available. Check the confirmed status afterwards.",
      ],
      [
        "Return whenever you need",
        "Save the project link. It opens directly on your signed-in device; sign in first on another device. Installation is optional.",
      ],
    ]
  ),
];
export function guidesForRole(role: string | undefined) {
  const effectiveRole = role === "admin" ? "artist" : role;
  return WORKFLOW_GUIDES.filter(g => g.role === effectiveRole);
}
