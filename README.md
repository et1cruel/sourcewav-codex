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

## Cloudflare Pages deployment

The project deploys static files to Cloudflare Pages. Build and deploy the site from the project root with:

```powershell
npm run deploy:pages
```

The build copies only the files the web app needs into `dist/`, so workspace files and local data stay out of the public deployment. The deployed site uses the configured Supabase project for auth and data.

The production site is `https://sourcewav-community.pages.dev`. Supabase Auth's Site URL and Redirect URLs are configured for that Pages domain. Email signup requires email confirmation; production email delivery depends on Supabase SMTP settings.

## Remaining launch work

Test registration, email confirmation, login, room creation, text and image messages, and password recovery with two accounts. Test SlipOK, order reconciliation, and ticket QR scan in a controlled environment before taking real payments. Keep the local Node/SQLite endpoints off the public deployment.
