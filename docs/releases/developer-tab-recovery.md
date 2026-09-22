# Developer People and Suppliers recovery

Production diagnosis: the People query succeeded against MySQL; the browser request was rejected with “Private developer session required. Sign in again.” Suppliers additionally failed because `suppliers.isActive` was absent.

Applied the additive supplier-visibility migration on Railway on 2026-09-23. The supplier list query then returned 14 records successfully. No supplier or order records were deleted.

Developer query and mutation authorization failures now display a specific sign-in prompt. Expired list views hide their controls/data, stop retrying the list query, and provide an action that clears both stored sessions and opens the main login page. Other errors retain normal error handling.

Validation: TypeScript and frontend production build passed. Isolated production-preview browser checks verified People and Suppliers authorization errors produce the dedicated prompt and navigate to `/login`. End-to-end production sign-in still requires the owner’s password.

## Follow-up: fresh logins losing developer permission

The session rejection was not necessarily expiry: `useAuth` silently called `auth.refreshToken` after login, and that endpoint replaced the dedicated developer token with an ordinary 90-day token. This removed the `masterDev` claim. Overview could finish before replacement while later tab requests failed.

Developer users now skip silent refresh. The server also returns the unchanged, verified developer token if an older client requests refresh; it neither strips privileges nor extends the original 30-minute expiry. Ordinary tokens cannot be elevated through refresh. Already-replaced tokens require one fresh sign-in after deployment.

Validation: nine targeted authentication tests passed, including unchanged-token refresh and rejection of ordinary tokens. TypeScript and production build passed. Dashboard browser tests passed at 320px and 390px, including an assertion that no developer silent-refresh request occurs; ordinary-role exclusion also passed.
