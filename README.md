# Sourcewav local MVP

Sourcewav is a local community prototype for Thai hip-hop and independent art. Run it with Node.js 24 or later:

```powershell
node server.js
```

The server listens on `http://localhost:4173` and binds to loopback only. If another local preview already uses that port, choose an unused port explicitly, for example `node server.js 4174`, then open `http://localhost:4174`.

## What works

- Posts, likes, comments, bookmarks, follows, profile edits, chat messages, and artist listings save through the API into `database/sourcewav.sqlite`.
- Artists can upload MP3, WAV, FLAC, OGG, M4A, AAC, and WEBM audio (up to 50 MB per track). Audio is stored under `database/uploads/` and streamed with HTTP byte-range support for seeking.
- Track title, artist, genre, and file metadata are saved in SQLite. Uploads are type-checked by their file signatures and limited to five per minute on this local server.
- The music player streams from the local server and supports seeking. This prototype does not transcode audio, generate waveforms, identify rights, or store files in cloud object storage.
- SQLite data remains after reloads and can be shared by browser tabs on this computer.
- The Bangkok venue map is interactive and uses Leaflet with OpenStreetMap tiles.
- If the API is offline, browser storage serves as a temporary cache and the header shows the connection state.

## Before public launch

This local MVP has one shared local profile and no account system, hosted database, image upload service, moderation console, or real-time multi-user chat. Event cards and sample marketplace entries are illustrative. Ticket tracking saves an interest marker only; there is no payment provider, valid PromptPay QR, order verification, or ticket issuance. Connect an authentication service, remote database, event data source, and licensed payment gateway before exposing this app publicly or accepting money.
