# Sourcewav database and system notes

## Current state

The current local MVP runs through `../server.js`. It serves the site and a same-origin JSON API; the API stores profiles, posts, reactions, comments, follows, bookmarks, listings, messages, and audio-track metadata in `sourcewav.sqlite` beside this README. Audio files are stored under `uploads/` and streamed through a byte-range endpoint so seeking works. `../data-store.js` hydrates community data from this API and keeps a browser cache for temporary offline use. Run `node server.js` (or `node server.js 4174` if port 4173 is already occupied). The server binds to loopback; this is a single local installation, not a public multi-account service.

`schema.sql` remains the future PostgreSQL/Supabase-compatible production data model. It has not been applied. It assumes Supabase Auth's `auth.users` table. Review policies against actual product roles and run migrations in a disposable environment before production.

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

## Apply in development

1. Create a disposable PostgreSQL/Supabase project and configure its migration tooling.
2. Apply `schema.sql` as the first migration, then review the generated policies using at least two regular accounts and one moderator account.
3. Create a server/API that owns privileged operations. Do not put a database service-role key, payment secret, webhook secret, or ticket-signing key in `index.html`, `app.js`, or `data-store.js`.
4. Add seed records separately from migrations. Keep demo records visibly marked and never copy them into production as real events or inventory.
5. Configure automated backups, restore drills, log retention, and account export/deletion procedures before inviting real users.

The local MVP requires no external database URL or credentials. It still has no account system, hosted deployment, media storage, or payment provider credentials, so no migration was run and no external account was created.

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
- Create orders and payment intents only on a trusted server; confirm them through provider-signed, idempotent webhooks. The current visual QR in the prototype is not payable.
- Generate opaque ticket tokens server-side and enforce one-time check-in in a transaction.
- Add moderation tooling, report handling, retention/export/deletion paths, backups, monitoring, and incident response before production.
