# Developer People and Suppliers recovery

Production diagnosis: the People query succeeded against MySQL; the browser request was rejected with “Private developer session required. Sign in again.” Suppliers additionally failed because `suppliers.isActive` was absent.

Applied the additive supplier-visibility migration on Railway on 2026-09-23. The supplier list query then returned 14 records successfully. No supplier or order records were deleted.

Developer query and mutation authorization failures now display a specific sign-in prompt. Expired list views hide their controls/data, stop retrying the list query, and provide an action that clears both stored sessions and opens the main login page. Other errors retain normal error handling.

Validation: TypeScript and frontend production build passed. Isolated production-preview browser checks verified People and Suppliers authorization errors produce the dedicated prompt and navigate to `/login`. End-to-end production sign-in still requires the owner’s password.
