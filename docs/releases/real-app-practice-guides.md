# Real app artist practice guides

Artist practice renders the same ArtistRoutes and navigation as the normal workspace. A closed tRPC adapter sends supported operations to the isolated practice session; it never falls back to live operations. Fictional records are shared across the actual messages, booking wizard, calendar, project, promotion and financial screens.

Twenty-two guide recipes highlight actual mounted controls and advance on user actions or successful mutations. Client responses, payments and external deliveries are simulated behind the scenes. Guide copy describes each step naturally without referring to mock records. After compulsory account setup, each page opens its own guide on the first visit per account. The question mark directly replays that page’s guide. There is no guide chooser. Leaving a guide restores the originating page. A portalled spotlight keeps the described control sharp while the surrounding page receives a subtle 0.8px blur and 4% tint.

No schema migration is needed. The existing practice session stores guide progress and sandbox data. Replaying a guide resets its fictional fixture. Guide progress persists, but an interrupted modal or unfinished form must be reopened; form drafts are not restored.

Validation includes every guide's starting control, enquiry through deposit and calendar, client discounts and gift vouchers, simulated bank verification, isolated routing and control mutations. Production provider delivery and payments remain outside practice.
