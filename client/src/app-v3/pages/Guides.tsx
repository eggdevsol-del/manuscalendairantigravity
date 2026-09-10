import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTooltipTour } from "@/components/tooltip-tour";
import {
  Action,
  Row,
  Screen,
  SearchField,
  Section,
  Status,
} from "../design/primitives";

type Guide = { id: string; title: string; route: string; steps: string[] };
const artistGuides: Guide[] = [
  {
    id: "today",
    title: "Run your day",
    route: "/dashboard",
    steps: [
      "Today brings your appointments and outstanding work together. Open an appointment to see the client and next action.",
      "Check consent, the deposit and the client’s arrival before starting. Finish the session from its booking workspace when the work is done.",
    ],
  },
  {
    id: "booking",
    title: "Plan a booking",
    route: "/calendar",
    steps: [
      "Choose New booking, select a client and choose the service. Service duration and session count come from Working hours & services.",
      "Review each date and time. Availability suggestions respect working hours and breaks; check the final dates before sending.",
      "Review the estimate and deposit, then send the plan. The client accepts and pays the deposit to confirm the dates.",
    ],
  },
  {
    id: "inbox",
    title: "Turn an enquiry into a booking",
    route: "/conversations",
    steps: [
      "Open a client’s conversation to read their idea and references. Keep the discussion with the booking so you don’t need to find it elsewhere.",
      "Use the booking action when you’re ready to propose dates. Sending a message and sending a booking plan are separate actions.",
    ],
  },
  {
    id: "clients",
    title: "Keep client details together",
    route: "/clients",
    steps: [
      "Search for a client or add an existing client. Open their record to see appointments, forms and your notes.",
      "Use notes for information you need at the next session. Read the booking’s forms before the appointment and open Messages for the conversation.",
    ],
  },
  {
    id: "hours",
    title: "Set working hours and services",
    route: "/work-hours",
    steps: [
      "Enable the days you take appointments and set start and finish times. Add breaks inside the working day.",
      "Design and personal days are excluded from tattoo availability. Set each service’s price, duration and number of sittings, then save.",
    ],
  },
  {
    id: "link",
    title: "Share your booking link",
    route: "/settings?section=booking-link",
    steps: [
      "Choose your public link name and save it. Only the saved link is offered for copying and sharing.",
      "Clients send their idea from your public page before creating a password. They can then follow the conversation and booking in their account.",
    ],
  },
  {
    id: "portfolio",
    title: "Build your public portfolio",
    route: "/artist-profile?view=Portfolio",
    steps: [
      "Add a photo and caption, or review imported work. Open an item to see the full image or video.",
      "Select items to remove them from your portfolio. Review the public profile before sharing the booking link.",
    ],
  },
  {
    id: "money",
    title: "Track payments and refunds",
    route: "/money",
    steps: [
      "Compare recorded earnings with the available and pending Stripe balance. A pending payment is not yet a bank payout.",
      "Open Payment history to review a refund. The preview includes the remaining original charge and every session paid together. Check it carefully before confirming.",
    ],
  },
  {
    id: "bank",
    title: "Set up bank payouts",
    route: "/bank-payouts",
    steps: [
      "Complete Stripe’s identity and bank setup. Returning from the form does not itself mean verification is finished.",
      "Check the payout status here. Once available, choose a daily, weekly or monthly schedule and save it.",
    ],
  },
  {
    id: "forms",
    title: "Manage forms and consent",
    route: "/settings?section=regulation",
    steps: [
      "Review the medical and consent templates used for newly generated forms. Save each edited template separately.",
      "Changes do not rewrite already issued forms. Signed forms belong with the client and booking; completed procedure records can be searched here.",
    ],
  },
  {
    id: "waitlist",
    title: "Fill a cancellation",
    route: "/waitlist",
    steps: [
      "Clients opt into your waitlist from their booking workspace. Select a waiting client to offer a time.",
      "Set the date, duration, estimate, deposit and expiry. The slot becomes confirmed after the client accepts and pays.",
    ],
  },
  {
    id: "studio",
    title: "Work as a studio",
    route: "/studio",
    steps: [
      "Use Schedule to see active team members’ appointments. Open your own booking to manage it; other artists’ appointment details are read-only.",
      "Owners and managers can invite team members when studio billing is active. Team shows pending invitations and active members.",
      "Billing shows the studio’s subscription. Review it before subscribing; the shared team schedule is separate from chair rental or commission accounting.",
    ],
  },
  {
    id: "travel",
    title: "Plan a guest spot",
    route: "/settings?section=travel",
    steps: [
      "Add the destination and travel dates, then save the trip.",
      "Use nearby clients to find existing clients in the matching city or country. Saving a trip does not change working hours or send messages; arrange those separately.",
    ],
  },
  {
    id: "import",
    title: "Import existing client records",
    route: "/settings?section=data-import",
    steps: [
      "Choose a CSV and match its columns. For appointment imports, map service names only where they match your actual services.",
      "Preview the import and review duplicates or conflicts. Import ready rows, then check any failed rows before retrying.",
    ],
  },
  {
    id: "instagram",
    title: "Import Instagram work",
    route: "/settings?section=instagram",
    steps: [
      "Enter your public account name and check the account before starting. This lookup does not verify account ownership.",
      "Choose a post limit and import. The current importer hosts media copies for playback. Review imported items in Portfolio; this is not an embed-only integration.",
    ],
  },
  {
    id: "supplies",
    title: "Order studio supplies",
    route: "/supplies",
    steps: [
      "Choose a supplier, review variants and stock, and add quantities to your order.",
      "Review delivery and the final total before paying. Supply orders keeps the order status and any supplier handoff link together.",
    ],
  },
  {
    id: "notifications",
    title: "Manage reminders and message templates",
    route: "/settings?section=notifications",
    steps: [
      "Enable device notifications when you want booking and message updates. Device and browser permissions may need to be enabled too.",
      "Templates save wording for reuse. Saving a template alone does not schedule or send a message.",
    ],
  },
  {
    id: "plans",
    title: "Choose your artist plan",
    route: "/subscriptions",
    steps: [
      "Compare Free, Pro and Studio using the current prices and payment fees shown here.",
      "Review the subscription checkout before paying. Existing subscriptions can be managed through the billing portal.",
    ],
  },
];
const supplierGuides: Guide[] = [
  {
    id: "supplier-day",
    title: "Review your store day",
    route: "/dashboard",
    steps: [
      "Today shows paid orders needing fulfilment, low stock and recorded sales.",
      "Open Orders to work through purchases, or Products to adjust your Tattoi stock allocation.",
    ],
  },
  {
    id: "supplier-products",
    title: "Create and publish a product",
    route: "/merchant/products",
    steps: [
      "Add a product with its name, description, images, price and stock. Review variants before saving.",
      "Keep a product hidden while preparing it, then publish it when pricing, inventory and delivery are ready.",
    ],
  },
  {
    id: "supplier-orders",
    title: "Fulfil an order",
    route: "/merchant/orders",
    steps: [
      "Select a paid order and check items, quantities and delivery details.",
      "Prepare the order, add tracking where appropriate, then mark it fulfilled. This records fulfilment; it does not book a courier.",
    ],
  },
  {
    id: "supplier-payments",
    title: "Connect supplier payments",
    route: "/settings",
    steps: [
      "Open Payments and complete Stripe’s business and bank setup.",
      "Check the returned account status. Products can only be purchased when the store and payment account are ready.",
    ],
  },
  {
    id: "supplier-shopify",
    title: "Import your Shopify catalogue",
    route: "/settings",
    steps: [
      "Open Shopify and enter the store domain and an Admin API token with the required product permissions. Save to verify the connection.",
      "Start a catalogue import. New products are hidden until reviewed. Later imports update details without replenishing sold or reserved Tattoi stock.",
    ],
  },
  {
    id: "supplier-account",
    title: "Update your business details",
    route: "/settings",
    steps: [
      "Review the business name, contact details and store setup before sharing your storefront.",
      "Use Account for your personal profile and notifications. Keep business and bank details current so orders can be fulfilled.",
    ],
  },
];
const clientGuides: Guide[] = [
  {
    id: "client-booking",
    title: "Follow your booking",
    route: "/bookings",
    steps: [
      "Your booking shows the artist, dates and next action. Open it for messages, files, forms and payments.",
      "Review the full plan before paying the deposit. Dates are confirmed after payment confirmation.",
    ],
  },
  {
    id: "client-message",
    title: "Talk with your artist",
    route: "/conversations",
    steps: [
      "Open your artist’s conversation to send questions and reference images.",
      "Your booking plan stays with the same conversation. Check its dates, estimate and deposit before accepting.",
    ],
  },
  {
    id: "client-profile",
    title: "Prepare for your appointment",
    route: "/profile",
    steps: [
      "Keep your contact details up to date and review any forms your artist has issued.",
      "Complete each required form carefully. For an earlier appointment, opt into the cancellation waitlist from your booking.",
    ],
  },
];

export default function Guides() {
  const { user } = useAuth();
  const [, go] = useLocation();
  const tour = useTooltipTour();
  const [search, setSearch] = useState("");
  const guides =
    user?.role === "merchant"
      ? supplierGuides
      : user?.role === "client"
        ? clientGuides
        : artistGuides;
  return (
    <Screen
      title="Guided walkthroughs"
      subtitle="A little guidance, right where you work."
      back={user?.role === "merchant" ? "/account-settings" : "/settings"}
    >
      <SearchField
        value={search}
        onChange={setSearch}
        label="Find a walkthrough"
      />
      <Section title="Choose a workflow">
        {guides
          .filter(g => g.title.toLowerCase().includes(search.toLowerCase()))
          .map(guide => (
            <Row
              key={guide.id}
              title={guide.title}
              detail={`${guide.steps.length} steps · no changes made automatically`}
              trailing={
                tour.isTourCompleted("v3-" + guide.id) ? (
                  <Status tone="success">Viewed</Status>
                ) : undefined
              }
              onClick={() => {
                go(guide.route);
                tour.startTour({
                  id: "v3-" + guide.id,
                  steps: guide.steps.map((body, index) => ({
                    title: guide.title,
                    body,
                    targetId: "css:.v3-header",
                    onNext:
                      index === guide.steps.length - 1 ? undefined : () => {},
                  })),
                });
              }}
            />
          ))}
      </Section>
    </Screen>
  );
}

/** Non-modal guidance keeps the actual page usable. It never performs a business action. */
export function GuideOverlay() {
  const { activeTour, currentStep, nextStep, skipTour } = useTooltipTour();
  const visible = activeTour?.id.startsWith("v3-");
  useEffect(() => {
    if (!visible) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") skipTour();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [visible, skipTour]);
  if (!activeTour || !visible) return null;
  const step = activeTour.steps[currentStep];
  return createPortal(
    <aside
      className="v3-guide"
      aria-label="Guided walkthrough"
      aria-live="polite"
    >
      <div className="v3-section-heading">
        <h2>{step.title}</h2>
        <small>
          {currentStep + 1} / {activeTour.steps.length}
        </small>
      </div>
      <p>{step.body}</p>
      <div className="v3-inline">
        <Action tone="quiet" onClick={skipTour}>
          Close guide
        </Action>
        <Action onClick={nextStep}>
          {currentStep === activeTour.steps.length - 1
            ? "Finish guide"
            : "Next step"}
        </Action>
      </div>
    </aside>,
    document.body
  );
}
