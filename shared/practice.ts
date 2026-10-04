import { projectPracticeStep } from "./practiceProjection";
/** Versioned, artist-only practice templates. No production identifiers or provider secrets. */
export const PRACTICE_VERSION = 1;
export type PracticeField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "checkbox";
  options?: string[];
  initial?: string;
  required?: boolean;
};
export type PracticeStep = {
  id: string;
  title: string;
  instruction: string;
  button: string;
  fields?: PracticeField[];
  simulation?: boolean;
  effect?: string;
};
export type PracticeChapter = {
  id: string;
  title: string;
  detail: string;
  steps: PracticeStep[];
};
const field = (
  key: string,
  label: string,
  initial = "",
  type: PracticeField["type"] = "text",
  options?: string[]
): PracticeField => ({
  key,
  label,
  initial,
  type,
  options,
  required: type !== "checkbox",
});
const step = (
  id: string,
  title: string,
  instruction: string,
  button: string,
  fields?: PracticeField[],
  effect?: string
): PracticeStep => ({ id, title, instruction, button, fields, effect });
const simulate = (
  id: string,
  title: string,
  instruction: string,
  effect?: string
): PracticeStep => ({
  id,
  title,
  instruction,
  button: "Simulate client response",
  simulation: true,
  effect,
});
const service = [
  field("service", "Service", "Full-day tattoo", "select", [
    "Full-day tattoo",
    "Half-day tattoo",
    "Sleeve project",
  ]),
  field("price", "Estimate (AUD)", "1000", "number"),
  field("deposit", "Deposit (AUD)", "250", "number"),
];
const bookingSteps: PracticeStep[] = [
  step(
    "client",
    "Choose the client",
    "Book from the conversation so the proposal stays with the design discussion.",
    "Choose client",
    [
      field("client", "Client", "Alex Taylor", "select", [
        "Alex Taylor",
        "Sam Chen",
        "Jordan Reid",
      ]),
    ]
  ),
  step(
    "service",
    "Choose a service",
    "Review duration, estimate and deposit. These services belong only to the tutorial.",
    "Use service",
    service,
    "price"
  ),
  step(
    "schedule",
    "Find available dates",
    "The practice artist works Monday–Friday, 9 am–5 pm. Check a full-day slot and the project deadline.",
    "Find dates",
    [
      field("date", "Start date", "", "date"),
      field("frequency", "Frequency", "Weekly", "select", [
        "Consecutive",
        "Weekly",
        "Fortnightly",
      ]),
      field("sittings", "Sittings", "1", "number"),
    ],
    "schedule"
  ),
  step(
    "review",
    "Review your proposal",
    "Check client, service, sittings, totals and deposit before sending.",
    "Send booking proposal",
    undefined,
    "proposal"
  ),
  simulate(
    "accept",
    "Client reviews the proposal",
    "The mock client accepts the proposal. No real client receives this.",
    "accept"
  ),
  simulate(
    "deposit",
    "Client pays the deposit",
    "Simulate a successful deposit confirmation. Replaying a payment must not collect it twice.",
    "deposit"
  ),
  step(
    "confirmation",
    "Review the confirmed booking",
    "The calendar, project, client history and payment record now reference the same practice booking.",
    "View booking",
    undefined,
    "notifications"
  ),
];
export const PRACTICE_CHAPTERS: PracticeChapter[] = [
  {
    id: "enquiry",
    title: "Enquiry to confirmed booking",
    detail: "Messages, references, the full proposal and deposit flow.",
    steps: [
      step(
        "request",
        "A new booking request",
        "Alex wants a black-and-grey forearm design. Open the enquiry and review their idea.",
        "Open request",
        undefined,
        "request"
      ),
      step(
        "message",
        "Discuss the design",
        "Send a practice reply asking about placement, size and reference ideas.",
        "Send message",
        [
          field(
            "message",
            "Your reply",
            "Thanks Alex — what size and placement did you have in mind?"
          ),
        ],
        "message"
      ),
      simulate(
        "reply",
        "References arrive",
        "Alex sends a reference and confirms forearm placement. The reference also belongs in Design & references.",
        "reference"
      ),
      step(
        "brief",
        "Review the design brief",
        "The brief summarises the discussion and retains the reference. Review it before preparing the proposal.",
        "Review brief",
        undefined,
        "brief"
      ),
      ...bookingSteps,
    ],
  },
  {
    id: "session",
    title: "Run a full-day sitting",
    detail:
      "Client history, consent, procedure record, final payment and aftercare.",
    steps: [
      step(
        "history",
        "Review client history",
        "Open Alex’s mock history, previous sittings, notes and payment totals.",
        "View history"
      ),
      step(
        "references",
        "Design & references",
        "Review the reference shared in the conversation alongside the design brief.",
        "View references",
        undefined,
        "reference"
      ),
      step(
        "forms",
        "Issue client forms",
        "Send the medical and consent forms before the appointment.",
        "Issue forms",
        undefined,
        "forms"
      ),
      simulate(
        "signed",
        "Client completes forms",
        "Simulate signed forms. The tutorial does not create a legal procedure record.",
        "signed"
      ),
      step(
        "arrival",
        "Client has arrived",
        "Mark arrival only after checking the client and the required forms.",
        "Mark arrived",
        undefined,
        "arrival"
      ),
      step(
        "start",
        "Start the sitting",
        "Record the start of this full-day appointment.",
        "Start sitting",
        undefined,
        "start"
      ),
      step(
        "procedure",
        "Record the procedure",
        "Record the practice procedure, placement and materials. Do not enter real health information.",
        "Save procedure",
        [
          field(
            "procedure",
            "Procedure notes",
            "Black-and-grey forearm design; single-use equipment."
          ),
        ],
        "procedure"
      ),
      step(
        "finish",
        "Finish and request the balance",
        "Review the remaining balance after the deposit. Completion follows confirmed final payment.",
        "Request final balance",
        undefined,
        "balance-request"
      ),
      simulate(
        "balance",
        "Client pays final balance",
        "Simulate the balance payment. Completion updates the shared practice booking immediately.",
        "balance"
      ),
      step(
        "records",
        "Check updated records",
        "Review completed sitting, collected total and remaining balance in the practice record.",
        "Review completion"
      ),
      step(
        "aftercare",
        "Send aftercare",
        "Send the mock aftercare instructions and schedule a follow-up.",
        "Send aftercare",
        [
          field(
            "aftercare",
            "Instructions",
            "Follow the aftercare guidance provided during your sitting."
          ),
        ],
        "notifications"
      ),
    ],
  },
  {
    id: "project",
    title: "Book a large project",
    detail:
      "Six sittings, frequency, deadline, split dates and project totals.",
    steps: bookingSteps.map(s =>
      s.id === "schedule"
        ? {
            ...s,
            instruction:
              "Find six sittings before the project deadline. Consecutive dates are preferred; any necessary splits must be clear in the proposal.",
            fields: [
              field("date", "First sitting", "", "date"),
              field("deadline", "Project completed by", "", "date"),
              field("frequency", "Frequency", "Weekly", "select", [
                "Consecutive",
                "Weekly",
                "Fortnightly",
              ]),
              field("sittings", "Sittings", "6", "number"),
            ],
          }
        : s
    ),
  },
  {
    id: "reschedule",
    title: "Reschedule a sitting",
    detail:
      "Availability, existing payments, client approval and conflict recovery.",
    steps: [
      step(
        "select",
        "Choose sitting 2",
        "Move one sitting without creating another booking or changing its existing payments.",
        "Open sitting 2"
      ),
      step(
        "date",
        "Choose a new time",
        "Use an available weekday. A conflicting date must leave the original sitting unchanged.",
        "Check new time",
        [
          field("date", "New date", "", "date"),
          field("time", "New time", "09:00"),
        ],
        "reschedule"
      ),
      step(
        "terms",
        "Review the change",
        "Review the old and proposed dates. The original booking remains confirmed until the mock client accepts.",
        "Send reschedule request",
        undefined,
        "reschedule-request"
      ),
      simulate(
        "approve",
        "Client accepts the change",
        "Simulate acceptance; replace the date on the same booking and release the previous slot.",
        "reschedule-accept"
      ),
      step(
        "updated",
        "Review updated records",
        "Calendar and project show the new date with existing money unchanged.",
        "Review change",
        undefined,
        "notifications"
      ),
    ],
  },
  {
    id: "promo-reschedule",
    title: "Move outside promotion dates",
    detail: "Keep the offer or request client agreement to changed pricing.",
    steps: [
      step(
        "select",
        "Choose a promotional sitting",
        "This sitting has a confirmed 20% promotion.",
        "Open promotional sitting",
        undefined,
        "promo-seed"
      ),
      step(
        "date",
        "Move outside eligibility",
        "Choose a date after the offer month. Decide explicitly whether to keep the discount.",
        "Review new terms",
        [
          field("date", "New date", "", "date"),
          field(
            "keep",
            "Keep the promotion outside eligible dates",
            "false",
            "checkbox"
          ),
        ],
        "promo-reschedule"
      ),
      step(
        "send",
        "Request agreement",
        "If the discount is removed, the client must agree to the new balance. Paid deposits remain credited.",
        "Send terms to client",
        undefined,
        "reschedule-request"
      ),
      simulate(
        "approve",
        "Client accepts the terms",
        "Simulate approval of the proposed date and final price, then update all practice records.",
        "reschedule-accept"
      ),
      step(
        "result",
        "Review pricing and date",
        "Check total, deposit, remaining balance and notification preview.",
        "Review records",
        undefined,
        "notifications"
      ),
    ],
  },
  {
    id: "promotion",
    title: "Create an offer for a client",
    detail: "Discount, artwork, eligible months and booking with the offer.",
    steps: [
      step(
        "create",
        "Create the promotion",
        "Choose discount type and value. A percentage can include decimal values.",
        "Save promotion",
        [
          field("title", "Promotion title", "Forearm design offer"),
          field("valueType", "Value type", "Percent", "select", [
            "Percent",
            "Amount",
          ]),
          field("value", "Value", "20", "number"),
          field("month", "Offer month (YYYY-MM)", "", "text"),
        ],
        "promotion"
      ),
      step(
        "artwork",
        "Choose background artwork",
        "Use the built-in practice artwork. No file is uploaded to R2 during practice.",
        "Use mock artwork"
      ),
      step(
        "recipient",
        "Select a client",
        "Choose one recipient from the practice client list.",
        "Send offer",
        [
          field("client", "Recipient", "Alex Taylor", "select", [
            "Alex Taylor",
            "Sam Chen",
            "Jordan Reid",
          ]),
        ],
        "notifications"
      ),
      simulate(
        "interest",
        "Client wants to use the offer",
        "Interest begins a consultation; it does not confirm a sitting or consume the promotion.",
        "interest"
      ),
      step(
        "consult",
        "Discuss the design",
        "Agree the design and use Book with this offer so the wizard inherits eligibility and pricing.",
        "Book with this offer"
      ),
      ...bookingSteps,
    ],
  },
  {
    id: "calendar-fill",
    title: "Fill calendar space",
    detail: "Limited offers, months, audience filters and multiple recipients.",
    steps: [
      step(
        "create",
        "Set the calendar-fill offer",
        "Set eligible months and a limited time to secure a booking by paying the deposit.",
        "Save offer",
        [
          field("title", "Title", "Available studio dates"),
          field("value", "Discount %", "15", "number"),
          field("month", "Eligible month (YYYY-MM)", "", "text"),
          field("expiry", "Visible for", "24 hours", "select", [
            "24 hours",
            "48 hours",
            "7 days",
          ]),
        ],
        "promotion"
      ),
      step(
        "audience",
        "Filter the audience",
        "Review preset lifetime value, loyalty, recency, birthday and city options.",
        "Preview audience",
        [
          field("loyalty", "Completed bookings", "Any", "select", [
            "Any",
            "1 or more",
            "3 or more",
          ]),
          field("lifetime", "Lifetime value", "Any", "select", [
            "Any",
            "$500+",
            "$2000+",
          ]),
          field("recency", "Last sitting", "Any", "select", [
            "Any",
            "Over 30 days",
            "Over 90 days",
          ]),
          field("birthday", "Birthday month", "Any", "select", [
            "Any",
            "January",
            "October",
          ]),
          field("city", "City", "Any", "select", [
            "Any",
            "Brisbane",
            "Sydney",
            "Auckland",
          ]),
        ],
        "audience"
      ),
      step(
        "manual",
        "Choose recipients manually",
        "Choose one or several practice clients before reviewing notification previews.",
        "Review recipients",
        [
          field("alex", "Alex Taylor", "true", "checkbox"),
          field("sam", "Sam Chen", "true", "checkbox"),
          field("jordan", "Jordan Reid", "false", "checkbox"),
        ]
      ),
      step(
        "send",
        "Send the offer",
        "Only previews are produced. No SMS or push provider is contacted.",
        "Send practice offers",
        undefined,
        "notifications"
      ),
      simulate(
        "interest",
        "One client responds",
        "Alex asks to use the offer; other recipients still have their original expiry.",
        "interest"
      ),
      ...bookingSteps,
      simulate(
        "expire",
        "Other offers expire",
        "Unconfirmed offers expire. The booking secured by its deposit keeps the issued promotion.",
        "expire"
      ),
    ],
  },
  {
    id: "voucher",
    title: "Sell a gift voucher",
    detail: "Specific client, expiry, purchase and simulated transfer.",
    steps: [
      step(
        "create",
        "Create a voucher",
        "Choose a face value and review the issued terms and expiry.",
        "Save voucher",
        [
          field("title", "Voucher title", "Tattoo gift voucher"),
          field("value", "Face value (AUD)", "500", "number"),
          field("expiryDate", "Expiry date", "", "date"),
        ],
        "voucher"
      ),
      step(
        "send",
        "Send to the client",
        "Use Create promo from the mock conversation to send this voucher directly.",
        "Send voucher",
        undefined,
        "notifications"
      ),
      simulate(
        "purchase",
        "Client purchases the voucher",
        "Simulate a successful voucher purchase. This is separate from a booking deposit.",
        "voucher-purchase"
      ),
      simulate(
        "transfer",
        "Client transfers the voucher",
        "Sam receives the same artist, currency, expiry and remaining balance.",
        "voucher-transfer"
      ),
      step(
        "review",
        "Review the voucher",
        "Check ownership and unspent credit before preparing an eligible new booking.",
        "Review voucher"
      ),
    ],
  },
];
const groups: [string, string, string, [string, string, string][]][] = [
  [
    "today",
    "Manage Today and your week",
    "Attention, follow-ups, upcoming work and earnings.",
    [
      [
        "attention",
        "Review needs attention",
        "Review the mock arrival, unanswered enquiry and overdue follow-up.",
      ],
      [
        "follow-up",
        "Send a follow-up",
        "Edit the wording and send a practice follow-up.",
      ],
      [
        "week",
        "Review next seven days",
        "Compare confirmed work estimate and outstanding balance.",
      ],
      [
        "task",
        "Complete or snooze a task",
        "Choose a task and record its practice outcome.",
      ],
    ],
  ],
  [
    "clients",
    "Manage client records",
    "Search, contact details, notes, history and references.",
    [
      ["search", "Search clients", "Find Alex Taylor in the practice list."],
      [
        "add",
        "Add an existing client",
        "Create a mock client without creating a production account.",
      ],
      ["edit", "Edit contact details", "Update mock phone, birthday and city."],
      [
        "notes",
        "Save a private note",
        "Record information useful at the next sitting.",
      ],
      [
        "history",
        "Review booking and payment history",
        "Review the full-day appointment and historical sitting.",
      ],
      [
        "references",
        "Review and label references",
        "References sent in practice Messages appear in the same client record.",
      ],
    ],
  ],
  [
    "messages",
    "Messages and design briefs",
    "Text, media, read receipts, tags and brief regeneration.",
    [
      ["reply", "Send a message", "Send a mock design question."],
      [
        "media",
        "Send a reference image",
        "Use a fixture image instead of uploading a real file.",
      ],
      [
        "read",
        "Review delivery and read receipts",
        "Simulate the client opening the message.",
      ],
      [
        "tag",
        "Tag a conversation",
        "Assign a practice label and filter the inbox.",
      ],
      [
        "brief",
        "Regenerate the design brief",
        "Review placement, style and references from the mock conversation.",
      ],
      [
        "tools",
        "Use conversation tools",
        "Choose Book in or Create promo for this client.",
      ],
    ],
  ],
  [
    "availability",
    "Services and availability",
    "Service editing, hours, breaks, time off and calendar navigation.",
    [
      ["service-add", "Add a service", "Set price, duration and sittings."],
      [
        "service-edit",
        "Edit a service",
        "Update a mock service and review its booking preview.",
      ],
      [
        "service-remove",
        "Remove a service",
        "Remove the unused fixture service only.",
      ],
      ["hours", "Set working days and hours", "Set 9 am–5 pm on weekdays."],
      ["break", "Add a break", "Exclude a lunch break from availability."],
      ["time-off", "Set time off", "Block a mock design or personal day."],
      [
        "navigate",
        "Navigate the calendar",
        "Practise Previous, Today and Next.",
      ],
    ],
  ],
  [
    "waitlist",
    "Fill a cancellation from the waitlist",
    "Offer a slot, expiry, deposit and conflict recovery.",
    [
      ["list", "Review the waitlist", "Choose an interested mock client."],
      [
        "offer",
        "Offer an available slot",
        "Review estimate, deposit and offer deadline.",
      ],
      [
        "accept",
        "Simulate a client acceptance",
        "Confirm only after a simulated deposit.",
      ],
      [
        "expiry",
        "Review an expired offer",
        "Release an unpaid hold without cancelling another booking.",
      ],
    ],
  ],
  [
    "forms",
    "Forms, consent and aftercare",
    "Templates, signatures, procedure search and aftercare.",
    [
      [
        "template",
        "Edit a medical form template",
        "Change the mock template for future forms.",
      ],
      [
        "consent",
        "Edit consent wording",
        "Previously signed practice forms retain their issued wording.",
      ],
      ["issue", "Issue forms", "Send practice forms to Alex."],
      [
        "signature",
        "Review signed forms",
        "Inspect simulated signature and issued version.",
      ],
      [
        "procedure",
        "Search procedure records",
        "Find the fixture full-day procedure.",
      ],
      [
        "aftercare",
        "Edit and send aftercare",
        "Review instructions and a follow-up preview.",
      ],
    ],
  ],
  [
    "money",
    "Money, refunds and reconciliation",
    "Earnings, transaction history, refund preview and balances.",
    [
      [
        "earnings",
        "Review earnings",
        "Compare gross recorded payments, fees and net earnings.",
      ],
      [
        "transaction",
        "Open a transaction",
        "Identify its project and sitting.",
      ],
      [
        "refund-preview",
        "Preview a refund",
        "Review the original charge and refundable balance.",
      ],
      [
        "refund",
        "Confirm a practice refund",
        "Simulate provider confirmation without changing real money.",
      ],
      [
        "reconcile",
        "Review reconciliation",
        "Inspect a simulated delayed payment and its resolved outcome.",
      ],
    ],
  ],
  [
    "bank",
    "Bank and payout setup",
    "Simulated onboarding, verification, payout schedule and status.",
    [
      [
        "connect",
        "Connect Stripe",
        "Use a simulated identity and bank setup, never real credentials.",
      ],
      [
        "verification",
        "Check verification status",
        "Simulate pending verification and then approval.",
      ],
      [
        "schedule",
        "Change payout schedule",
        "Select a daily, weekly or monthly mock schedule.",
      ],
      [
        "payout",
        "Review payout status",
        "Inspect a pending and a paid fixture payout.",
      ],
    ],
  ],
  [
    "profile",
    "Profile, portfolio and booking link",
    "Profile details, media, public preview and sharing.",
    [
      [
        "profile",
        "Edit artist profile",
        "Change the practice bio, styles and location.",
      ],
      [
        "upload",
        "Add portfolio media",
        "Choose built-in fixture artwork; no R2 upload occurs.",
      ],
      [
        "reorder",
        "Reorder portfolio",
        "Arrange fixture artwork in the mock portfolio.",
      ],
      ["remove", "Remove portfolio media", "Remove a practice item only."],
      [
        "link",
        "Set and copy booking link",
        "Preview a non-working tutorial booking URL.",
      ],
      [
        "preview",
        "Preview the public profile",
        "Inspect the practice profile without publishing it.",
      ],
    ],
  ],
  [
    "imports",
    "Import clients and Instagram work",
    "Fixture files, mapping, progress, duplicate recovery and review.",
    [
      [
        "source",
        "Choose a fixture import",
        "Use a mock CSV or Instagram feed.",
      ],
      [
        "map",
        "Map columns or choose posts",
        "Match name, contact and booking fields.",
      ],
      [
        "preview",
        "Preview the import",
        "Review ready rows, duplicates and conflicts.",
      ],
      [
        "import",
        "Run the practice import",
        "Simulate processing and completion without scraping a website.",
      ],
      [
        "retry",
        "Resolve and retry a failed row",
        "Correct the mock service mapping and import the row once.",
      ],
    ],
  ],
  [
    "supplies",
    "Supplies, cart and recommendations",
    "Variants, quantities, delivery, checkout, tracking and reorder.",
    [
      ["supplier", "Choose a supplier", "Open the mock supplier catalogue."],
      [
        "variant",
        "Choose a product variant",
        "Review the fixture price and stock.",
      ],
      [
        "quantity",
        "Add multiple items",
        "Set quantity and update the practice cart.",
      ],
      ["remove", "Remove an item", "Remove only a practice cart line."],
      [
        "delivery",
        "Review delivery",
        "Check fixture address and delivery estimate.",
      ],
      [
        "checkout",
        "Confirm practice checkout",
        "Simulate payment without a Stripe checkout.",
      ],
      [
        "tracking",
        "Track the order",
        "Review the simulated supplier shipment.",
      ],
      [
        "recommendation",
        "Review a recommended reorder",
        "Use past fixture purchases and adjust quantities before checkout.",
      ],
    ],
  ],
  [
    "shopfront",
    "Artist shopfront and events",
    "Products, publishing, events, sales and order history.",
    [
      [
        "product",
        "Create a shopfront item",
        "Set fixture artwork, price and stock.",
      ],
      [
        "edit",
        "Edit or remove an item",
        "Change a mock item without publishing.",
      ],
      [
        "publish",
        "Publish or unpublish the practice store",
        "Preview visibility within this tutorial only.",
      ],
      ["event", "Create an event", "Set date, description and availability."],
      [
        "event-edit",
        "Edit or cancel an event",
        "Review the impact on mock attendees.",
      ],
      [
        "orders",
        "Review customer orders",
        "Inspect fixture payment and fulfilment history.",
      ],
    ],
  ],
  [
    "studio",
    "Artist-accessible studio actions",
    "Role-aware schedule, team, invitations and billing.",
    [
      [
        "schedule",
        "View the team schedule",
        "Your mock bookings are editable; other artists’ records are read-only.",
      ],
      ["create", "Create a practice studio", "Set fixture studio details."],
      [
        "invite",
        "Invite a team member",
        "Preview an invitation; no email is sent.",
      ],
      [
        "roles",
        "Manage a mock member",
        "Review owner, manager and artist permissions.",
      ],
      [
        "billing",
        "Review studio billing",
        "Simulate checkout and subscription status.",
      ],
      [
        "leave",
        "Leave the practice studio",
        "Review ownership restrictions before confirming.",
      ],
    ],
  ],
  [
    "settings",
    "Settings, travel and notifications",
    "Account preferences, plans, templates and destructive-action previews.",
    [
      [
        "account",
        "Edit account details",
        "Update mock contact and business information.",
      ],
      [
        "appearance",
        "Change appearance",
        "Review light and dark tutorial colours.",
      ],
      [
        "notifications",
        "Configure notification preferences",
        "Inspect push permission and SMS opt-in previews.",
      ],
      ["templates", "Edit message templates", "Save reusable mock wording."],
      [
        "travel",
        "Plan a guest spot",
        "Set destination and dates and review nearby mock clients.",
      ],
      [
        "plans",
        "Change subscription",
        "Simulate checkout, renewal and cancellation.",
      ],
      [
        "export",
        "Export practice records",
        "Preview an export of mock data only.",
      ],
      [
        "delete",
        "Preview account removal",
        "Practise the confirmation without deleting any real account.",
      ],
      [
        "signout",
        "Practise signing out",
        "End this chapter; the real login remains unchanged.",
      ],
    ],
  ],
];
const actionFields: Record<string, PracticeField[]> = {
  "today.task": [
    field("task", "Task", "Follow up with Alex", "select", [
      "Follow up with Alex",
      "Confirm tomorrow’s appointment",
    ]),
    field("outcome", "Action", "Complete", "select", [
      "Complete",
      "Snooze until tomorrow",
    ]),
  ],
  "clients.search": [field("query", "Client name", "Alex")],
  "clients.add": [
    field("name", "Name", "Morgan Lee"),
    field("email", "Email", "morgan@example.test"),
    field("city", "City", "Brisbane"),
  ],
  "clients.edit": [
    field("name", "Name", "Alex Taylor"),
    field("phone", "Phone", "0400 000 000"),
    field("city", "City", "Brisbane"),
    field("birthday", "Birthday", "1990-10-15", "date"),
  ],
  "clients.notes": [
    field("note", "Private note", "Prefers a morning appointment."),
  ],
  "messages.reply": [
    field("message", "Message", "What size did you have in mind?"),
  ],
  "messages.tag": [
    field("tag", "Conversation tag", "Consultation", "select", [
      "Consultation",
      "Ready to book",
      "Follow up",
    ]),
  ],
  "availability.service-add": [
    field("name", "Service name", "Small tattoo"),
    field("duration", "Duration (minutes)", "120", "number"),
    field("price", "Price (AUD)", "400", "number"),
    field("sittings", "Sittings", "1", "number"),
  ],
  "availability.service-edit": [
    field("service", "Service", "Full-day tattoo", "select", [
      "Full-day tattoo",
      "Half-day tattoo",
    ]),
    field("price", "New price (AUD)", "1100", "number"),
  ],
  "availability.service-remove": [
    field("service", "Service", "Small tattoo", "select", [
      "Small tattoo",
      "Half-day tattoo",
    ]),
  ],
  "availability.hours": [
    field("start", "Start time", "09:00"),
    field("end", "Finish time", "17:00"),
  ],
  "availability.break": [
    field("start", "Break starts", "12:00"),
    field("end", "Break ends", "13:00"),
  ],
  "availability.time-off": [
    field("date", "Date", "", "date"),
    field("reason", "Reason", "Design day", "select", [
      "Design day",
      "Personal day",
    ]),
  ],
  "availability.navigate": [
    field("direction", "Move calendar", "Today", "select", [
      "Previous",
      "Today",
      "Next",
    ]),
  ],
  "waitlist.offer": [
    field("date", "Offered date", "", "date"),
    field("price", "Estimate (AUD)", "1000", "number"),
    field("deposit", "Deposit (AUD)", "250", "number"),
  ],
  "forms.template": [
    field(
      "wording",
      "Template wording",
      "Please disclose any relevant medical conditions."
    ),
  ],
  "forms.consent": [
    field(
      "wording",
      "Consent wording",
      "I understand the procedure and have discussed my questions."
    ),
  ],
  "forms.aftercare": [
    field(
      "wording",
      "Aftercare instructions",
      "Follow the instructions discussed during your sitting."
    ),
  ],
  "money.refund-preview": [
    field("amount", "Refund amount (AUD)", "100", "number"),
  ],
  "money.refund": [
    field("confirm", "Confirm the mock refund", "false", "checkbox"),
  ],
  "bank.connect": [
    field("business", "Practice business name", "Demo Tattoo Studio"),
    field("country", "Country", "Australia", "select", [
      "Australia",
      "New Zealand",
    ]),
  ],
  "bank.schedule": [
    field("schedule", "Payout schedule", "Weekly", "select", [
      "Daily",
      "Weekly",
      "Monthly",
    ]),
  ],
  "profile.profile": [
    field("bio", "Bio", "Black-and-grey artist in Brisbane."),
    field("style", "Style", "Black and grey"),
    field("city", "City", "Brisbane"),
  ],
  "profile.upload": [
    field("artwork", "Fixture artwork", "Botanical forearm", "select", [
      "Botanical forearm",
      "Portrait study",
      "Sleeve composition",
    ]),
  ],
  "profile.link": [field("slug", "Practice link name", "demo-artist")],
  "imports.source": [
    field("source", "Import source", "Clients CSV", "select", [
      "Clients CSV",
      "Instagram fixtures",
    ]),
  ],
  "imports.map": [
    field("nameColumn", "Name column", "full_name", "select", [
      "full_name",
      "email",
    ]),
    field("emailColumn", "Email column", "email", "select", [
      "email",
      "full_name",
    ]),
  ],
  "imports.retry": [
    field("service", "Correct service mapping", "Full-day tattoo", "select", [
      "Full-day tattoo",
      "Half-day tattoo",
    ]),
  ],
  "supplies.variant": [
    field("product", "Product", "Cartridges", "select", [
      "Cartridges",
      "Ink caps",
    ]),
    field("variant", "Variant", "Standard", "select", ["Standard", "Fine"]),
  ],
  "supplies.quantity": [field("quantity", "Quantity", "3", "number")],
  "supplies.delivery": [
    field("address", "Fixture delivery address", "10 Example Street, Brisbane"),
  ],
  "supplies.recommendation": [
    field("quantity", "Suggested reorder quantity", "2", "number"),
  ],
  "shopfront.product": [
    field("name", "Product name", "Art print"),
    field("price", "Price (AUD)", "50", "number"),
    field("stock", "Stock", "10", "number"),
  ],
  "shopfront.publish": [
    field("published", "Publish practice store", "true", "checkbox"),
  ],
  "shopfront.event": [
    field("name", "Event name", "Flash day"),
    field("date", "Event date", "", "date"),
  ],
  "studio.create": [field("name", "Studio name", "Practice studio")],
  "studio.invite": [
    field("email", "Practice invitation address", "demo.artist@example.test"),
    field("role", "Role", "Artist", "select", ["Artist", "Manager"]),
  ],
  "studio.roles": [
    field("role", "Mock member role", "Artist", "select", [
      "Artist",
      "Manager",
    ]),
  ],
  "settings.account": [
    field("name", "Name", "Practice Artist"),
    field("email", "Email", "artist@example.test"),
  ],
  "settings.appearance": [
    field("appearance", "Appearance", "Light", "select", ["Light", "Dark"]),
  ],
  "settings.notifications": [
    field("push", "Enable practice push previews", "true", "checkbox"),
    field("sms", "Practice client has opted into SMS", "true", "checkbox"),
  ],
  "settings.templates": [
    field(
      "wording",
      "Template wording",
      "Looking forward to your appointment."
    ),
  ],
  "settings.travel": [
    field("city", "Destination", "Auckland"),
    field("date", "Start date", "", "date"),
  ],
  "settings.plans": [
    field("plan", "Plan", "Pro", "select", ["Free", "Pro", "Studio"]),
  ],
  "settings.delete": [
    field("confirm", "Confirm mock account removal", "false", "checkbox"),
  ],
};
for (const [id, title, detail, actions] of groups)
  PRACTICE_CHAPTERS.push({
    id,
    title,
    detail,
    steps: actions.map(([action, title, instruction]) =>
      step(
        action,
        title,
        instruction,
        title,
        actionFields[`${id}.${action}`],
        "setting"
      )
    ),
  });
export interface PracticeState {
  version: number;
  revision: number;
  chapterId: string | null;
  cursor: number;
  completed: string[];
  client: { name: string; city: string; reference: boolean; brief: string };
  booking: {
    status: string;
    price: number;
    deposit: number;
    paid: number;
    dates: string[];
    proposedDate?: string;
    proposedPrice?: number;
    forms: string;
    procedure: string;
  };
  messages: { text: string; from: string }[];
  notifications: string[];
  records: Record<string, Record<string, string>>;
  voucher: { balance: number; owner: string } | null;
  sandbox?: Record<string, any>;
  checkpoints?: PracticeState[];
  workspace: Record<string, string>;
  audience: string[];
  offers: { client: string; status: string; expiresAt: string }[];
}
export function seedPractice(
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
  }).format(new Date())
): PracticeState {
  return {
    version: PRACTICE_VERSION,
    revision: 0,
    chapterId: null,
    cursor: 0,
    completed: [],
    client: {
      name: "Alex Taylor",
      city: "Brisbane",
      reference: false,
      brief: "",
    },
    booking: {
      status: "confirmed",
      price: 100000,
      deposit: 25000,
      paid: 25000,
      dates: [today],
      forms: "not issued",
      procedure: "",
    },
    messages: [],
    notifications: [],
    records: {},
    voucher: null,
    audience: ["Alex Taylor", "Sam Chen", "Jordan Reid"],
    offers: [],
    workspace: {
      Clients:
        "Alex Taylor · Brisbane · 3 bookings · $3,000 lifetime paid; Sam Chen · Sydney · 1 booking · $500; Jordan Reid · Auckland · 5 bookings · $5,000",
      Services:
        "Full-day tattoo · 480 minutes · $1,000; Half-day tattoo · 240 minutes · $600",
      Bank: "Not connected",
      Cart: "Empty",
      Portfolio: "Botanical forearm; Portrait study",
      Import: "Not started",
      Studio: "Practice Artist (owner); Demo Artist (member)",
    },
  };
}
export function startPractice(
  state: PracticeState,
  chapterId: string
): PracticeState {
  if (!PRACTICE_CHAPTERS.some(c => c.id === chapterId))
    throw new Error("Unknown practice chapter");
  return {
    ...seedPractice(),
    revision: state.revision + 1,
    completed: state.completed,
    sandbox: { actionProgress: state.sandbox?.actionProgress ?? {} },
    chapterId,
    cursor: 0,
  };
}
export function advancePractice(
  state: PracticeState,
  stepId: string,
  values: Record<string, string>,
  outcome: "success" | "decline" | "failure" = "success"
): PracticeState {
  const chapter = PRACTICE_CHAPTERS.find(c => c.id === state.chapterId);
  const current = chapter?.steps[state.cursor];
  if (!chapter || !current || current.id !== stepId)
    throw new Error(
      "This practice step has already changed. Refresh before continuing."
    );
  if (outcome === "failure")
    throw new Error(
      "Simulated failure: nothing changed. Retry this practice step."
    );
  const next = structuredClone(state);
  if (outcome === "decline") {
    if (!current.simulation)
      throw new Error("Only a simulated client response can be declined.");
    next.messages.push({
      from: "Client",
      text: "I have declined the proposed change. Please discuss another option.",
    });
    next.booking.proposedDate = undefined;
    next.booking.proposedPrice = undefined;
    next.booking.status =
      current.id === "approve" ? "confirmed" : "consultation";
    if (current.id === "approve")
      next.cursor = chapter.steps.findIndex(s => s.id === "date");
    else if (["accept", "deposit"].includes(current.id))
      next.cursor = chapter.steps.findIndex(s => s.id === "review");
    next.revision++;
    return next;
  }
  for (const f of current.fields ?? []) {
    const value = values[f.key];
    if (f.required && !value?.trim())
      throw new Error(`Enter ${f.label.toLowerCase()}.`);
    if (
      f.type === "number" &&
      (!Number.isFinite(Number(value)) || Number(value) < 0)
    )
      throw new Error(`${f.label} must be a positive number or zero.`);
    if (f.type === "select" && !f.options?.includes(value))
      throw new Error(`Choose a valid ${f.label.toLowerCase()}.`);
    if (
      f.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      throw new Error("Choose a valid date.");
  }
  if (chapter.id === "calendar-fill" && current.id === "manual") {
    next.audience = [
      values.alex === "true" ? "Alex Taylor" : null,
      values.sam === "true" ? "Sam Chen" : null,
      values.jordan === "true" ? "Jordan Reid" : null,
    ].filter((name): name is string => !!name);
    if (!next.audience.length)
      throw new Error("Choose at least one practice recipient.");
    next.workspace["Selected recipients"] = next.audience.join(", ");
  }
  const b = next.booking;
  next.records[`${chapter.id}.${current.id}`] = values;
  switch (current.effect) {
    case "setting": {
      const key = `${chapter.id}.${current.id}`;
      const w = next.workspace;
      if (key === "clients.search")
        w["Search results"] = values.query.toLowerCase().includes("alex")
          ? "Alex Taylor · Brisbane"
          : "No matching practice clients";
      else if (key === "clients.add")
        w["Added client"] = `${values.name} · ${values.city} · ${values.email}`;
      else if (key === "clients.edit") {
        next.client.name = values.name;
        next.client.city = values.city;
        w["Client contact"] = `${values.phone} · Birthday ${values.birthday}`;
      } else if (key === "clients.notes") w["Private note"] = values.note;
      else if (key === "clients.references" || key === "messages.media") {
        next.client.reference = true;
        next.messages.push({
          from: "Artist",
          text: "Fixture reference shared: botanical forearm.",
        });
      } else if (key === "messages.reply")
        next.messages.push({ from: "Artist", text: values.message });
      else if (key === "messages.read")
        w["Message receipt"] = "Read by mock client";
      else if (key === "messages.tag") w["Conversation tag"] = values.tag;
      else if (key === "messages.brief") {
        next.client.brief =
          "Black-and-grey forearm design, full-day sitting, shared reference.";
        w["Design brief"] = "Regenerated from mock conversation";
      } else if (key === "availability.service-add") {
        if (
          Number(values.duration) < 15 ||
          Number(values.duration) > 480 ||
          Number(values.duration) % 15
        )
          throw new Error(
            "Choose a duration from 15 to 480 minutes in 15-minute increments."
          );
        if (
          !Number.isInteger(Number(values.sittings)) ||
          Number(values.sittings) < 1
        )
          throw new Error("Sittings must be a whole number above zero.");
        w["Added service"] =
          `${values.name} · ${values.duration} minutes · $${values.price} · ${values.sittings} sitting(s)`;
      } else if (key === "availability.service-edit")
        w["Updated service"] = `${values.service} · $${values.price}`;
      else if (key === "availability.service-remove")
        w["Removed service"] = values.service;
      else if (key === "availability.hours" || key === "availability.break") {
        if (
          !/^\d{2}:\d{2}$/.test(values.start) ||
          !/^\d{2}:\d{2}$/.test(values.end) ||
          values.start >= values.end
        )
          throw new Error(
            "Use valid start and finish times with finish after start."
          );
        w[key.endsWith("hours") ? "Working hours" : "Break"] =
          `${values.start}–${values.end}`;
      } else if (key === "availability.time-off")
        w["Time off"] = `${values.date} · ${values.reason}`;
      else if (key === "availability.navigate")
        w["Calendar position"] = values.direction;
      else if (key === "waitlist.offer") {
        b.dates = [values.date];
        b.price = Math.round(Number(values.price) * 100);
        b.deposit = Math.round(Number(values.deposit) * 100);
        b.paid = 0;
        b.status = "waitlist offer";
        if (b.deposit > b.price)
          throw new Error("Deposit cannot exceed estimate.");
      } else if (key === "waitlist.accept") {
        b.paid = b.deposit;
        b.status = "confirmed";
      } else if (key === "waitlist.expiry")
        w["Expired waitlist offer"] =
          "Unpaid mock offer released; confirmed booking retained";
      else if (key === "forms.issue") b.forms = "issued";
      else if (key === "forms.signature") b.forms = "signed";
      else if (
        key === "forms.template" ||
        key === "forms.consent" ||
        key === "forms.aftercare"
      )
        w[current.title] = values.wording;
      else if (key === "money.refund-preview") {
        const amount = Math.round(Number(values.amount) * 100);
        if (amount <= 0 || amount > b.paid)
          throw new Error(
            "Refund must be greater than zero and within the collected amount."
          );
        w["Refund preview"] =
          `$${values.amount} from mock payment · Deposit credit will decrease`;
      } else if (key === "money.refund") {
        if (values.confirm !== "true")
          throw new Error("Confirm the mock refund first.");
        const amount = Math.round(
          Number(next.records["money.refund-preview"]?.amount ?? 0) * 100
        );
        b.paid -= amount;
        w["Refund"] = "Simulated provider confirmed the refund";
      } else if (key === "money.reconcile")
        w["Reconciliation"] = "Simulated delayed confirmation reconciled once";
      else if (key === "bank.connect")
        w["Bank"] =
          `${values.business} · ${values.country} · Verification pending`;
      else if (key === "bank.verification")
        w["Bank"] = "Verified (simulated) · Payouts enabled";
      else if (key === "bank.schedule") w["Payout schedule"] = values.schedule;
      else if (key === "bank.payout")
        w["Latest payout"] = "$750 · Paid (simulated)";
      else if (key === "profile.profile")
        w["Artist profile"] =
          `${values.bio} · ${values.style} · ${values.city}`;
      else if (key === "profile.upload")
        w["Portfolio"] += "; " + values.artwork;
      else if (key === "profile.remove") w["Portfolio"] = "Botanical forearm";
      else if (key === "profile.reorder")
        w["Portfolio"] = "Portrait study; Botanical forearm";
      else if (key === "profile.link") {
        if (!/^[a-z0-9-]+$/.test(values.slug))
          throw new Error("Use lowercase letters, numbers and hyphens.");
        w["Booking link"] = `example.test/book/${values.slug} · Preview only`;
      } else if (key === "imports.source") w["Import source"] = values.source;
      else if (key === "imports.map") {
        if (values.nameColumn === values.emailColumn)
          throw new Error("Map name and email to different columns.");
        w["Import mapping"] = "Name and email mapped";
      } else if (key === "imports.preview")
        w["Import preview"] =
          "2 ready rows · 1 service conflict · 1 duplicate skipped";
      else if (key === "imports.import")
        w["Import"] = "100% · 2 mock clients imported · 1 row needs review";
      else if (key === "imports.retry")
        w["Import"] = "100% · 3 mock clients imported · duplicate skipped";
      else if (key === "supplies.variant")
        w["Selected product"] =
          `${values.product} · ${values.variant} · $30 each · 10 in stock`;
      else if (
        key === "supplies.quantity" ||
        key === "supplies.recommendation"
      ) {
        const quantity = Number(values.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)
          throw new Error(
            "Choose a whole quantity from 1 to 10 (mock stock limit)."
          );
        w["Cart"] = `${quantity} × Cartridges · $${quantity * 30}`;
      } else if (key === "supplies.remove") w["Cart"] = "Empty";
      else if (key === "supplies.delivery") {
        w["Delivery"] = `${values.address} · $10 · Estimated 3–5 working days`;
        w["Cart"] = "3 × Cartridges · $90";
      } else if (key === "supplies.checkout") {
        if (w["Cart"] === "Empty")
          throw new Error("Add a practice item first.");
        w["Supply order"] = "Paid (simulated) · Processing";
        w["Cart"] = "Empty";
      } else if (key === "supplies.tracking")
        w["Supply order"] = "Shipped · Mock tracking DEMO-001";
      else if (key === "shopfront.product")
        w["Shopfront item"] =
          `${values.name} · $${values.price} · ${values.stock} available`;
      else if (key === "shopfront.publish")
        w["Shopfront visibility"] =
          values.published === "true"
            ? "Published inside practice only"
            : "Unpublished";
      else if (key === "shopfront.event")
        w["Event"] = `${values.name} · ${values.date}`;
      else if (key === "shopfront.event-edit")
        w["Event"] = "Practice event cancelled · Notification preview ready";
      else if (key === "studio.create") w["Studio name"] = values.name;
      else if (key === "studio.invite")
        w["Studio invitation"] =
          `${values.email} · ${values.role} · Preview only, no email sent`;
      else if (key === "studio.roles") w["Mock member role"] = values.role;
      else if (key === "studio.leave")
        w["Studio"] = "Left practice studio; real membership unchanged";
      else if (key === "settings.account")
        w["Account"] = `${values.name} · ${values.email}`;
      else if (key === "settings.appearance")
        w["Appearance"] = values.appearance;
      else if (key === "settings.notifications")
        w["Notifications"] =
          `Push previews ${values.push === "true" ? "on" : "off"} · SMS opt-in ${values.sms === "true" ? "on" : "off"}`;
      else if (key === "settings.templates")
        w["Message template"] = values.wording;
      else if (key === "settings.travel")
        w["Guest spot"] = `${values.city} · ${values.date}`;
      else if (key === "settings.plans" || key === "studio.billing")
        w["Subscription"] = `${values.plan ?? "Studio"} · Active (simulated)`;
      else if (key === "settings.delete") {
        if (values.confirm !== "true")
          throw new Error(
            "Confirm mock account removal to practise this action."
          );
        w["Account removal"] =
          "Practice confirmation completed · Real account unchanged";
      } else w[current.title] = "Reviewed in practice";
      break;
    }
    case "request":
      b.status = "enquiry";
      next.messages.push({
        from: "Client",
        text: "I would love a black-and-grey forearm design. Can we plan a full-day sitting?",
      });
      break;
    case "message":
      next.messages.push({ from: "Artist", text: values.message });
      break;
    case "reference":
      next.client.reference = true;
      next.messages.push({
        from: "Client",
        text: "Reference image shared: black-and-grey botanical forearm design.",
      });
      break;
    case "brief":
      next.client.brief =
        "Black-and-grey forearm design. Full-day sitting. Reference image attached.";
      break;
    case "price":
      b.price = Math.round(Number(values.price) * 100);
      b.deposit = Math.round(Number(values.deposit) * 100);
      if (b.deposit > b.price)
        throw new Error("Deposit cannot exceed the estimate.");
      b.paid = 0;
      break;
    case "schedule": {
      const count = Number(values.sittings);
      if (!Number.isInteger(count) || count < 1 || count > 12)
        throw new Error("Choose 1–12 sittings.");
      const dates: string[] = [];
      const date = new Date(`${values.date}T12:00:00Z`);
      const interval =
        values.frequency === "Fortnightly"
          ? 14
          : values.frequency === "Weekly"
            ? 7
            : 1;
      for (let i = 0; i < count; i++) {
        while ([0, 6].includes(date.getUTCDay()))
          date.setUTCDate(date.getUTCDate() + 1);
        const day = date.toISOString().slice(0, 10);
        if (values.deadline && day > values.deadline)
          throw new Error(
            "These sittings cannot fit before the project deadline. Choose another frequency or start date."
          );
        dates.push(day);
        date.setUTCDate(date.getUTCDate() + interval);
      }
      const promo =
        next.records["promotion.create"] ??
        next.records["calendar-fill.create"];
      if (promo?.month && dates.some(d => !d.startsWith(promo.month)))
        throw new Error("Choose dates within the offer’s eligible month.");
      b.dates = dates;
      b.price *= count;
      b.deposit *= count;
      if (promo) {
        const value = Number(promo.value);
        b.price =
          promo.valueType === "Amount"
            ? Math.max(0, b.price - Math.round(value * 100))
            : Math.round(b.price * (1 - value / 100));
        b.deposit = Math.min(b.deposit, b.price);
      }
      break;
    }
    case "proposal":
      b.status = "proposal sent";
      next.messages.push({
        from: "Artist",
        text: `Booking proposal: ${b.dates.length} sitting(s), total $${(b.price / 100).toFixed(2)}, deposit $${(b.deposit / 100).toFixed(2)}.`,
      });
      break;
    case "accept":
      b.status = "awaiting deposit";
      break;
    case "deposit":
      for (const offer of next.offers)
        if (offer.client === next.client.name)
          offer.status = "confirmed with deposit";
      b.paid = b.deposit;
      b.status = "confirmed";
      break;
    case "audience": {
      const clients = [
        {
          name: "Alex Taylor",
          city: "Brisbane",
          bookings: 3,
          paid: 3000,
          lastDays: 45,
          birthday: "October",
        },
        {
          name: "Sam Chen",
          city: "Sydney",
          bookings: 1,
          paid: 500,
          lastDays: 100,
          birthday: "January",
        },
        {
          name: "Jordan Reid",
          city: "Auckland",
          bookings: 5,
          paid: 5000,
          lastDays: 10,
          birthday: "October",
        },
      ];
      const minimumBookings =
        values.loyalty === "3 or more"
          ? 3
          : values.loyalty === "1 or more"
            ? 1
            : 0;
      const minimumPaid =
        values.lifetime === "$2000+"
          ? 2000
          : values.lifetime === "$500+"
            ? 500
            : 0;
      const days =
        values.recency === "Over 90 days"
          ? 90
          : values.recency === "Over 30 days"
            ? 30
            : 0;
      next.audience = clients
        .filter(
          c =>
            c.bookings >= minimumBookings &&
            c.paid >= minimumPaid &&
            c.lastDays >= days &&
            (values.birthday === "Any" || c.birthday === values.birthday) &&
            (values.city === "Any" || c.city === values.city)
        )
        .map(c => c.name);
      next.workspace["Audience preview"] =
        `${next.audience.length} matching clients · ${next.audience.join(", ") || "None"}`;
      break;
    }
    case "notifications":
      if (chapter.id === "calendar-fill" && current.id === "send") {
        const duration =
          next.records["calendar-fill.create"].expiry === "48 hours"
            ? 48
            : next.records["calendar-fill.create"].expiry === "7 days"
              ? 168
              : 24;
        next.offers = next.audience.map(client => ({
          client,
          status: "available",
          expiresAt: new Date(Date.now() + duration * 3600000).toISOString(),
        }));
      }
      next.notifications.push(
        "Push preview · Your booking or offer has been updated.",
        "SMS preview · Open Tattoi to review your update. No message sent."
      );
      break;
    case "forms":
      b.forms = "issued";
      break;
    case "signed":
      b.forms = "signed";
      break;
    case "arrival":
      if (b.forms !== "signed")
        throw new Error("Complete the mock forms first.");
      b.status = "arrived";
      break;
    case "start":
      b.status = "in progress";
      break;
    case "procedure":
      b.procedure = values.procedure;
      break;
    case "balance-request":
      if (!b.procedure) throw new Error("Save the practice procedure first.");
      b.status = "awaiting final payment";
      break;
    case "balance":
      b.paid = b.price;
      b.status = "completed";
      break;
    case "reschedule":
    case "promo-reschedule": {
      const day = new Date(`${values.date}T12:00:00Z`).getUTCDay();
      if ([0, 6].includes(day))
        throw new Error("The practice artist is unavailable on weekends.");
      if (values.time && values.time !== "09:00")
        throw new Error(
          "A full-day sitting starts at 09:00 in this practice calendar."
        );
      if (b.dates.includes(values.date))
        throw new Error("That slot is already occupied. Choose another date.");
      b.proposedDate = values.date;
      if (current.effect === "promo-reschedule")
        b.proposedPrice = values.keep === "true" ? b.price : 100000;
      break;
    }
    case "promo-seed":
      b.price = 80000;
      break;
    case "reschedule-request":
      b.status = "change awaiting client approval";
      break;
    case "reschedule-accept":
      if (!b.proposedDate)
        throw new Error("Choose a new date before requesting approval.");
      const selectedIndex =
        next.sandbox?.rescheduleIndex ?? (b.dates.length > 1 ? 1 : 0);
      b.dates[selectedIndex] = b.proposedDate;
      if (
        next.sandbox?.plans?.[0]?.items?.[selectedIndex] &&
        next.sandbox?.rescheduleStart
      ) {
        const item = next.sandbox.plans[0].items[selectedIndex];
        item.startsAt = next.sandbox.rescheduleStart;
        item.endsAt = new Date(
          +new Date(item.startsAt) + item.durationMinutes * 60000
        ).toISOString();
      }
      b.price = b.proposedPrice ?? b.price;
      delete b.proposedDate;
      delete b.proposedPrice;
      b.status = "confirmed";
      break;
    case "promotion":
      if (Number(values.value) <= 0)
        throw new Error("Offer value must be greater than zero.");
      if (
        (values.valueType ?? "Percent") === "Percent" &&
        (Number(values.value) <= 0 || Number(values.value) > 100)
      )
        throw new Error("Discount must be greater than 0 and at most 100%.");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(values.month))
        throw new Error("Enter an eligible month as YYYY-MM.");
      break;
    case "interest":
      if (next.offers.length) next.client.name = next.offers[0].client;
      next.messages.push({
        from: "Client",
        text: "I would like to use this offer. Can we discuss the design?",
      });
      break;
    case "expire":
      for (const offer of next.offers)
        if (offer.status !== "confirmed with deposit") offer.status = "expired";
      next.notifications.push(
        "Unconfirmed practice offers expired. The deposit-confirmed booking is retained."
      );
      break;
    case "voucher":
      next.voucher = {
        balance: Math.round(Number(values.value) * 100),
        owner: "Alex Taylor",
      };
      break;
    case "voucher-purchase":
      next.messages.push({
        from: "Client",
        text: "Voucher purchase confirmed (simulated).",
      });
      break;
    case "voucher-transfer":
      if (next.voucher) next.voucher.owner = "Sam Chen";
      break;
  }
  if (current.effect === "setting")
    projectPracticeStep(next, `${chapter.id}.${current.id}`, values);
  next.checkpoints = [
    ...(state.checkpoints ?? []),
    { ...structuredClone(state), checkpoints: [] },
  ].slice(-30);
  next.cursor++;
  next.revision++;
  if (
    next.cursor === chapter.steps.length &&
    !next.completed.includes(chapter.id)
  )
    next.completed.push(chapter.id);
  return next;
}

/** Restoring a guide checkpoint affects only this private practice session. */
export function previousPractice(state: PracticeState): PracticeState {
  const checkpoints = state.checkpoints ?? [];
  if (!checkpoints.length)
    throw new Error("There is no earlier checkpoint in this chapter.");
  const previous = structuredClone(checkpoints[checkpoints.length - 1]);
  return {
    ...previous,
    revision: state.revision + 1,
    checkpoints: checkpoints.slice(0, -1),
  };
}
