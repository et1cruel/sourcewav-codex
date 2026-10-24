import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(projectRoot, 'dist');
const rootFiles = [
  'index.html',
  'styles.css',
  'account-feed-ui.css',
  'account-ui.js',
  'platform-ui.js',
  'app.js',
  'data-store.js',
  'i18n.js',
  'prototype-app.js',
  'streaming-app.js',
  'listening-room-app.js',
  'supabase-client.js',
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const file of rootFiles) {
  await cp(join(projectRoot, file), join(outputDir, file));
}

for (const directory of ['assets', 'features']) {
  await cp(join(projectRoot, directory), join(outputDir, directory), { recursive: true });
}

await writeFile(join(outputDir, '_routes.json'), JSON.stringify({
  version: 1, include: ['/media/*'], exclude: []
}));

console.log(`Prepared Cloudflare Pages assets in ${outputDir}`);
