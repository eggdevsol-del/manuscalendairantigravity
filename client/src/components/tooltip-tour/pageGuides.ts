/** Curated page copy: feature, behaviour and benefit. Never inspect input values. */
export type PageGuide = { pages: RegExp; steps: [RegExp, string, string][] };
export const PAGE_GUIDES: PageGuide[] = [
  {
    pages: /^Tattoo project$/,
    steps: [
      [
        /Next sitting|sittings completed|sittings complete/i,
        "See where the project stands",
        "Check the next appointment and completed sittings before planning remaining work.",
      ],
      [
        /Design & references/,
        "Prepare from shared information",
        "Find the conversation’s reference images and project design information together.",
      ],
      [
        /Payments/,
        "Check the account before collecting",
        "Review recorded payments and the remaining balance before requesting more money.",
      ],
    ],
  },
  {
    pages: /New booking|Book in|Booking planner/,
    steps: [
      [
        /service/i,
        "Start with your saved service",
        "Sitting count, duration and price carry into the proposal, reducing repeated admin.",
      ],
      [
        /Start looking|completed by|frequency/i,
        "Find dates that fit the project",
        "Use availability, the finish-by deadline and any promotional date limits. Check gaps before agreeing the plan.",
      ],
      [
        /Review|Send proposal/,
        "Review every sitting before sending",
        "Check all dates, the project total and deposit. Sending the proposal does not confirm receipt of payment.",
      ],
    ],
  },
  {
    pages: /Sitting details|Session details|Reschedule session|Finish session/,
    steps: [
      [
        /Forms|balance|Payment/i,
        "Check sitting readiness",
        "Review required records and recorded payments for this specific sitting.",
      ],
      [
        /Keep.*promotion|Review new time|Save new time|Send.*approval/i,
        "Agree any change in promotional terms",
        "Existing payments stay linked to the sitting. If moving outside eligible dates removes a discount, the client must approve the revised terms; the original sitting remains booked while approval is pending.",
      ],
      [
        /Finish|Complete/,
        "Keep the sitting status accurate",
        "Record the work completed and follow the remaining-payment flow.",
      ],
    ],
  },
  {
    pages: /Checkout|Pay deposit|Payment request|Pay balance/,
    steps: [
      [
        /Summary|Total|Deposit|Balance|Amount/i,
        "Review what you are paying",
        "Check the appointment, applied offer and amount due before paying.",
      ],
      [
        /Pay|Confirm/i,
        "Wait for confirmed payment",
        "Use the confirmed payment and booking status to verify completion. An unfinished checkout does not secure an appointment.",
      ],
    ],
  },
  {
    pages: /Booking enquiry|Public artist|Public studio/,
    steps: [
      [
        /Portfolio|Artwork|Work/,
        "Choose an artist for your idea",
        "Review examples and public details before enquiring.",
      ],
      [
        /Enquire|Book|Request/,
        "Give the artist useful context",
        "Share your idea, placement and references so the artist can assess your request.",
      ],
    ],
  },
  {
    pages: /Your booking link|Public booking link/,
    steps: [
      [
        /Copy|Share|link/i,
        "Make enquiries easy to start",
        "Share your saved public booking link so prospective clients can send the information you need.",
      ],
    ],
  },

  {
    pages: /^Today$/,
    steps: [
      [
        /Needs attention/,
        "Know what needs you next",
        "Follow up enquiries and appointment tasks here to keep conversations moving towards booked work.",
      ],
      [
        /Next 7 days|Booked work estimate/,
        "Plan your week",
        "Review upcoming sittings and the booked-work estimate together, while keeping the amount still to collect in view.",
      ],
      [
        /Promotions|Create promo/,
        "Make room for new work",
        "Create a calendar-filling promotion or gift voucher, then choose the clients you want to reach.",
      ],
      [
        /Supplies/,
        "Prepare for booked work",
        "Check incoming orders and review reorder recommendations against what your upcoming work needs.",
      ],
    ],
  },
  {
    pages: /^Calendar$/,
    steps: [
      [
        /New booking/,
        "Build a clear proposal",
        "Use your saved services and availability, then review every sitting and its cost before sending.",
      ],
      [
        /Today/,
        "Move through your schedule",
        "Use the date controls to browse your schedule. Today brings you back to the current date.",
      ],
      [
        /Sitting|Session|No sessions|No sittings/,
        "See the work ahead",
        "Open a sitting to review its client, payments and forms before making changes.",
      ],
    ],
  },
  {
    pages: /^Clients$|^Client records$/,
    steps: [
      [
        /Search|Find/,
        "Find the right client",
        "Search your records before booking or following up, so you pick up the right relationship.",
      ],
      [
        /Add client|New client/,
        "Keep client details together",
        "Save contact details for future work. Review a client’s bookings and notes when they return.",
      ],
    ],
  },
  {
    pages: /^Messages$|^Conversations$/,
    steps: [
      [
        /Search|Find/,
        "Pick up the conversation",
        "Find a client’s thread to review the discussion and shared booking details.",
      ],
      [
        /./,
        "Keep enquiries moving",
        "Open a conversation to reply, share references and agree the next step towards a booking.",
      ],
    ],
  },
  {
    pages: /^Message thread$/,
    steps: [
      [
        /Write a message|Message/,
        "Keep the consultation together",
        "Discuss design and pricing here. Explicit booking and payment confirmation keep an agreement separate from an informal chat.",
      ],
      [
        /Attach|photo|image/i,
        "Prepare from shared references",
        "Share reference images beside the discussion. These also appear in Design & references.",
      ],
      [
        /Conversation tools/,
        "Turn a conversation into work",
        "Artists can book in or create a promotion for this client. Clients can review shared project and booking information.",
      ],
      [
        /Read|Sent/,
        "Know whether it was viewed",
        "Read confirms that the recipient viewed the message. It does not confirm agreement to a booking or price.",
      ],
    ],
  },
  {
    pages: /^Business$/,
    steps: [
      [
        /LAST 30 DAYS|Last 30 days|Net earnings/,
        "Spot your trading pattern",
        "Compare daily net earnings with the period’s total to see stronger and quieter days. Earnings and bank payouts are different stages of your money.",
      ],
      [
        /Services & availability/,
        "Set up your working day",
        "Keep services and working hours accurate so proposals reuse consistent prices and feasible dates.",
      ],
      [
        /Profile & portfolio/,
        "Help clients choose your work",
        "Keep your public examples and details current so clients can send more useful enquiries.",
      ],
    ],
  },
  {
    pages: /^Money$|^Income & payouts$/,
    steps: [
      [
        /Your balance/,
        "Understand your cash flow",
        "Available and pending funds describe different stages before money reaches your bank.",
      ],
      [
        /Earnings/,
        "See what your work earned",
        "Review the period’s recorded earnings separately from bank transfers.",
      ],
      [
        /Recent transactions/,
        "Check the records behind the totals",
        "Use individual transactions when reconciling payments or investigating a balance.",
      ],
    ],
  },
  {
    pages: /^Bank & payouts$/,
    steps: [
      [
        /Get paid for your work|Your payment account/,
        "Set up payments in Tattoi",
        "Connect your payment account and complete Stripe’s identity and bank checks. Payments and payouts have separate readiness requirements.",
      ],
      [
        /Bank balance/,
        "Know what can reach your bank",
        "Available funds can be paid out; pending funds still need to settle.",
      ],
      [
        /Payout schedule/,
        "Plan around your payouts",
        "Review when available funds are transferred. Bank arrival can take additional time.",
      ],
    ],
  },
  {
    pages: /Payment history|Payout history|Payments & refunds/,
    steps: [
      [
        /Search|Filter|Payments|Transactions/,
        "Identify the right payment",
        "Review the original transaction and its booking before following up or refunding.",
      ],
      [
        /Refund/,
        "Review before returning money",
        "Check the transaction and remaining refundable amount before confirming.",
      ],
    ],
  },
  {
    pages: /Working hours|Services & availability|Services$/,
    steps: [
      [
        /Services|Add service/,
        "Quote consistently",
        "Save sitting duration, count and price. Proposals reuse these details instead of rebuilding each project.",
      ],
      [
        /Working|Monday|Work days/,
        "Protect your availability",
        "Set work days, hours and breaks so automatic date finding can propose feasible sittings.",
      ],
      [
        /Time off|Personal|Design day/,
        "Make unavailable time explicit",
        "Record time away before proposing new work.",
      ],
    ],
  },
  {
    pages: /Profile & portfolio|Artist profile|Portfolio/,
    steps: [
      [
        /Portfolio|Add photo|Upload/,
        "Show the work you want to book",
        "Use relevant examples to help clients judge whether your style fits their idea.",
      ],
      [
        /Public|Personal|Business|Edit/,
        "Set expectations before an enquiry",
        "Keep your location and public details accurate.",
      ],
    ],
  },
  {
    pages: /^Supplies$/,
    steps: [
      [
        /Search|Suppliers/,
        "Find your supplies",
        "Browse supplier stores and their available catalogue.",
      ],
      [
        /Recommended|Reorder/,
        "Start from your ordering history",
        "Review suggested items and quantities against your current needs before adding them to your order.",
      ],
      [
        /Cart/,
        "Review before checkout",
        "Check exact variants, quantities, delivery and total before payment.",
      ],
    ],
  },
  {
    pages: /Supply orders|Order history|Purchases/,
    steps: [
      [
        /Search|Order status|Orders|Purchases/,
        "Keep track of your purchases",
        "Review recorded orders or registrations and their current status.",
      ],
      [
        /Order|Registration|Details/,
        "Follow up with the right details",
        "Open a record to check items and the available fulfilment information.",
      ],
    ],
  },
  {
    pages: /^Shopfront$/,
    steps: [
      [
        /Products/,
        "Offer more than appointments",
        "Manage the products clients can buy alongside your tattoo work.",
      ],
      [
        /Orders/,
        "Keep fulfilment visible",
        "Review items, customer details and the work still needed to deliver an order.",
      ],
      [
        /Events/,
        "Share your expertise",
        "Manage seminars or events with clear dates, capacity and pricing.",
      ],
    ],
  },
  {
    pages: /^Products$|Catalogue|Catalogue & stock/,
    steps: [
      [
        /Search|Products|Catalogue/,
        "Review your catalogue",
        "Check imported or saved products before making them available.",
      ],
      [
        /Stock|Availability|Publish/,
        "Sell what you can supply",
        "Keep product availability aligned with what you can deliver.",
      ],
      [
        /Shopify/,
        "Maintain your source store",
        "Suppliers manage product information through the supported Shopify workflow.",
      ],
    ],
  },
  {
    pages: /^Orders$|Store orders/,
    steps: [
      [
        /Order status|Search/,
        "Focus on the next fulfilment task",
        "Filter orders to the stage you need to work on.",
      ],
      [
        /Order|Items|Delivery/,
        "Check the complete order",
        "Review items, quantities and delivery information before fulfilment.",
      ],
    ],
  },
  {
    pages: /Events|Seminars/,
    steps: [
      [
        /Create|New event|Add event/,
        "Make the event clear",
        "Explain what attendees receive, when it takes place and how many places are available.",
      ],
      [
        /Registrations|Capacity|Price/,
        "Plan around confirmed places",
        "Review pricing and registrations against the event you can deliver.",
      ],
    ],
  },
  {
    pages: /Studio/,
    steps: [
      [
        /Schedule|Calendar/,
        "Coordinate your team",
        "Review shared work while keeping individual bookings identifiable.",
      ],
      [
        /Your team|Invite an artist|Invitations/,
        "Manage workspace membership",
        "Review members, invitations and access before making changes.",
      ],
      [
        /Studio membership/,
        "Understand studio billing",
        "Review membership separately from individual bookings.",
      ],
    ],
  },
  {
    pages: /Waitlist|Cancellation offers/,
    steps: [
      [
        /Join|Waiting|Waitlist|Clients/,
        "Recover available appointment time",
        "Artists can match an opening with interested clients. Clients can register interest in an earlier sitting.",
      ],
      [
        /Offer|Expiry|Accept/,
        "Make the booking explicit",
        "Check the date, response deadline and payment requirements. Interest alone does not confirm the sitting.",
      ],
    ],
  },
  {
    pages: /Promotions|Create promo|Create offer|Edit offer/,
    steps: [
      [
        /Offer type|Value type|Discount|Gift voucher/,
        "Choose the right offer",
        "Use a discount to encourage eligible bookings or a purchased voucher that the client can redeem.",
      ],
      [
        /month|duration|expiry|expires/i,
        "Set two clear limits",
        "Eligible months control when the tattoo work can occur. Offer duration controls how long clients have to take the offer.",
      ],
      [
        /Audience|Who is this for|Choose filters|clients/i,
        "Reach the right clients",
        "Choose individual clients or preset filters to match the audience to your offer.",
      ],
      [
        /Preview|Background image|Create|Save/,
        "Review what clients will see",
        "Check the image, value and terms before making the offer available. Deposit payment confirms the booking.",
      ],
    ],
  },
  {
    pages: /My Tattoos|^Bookings$/,
    steps: [
      [
        /Next sitting|Upcoming/,
        "Know your next appointment",
        "Check the date and current status without searching messages.",
      ],
      [
        /Your projects/,
        "Keep each tattoo organised",
        "Open a project for its sittings, references, forms and payments.",
      ],
      [
        /Proposals|Offers|Requests/,
        "Review before confirming",
        "Check dates, eligibility and the amount due before accepting a proposal.",
      ],
    ],
  },
  {
    pages: /^Discover$|^Artist artwork$/,
    steps: [
      [
        /video|artwork|artist/i,
        "Find work that fits your idea",
        "Explore artist portfolios and review their details before enquiring.",
      ],
      [
        /promotion|offer/i,
        "Check an offer before using it",
        "Review value, expiry and eligible dates before asking the artist to apply it.",
      ],
    ],
  },
  {
    pages: /^Your profile$|^Your consent forms$|^Profile$/,
    steps: [
      [
        /Personal details|Edit/,
        "Keep your details current",
        "Accurate information helps your artist prepare for your appointment.",
      ],
      [
        /Forms|documents/i,
        "Prepare before the sitting",
        "Review the forms connected to your tattoo work and complete those requested.",
      ],
    ],
  },
  {
    pages: /^Home$/,
    steps: [
      [
        /Needs you/,
        "See what needs action",
        "Review orders awaiting fulfilment and products requiring stock attention.",
      ],
      [
        /Tattoi sales/,
        "Understand this sales channel",
        "Review sales recorded through Tattoi separately from your other channels.",
      ],
      [
        /Publish|Unpublish/,
        "Control when your store goes live",
        "Prepare and review your catalogue before making the store available to artists.",
      ],
    ],
  },
  {
    pages: /Store settings|Shopify/,
    steps: [
      [
        /Shopify|Import/,
        "Bring your catalogue into Tattoi",
        "Connect or import your source store, then review the result before publishing.",
      ],
      [
        /Payments|payouts/i,
        "Check payment readiness",
        "Complete the required payment-account setup before relying on online orders.",
      ],
    ],
  },
  {
    pages: /Import|Data import/,
    steps: [
      [
        /file|CSV|mapping/i,
        "Match the right information",
        "Map source fields to the correct clients, dates and services before importing.",
      ],
      [
        /Preview|Review/,
        "Check before applying",
        "Review the imported information and conflicts to avoid assigning data incorrectly.",
      ],
      [
        /Result|Imported|Complete/,
        "Review what needs attention",
        "Check the result and resolve any items that could not be imported.",
      ],
    ],
  },
  {
    pages: /Travel|Guest spots/,
    steps: [
      [
        /Dates|Destination|Add|Create/,
        "Plan where you will work",
        "Record trip dates and destinations alongside your schedule.",
      ],
      [
        /Nearby|Clients/,
        "Review clients near your trip",
        "Use relevant client information when planning work in another location.",
      ],
    ],
  },
  {
    pages: /Consultation|Requests/,
    steps: [
      [
        /References|Request|Details/,
        "Understand the enquiry",
        "Review the idea and reference images before replying.",
      ],
      [
        /Message|Conversation/,
        "Agree the next step together",
        "Continue design, pricing and booking discussions in the shared thread.",
      ],
    ],
  },
  {
    pages: /Notification/,
    steps: [
      [
        /Enable|permission|device/i,
        "Receive updates on this device",
        "Device permission is required for supported notifications while the app is not open.",
      ],
      [
        /Templates|Preferences|Reminders/,
        "Make communication intentional",
        "Save reusable wording and choose notification preferences. Saving a template does not send a message.",
      ],
    ],
  },
  {
    pages: /Your plan|Subscription/,
    steps: [
      [
        /Current|Your plan|Free|Pro/,
        "Choose a plan for how you work",
        "Review included features and fees against your actual use of Tattoi.",
      ],
      [
        /billing|Manage/i,
        "Keep control of billing",
        "Review your subscription through the available billing controls.",
      ],
    ],
  },
  {
    pages: /Consent|Procedure|Medical|Forms/,
    steps: [
      [
        /Forms|Templates|Medical|Consent/,
        "Prepare the correct records",
        "Check which information and forms are required for the client and sitting.",
      ],
      [
        /Signature|Submit|Sign/,
        "Review before signing",
        "Read the information and verify the details before submitting a signed record.",
      ],
    ],
  },
  {
    pages: /^Settings$|Account settings|Account details/,
    steps: [
      [
        /account|Personal|Profile/i,
        "Keep account information accurate",
        "Review your contact information so important account communication reaches you.",
      ],
      [
        /Notifications/,
        "Set up this device",
        "Choose the available notification preferences and check device permission.",
      ],
      [
        /Dark appearance|Appearance|Help|Guides/,
        "Make the app work for you",
        "Choose your appearance and replay page guides whenever you need a refresher.",
      ],
    ],
  },
  {
    pages: /Operations/,
    steps: [
      [
        /Checkouts awaiting confirmation/,
        "Investigate payment confirmation",
        "Review checkouts awaiting confirmation before taking further action.",
      ],
      [
        /Failed notifications/,
        "Separate delivery from booking status",
        "Investigate failed delivery without assuming the booking itself failed.",
      ],
      [
        /Outstanding forms/,
        "Find incomplete records",
        "Review forms still awaiting completion.",
      ],
    ],
  },
  {
    pages: /Error reports/,
    steps: [
      [
        /Error status|Filter/,
        "Focus your investigation",
        "Filter reports and inspect the affected action.",
      ],
      [
        /Resolve|Details|Report/,
        "Record the outcome",
        "Review the report and record resolution after investigating.",
      ],
    ],
  },
  {
    pages: /Developer/,
    steps: [
      [
        /Overview|metrics/i,
        "Review platform activity",
        "Use available totals and trends to identify areas needing investigation.",
      ],
      [
        /People/,
        "Manage individual accounts",
        "Review the relevant user record before changing an account.",
      ],
      [
        /Suppliers/,
        "Review supplier participation",
        "Inspect supplier records and available metrics before taking action.",
      ],
    ],
  },
  {
    pages: /Business details/,
    steps: [
      [
        /Business name|Contact|Address|Location/,
        "Keep your business details current",
        "Accurate contact and location information helps clients prepare and supports your public booking information.",
      ],
      [
        /Save|preferences/i,
        "Keep future bookings consistent",
        "Review the saved booking preferences your workflows rely on.",
      ],
    ],
  },
  {
    pages: /Design & references/,
    steps: [
      [
        /Photos shared|Project reference|Design/,
        "Prepare without searching the thread",
        "Review shared conversation photos alongside project references. Conversation photos can be unassigned to a specific project.",
      ],
      [
        /notes|brief/i,
        "Verify the design with your client",
        "Use the brief to prepare, then explicitly agree placement, style and scope.",
      ],
    ],
  },
  {
    pages: /Payments$/,
    steps: [
      [
        /history|payment/i,
        "Identify each recorded payment",
        "Review the project and sitting associated with a payment before requesting another amount.",
      ],
    ],
  },
  {
    pages: /Your artists and bookings/,
    steps: [
      [
        /Artists|Upcoming/,
        "Pick up your tattoo journey",
        "Find your artists and upcoming work together.",
      ],
      [
        /Discover/,
        "Explore your next idea",
        "Browse portfolios before starting an enquiry.",
      ],
    ],
  },
  {
    pages: /Supplier store/,
    steps: [
      [
        /Choose supplies|product|variant/i,
        "Choose the right product",
        "Review available variants and quantities for the exact supplies you need.",
      ],
      [
        /Cart/,
        "Check your complete order",
        "Review quantities, delivery and the total before checkout.",
      ],
    ],
  },
  {
    pages: /Shop|Public commerce/,
    steps: [
      [
        /Product|variant|option/i,
        "Check the item before buying",
        "Review available options, price and availability.",
      ],
      [
        /Cart|Checkout|Buy/,
        "Review before payment",
        "Check your selection and delivery information before confirming payment.",
      ],
    ],
  },
];

/** Dynamic record titles still use the same project/public guide. Sheets retain their own title. */
export function pageGuideTitle(
  title: string,
  pathname: string,
  isDialog: boolean
) {
  if (isDialog) return title;
  if (/^\/supplies\//.test(pathname)) return "Supplier store";
  if (/^\/shop\//.test(pathname)) return "Shop";
  if (/^\/projects\//.test(pathname)) return "Tattoo project";
  if (/^\/chat\//.test(pathname)) return "Message thread";
  if (/^\/(book|start)\//.test(pathname)) return "Booking enquiry";
  if (/^\/studio\//.test(pathname)) return "Public studio";
  if (/^\/(pay|deposit|balance)\//.test(pathname)) return "Checkout";
  return title;
}
