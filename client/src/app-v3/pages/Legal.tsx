import type { ReactNode } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Screen, Section } from "../design/primitives";

/**
 * Plain-English privacy policy and terms. The wording describes what the app actually does and was
 * written by the product team, not a lawyer. Set LEGAL_REVIEWED to true once a lawyer has approved
 * the text; until then each page says it is a draft.
 */
export const LEGAL_REVIEWED = false;
export const LEGAL_UPDATED = "11 November 2026";
const CONTACT = "privacy@tattoi.app";

function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  // Signed-in artists reach these from Settings; everyone else arrives by a public link.
  const { user } = useAuth();
  return (
    <Screen
      title={title}
      subtitle={`Last updated ${LEGAL_UPDATED}`}
      back={user?.role === "artist" ? "/settings" : undefined}
      publicView={!user}
    >
      {!LEGAL_REVIEWED && (
        <p role="note" className="legal-draft">
          Draft. This document is awaiting legal review and may change before
          Tattoi’s public release.
        </p>
      )}
      <div className="legal-copy">{children}</div>
      <p className="v3-muted">
        <Link href="/privacy">Privacy Policy</Link> ·{" "}
        <Link href="/terms">Terms of Service</Link>
      </p>
    </Screen>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <Section title="Who we are">
        <p>
          Tattoi is a booking and payments app for tattoo artists, their clients
          and tattoo suppliers. This policy explains what personal information
          we collect, why, and the choices you have. Questions:{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </Section>
      <Section title="What we collect">
        <ul>
          <li>
            <b>Account details:</b> your name, email, phone number, city, and a
            password stored in hashed form.
          </li>
          <li>
            <b>Bookings:</b> requests, reference and placement photos, sitting
            dates, prices, messages between artist and client, and notes an
            artist keeps about a client.
          </li>
          <li>
            <b>Consent and medical forms:</b> the answers and signature you give
            before a sitting. This can include health information, which we
            treat as sensitive.
          </li>
          <li>
            <b>Payments:</b> amounts, dates and status. Card and bank details
            are collected and held by Stripe, not by Tattoi.
          </li>
          <li>
            <b>Business details (artists and suppliers):</b> studio name,
            address, licence number, opening hours, services and products.
          </li>
          <li>
            <b>Device information:</b> push notification tokens, app version and
            error reports, used to deliver notifications and fix faults.
          </li>
        </ul>
      </Section>
      <Section title="How we use it">
        <ul>
          <li>To run bookings, reminders, messages and payments.</li>
          <li>
            To show an artist the clients, forms and payments for their own
            bookings, and to show a client their own bookings and artists.
          </li>
          <li>To prevent fraud, resolve disputes and meet legal duties.</li>
          <li>To fix problems and improve the app.</li>
        </ul>
        <p>We do not sell personal information or use it for advertising.</p>
      </Section>
      <Section title="Who sees it">
        <ul>
          <li>
            <b>Your artist or client:</b> the two sides of a booking see the
            details of that booking, including forms the client signs for it.
          </li>
          <li>
            <b>Service providers:</b> Stripe (payments), our email, SMS and push
            notification providers, and our hosting and file storage providers.
            They handle information only to provide their service to us. Some
            are located outside Australia.
          </li>
          <li>
            <b>Authorities:</b> when the law requires it.
          </li>
        </ul>
      </Section>
      <Section title="How long we keep it">
        <p>
          We keep your information while your account is open. Signed consent
          forms and payment records are kept for the period health and tax law
          requires, even after an account closes. Other information is deleted
          or de-identified when you delete your account.
        </p>
      </Section>
      <Section title="Your choices">
        <ul>
          <li>
            <b>See and correct:</b> edit your details in Settings at any time.
          </li>
          <li>
            <b>Download:</b> get a copy of your information from Settings.
          </li>
          <li>
            <b>Delete:</b> delete your account from Settings.
          </li>
          <li>
            <b>Notifications:</b> turn messages, reminders and updates on or off
            in Settings.
          </li>
          <li>
            <b>Complain:</b> contact us first at{" "}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. If you’re not
            satisfied, you can contact the Office of the Australian Information
            Commissioner (oaic.gov.au) or, in New Zealand, the Privacy
            Commissioner (privacy.org.nz).
          </li>
        </ul>
      </Section>
      <Section title="Security">
        <p>
          Information is encrypted in transit, passwords are hashed, and access
          is limited to the people on each booking. No system is perfectly
          secure; if a breach is likely to cause serious harm we will tell you
          and the regulator as the law requires.
        </p>
      </Section>
      <Section title="Changes">
        <p>
          If we change this policy in a way that matters, we’ll tell you in the
          app before it takes effect.
        </p>
      </Section>
    </LegalPage>
  );
}

export function TermsOfService() {
  return (
    <LegalPage title="Terms of Service">
      <Section title="The service">
        <p>
          Tattoi lets artists take booking requests, schedule sittings, collect
          deposits and balances, send forms and message clients, and lets
          suppliers sell to artists. Tattoi is not a party to the tattoo service
          itself: that agreement is between the artist and the client.
        </p>
      </Section>
      <Section title="Your account">
        <ul>
          <li>You must be 18 or older.</li>
          <li>
            Keep your sign-in details private and your information accurate.
          </li>
          <li>
            Artists are responsible for holding the licences and meeting the
            health rules that apply where they work.
          </li>
        </ul>
      </Section>
      <Section title="Payments and fees">
        <ul>
          <li>Payments are processed by Stripe and paid out to the artist.</li>
          <li>
            Clients pay a platform fee of 3.4% (minimum $5) on each payment,
            shown before they pay.
          </li>
          <li>
            Artists on the Free plan pay a 2% fee on payments they receive. Paid
            plans (Pro, Studio) have a monthly subscription and no artist fee.
            Current prices are shown in the app before you subscribe.
          </li>
          <li>
            Subscriptions renew monthly until cancelled. Cancelling takes effect
            at the end of the paid period.
          </li>
        </ul>
      </Section>
      <Section title="Deposits, changes and cancellations">
        <ul>
          <li>
            A deposit holds the client’s dates and comes off the price of the
            sitting.
          </li>
          <li>
            Each artist sets their own notice period for rescheduling and their
            cancellation policy, shown to the client before they pay. Deposits
            may be forfeited under that policy.
          </li>
          <li>
            Refunds are decided by the artist under their policy and the
            consumer law that applies. Nothing in these terms limits rights you
            have under the Australian Consumer Law or New Zealand consumer law.
          </li>
        </ul>
      </Section>
      <Section title="Acceptable use">
        <p>
          Don’t use Tattoi to break the law, harass anyone, take payments for
          anything other than genuine bookings and orders, upload content you
          don’t have the right to use, or interfere with the service. We may
          suspend accounts that do.
        </p>
      </Section>
      <Section title="Your content">
        <p>
          You keep ownership of the photos, designs and messages you add. You
          give Tattoi permission to store and display them as needed to run the
          service, including showing an artist’s portfolio publicly when they
          choose to publish it.
        </p>
      </Section>
      <Section title="Liability">
        <p>
          We provide the app with reasonable care, but we don’t guarantee it
          will always be available or error-free. To the extent the law allows,
          Tattoi is not liable for the tattoo service, for disputes between
          artists, clients and suppliers, or for indirect losses.
        </p>
      </Section>
      <Section title="Ending and changes">
        <p>
          You can delete your account at any time. We’ll give notice in the app
          before changing these terms in a way that matters. These terms are
          governed by the laws of Queensland, Australia.
        </p>
      </Section>
    </LegalPage>
  );
}

/** The consent line shown where an account is created. */
export function LegalConsent() {
  return (
    <>
      I agree to the{" "}
      <a href="/terms" target="_blank" rel="noreferrer">
        Terms of Service
      </a>{" "}
      and{" "}
      <a href="/privacy" target="_blank" rel="noreferrer">
        Privacy Policy
      </a>
      .
    </>
  );
}
