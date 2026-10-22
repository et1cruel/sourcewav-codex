# Sourcewav community site

Sourcewav is a static community site for Thai hip-hop and independent art. The web app uses Supabase Auth, Postgres, Realtime, and Storage for online accounts and features. For local preview, run the optional Node.js 24+ server:

```powershell
node server.js
```

The server listens on `http://localhost:4173` and binds to loopback only. If another local preview already uses that port, choose an unused port explicitly, for example `node server.js 4174`, then open `http://localhost:4174`.

## Current data services

- Accounts, profiles, posts, reactions, comments, bookmarks, follows, direct messages, listings, events, bookings, and tickets use Supabase tables with row-level security.
- Event ticket payments use organizer-owned PromptPay QR codes and SlipOK slip verification. The site does not use Omise.
- Audio uses the `audio_tracks` table and the `sourcewav-audio` Supabase Storage bucket after migration `20261021000800_rooms_and_audio_storage.sql` is applied.
- Community rooms and text messages use Supabase after migration `20261021000800_rooms_and_audio_storage.sql` is applied. Room image messages also need `20261022000000_community_room_images.sql`.
- `data-store.js` keeps a per-browser/per-account cache for non-core preferences. It is not the source of truth for the normalized live features.
- The local Node server's older SQLite `/api/state` and `/api/tracks` endpoints are retained for local compatibility only; the current web UI does not use them.
- The Bangkok venue map is interactive and uses Leaflet with OpenStreetMap tiles.

## Cloudflare preview deployment

The repository is configured for Cloudflare Workers Static Assets. Install Wrangler or run it through `npx`, then deploy from the project root with `npx wrangler deploy`. `.assetsignore` excludes source, local database, and project metadata from public assets. The app continues to use the configured Supabase project for auth and data.

After deployment, add the resulting `https://<worker-name>.<workers-subdomain>.workers.dev` URL to Supabase Auth's Site URL and Redirect URLs before testing registration or login. Apply and review pending SQL migrations first. Production registration also depends on Supabase Auth email confirmation and SMTP settings.

## Remaining launch work

Apply migration `20261022000000_community_room_images.sql` to the configured Supabase project before using room image messages. Email sign-up is enabled and requires users to confirm their email before logging in. Set the deployed site's URL in Supabase Auth's Site URL and Redirect URLs, then test registration, email confirmation, login, room creation, text and image messages, and password recovery with two accounts. Test SlipOK, order reconciliation, and ticket QR scan in a controlled environment before taking real payments. Keep the local Node/SQLite endpoints off the public deployment.
