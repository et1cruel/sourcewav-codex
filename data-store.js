/* Per-account Supabase persistence with isolated browser storage as the offline fallback. */
(function (global) {
  const STORAGE_KEY = 'sourcewav.prototype.v1';
  const VERSION = 1;
  const empty = () => ({ schemaVersion: VERSION, posts: [], interactions: {}, comments: {}, follows: [], bookmarks: [], messages: [], listings: [], profile: {}, bookingCards: [], bookingOffers: [], dropAlerts: [], followedVenues: [], followedArtists: [], eventCommand: {}, artistStoreProducts: [], artistStoreOrders: [] });
  const memory = empty();
  let readOnly = false;
  let status = 'connecting';
  let userId = null;
  let saveQueue = Promise.resolve();
  const clone = value => JSON.parse(JSON.stringify(value));
  const key = () => userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
  const normalize = value => {
    const source = value && typeof value === 'object' ? value : {};
    return {
      schemaVersion: VERSION,
      posts: Array.isArray(source.posts) ? source.posts : [],
      interactions: source.interactions && typeof source.interactions === 'object' ? source.interactions : {},
      comments: source.comments && typeof source.comments === 'object' ? source.comments : {},
      follows: Array.isArray(source.follows) ? source.follows : [],
      bookmarks: Array.isArray(source.bookmarks) ? source.bookmarks : [],
      messages: Array.isArray(source.messages) ? source.messages : [],
      listings: Array.isArray(source.listings) ? source.listings : [],
      profile: source.profile && typeof source.profile === 'object' ? source.profile : {},
      bookingCards: Array.isArray(source.bookingCards) ? source.bookingCards : [],
      bookingOffers: Array.isArray(source.bookingOffers) ? source.bookingOffers : [],
      dropAlerts: Array.isArray(source.dropAlerts) ? source.dropAlerts : [],
      followedVenues: Array.isArray(source.followedVenues) ? source.followedVenues : [],
      followedArtists: Array.isArray(source.followedArtists) ? source.followedArtists : [],
      eventCommand: source.eventCommand && typeof source.eventCommand === 'object' ? source.eventCommand : {},
      artistStoreProducts: Array.isArray(source.artistStoreProducts) ? source.artistStoreProducts : [],
      artistStoreOrders: Array.isArray(source.artistStoreOrders) ? source.artistStoreOrders : []
    };
  };
  function read() {
    try {
      const raw = global.localStorage.getItem(key());
      const parsed = raw ? JSON.parse(raw) : memory;
      if (Number(parsed.schemaVersion) > VERSION) readOnly = true;
      return clone(normalize(parsed));
    } catch (_) { return clone(normalize(memory)); }
  }
  function persist(state) {
    const next = normalize(state);
    Object.assign(memory, next);
    try { global.localStorage.setItem(key(), JSON.stringify(next)); return true; } catch (_) { return false; }
  }
  function announce(state, saved) {
    global.dispatchEvent(new CustomEvent('sourcewav:store', { detail: { state: normalize(state), saved, status } }));
  }
  async function hydrate(user) {
    userId = user?.id || null;
    if (!userId) {
      status = global.SourcewavSupabaseStatus === 'online' ? 'online' : 'offline';
      announce(read(), false);
      return read();
    }
    const client = global.SourcewavSupabase;
    if (!client) { status = 'offline'; announce(read(), false); return read(); }
    status = 'connecting';
    announce(read(), false);
    try {
      const { data, error } = await client.from('user_states').select('state').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      persist(data?.state || empty());
      status = 'online';
    } catch (error) {
      status = 'offline';
      console.error('Sourcewav account data could not be loaded:', error.message);
    }
    announce(read(), status === 'online');
    return read();
  }
  async function saveRemote(state, ownerId) {
    if (!ownerId || !global.SourcewavSupabase) return false;
    const { error } = await global.SourcewavSupabase.from('user_states')
      .upsert({ user_id: ownerId, state: normalize(state) }, { onConflict: 'user_id' });
    if (error) throw error;
    return true;
  }

  const api = {
    key: STORAGE_KEY, version: VERSION, status: () => status, ready: null, getState: read,
    update(mutator) {
      if (readOnly) return { state: read(), saved: false };
      const next = read();
      mutator(next);
      persist(next);
      const ownerId = userId;
      const snapshot = normalize(next);
      const saved = Boolean(ownerId && status === 'online');
      announce(snapshot, saved);
      if (ownerId) {
        saveQueue = saveQueue.then(() => saveRemote(snapshot, ownerId))
          .then(() => { if (ownerId === userId) { status = 'online'; announce(read(), true); } })
          .catch(error => { if (ownerId === userId) { status = 'offline'; announce(read(), false); } console.error('Sourcewav account data could not be saved:', error.message); });
      }
      return { state: snapshot, saved };
    },
    clearPrototypeData() {
      if (readOnly) return;
      const clean = normalize(empty());
      persist(clean);
      const ownerId = userId;
      if (ownerId) {
        saveQueue = saveQueue.then(() => saveRemote(clean, ownerId))
          .then(() => { if (ownerId === userId) status = 'online'; })
          .catch(() => { if (ownerId === userId) status = 'offline'; });
      }
      announce(clean, Boolean(ownerId && status === 'online'));
    }
  };
  global.SourcewavStore = api;
  global.addEventListener('sourcewav:auth', event => { hydrate(event.detail.user); });
  api.ready = (async () => {
    if (global.SourcewavSupabaseReady) await global.SourcewavSupabaseReady;
    await hydrate(global.SourcewavAuthUser);
    return read();
  })();
  global.addEventListener('online', () => {
    if (!userId) return;
    status = 'connecting';
    announce(read(), false);
    const ownerId = userId;
    saveQueue = saveQueue.then(() => saveRemote(read(), ownerId))
      .then(() => { if (ownerId === userId) { status = 'online'; announce(read(), true); } })
      .catch(() => { if (ownerId === userId) { status = 'offline'; announce(read(), false); } });
  });
})(window);
