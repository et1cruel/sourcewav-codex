import { readFile } from 'node:fs/promises';

// Check the same public paths the music page uses, without changing any data.
const config = await readFile(new URL('../supabase-client.js', import.meta.url), 'utf8');
const value = name => config.match(new RegExp(`const ${name} = '([^']+)'`))?.[1];
const mediaBase = process.env.SOURCEWAV_MEDIA_BASE || value('MEDIA_PUBLIC_URL');
const response = await fetch(`${value('url')}/rest/v1/audio_tracks?select=id,storage_key,cover_storage_key,banner_storage_key,byte_size&status=eq.published&visibility=eq.public&deleted_at=is.null`, {
  headers: { apikey: value('publishableKey') }
});
if (!response.ok) throw new Error(`Track query failed: ${response.status}`);
const tracks = await response.json();
let failures = 0;
let checked = 0;
for (const track of tracks) {
  for (const field of ['storage_key', 'cover_storage_key', 'banner_storage_key']) {
    if (!track[field]) continue;
    const url = `${mediaBase}/${track[field].split('/').map(encodeURIComponent).join('/')}`;
    const media = await fetch(url, { headers: { Range: 'bytes=0-31', Origin: 'https://sourcewav-community.pages.dev' } });
    const type = media.headers.get('content-type') || '';
    const audio = field === 'storage_key';
    const size = Number(media.headers.get('content-range')?.split('/')[1] || media.headers.get('content-length'));
    const valid = media.ok && (audio ? type.startsWith('audio/') && size === Number(track.byte_size) : type.startsWith('image/'));
    if (!valid) failures++;
    checked++;
    console.log(`${valid ? 'OK' : 'FAIL'} ${track.id} ${field} HTTP ${media.status} ${type} ${size} bytes`);
    await media.body?.cancel();
  }
}
console.log(`${tracks.length} tracks, ${checked} media files, ${failures} failures`);
process.exitCode = failures ? 1 : 0;
