/* Sourcewav local app store. SQLite is authoritative; browser storage is an offline cache. */
(function (global) {
  const STORAGE_KEY = 'sourcewav.prototype.v1';
  const VERSION = 1;
  const memory = { schemaVersion: VERSION, posts: [], interactions: {}, comments: {}, follows: [], bookmarks: [], messages: [], listings: [], profile: {} };
  let readOnly = false;
  let status = 'connecting';
  let saveQueue = Promise.resolve();
  const clone = value => JSON.parse(JSON.stringify(value));
  const normalize = value => {
    const source = value && typeof value === 'object' ? value : {};
    return { schemaVersion: VERSION, posts: Array.isArray(source.posts) ? source.posts : [], interactions: source.interactions && typeof source.interactions === 'object' ? source.interactions : {}, comments: source.comments && typeof source.comments === 'object' ? source.comments : {}, follows: Array.isArray(source.follows) ? source.follows : [], bookmarks: Array.isArray(source.bookmarks) ? source.bookmarks : [], messages: Array.isArray(source.messages) ? source.messages : [], listings: Array.isArray(source.listings) ? source.listings : [], profile: source.profile && typeof source.profile === 'object' ? source.profile : {} };
  };
  function read() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      const value = raw ? normalize(JSON.parse(raw)) : normalize(memory);
      if (Number(JSON.parse(raw || '{}').schemaVersion) > VERSION) readOnly = true;
      return clone(value);
    } catch (_) { return clone(normalize(memory)); }
  }
  function persist(state) {
    const next = normalize(state);
    Object.assign(memory, next);
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return true; } catch (_) { return false; }
  }
  function announce(state, saved) {
    global.dispatchEvent(new CustomEvent('sourcewav:store', { detail: { state: normalize(state), saved, status } }));
  }
  const api = {
    key: STORAGE_KEY, version: VERSION, status: () => status, ready: null, getState: read,
    update(mutator) {
      if (readOnly) return { state: read(), saved: false };
      const next = read(); mutator(next); persist(next);
      const saved = status === 'online'; announce(next, saved);
      if (!saved) return { state: normalize(next), saved: false };
      saveQueue = saveQueue.then(async () => {
        const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(read()) });
        if (!response.ok) throw new Error('save failed');
      }).then(() => { status = 'online'; announce(read(), true); }).catch(() => { status = 'offline'; announce(read(), false); });
      return { state: normalize(next), saved };
    },
    clearPrototypeData() {
      if (readOnly) return;
      const clean = normalize({}); persist(clean);
      if (status === 'online') fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean) }).then(response => { if (!response.ok) throw new Error(); }).catch(() => { status = 'offline'; });
      announce(clean, status === 'online');
    }
  };
  global.SourcewavStore = api;
  api.ready = (async () => {
    try {
      const response = await fetch('/api/state', { cache: 'no-store' });
      if (!response.ok) throw new Error('server unavailable');
      const remote = normalize((await response.json()).state);
      const local = read();
      const localHasData = local.posts.length || local.listings.length || local.messages.length || Object.keys(local.interactions).length || local.profile.displayName;
      const remoteHasData = remote.posts.length || remote.listings.length || remote.messages.length || Object.keys(remote.interactions).length || remote.profile.displayName;
      if (localHasData && !remoteHasData) {
        const imported = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(local) });
        if (!imported.ok) throw new Error('import failed');
        persist(local);
      } else persist(remote);
      status = 'online';
    } catch (_) { status = 'offline'; }
    announce(read(), status === 'online');
    return read();
  })();
  global.addEventListener('online', () => {
    if (status !== 'offline') return;
    status = 'connecting'; announce(read(), false);
    saveQueue = saveQueue.then(async () => {
      const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(read()) });
      if (!response.ok) throw new Error('save failed');
    }).then(() => { status = 'online'; announce(read(), true); }).catch(() => { status = 'offline'; announce(read(), false); });
  });
})(window);
