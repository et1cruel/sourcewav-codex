# Sourcewav Ticket Sales — Master Prompt

Use this prompt when implementing, reviewing, or extending ticket sales in Sourcewav. It is grounded in the current static frontend, Supabase Auth/Database/Storage/Edge Functions, Cloudflare Pages deployment, and the seller-specific SlipOK transfer flow.

## Mission

Deliver a dependable Thai event ticket checkout. An organizer may publish tickets only after providing a PromptPay/bank QR and a SlipOK branch/API credential for the receiving account. A buyer reserves available inventory, transfers the exact server-calculated amount, uploads the original transfer slip, and receives a digital ticket only after the server verifies the slip with SlipOK and the database commits payment and ticket issuance atomically.

Treat payment confirmation as a financial state transition, not a UI event. The browser may request an operation and display its result; only trusted server code and database transactions may confirm payment, consume inventory, issue a ticket, or check one in.

## First inspect, then plan

Before changing code, inspect `AGENTS.md`, `MASTER_PROMPT.md`, the current ticket UI, every relevant Edge Function, SQL migration, RLS policy, Storage policy, `supabase/config.toml`, deployment scripts, and current Git changes. Reuse the existing architecture and visual language. Identify what already works, what is mock data, and what is still required for production. Do not overwrite local user changes or edit a migration already applied to a shared project; add a forward migration.

Write a short implementation plan and a risk list. Trace these paths end to end:

1. Organizer role and event creation.
2. Organizer receiving QR, bank details, SlipOK Branch ID and API Key.
3. Buyer inventory selection, amount calculation and order reservation.
4. Private slip upload, authenticated verification request and SlipOK response.
5. Idempotent payment confirmation, ticket creation, ticket wallet, and one-time check-in.
6. Expiry, rejection, provider outage, duplicate slip, refund/cancellation, and support recovery.

## Product and payment rules

- The organizer is the payee and receives funds directly. State this clearly before purchase; do not imply Sourcewav holds, escrows, or pays out funds.
- SlipOK credentials are mandatory for a ticketed event. Never expose API keys, encryption keys, service-role keys, or decrypted credentials to the browser, logs, URLs, analytics, or errors.
- Encrypt organizer API keys at rest using authenticated encryption and a server-only key. Store the encryption key in Supabase Edge Function secrets; document generation, rotation, and recovery without placing secret values in repository files.
- For every order, compute price and currency from trusted database rows. Reserve stock atomically with an idempotency key, a bounded ticket quantity, and a short expiry. Prevent overselling under concurrent checkouts and release expired reservations exactly once.
- Show the buyer the event, ticket tier, quantity, exact total in THB, recipient name, bank, optional masked account suffix, and reservation expiry before transfer. Do not add hidden fees.
- Accept only supported image formats and bounded file size. Upload slips to private storage under an order- and buyer-scoped key. Never make slips public or trust the browser MIME declaration as proof of payment.
- Authenticate the buyer and confirm order ownership, pending status, amount, event, expiry, and payment record on the server before any SlipOK request.
- Call the official SlipOK check-slip endpoint from server code with the organizer's branch and API key, the original slip image, the order amount, and `log=true` so the registered recipient and repeat-slip checks apply. Treat the request as a synchronous server-to-SlipOK verification. Do not describe it as a SlipOK webhook unless an actual, documented webhook is configured.
- Require a successful provider response, successful slip parse, exact amount in minor currency units, Thai transfer country, receiver data, and unique transaction reference. Reject duplicates and mismatches. Never accept a client-supplied “paid” or “verified” flag.
- Persist only the minimum provider facts needed for reconciliation and support. Avoid retaining sender names, account data, the complete raw response, or unnecessary personal information. Keep private upload retention and deletion rules explicit.
- Commit payment success, inventory sold/reserved changes, ticket records and order status in one database transaction. Use row locks, unique constraints and idempotency so retries, races and lost responses cannot produce duplicate charges or tickets.
- A SlipOK timeout, quota exhaustion, provider error, malformed image, or database outage must not issue tickets. Explain whether the attempt was consumed and offer a safe retry or support path. Limit repeated checks per order and prevent concurrent verification from draining an organizer's quota.
- If SlipOK verified payment but issuance failed, preserve verified evidence and provide an authenticated retry that does not call SlipOK again. If the order expired after a valid transfer, preserve the verified payment for a controlled recovery/refund workflow; never silently mark it paid without allocating valid inventory.
- Generate an unpredictable ticket identifier and signed/hashed QR token server-side. A check-in endpoint must authenticate an authorized organizer/scanner, verify the token, and atomically reject a second scan.
- Define organizer controls for event cancellation, refunds, disputes, and correction of receiving details. Never claim refunds are automated unless an implemented provider or verifiable manual process exists.

## Data, API, and security requirements

- Keep RLS enabled. Use least-privilege table and column grants, explicit participant policies, and server-only RPC grants for privileged transitions. Check resource ownership inside each `SECURITY DEFINER` function and pin `search_path`.
- Use `verify_jwt` where compatible. If gateway JWT verification is disabled for an endpoint, validate the Supabase user explicitly in the handler. Public endpoints must have a provider-authenticated reason to be public.
- Validate methods, content type, payload size, UUIDs, quantities, timestamps, IDs, file size and supported file types. Return clear status codes without leaking SQL, secrets, provider credentials, or personal data.
- Rate-limit costly SlipOK checks by order and buyer; serialize concurrent attempts with a row lock or equivalent atomic claim. Keep a bounded audit record of attempt status and provider error code, not the raw slip or full response.
- Protect against IDOR, replay, duplicate references, forged storage paths, duplicate check-in, brute force, oversized uploads, repeated API spend, and race-condition overselling.
- Never log image contents, API keys, access tokens, payment credentials, full transfer slips, or unnecessary buyer/sender details.
- All schema changes are new forward migrations. Include indexes, constraints, grants, RLS and Storage policies in the migration. Keep migration idempotency aligned with repository conventions; do not silently mutate a migration that may have reached production.
- Preserve existing paid orders and in-flight legacy orders when deprecating another payment provider. Do not delete payment records or remote data as part of a code cleanup.
- Secrets and live provider calls must be configured only in trusted environments. Never fabricate verification responses or simulate a successful payment in production.

## UX/UI direction

Design a premium, distinctly Sourcewav ticket flow: confident event artwork, clear type hierarchy, calm high-contrast surfaces, restrained teal identity, and a memorable ticket/QR treatment. Follow existing Sourcewav colors, fonts and components rather than introducing a generic SaaS checkout. Search current primary-provider documentation for integration truth and use reputable ticketing/checkout examples for visual research; do not copy protected artwork or imply third-party endorsement.

### Buyer flow

- Make it easy to compare ticket tiers, remaining availability, quantity, sale windows, and total price.
- Present payment as a clear sequence: **Review ticket → Transfer → Upload slip → Verification → Ticket ready**. Preserve the event and order context throughout.
- Make the total, recipient, bank, QR image and expiry easy to scan on a phone. Include a short reminder to check the recipient name in the bank app before confirming.
- Provide a clear original-slip upload affordance with accepted formats and size. Disable repeat submission while uploading/verifying and announce progress to assistive technology.
- Use distinct success, pending-recovery, rejection, timeout, quota-limit and expiry states. Explain what happened and the next useful action in Thai, with reference to the order when relevant.
- After verification, show the ticket in My Tickets with event/date/venue/tier, QR, ticket status, order reference and access to support. Never render a valid-ticket visual for a pending payment.

### Organizer flow

- Group event details, ticket inventory, payment recipient and SlipOK connection into a guided setup with clear required/optional labels.
- State that the bank/PromptPay account represented by the uploaded QR must be the same recipient registered to the SlipOK branch. Show branch/API setup instructions and a non-secret connection status; never echo the saved API key.
- Do not publish sales until all required ticket and payment fields pass server validation. Explain how to update credentials safely if rotation is needed.
- Present organizer sales, reservations, verified orders, rejected slips and check-ins using backend truth, with useful empty/loading/error states.

### Accessibility and responsive behavior

- Use semantic labels, headings, buttons, keyboard focus, dialog focus management, accessible error associations, and polite live regions.
- Meet WCAG AA contrast where practical; never rely on color alone. Support reduced motion, zoom, small screens, Thai text wrapping, and long event or organizer names.
- Keep the mobile checkout legible without horizontal scrolling. Keep the important price and payment action visible when the keyboard is open.
- Use purposeful motion only to confirm meaningful state changes; avoid decoration that competes with event artwork or payment details.

## Implementation workflow

1. Inspect the current implementation and official SlipOK/Supabase docs. Document verified API behavior and assumptions.
2. Map current schema and payment state machine. Write down invariants before editing.
3. Implement forward migrations and server-side authorization/validation first.
4. Implement SlipOK request, sanitized audit data, duplicate handling, quotas, idempotent ticket issuance and recovery paths.
5. Connect the buyer and organizer UI to server truth; remove or clearly disable any obsolete checkout path that could mislead users, while preserving in-flight orders.
6. Apply the Sourcewav design direction across desktop and mobile, including accessible loading, empty, failure, pending and success states.
7. Review changes and verify the relevant flow using safe local/provider test fixtures only. Do not create a real bank transfer or claim production readiness without live secret and project configuration checks.
8. Summarize implementation, migrations, verification performed, required secrets/setup, remaining operational or legal requirements, and any steps that need a human-held credential.

## Definition of done

- Ticket sales cannot be enabled for an event without a valid seller payment setup and SlipOK credential.
- Buyer payment cannot become paid and a ticket cannot be issued from browser claims, screenshots, or a failed/ambiguous SlipOK response.
- Exact amount, receiver, duplicate transaction, order ownership, expiry, stock reservation, and check-in are enforced by server/database state.
- Retries and concurrency cannot create duplicate tickets or spend unlimited SlipOK quota.
- The UI makes the transfer and verification sequence, recipient, total, expiry, and every recovery path understandable in Thai on mobile and desktop.
- Private payment artifacts and credentials have least-privilege access and a documented retention/rotation path.
- Database migrations, code, and setup instructions match the actual project; no feature is described as live when it still requires provider secrets or deployment.
