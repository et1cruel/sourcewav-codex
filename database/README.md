# Sourcewav database and system notes

## Current state

The current local MVP still runs through `../server.js`. It serves the site and a same-origin JSON API; posts, reactions, comments, follows, bookmarks, listings, messages, and audio-track metadata are stored in `sourcewav.sqlite`. Audio files are stored under `uploads/` and streamed through a byte-range endpoint. `../data-store.js` keeps a browser cache for temporary offline use. Run `node server.js` (or `node server.js 4174` if port 4173 is already occupied). This local data service is not a public multi-account backend.

The initial PostgreSQL schema, per-account state migration, and live-community/ticket migration have been applied to the Supabase project `sourcewav` (`gzlxkkyeijsukywvsekx`). Follow-up migrations `20261021000300_validate_order_release_status.sql` and `20261021000400_listing_art_uploads.sql` add order-state validation and artwork image storage with owner-scoped upload policies. Migration 002 adds transactional inventory reservation, idempotent payment settlement, one-use ticket codes, and direct-message creation.

The Booking Board, Drop Alerts, Event Command Center, and Artist Store read/write their feature tables directly; organizer expenses, crew duty, event summaries, follows, and read markers are also persisted. Migrations `20261021000500_features_5_to_8.sql` and `20261021000600_live_features.sql` were applied in order to the `sourcewav` production project on 2026-10-21. A production SQL check confirmed all 11 feature tables exist with RLS enabled and all four feature RPCs are installed. Existing browser-only/demo feature records were not imported into real accounts. Migration `20261021000700_slipok_ticket_payments.sql` was applied to production on 2026-10-21; it adds seller-specific SlipOK credentials, payment QR storage, private buyer slips, profile image storage, and atomic ticket issuance. Production SQL confirmed both new tables, the three payment RPCs, and all three storage buckets.

Supabase Auth is connected to the Register/Login and profile screens. The Supabase Auth site URL is currently configured for local development ports 4173 and 4174; add the production URL before going live. Community posts/reactions/comments, direct messages, artist listings and uploaded artwork, and public event/ticket-tier data use normalized Supabase tables with RLS and realtime subscriptions. Authenticated user state remains in `user_states` for non-core preferences. Audio uploads still use the local Node/SQLite service and are not production-ready on Cloudflare.

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
2. The production database was assembled in the dashboard SQL Editor and has no `supabase_migrations.schema_migrations` ledger. Apply a reviewed migration individually in a new SQL Editor query, or baseline the existing production schema before using `supabase db push`; do not run a broad push against this untracked history.
3. Review RLS with multiple accounts and a moderator role before widening access.
4. Keep seed records separate and visibly marked. Do not copy demo records into the real event calendar or inventory.
5. Deploy the Supabase Edge Functions in `../supabase/functions/` with Supabase CLI. Production currently has `create-event`, `create-manual-ticket-order`, `submit-ticket-payment`, `finalize-ticket-payment`, `my-tickets`, and `validate-ticket`; each verifies the authenticated user inside the function. The gateway's legacy JWT check is disabled for these functions to support current Supabase signing keys. Omise checkout uses `OMISE_SECRET_KEY` and `OMISE_WEBHOOK_SECRET`; all ticket QR issuance/check-in needs a random `TICKET_QR_SECRET` (at least 32 random bytes, used as text). Seller QR checkout needs `SLIPOK_CREDENTIAL_ENCRYPTION_KEY`, a random 32-byte key encoded as 64 hex characters. These two ticket secrets are configured in production. Each organizer supplies their SlipOK Branch ID and branch API key when publishing an event; the Edge Function encrypts that API key with AES-GCM before it reaches the database. Never place secrets in browser code or Git. Set the Omise HTTPS webhook endpoint to `https://gzlxkkyeijsukywvsekx.supabase.co/functions/v1/omise-webhook` and ensure PromptPay is enabled in the Omise account before enabling Omise checkout.
6. Assign `organizer` role only to verified organizers; the `create-event` function checks that role. Add the production app origin to Supabase Auth URL configuration and set the `APP_ORIGIN` function secret to the exact origin.
7. Configure automated backups, restore drills, log retention, and account export/deletion procedures before inviting real users.

The publishable Supabase key is intended for browser use and is restricted by RLS. Migrations 002–007 are applied, and the SlipOK/manual-transfer functions are deployed. `SLIPOK_CREDENTIAL_ENCRYPTION_KEY` and `TICKET_QR_SECRET` are configured in production; Omise secrets and webhook function are not configured or deployed. The transfer flow calls SlipOK with `log=true` and the event's seller-specific branch, checks amount and recipient, rejects duplicate slips, and issues tickets automatically after verification. The branch API key is encrypted at the Edge Function before storage and is not selected by browser roles. Each event must use a receiving QR account registered to the same SlipOK branch; organizers enter their own Branch ID and API key when publishing. Artist Store orders and Booking offers are recorded as requests only; they are not paid transactions. The production payment flow has not been exercised against a live organizer's SlipOK account; verify payment, order reconciliation, QR scan, ticket reuse rejection, and failed/expired payment handling before enabling real sales.

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
