# Universal practice mode implementation plan

Implemented on `codex/tattoi-ivory-design-system`. This document records the design and completion criteria for the artist practice environment. See `practice-implementation-status.md` for delivered behavior and validation.

## Scope and completion rule

Every artist-facing action must have a registry entry: navigation, search, filtering, selection, editing, submission, cancellation, deletion, payment, upload, external handoff and recovery. A chapter groups actions into a useful workflow; it does not replace individual action coverage.

The attached source inventory is a starting checklist, not proof of exhaustive coverage. Before implementation is declared complete, reconcile it against every live route, sheet, conditional state and actionable control available to the tattoo artist. Each item must be implemented in practice mode, handled as a read-only explanation, or explicitly classified as an internal operation with no user-facing tutorial. No unclassified actions may remain.

Hidden and deprecated endpoints are not instructions to expose those features. Client, supplier and developer actions are outside tutorial scope. Artist-accessible studio actions remain in scope.

## Shared dataset and separate user sessions

Create one versioned backend template with fictional records and assets. Instantiate a separate practice session for each authenticated user; public or other-role access is not part of this tutorial programme. Never share a mutable client or calendar between users.

Use a dedicated practice data store, or a dedicated practice schema accessed through separate repositories. Prefer separation over adding a tutorial flag to every production table. Production repositories, analytics, scheduled jobs, exports and integrations must not receive practice records. Practice endpoints require server-issued session identity and ownership checks; frontend mode alone is not protection.

Seed these connected records:

- One central fictional client, Alex Taylor, plus a fictional artist and additional clients for audience and counterpart scenarios.
- A configurable client audience for loyalty, lifetime value, recency, booking count, birthday month, city and communication consent examples.
- A full-day tattoo service, shorter services, a six-sitting sleeve and an eight-sitting project. Service prices and deposit rules come from the template, not tutorial copy.
- Working days, breaks, design time, time off and conflicting appointments. Dates are relative to session start and use the practice artist’s timezone.
- A request, consultation, text conversation, individual references, reference grid, placement grid and design brief.
- Draft, proposed, deposit-paid, completed, cancelled, rescheduled and no-show examples as supported by the actual application.
- Ledger entries, deposits, balances, refunds, payout states and payment requests, with consistent cents-based calculations.
- Blank and completed consent/medical forms, procedure records and aftercare information. All personal and health information is explicitly fictional.
- Discounts, vouchers, expiring offers, promotional projects and an available calendar opening.
- A studio, invitations, member roles, guest spot, shopfront, products, variants, stock, orders and events.
- A supplier store, imported catalogue, cart, shipping options, order history and reorder recommendations.
- Import fixtures containing valid rows, duplicates, missing fields, conflicting appointments and rejected media.

Provide Reset chapter, Reset all, Resume and Start again. Existing sessions retain their template version until reset. Session expiry and cleanup must only remove practice data.

## Real screens and real rules with simulated external outcomes

Reuse the real ivory components and domain validation. Extract reusable booking, quote, discount, balance, availability and state-transition logic where necessary. Supply practice repositories and provider adapters underneath that logic; do not reproduce the rules in tutorial-specific arithmetic.

Practice mode must visibly persist across pages and sheets: “Practice mode · No real payments or messages”. Exiting returns to the previous real page and restores real query subscriptions. Use distinct practice query keys and live-event channels to prevent cache contamination.

The user performs meaningful actions. A clearly labelled “Simulate client response” control advances the other participant’s side. A counterpart preview shows the simulated client response only; it does not become a client tutorial or change the artist’s real permissions.

Simulate Stripe payments, account onboarding, verification, payouts, subscriptions and refunds. Simulate SMS, email and push with inbox previews, consent rules, delivery states and failures. Simulate imports with packaged website/calendar/Instagram fixtures. Never scrape a real website, request real identity documents, register devices, send a notification, sign a real form, change credentials or charge money from practice mode.

External-service simulation must be visibly labelled and must not claim to prove production delivery or provider verification. Signed practice forms have no legal effect. Legal wording should reuse the application’s approved text rather than inventing assurances.

## Action registry

Each action needs a stable action ID, artist permission requirements, real screen/target, prerequisites, template scenario, expected input, validation, expected state transition, affected records, simulated external effect, completion predicate, edge cases and reset checkpoint.

Explain three things: what to do, what it changes, and why that matters. Highlight real controls; do not use positional selectors, typed private values or pretend buttons. Only declare a step complete after the backend practice outcome is confirmed, not after a click.

Account-scoped backend progress should persist across devices. Keep tutorial completion and dismissal separate. The “?” button offers Page overview, Practise this workflow and Resume practice. An introductory tour starts on first sign-in; invasive exercises require an explicit Start practice action. Allow Skip, Back, Replay and Exit without performing the associated business action.

If a prerequisite is absent, load the required practice scenario or explain it. Do not silently skip a failed step. Allow keyboard navigation, reduced motion and both themes. Guides must fit narrow screens, remain readable over sheets and respect safe areas.

## Artist action catalogue

| Area | Actions to cover | Practice outcome to verify |
|---|---|---|
| Sign in and onboarding | Artist sign in; artist registration and role selection; recovery; secure-link sign-in; complete profile; resume setup; sign out | Artist-specific progress, no shared identity, no real credential changes |
| Today | Switch Today/Clients/Supplies; open a task; follow its deep link; open contact action; complete task; inspect next seven days; open sitting; inspect estimates and amount to collect; review incoming orders; open recommendation; dismiss weekly snapshot; update task preferences | The relevant simulated task and metrics update coherently |
| Calendar | Previous/next/today; select day; scroll schedule; filter artist; open/deselect sitting; header and daily plus; personal appointment; edit personal time; inspect conflict | Same practice sittings visible in schedule, projects and Today |
| Client directory | Search; add client; edit contact/profile fields; open record; view spend/history; add/delete private note; inspect forms and media; open conversation; select multiple clients; bulk messaging where available | Only practice clients affected; private notes remain private |
| Inbox and conversation | Search/open thread; send text; empty-message validation; attach/upload/view image; reference/placement grids; read receipts; load older messages; retry failure; pin consultation; tag/untag where exposed; quick action create/edit/delete/use; open project | Both practice perspectives see messages, media and read state; design references reuse original assets |
| Requests and consultations | Inspect enquiry; reference review; reply; mark responded; pin; archive; restore only if supported; create consultation; update status; review public lead; change lead status | Request and conversation state agree |
| Single sitting wizard | Select/create client; select service; inspect duration, sitting count and per-sitting/project cost; modify supported details; start date; finish-by limit; date/time selection; auto-find; edit results; review; back; send | A pending proposal with correct totals, availability and linked conversation |
| Proposal lifecycle | View; modify/replace where supported; withdraw; decline; retry send; client review; apply available promotion; acceptance; simulated deposit; abandoned/failed checkout; duplicate acceptance | Deposit confirmation produces one booking, correct ledger and preserved proposal history |
| Large project wizard | Select multi-sitting service; consecutive/weekly/fortnightly/monthly spacing; feasible frequency constraints; automatic search; split notes; per-sitting review; total/deposit allocation; send; accept | All sittings fit availability and offer rules; sums match project totals |
| Project workspace | Rename project; select another project; inspect progress/next sitting; open sitting; open messages; browse design/references; inspect transaction provenance; view forms/aftercare | One canonical practice project state across all views |
| Design brief | Open brief; refresh; inspect references; add new conversation information; generate draft where exposed; review stale/failed generation | A deterministic simulated brief changes with the practice conversation and is labelled as requiring verification |
| Sitting preparation | Review client history, medical information and outstanding forms; issue/request forms where supported; open/sign/review client forms; open procedure details; inspect readiness | Correct client and sitting links, fictional signed records |
| Finish and payment | Finish sitting; review balance; request balance; manual payment where exposed; simulated card/bank payment; additional charge; decline/failure; retry; zero balance; overpayment prevention | Completion and final payment update appointment, project, calendar, Today, client history and money without a second finish action |
| Procedure and aftercare | Review/create procedure record using the supported completion flow; inspect log; view/update templates; view client aftercare | Records remain linked to the sitting; no fabricated manual-edit action |
| Reschedule | Select sitting; choose date/time; working-hours and break validation; conflict check; review; save; notify; view audit label | Same sitting and payment references; released original slot; updated views |
| Promotional reschedule | Move within months; move outside keeping discount; move outside removing discount; review revised price; send approval; client accept/decline; artist withdraw; approval expiry; competing slot request | Original stays booked until agreement; temporary hold and approved repricing are correct |
| Cancellation | Cancel one sitting; cancel remaining project sittings; cancel proposal; no-show if exposed; review payment consequences; separate refund decision | Correct cancellation scope, no implicit refund, availability released as appropriate |
| Financials | Change period; inspect daily bars/totals; inspect fees/refunds; available/pending balance; open transaction; payment history/search/filter; refund preview/confirm; failure/retry | Earnings, recorded payments and payouts remain distinct and internally consistent |
| Bank and payouts | Start embedded setup; business/identity/bank steps; simulated document upload; validation; leave/resume; pending/rejected verification; refresh; accept-payment/payout readiness; change payout schedule; disconnect/cancel disconnect; legacy handoff explanation | No real connected account; simulated account status accurately gates practice checkout |
| Services and hours | Add/edit/remove service; duration/count/pricing/deposit; working days/hours; breaks; time off/design days; external-calendar URL check; save/cancel | Subsequent practice proposals use updated service and availability |
| Profile and portfolio | Edit photo/name/bio/business details/location; upload/import media; preview; reorder; like where supported; delete/bulk delete; public profile view; copy/share booking link; slug availability | Public practice presentation matches saved data; sharing uses a preview, not an external send |
| Travel | Create/edit/remove trip where supported; dates/destination; match nearby clients; inspect availability impact | Fictional location results and correctly linked dates |
| Imports | Choose file; mapping; service mapping; preview; duplicates/conflicts; commit; results/retry; Instagram lookup/select/start/status/stop; Shopify URL/import/status | Deterministic fixture imports with no real scraping or production writes |
| Supplies | Search supplier; open image-backed store; search/filter products; choose variant; quantity increment/decrement/type; remove; cart; shipping/delivery; review/pay; abandon; stock/price change; order history/status/handoff | Practice inventory and orders update, no external purchase |
| Recommendations | Review predicted reorder; change quantities; remove/add item; add recommended order to cart; review interval/history evidence | Recommendations come from practice order history and remain editable |
| Shopfront products | Create/edit product where role permits; upload background/media; variants; stock; price; availability; public preview; checkout; order list/filter/detail; change fulfilment status | Only eligible catalogue and order states appear publicly |
| Events | Create/edit event where supported; schedule/format/capacity/price; publish availability; inspect registrations; client purchase; sold-out handling | Capacity and registration/payment state agree |
| Studio | Create/open studio; shared schedule; member details; invite; accept/decline; remove member; leave if exposed; studio billing; pending invite handling | Simulated membership preserves real authorization boundaries |
| Waitlist | Join/remove; inspect client preference; offer opening; review expiry/price/deposit; client accept/pay; reject/expiry; competing claims | One eligible client secures a slot; other offers do not create duplicate bookings |
| Plans and billing | Inspect current plan; compare tiers/fees; subscribe/upgrade/change only as exposed; simulated checkout; billing portal; cancellation explanation | Practice entitlements and billing state only |
| Settings | Search setting; edit/save/cancel business/account data; notification preferences; templates; payment methods; policies; appearance; update/reload; help/replay; account removal confirmation | No real account deletion, credential changes, browser update or integration disconnection |

## Promotion and voucher action catalogue

Teach discounts and purchased vouchers separately. Do not describe a voucher as a free discount.

| Workflow | Actions and branches | Required result |
|---|---|---|
| Create offer | Open from Today/thread; select offer type; enter custom percentage or amount; delete initial zero; choose applicability to new/existing bookings where supported; eligible months; expiry; 24/48-hour duration; image upload/convert; preview; save/cancel | Stored practice offer with valid money, date and image fields |
| Manage offer | List/open; edit; explain issued-term preservation; archive/delete as supported; inspect active/expired status | Previously issued recipients retain their issued terms |
| Target audience | All eligible clients; manual one/many; search/select/deselect; lifetime-value, loyalty/bookings, recency, birthday month, city; combine/reset filters; preview recipients | Recipient selection reproducible from fictional client data |
| Deliver offer | Select supported channels; consent checks; verified/unverified phone; push permission; provider unavailable; send; delivery preview; failure/retry; duplicate-send handling | One issue per intended recipient; no real push, SMS or email |
| Client interest | Discover/Bookings/message card; terms; use/decline; sticky offer; consultation; expired offer; notification to artist | Interest remains separate from secured booking |
| Book with offer | Tertiary conversation action; service; eligible date search; feasible frequency; entire wizard; discount allocation; deposit math; send; accept/pay | Confirmed application tied to the new practice booking with consistent totals |
| Expiry and abandonment | Offer expiry before booking, pending checkout, confirmed deposit, client non-response and artist withdrawal | No stale offer can secure a new booking; confirmed issued booking terms remain coherent |
| Voucher purchase | Set value/expiry as supported; issue purchase offer; simulated checkout; payment failure/retry; inspect balance | Voucher becomes usable only after simulated confirmed purchase |
| Voucher redemption | Select before eligible deposit/balance payment; partial/full use; remaining balance; insufficiency; prevent cross-artist/currency use | Credit and cash payment are distinguished; voucher cannot overspend |
| Voucher transfer | Choose destination; confirm; recipient accept/decline where supported; expiry/duplicate/self-transfer validation | Same artist, currency, remaining value and expiry; no duplicated balance |
| Calendar filling | Inspect a gap; choose service/months; short deadline; audience filters/manual additions; preview recipients; send; one client books; others decline/expire | Available work becomes a confirmed sitting without conflicts or unintended repeat discounts |

## Simulated counterparts without separate role tutorials

Only the tattoo artist performs guided exercises. Client, supplier, studio-member and provider behaviour exists solely to demonstrate the result of an artist action and let the artist continue the workflow.

- Client: sends the fictional request and references, replies to consultation, accepts or declines proposals, completes fictional forms, pays a simulated deposit or balance, expresses promotional interest and accepts or declines reschedule terms.
- Supplier: provides fictional products, variants, stock, shipping options, order confirmation and fulfilment status for the artist’s supply-order workflow. No supplier registration, store publication, account management or catalogue-editing tutorial.
- Studio member: accepts or declines an artist-issued invitation where the real artist has permission to manage a studio. No separate studio-role onboarding.
- Stripe: supplies simulated onboarding, verification, checkout, refund and payout outcomes. The artist completes only the controls they normally see.
- Notifications: shows fictional SMS, push and email previews and delivery results linked to the artist’s action; nothing is sent.
- Public pages: the artist can preview their own public profile, booking link, store or event listing. Visitors’ interactions are simulated responses, not separate guided exercises.

Exclude client-only Discover/profile/moodboards, supplier-only administration, developer dashboards, privileged platform operations and public-user registration tutorials. Keep studio membership, shared schedule, shopfront management and other features only where they are available through the artist’s actual permissions. Never expose a hidden endpoint as a tutorial action.

The promotion catalogue includes counterpart events such as redemption and voucher transfer only to explain results of artist-created offers. Client-only transfer controls are not guided artist actions.

## Cross cutting actions and failures

Every applicable action must include cancel/back/close, keyboard selection, search/filter reset, empty and loading states, validation, permission denial, offline/interrupted response, retry, duplicate click, stale state and restore/resume. Include upload preview/remove/retry, unsupported media, conversion, simulated storage failure and access errors. Include notification consent and denied permission without opening an OS permission prompt during practice.

Use the same canonical practice state for every view. Demonstrate immediate cross-view updates after changes; subscription/refresh events come from the practice environment, not production event channels. Simulate duplicate and delayed payment events to teach reliable confirmation while exercising idempotency.

Numeric inputs must support clearing zero and typing custom valid values. Dates must respect timezone and daylight-saving behaviour where applicable. Financial scenarios must assert cents-level sums. Never accept invalid dates or overbook a slot just to advance a tutorial.

## Implementation order

1. Inventory and registry: map live artist routes, artist permissions, controls, queries, mutations and external handoffs. Assign coverage status and identify reusable rules.
2. Isolation foundation: practice store/session ownership, versioned seed templates, simulation adapters, cache/event boundaries, reset/resume/cleanup and persistent practice banner.
3. Complete first-booking chapter: enquiry to conversation to entire wizard to proposal to deposit to confirmed booking and notification previews. Include every wizard field and Back/edit path.
4. Sitting chapter: client history/references, forms, procedure record, final balance, completion and updated financial/history views.
5. Multi-sitting and reschedule chapters: project scheduling and full approval/hold/conflict/expiry branches.
6. Promotions and vouchers: direct-client offer, redemption, transfers, filtered audience and calendar-filling campaigns, including payment confirmation and expiry.
7. Business and commerce: services/hours/profile/imports, supplies/reorders/cart with simulated supplier responses, shopfront/events, money/payouts and subscriptions.
8. Remaining artist workflows: artist-accessible studio management, public-profile preview, account controls and all recovery paths.
9. Coverage audit and release: no unmapped user action; artist route/permission walkthroughs, isolation/security tests, realistic interaction tests and mobile/light/dark/accessibility review.

Implementation should proceed in this order, but the final acceptance criterion is complete action coverage rather than merely delivering the first chapters.

## Acceptance criteria

- Every live artist-facing action has an action registry entry and a tested practice outcome or explicit read-only handling.
- Two concurrent users can independently finish, reschedule and reset the same template without affecting one another.
- Practice produces zero production records, provider calls, outbound notifications, real uploads, charges or genuine signed records.
- Every booking and financial transition updates all related practice screens accurately; duplicates do not create additional money or sittings.
- Every tutorial uses actual controls, demonstrates the full supported workflow and explains the resulting change.
- Exit restores the real application without displaying practice clients, appointments, metrics or unread counts.
- Saved progress is account-scoped on the backend and survives a new device or browser.
- Reset, skip, replay and resume work at each chapter checkpoint; templates use useful relative dates.
- Existing production behaviour remains covered by regression checks. Live provider checks are separate from tutorial testing.

## Release and testing approach

Use a feature flag and internal accounts first. Apply practice migrations before enabling the feature. Production sign-in should initially show only the introduction; entry into practice must remain obvious and deliberate. Keep existing page overview guides as a lightweight alternative.

Validate isolation before end-to-end business exercises. Then test each chapter to completion, including failed simulated outcomes. After coverage is complete, test navigation and rendering across artist permissions, narrow screens, larger devices and both themes. Rollback disables entry while preserving real application operation and safely retaining practice progress.

## Source inventory baseline for artist scope

The companion practice-action-inventory.json retains the full source baseline for classification; it contains 343 router action candidates and 43 ivory page files. Counts include read operations and potentially internal or legacy actions. They do not count individual UI-only controls or prove artist-role availability. Each candidate must be mapped to an artist-visible action or explicitly excluded as another-role, internal or legacy operation. Excluded items require no tutorial.

| Source router | Actions requiring classification |
|---|---|
| aftercare | `getTemplate`, `updateTemplate`, `getForBooking` |
| appointments | `getArtistCalendar`, `getClientCalendar`, `getStudioCalendar`, `getByConversation`, `createPersonal`, `create`, `update`, `reschedule`, `delete`, `deleteAllForClient`, `deleteAllForArtist`, `resolveMysteryAppointments`, `confirmDeposit`, `findProjectAvailability`, `bookProject`, `deleteProposal`, `getProposalForAppointment`, `batchUpdateClientPrices`, `createBalancePaymentIntent`, `getClientBookings`, `cancelSession`, `cancelProjectSessions` |
| artistSettings | `get`, `getPublicByArtistId`, `testExternalCalendarUrl`, `upsert`, `matchClientsByLocation`, `getStripeOnboardingConfig`, `connectStripe`, `createStripeAccountSession`, `getStripeConnectStatus`, `disconnectStripe`, `getStripeAccountLink`, `submitStripeOnboarding`, `uploadStripeDocument`, `getPayoutSchedule`, `updatePayoutSchedule` |
| auth | `me`, `logout`, `updateProfile`, `setRole`, `completeOnboarding`, `linkInstagram`, `getInstagramAuthUrl`, `listArtists`, `deleteAccount` |
| billing | `artistOffer`, `studioOffer`, `subscriptionStatus`, `createCheckoutSession`, `createPortalSession`, `createArtistCheckoutSession`, `createArtistPortalSession` |
| booking | `checkAvailability`, `getCalendarIndicators`, `bookProject` |
| clientProfile | `getProfile`, `updateBio`, `updateAvatar`, `getSpendSummary`, `getHistory`, `getUpcoming`, `getConsentForms`, `getBoards`, `createMoodboard`, `deleteMoodboard`, `addMoodboardImage`, `getPhotos`, `updateClientProfile`, `getClientNotes`, `addClientNote`, `deleteClientNote`, `getMyPaymentRequests` |
| consultations | `list`, `create`, `update` |
| conversations | `list`, `getOrCreate`, `getById`, `markAsRead`, `pinConsultation`, `getClientMedia`, `getClients`, `bulkMessageClients`, `createClient`, `deleteAllClientsForArtist` |
| dashboard | `getUpcomingWeek`, `getArtistOverview`, `getClientOverview`, `getClientSessions`, `recordManualPayment`, `requestPayment` |
| dashboardTasks | `getBusinessTasks`, `startTask`, `completeTask`, `getSettings`, `updateSettings`, `getWeeklySnapshot`, `dismissWeeklySnapshot`, `shouldShowWeeklySnapshot`, `getQuickStats`, `getTaskBrief` |
| dataImport | `preview`, `commit`, `bulkImportClients`, `bulkImportAppointments` |
| designBrief | `get`, `refresh`, `generateDraft`, `conversationState` |
| errorLog | `log`, `list`, `resolve`, `clearResolved`, `purgeOld` |
| favourites | `list`, `toggle` |
| feed | `getDiscoverFeed`, `getArtistFeed`, `getArtistPublicProfile`, `getPublicArtistProfile` |
| forms | `getTemplates`, `updateTemplates`, `getPendingForms`, `signForm`, `getProcedureLogs` |
| funnel | `checkSlugAvailability`, `getDepositInfo`, `createDepositCheckout`, `getBalanceInfo`, `createBalanceCheckout`, `confirmBalance`, `confirmDeposit`, `generateDepositLink`, `getClientDepositLink`, `getArtistBySlug`, `submitFunnel`, `getLead`, `getLeads`, `updateLeadStatus`, `updateFunnelSettings`, `getFunnelSettings`, `uploadPublicImage`, `submitPublicBooking`, `getPaymentRequestInfo`, `createPaymentRequestCheckout` |
| instagram | `verifyUsername`, `startImport`, `getImportStatus`, `getLatestImport`, `getVideoUrl`, `stopImport` |
| invitations | `generateInvite`, `acceptInvite` |
| masterDev | `login`, `overview`, `people`, `person`, `savePerson`, `setAccountEnabled`, `suppliers`, `saveSupplier`, `setSupplierVisible` |
| merchantAuth | `detectCountry`, `validateAbn`, `validateNzbn`, `getMerchantProfile`, `id`, `userId`, `businessName`, `country`, `abn`, `nzbn`, `contactName`, `phone`, `address`, `integrationType`, `shopifyDomain`, `status`, `verified`, `claimed`, `lowStockThreshold`, `setStorePublished`, `updateProfile`, `getDashboardStats`, `register`, `claimStorefront`, `connectStripe`, `country`, `getMerchantStripeStatus`, `simulateShopifyImport`, `getSyncStatus`, `saveShopifyCredentials`, `triggerShopifySync` |
| messageTags | `toggle`, `list`, `bulkRemove` |
| messages | `references`, `declineProposal`, `list`, `send`, `updateMetadata`, `requestBalance`, `requestAdditional` |
| notificationTemplates | `list`, `create`, `update`, `delete` |
| offers | `preferences`, `setPreferences`, `requestSmsCode`, `verifySmsCode`, `deliveries`, `retryDelivery`, `purchase`, `balanceQuote`, `balanceCheckout`, `cancelBalanceCheckout`, `list`, `save`, `archive`, `audienceClients`, `audience`, `issue`, `conversation`, `declineConversation`, `use`, `transfer`, `resolveTransfer` |
| paymentMethodSettings | `get`, `upsert` |
| payouts | `refundPreview`, `refundTransaction`, `nextPayout`, `earningsBreakdown`, `payoutHistory` |
| places | `autocomplete`, `getPlaceDetails`, `staticMap`, `geocode` |
| policies | `list`, `getByType`, `upsert`, `delete` |
| portfolio | `create`, `list`, `toggleLike`, `delete`, `bulkDelete`, `reorder` |
| projects | `clientWorkspace`, `nameProject`, `setProjectName`, `summary` |
| promotions | `createTemplate`, `updateTemplate`, `getPromotions`, `issuePromotion`, `createAutoApply`, `getAvailableForBooking`, `redeemPromotion`, `updateAutoApply`, `deleteTemplate`, `getClientPromotions`, `updateIssuedPromotion` |
| push | `subscribe`, `unsubscribe`, `test`, `getPublicKey` |
| quickActions | `list`, `create`, `update`, `delete` |
| reconciliation | `overview`, `reconcilePlan`, `retryNotification` |
| reschedules | `get`, `resolve` |
| sessionPlans | `cancelOfferCheckout`, `offerOptions`, `setOffer`, `create`, `accept`, `decline`, `withdraw`, `getByConversation`, `getByClient`, `getById` |
| storefront | `getProducts`, `getSeminars`, `createProduct`, `updateProduct`, `updateVariant`, `getArtistStorefront`, `getStorefrontByArtistId`, `createStorefrontCheckout`, `cancelStoreCheckout`, `getPurchases`, `getOrderStatus`, `createSeminar`, `getOrders`, `updateOrderStatus`, `getPublicSeminars`, `createSeminarCheckout`, `accountId`, `name`, `currency` |
| studios | `getCurrentStudio`, `testUpgradeStudio`, `createStudio`, `getStudioMembers`, `removeMember`, `getStudioProfile`, `inviteArtist`, `getPendingInvites`, `respondToInvite` |
| supplierOrders | `getReorderRecommendations`, `getShippingRates`, `createSupplierCheckout`, `getSupplierOrderStatus`, `confirmSupplierOrder`, `getSupplierOrders` |
| suppliers | `scrapeShopifyStore`, `getSuppliers`, `deleteSupplier`, `getSupplier`, `getSupplierProducts` |
| system | `workspaceRevision`, `addLog` |
| upload | `getUploadUrl`, `uploadImage` |
| waitlist | `list`, `join`, `offer`, `accept`, `leave` |
| wallet | `createTemplate`, `listTemplates`, `issueVoucher`, `getMyVouchers` |
