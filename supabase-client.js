/* Public browser configuration only. Supabase RLS and Auth enforce user permissions. */
(() => {
  const url = 'https://gzlxkkyeijsukywvsekx.supabase.co';
  const publishableKey = 'sb_publishable_JNTB3ODHHSftN-DiUBx5vw_5xiAsEc4';
  const library = window.supabase;

  window.SourcewavSupabaseStatus = 'connecting';
  if (!library?.createClient) {
    window.SourcewavSupabaseStatus = 'unavailable';
    return;
  }

  const client = library.createClient(url, publishableKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
  window.SourcewavSupabase = client;
  window.SourcewavAuthUser = null;

  const announceAuth = (session, authEvent = 'INITIAL_SESSION') => {
    window.SourcewavAuthUser = session?.user || null;
    window.dispatchEvent(new CustomEvent('sourcewav:auth', { detail: { user: window.SourcewavAuthUser, authEvent } }));
  };

  window.SourcewavSupabaseReady = Promise.all([
    client.from('profiles').select('user_id', { head: true, count: 'exact' }),
    client.auth.getSession()
  ]).then(([databaseResult, sessionResult]) => {
    if (databaseResult.error) throw databaseResult.error;
    if (sessionResult.error) throw sessionResult.error;
    window.SourcewavSupabaseStatus = 'online';
    announceAuth(sessionResult.data.session, 'INITIAL_SESSION');
    return client;
  }).catch((error) => {
    window.SourcewavSupabaseStatus = 'offline';
    console.error('Sourcewav Supabase connection failed:', error.message);
    return null;
  });

  client.auth.onAuthStateChange((authEvent, session) => announceAuth(session, authEvent));
})();
