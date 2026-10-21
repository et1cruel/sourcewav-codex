const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const root = __dirname;
const database = new DatabaseSync(path.join(root, 'database', 'sourcewav.sqlite'));
const port = Number(process.argv[2] || process.env.PORT || 4173);
const maxBody = 1024 * 1024;
const maxAudioBytes = 50 * 1024 * 1024;
const uploadDirectory = path.join(root, 'database', 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS interactions (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS follows (id TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS bookmarks (id TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, person TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS tracks (id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL, genre TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const audioTypes = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.webm': 'audio/webm' };
const uploadAttempts = new Map();
function isAudioFile(ext, data) {
  if (ext === '.mp3') return data.length >= 4 && ((data.subarray(0, 3).toString() === 'ID3') || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0));
  if (ext === '.wav') return data.length >= 12 && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WAVE';
  if (ext === '.flac') return data.length >= 4 && data.subarray(0, 4).toString() === 'fLaC';
  if (ext === '.ogg') return data.length >= 4 && data.subarray(0, 4).toString() === 'OggS';
  if (ext === '.m4a') return data.length >= 12 && data.subarray(4, 8).toString() === 'ftyp';
  if (ext === '.aac') return data.length >= 2 && data[0] === 0xff && (data[1] & 0xf6) === 0xf0;
  if (ext === '.webm') return data.length >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3;
  return false;
}

function readRequestBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let done = false;
    req.on('data', chunk => {
      if (done) return;
      size += chunk.length;
      if (size > limit) { done = true; reject(Object.assign(new Error('too large'), { status: 413 })); req.resume(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!done) resolve(Buffer.concat(chunks)); });
    req.on('error', error => { if (!done) { done = true; reject(error); } });
  });
}

function parseMultipart(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`); const fields = {}; let file = null;
  let cursor = buffer.indexOf(delimiter);
  while (cursor >= 0) {
    cursor += delimiter.length;
    if (buffer[cursor] === 45 && buffer[cursor + 1] === 45) break;
    if (buffer[cursor] === 13 && buffer[cursor + 1] === 10) cursor += 2;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd < 0) break;
    const next = buffer.indexOf(delimiter, headerEnd + 4);
    if (next < 0) break;
    const header = buffer.subarray(cursor, headerEnd).toString('utf8');
    const content = buffer.subarray(headerEnd + 4, Math.max(headerEnd + 4, next - 2));
    const name = header.match(/content-disposition:[^\r\n]*\bname="([^"]+)"/i)?.[1];
    const filename = header.match(/content-disposition:[^\r\n]*\bfilename="([^"]*)"/i)?.[1];
    if (name === 'audio' && filename) file = { originalName: filename, data: content };
    else if (name && content.length <= 512) fields[name] = content.toString('utf8');
    cursor = next;
  }
  return { fields, file };
}

const empty = () => ({ schemaVersion: 1, posts: [], interactions: {}, comments: {}, follows: [], bookmarks: [], messages: [], listings: [], profile: {} });
const normalize = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid data');
  const list = (key, max) => Array.isArray(value[key]) && value[key].length <= max ? value[key] : [];
  const obj = (key) => value[key] && typeof value[key] === 'object' && !Array.isArray(value[key]) ? value[key] : {};
  const state = { schemaVersion: 1, posts: list('posts', 500), interactions: obj('interactions'), comments: obj('comments'), follows: list('follows', 1000), bookmarks: list('bookmarks', 1000), messages: list('messages', 2000), listings: list('listings', 500), profile: obj('profile') };
  const text = (v, max) => typeof v === 'string' && v.length <= max;
  if (!text(state.profile.displayName || '', 60) || !text(state.profile.bio || '', 500)) throw new Error('Invalid profile');
  for (const post of state.posts) if (!post || !text(post.id, 100) || !text(post.body, 3000) || !text(post.title || '', 120)) throw new Error('Invalid post');
  for (const message of state.messages) if (!message || !text(message.id, 100) || !text(message.body, 2000) || !text(message.person, 100)) throw new Error('Invalid message');
  for (const item of state.listings) if (!item || !text(item.id, 100) || !text(item.title, 100) || (item.price !== null && item.price !== undefined && (!Number.isFinite(Number(item.price)) || Number(item.price) < 0 || Number(item.price) > 10000000))) throw new Error('Invalid listing');
  return state;
};

function loadState() {
  const state = empty();
  state.profile = JSON.parse(database.prepare("SELECT payload FROM profiles WHERE id='current'").get()?.payload || '{}');
  state.posts = database.prepare('SELECT payload FROM posts ORDER BY created_at, rowid').all().map(row => JSON.parse(row.payload));
  for (const row of database.prepare('SELECT id,payload FROM interactions').all()) state.interactions[row.id] = JSON.parse(row.payload);
  for (const row of database.prepare('SELECT post_id,payload FROM comments ORDER BY rowid').all()) (state.comments[row.post_id] ||= []).push(JSON.parse(row.payload));
  state.follows = database.prepare('SELECT id FROM follows').all().map(row => row.id);
  state.bookmarks = database.prepare('SELECT id FROM bookmarks').all().map(row => row.id);
  state.messages = database.prepare('SELECT payload FROM messages ORDER BY created_at, rowid').all().map(row => JSON.parse(row.payload));
  state.listings = database.prepare('SELECT payload FROM listings ORDER BY created_at, rowid').all().map(row => JSON.parse(row.payload));
  return state;
}

function saveState(input) {
  const state = normalize(input);
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const table of ['posts','interactions','comments','follows','bookmarks','messages','listings','profiles']) database.exec(`DELETE FROM ${table}`);
    database.prepare('INSERT INTO profiles(id,payload,updated_at) VALUES(?,?,?)').run('current', JSON.stringify(state.profile), new Date().toISOString());
    const post = database.prepare('INSERT INTO posts(id,payload,created_at) VALUES(?,?,?)');
    for (const item of state.posts) post.run(item.id, JSON.stringify(item), item.createdAt || new Date().toISOString());
    const interaction = database.prepare('INSERT INTO interactions(id,payload) VALUES(?,?)');
    for (const [id, value] of Object.entries(state.interactions)) interaction.run(id, JSON.stringify(value));
    const comment = database.prepare('INSERT INTO comments(id,post_id,payload) VALUES(?,?,?)');
    for (const [postId, items] of Object.entries(state.comments)) if (Array.isArray(items)) for (const item of items) comment.run(item.id || `${postId}-${Math.random()}`, postId, JSON.stringify(item));
    const follow = database.prepare('INSERT INTO follows(id) VALUES(?)');
    for (const id of state.follows) if (typeof id === 'string' && id.length <= 100) follow.run(id);
    const bookmark = database.prepare('INSERT INTO bookmarks(id) VALUES(?)');
    for (const id of state.bookmarks) if (typeof id === 'string' && id.length <= 150) bookmark.run(id);
    const message = database.prepare('INSERT INTO messages(id,person,payload,created_at) VALUES(?,?,?,?)');
    for (const item of state.messages) message.run(item.id, item.person, JSON.stringify(item), item.createdAt || new Date().toISOString());
    const listing = database.prepare('INSERT INTO listings(id,payload,created_at) VALUES(?,?,?)');
    for (const item of state.listings) listing.run(item.id, JSON.stringify(item), item.createdAt || new Date().toISOString());
    database.exec('COMMIT');
    return state;
  } catch (error) { database.exec('ROLLBACK'); throw error; }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    if (req.method === 'GET' && url.pathname === '/api/tracks') {
      const tracks = database.prepare('SELECT id,title,artist,genre,mime_type,size_bytes,created_at FROM tracks ORDER BY created_at DESC').all();
      return send(res, 200, { tracks });
    }
    if (req.method === 'POST' && url.pathname === '/api/tracks') {
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { error: 'Origin not allowed' });
      const now = Date.now();
      const address = req.socket.remoteAddress || 'local';
      const recentUploads = (uploadAttempts.get(address) || []).filter(time => now - time < 60_000);
      if (recentUploads.length >= 5) return send(res, 429, { error: 'อัปโหลดได้ไม่เกิน 5 เพลงต่อนาที' });
      uploadAttempts.set(address, [...recentUploads, now]);
      const contentType = req.headers['content-type'] || '';
      const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      if (!contentType.toLowerCase().startsWith('multipart/form-data;') || !boundary) return send(res, 400, { error: 'รูปแบบไฟล์อัปโหลดไม่ถูกต้อง' });
      try {
        const body = await readRequestBody(req, maxAudioBytes + 64 * 1024);
        const { fields, file } = parseMultipart(body, (boundary[1] || boundary[2]).trim());
        const title = String(fields.title || '').trim();
        const artist = String(fields.artist || '').trim();
        const genre = String(fields.genre || 'อื่นๆ').trim() || 'อื่นๆ';
        const ext = path.extname(file?.originalName || '').toLowerCase();
        if (!title || title.length > 100 || /[\u0000-\u001f]/.test(title)) return send(res, 400, { error: 'ใส่ชื่อเพลงไม่เกิน 100 ตัวอักษร' });
        if (!artist || artist.length > 80 || /[\u0000-\u001f]/.test(artist)) return send(res, 400, { error: 'ใส่ชื่อศิลปินไม่เกิน 80 ตัวอักษร' });
        if (genre.length > 40 || /[\u0000-\u001f]/.test(genre)) return send(res, 400, { error: 'ชื่อแนวเพลงยาวเกินไป' });
        if (!file || file.data.length < 128 || file.data.length > maxAudioBytes) return send(res, 400, { error: 'เลือกไฟล์เสียงขนาดไม่เกิน 50 MB' });
        if (!audioTypes[ext] || !isAudioFile(ext, file.data)) return send(res, 415, { error: 'ไฟล์เสียงไม่รองรับหรือชนิดไฟล์ไม่ตรงกับเนื้อหา' });
        const id = randomBytes(12).toString('hex');
        const filename = `${id}${ext}`;
        const createdAt = new Date().toISOString();
        fs.writeFileSync(path.join(uploadDirectory, filename), file.data, { flag: 'wx' });
        try {
          database.prepare('INSERT INTO tracks(id,title,artist,genre,filename,mime_type,size_bytes,created_at) VALUES(?,?,?,?,?,?,?,?)')
            .run(id, title, artist, genre, filename, audioTypes[ext], file.data.length, createdAt);
        } catch (error) { fs.rmSync(path.join(uploadDirectory, filename), { force: true }); throw error; }
        return send(res, 201, { track: { id, title, artist, genre, mime_type: audioTypes[ext], size_bytes: file.data.length, created_at: createdAt } });
      } catch (error) {
        return send(res, error.status || 400, { error: error.status === 413 ? 'ไฟล์มีขนาดใหญ่เกิน 50 MB' : 'อัปโหลดไม่สำเร็จ ตรวจสอบข้อมูลแล้วลองอีกครั้ง' });
      }
    }
    const audioRequest = url.pathname.match(/^\/api\/tracks\/([a-f0-9]{24})\/audio$/);
    if (req.method === 'GET' && audioRequest) {
      const track = database.prepare('SELECT filename,mime_type,size_bytes FROM tracks WHERE id=?').get(audioRequest[1]);
      if (!track) return send(res, 404, { error: 'ไม่พบเพลงนี้' });
      const filename = path.join(uploadDirectory, track.filename);
      let stat;
      try { stat = fs.statSync(filename); } catch { return send(res, 404, { error: 'ไม่พบไฟล์เสียง' }); }
      const headers = { 'Content-Type': track.mime_type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' };
      const range = req.headers.range;
      if (range) {
        const match = range.match(/^bytes=(\d*)-(\d*)$/);
        if (!match || (!match[1] && !match[2])) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
        let start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
        let end = match[2] && match[1] ? Number(match[2]) : stat.size - 1;
        if (start >= stat.size || end < start) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
        end = Math.min(end, stat.size - 1);
        res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stat.size}` });
        return fs.createReadStream(filename, { start, end }).pipe(res);
      }
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
      return fs.createReadStream(filename).pipe(res);
    }
    if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, { state: loadState() });
    if (req.method === 'PUT' && url.pathname === '/api/state') {
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > maxBody) req.destroy(); });
      req.on('end', () => {
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { error: 'Origin not allowed' });
        try { const state = saveState(JSON.parse(body)); return send(res, 200, { ok: true, state }); }
        catch { return send(res, 400, { error: 'ข้อมูลไม่ถูกต้องหรือมีขนาดใหญ่เกินไป' }); }
      });
      return;
    }
    return send(res, 404, { error: 'Not found' });
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  if (pathname === '/') pathname = '/index.html';
  if (pathname.split('/').some(part => part === 'database' || part.startsWith('.'))) { res.writeHead(404); return res.end('Not found'); }
  const filename = path.resolve(root, `.${pathname}`);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
  fs.createReadStream(filename).pipe(res);
});

server.listen(port, '127.0.0.1', () => console.log(`Sourcewav local server: http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { database.close(); server.close(() => process.exit(0)); });
