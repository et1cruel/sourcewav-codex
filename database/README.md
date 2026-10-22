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

The publishable Supabase key is intended for browser use and is restricted by RLS. Migrations through `20261022000500_slipok_audit_expiry.sql` are applied in the linked production project; `pg_cron` has one active expiry job. Edge Functions `submit-ticket-payment`, `admin-list-ticket-payments`, and `admin-review-ticket-payment` are deployed. Mocked verification tests pass; no live organizer transfer or SlipOK request was run. This confirms implementation and deployment, not end-to-end production payment readiness. Keep the payment UI in a controlled rollout until an organizer account is granted appropriate roles and a separately approved test transfer is completed.

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
