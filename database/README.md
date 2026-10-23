# Sourcewav database and system notes

## Current state

The current local MVP still runs through `../server.js`. It serves the site and a same-origin JSON API; posts, reactions, comments, follows, bookmarks, listings, messages, and audio-track metadata are stored in `sourcewav.sqlite`. Audio files are stored under `uploads/` and streamed through a byte-range endpoint. `../data-store.js` keeps a browser cache for temporary offline use. Run `node server.js` (or `node server.js 4174` if port 4173 is already occupied). This local data service is not a public multi-account backend.

The initial PostgreSQL schema, per-account state migration, and live-community/ticket migration have been applied to the Supabase project `sourcewav` (`gzlxkkyeijsukywvsekx`). Follow-up migrations `20261021000300_validate_order_release_status.sql` and `20261021000400_listing_art_uploads.sql` add order-state validation and artwork image storage with owner-scoped upload policies. Migration 002 adds transactional inventory reservation, idempotent payment settlement, one-use ticket codes, and direct-message creation.

The Booking Board, Drop Alerts, Event Command Center, and Artist Store read/write their feature tables directly; organizer expenses, crew duty, event summaries, follows, and read markers are also persisted. Migrations `20261021000500_features_5_to_8.sql` and `20261021000600_live_features.sql` were applied in order to the `sourcewav` production project on 2026-10-21. A production SQL check confirmed all 11 feature tables exist with RLS enabled and all four feature RPCs are installed. Existing browser-only/demo feature records were not imported into real accounts. Migration `20261021000700_slipok_ticket_payments.sql` was applied to production on 2026-10-21; it adds seller-specific SlipOK credentials, payment QR storage, private buyer slips, profile image storage, and atomic ticket issuance. Migration `20261021000800_rooms_and_audio_storage.sql` is new and must be applied before community rooms or cloud audio uploads are available.

Supabase Auth is connected to Register/Login and profile screens. The Supabase Auth site URL is currently configured for local development ports 4173 and 4174; add the Cloudflare `workers.dev` URL before testing deployed registration/login. Community posts/reactions/comments, direct messages, artist listings and uploaded artwork, and public event/ticket-tier data use normalized Supabase tables with RLS and realtime subscriptions. Authenticated user state remains in `user_states` for non-core preferences. Cloud audio upload and community rooms use migration 008; the local Node/SQLite service remains a separate development compatibility path.

## Entity relationships

```text
auth.users ──1:1── profiles ──1:N── posts ──1:N── post_media
                         │                 ├──1:N── comments
                         │                 └──N:M── reactions / saved_items
                         ├──N:M── follows / blocks
                         ├──1:N── events ──1:N── ticket_types
                         │                  └──1:N── orders ──1:N── order_items ──1:N── tickets
                         │                                  └──1:N── payments ──1:N── refunds
                         ├──1:N── listings ──1:N── listing_media
                         └──N:M── conversations ──1:N── messages
venues ──1:N── events; notifications, reports, moderation_actions, audit_logs support platform operations
```

## Migration workflow

1. Keep each schema change in a new immutable file under `../supabase/migrations/`.
2. Production migration history is tracked with Supabase CLI. Check `npx supabase migration list --linked` before applying changes and use `npx supabase db push --linked` only after reviewing every pending migration.
3. Review RLS with multiple accounts and a moderator role before widening access.
4. Keep seed records separate and visibly marked. Do not copy demo records into the real event calendar or inventory.
5. Deploy the Supabase Edge Functions in `../supabase/functions/` with Supabase CLI. Ticket checkout sends funds directly to the organizer's account using that event's PromptPay QR. Each organizer supplies their own SlipOK Branch ID and API key; the Edge Function encrypts the key with AES-GCM before storing it. The browser never receives the key. The backend checks image signatures, exact order amount, Thailand transfer, registered receiver via SlipOK branch logging, last four account digits when exposed, and duplicate transaction references before ticket issuance. Order inventory reservations expire after 15 minutes; a one-minute `pg_cron` job releases abandoned reservations. Verified transfers arriving after expiry become disputed and require admin review; approval issues tickets only when inventory remains available. Each verification attempt records a minimal audit outcome without raw SlipOK personal data. Ticket QR issuance/check-in needs `TICKET_QR_SECRET` (at least 32 random bytes, used as text); per-event SlipOK credential encryption needs `SLIPOK_CREDENTIAL_ENCRYPTION_KEY` (32 random bytes as 64 hex characters). Do not put secrets in browser code or Git.
6. Authorization is stored in `public.user_roles`, separate from editable `profiles.roles` profession labels. Grant `organizer` and `admin` only after verification through a trusted server workflow or Supabase SQL Editor, never from signup metadata or a profile update. The `create-event` and ticket-payment review functions check this table. Production data had no organizer or admin profile labels and no events before the authorization migration; administrator payment review is available only after a trusted `admin` role grant. Add the production app origin to Supabase Auth URL configuration and set the `APP_ORIGIN` function secret to the exact origin.
7. Configure automated backups, restore drills, log retention, and account export/deletion procedures before inviting real users.

The publishable Supabase key is intended for browser use and is restricted by RLS. `pg_cron` has one active expiry job. No live organizer transfer or SlipOK request has been run.

### Ticketing rollout status (2026-10-23)

The linked production project is migrated through `20261023000500`. Local migrations `20261023000600_refund_slipok_credential_errors.sql` and `20261023000700_ticket_order_snapshots_and_recovery.sql` are pending. The local changes also add `my-orders` and update the submit/finalize, organizer review, and organizer retry verification functions; those updates have not been deployed. The linked function list does not yet contain `my-orders` and still reports the older deployed versions of the changed functions.

Local verification currently passes the Pages asset build, TypeScript syntax transpilation, and all 27 Node SlipOK/ticketing tests. A rollback-only Supabase pgTAP suite is added at `supabase/tests/ticketing-flow.test.sql` for reservation, expiry, immutable event and payment snapshots, late-payment review, repeat approval, and cross-order transaction uniqueness; it has not been executed because Docker and PostgreSQL are not installed in this workspace. The organizer retry endpoint reuses only the stored private slip, copies it under a unique key for each audit attempt, checks event ownership, and runs the same order snapshot, provider receiver, amount, duplicate-reference, and ticket issuance checks. For an invalid SlipOK key, retry can use a rotated key only when the organizer and Branch ID still match the order snapshot; changing the branch remains a manual investigation because it could change the receiving account. Buyer and organizer queues display event details from the order snapshot, so later event edits do not change which title, date, or venue is shown during review. Buyers can contact the snapshotted organizer from the order row with the order reference prefilled in chat. When buyers reopen an order, its event date/venue and last SlipOK failure are restored; credential/quota failures hide the payment QR and disable resubmission until the organizer can act, while outage guidance says not to transfer again. Expired orders allow buyers who have not transferred to return to the event and start a fresh order when sales remain open; orders with an existing transfer can still submit the original slip for review. Event refund terms and the event title, date, time, and venue are required/snapshotted for each order; the checkout and order history show those details so buyers can verify the event before paying and after returning later. Organizer decisions and notes are shown to the buyer, while a rejection does not claim a refund was completed. A linked database lint currently reports an ambiguous `ticket_id` reference in the deployed `validate_ticket_once`; migration `20261023000700` qualifies the unique constraint, but the linked schema could not be re-linted against that fix before applying the migration. Current linked-project preflight confirms migrations `20261023000600` and `20261023000700` are pending, `my-orders` and organizer retry verification are not deployed, and `APP_ORIGIN` is not configured (so Edge Function CORS currently falls back to `*`). No migration or function has been deployed; the Supabase migration dry run made no database changes.

The local late-slip path relies on SlipOK's documented `transTimestamp` ISO-8601 response field. The Edge Function requires a parseable transfer timestamp; a verified transfer submitted after reservation expiry is sent to review with its transfer time and the order's expiry, and manual approval still checks current inventory. SlipOK documents `log=true` as checking the receiver associated with the branch and detecting repeated slips ([Check Slip API](https://slipok.com/api-documentation/check-slip/)).

Run `npm run ticketing:preflight` for a read-only rollout check after production deployment. It compares required migration versions, the minimum deployed versions for changed Edge Functions, and required secret names without printing secret values. It exits nonzero while any required item remains pending.

### Controlled ticketing smoke run

Run this only after the preflight passes and a verified organizer account has a test event with its own PromptPay QR and SlipOK branch. Use a low-value test tier and an agreed test transfer; the organizer receives funds directly.

1. Sign in as a buyer, reserve a known ticket quantity, and confirm the order shows the event title, date/time, venue, tier, quantity, exact total, organizer/payee, order reference, refund terms, and 15-minute timer before transferring.
2. Submit one valid slip for that event's receiving account and exact total. Confirm SlipOK marks it paid and issues exactly the reserved quantity in “บัตรของฉัน”. Refresh and sign in on another device to verify the same order and tickets remain available.
3. Submit the same slip again for the same order and confirm no additional tickets appear. Attempt its transaction reference on a second test order and confirm the second order is held for review without ticket issuance.
4. Use the organizer queue to inspect an unresolved test payment. Confirm the slip is private and the expected amount and transfer time are visible. Approval must require the checkbox confirming the transfer reached the real account; decisions must record reviewer/action/note history. A rejection must direct the organizer to contact the buyer and must not claim a refund occurred.
5. For expiry, use a separate test order. Confirm the QR is hidden after 15 minutes; submit a slip whose provider transfer time was before expiry and ensure the organizer reviews inventory before approval. A post-expiry transfer must not issue tickets automatically.
6. Verify a provider outage or invalid organizer credential leaves a visible follow-up item and never tells the buyer to transfer again. Correct an invalid API key while keeping the same Branch ID, retry using the stored private slip, and confirm the quota/recovery behavior. If the organizer or Branch ID changed, verify that the system refuses automatic retry and leaves the item for manual investigation.
7. Run `supabase test db` in an environment with local PostgreSQL/Docker to verify transactional last-ticket reservation, expiry release, late-transfer recovery, repeat approval, global transaction uniqueness, and immutable event/payment snapshots.

Record the test event, order references, observed ticket counts, and reviewer history without storing full payment details or copying secrets into the report. Do not enable public ticket sales until this controlled run passes.

Do not describe the updated order recovery, snapshot, or organizer review flow as live until those migrations and Edge Functions are deployed and re-verified. Keep real ticket sales in a controlled rollout until an organizer account is configured and an independently approved end-to-end test transfer succeeds.

## API boundary for replacing local storage

Keep UI components calling a domain service, not browser storage directly. Add API implementations behind the same service interface:

| Service | Example operations |
| --- | --- |
| `FeedService` | list posts, create post, react, comment, save |
| `ProfileService` | get/update own profile, follow/unfollow artist |
| `EventService` | list events/venues, event details, bookmark |
| `TicketService` | create order/payment intent, read order, validate check-in |
| `ListingService` | list/create/update creative listing |
| `ChatService` | list conversations, list/send messages |
| `AudioService` | upload a validated audio file, list tracks, stream byte ranges |
| `NotificationService` | list unread, mark read |

Documented HTTP contracts and payload/status semantics live in `MASTER_PROMPT.md`. Every write must authenticate, authorize, validate, rate-limit, and audit on the server. Use idempotency for order/payment/refund/check-in operations. Ticket inventory changes must be transactional.

## Production gates

- Configure email auth/session management and test account recovery.
- Review RLS and storage bucket policies; the SQL file intentionally provides conservative examples, not a completed security review.
- Add media storage with file type/size limits and signed URLs for private uploads.
- Create orders and payment intents only on a trusted server; confirm electronic payments through provider-signed, idempotent webhooks or manual transfers through the seller's SlipOK branch. Confirm receiving QR ownership and end-to-end behavior before enabling real sales.
- Generate opaque ticket tokens server-side and enforce one-time check-in in a transaction.
- Add moderation tooling, report handling, retention/export/deletion paths, backups, monitoring, and incident response before production.
