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

  const MEDIA_PUBLIC_URL = 'https://sourcewav-community.pages.dev/media'; // Pages Function reads R2 with byte-range support.
  async function verifyPublishedFile(kind, key) {
    const fileUrl = `${MEDIA_PUBLIC_URL}/${key.split('/').map(encodeURIComponent).join('/')}`;
    let lastError;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await fetch(fileUrl, {
          headers: { Range: 'bytes=0-0' }, cache: 'no-store', signal: AbortSignal.timeout(10000)
        });
        await response.body?.cancel();
        const contentType = response.headers.get('content-type') || '';
        if (response.status === 206 && contentType.startsWith(`${kind}/`)) return;
        lastError = new Error(`ไฟล์ยังอ่านกลับจาก R2 ไม่ได้ (HTTP ${response.status}, ${contentType || 'ไม่มีชนิดไฟล์'})`);
      } catch (error) { lastError = error; }
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
    throw lastError || new Error('ตรวจสอบไฟล์หลังอัปโหลดไม่สำเร็จ');
  }
  const signS3 = async (payload) => {
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) throw new Error('กรุณาเข้าสู่ระบบก่อนทำรายการนี้');
    const response = await fetch(`${url}/functions/v1/s3-sign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'ติดต่อระบบอัปโหลดไฟล์ไม่ได้ ลองใหม่อีกครั้ง');
    return result;
  };

  window.SourcewavS3 = {
    publicUrl: (key) => (key ? `${MEDIA_PUBLIC_URL}/${key}` : ''),
    upload: async (kind, key, file, contentType) => {
      const type = contentType || file.type;
      const signed = await signS3({ action: 'put', kind, key, contentType: type, size: file.size });
      const put = (uploadUrl) => fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': type }, body: file }).then((putResponse) => {
        if (!putResponse.ok) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ (สถานะ ${putResponse.status})`);
      });
      // Dual upload: ยิงคู่ R2 (หลัก) + S3 (สำรอง) — ทั้งสองฝั่งต้องสำเร็จ ค่อยถือว่าอัปโหลดสำเร็จ
      try {
        const results = await Promise.allSettled([put(signed.uploads.r2), put(signed.uploads.s3)]);
        const failed = results.find(result => result.status === 'rejected');
        if (failed) throw failed.reason;
        await verifyPublishedFile(kind, signed.key);
        return { key: signed.key, publicUrl: `${MEDIA_PUBLIC_URL}/${signed.key}` };
      } catch (error) {
        await signS3({ action: 'delete', keys: [signed.key] }).catch(cleanupError => console.warn('Unable to clean up failed media upload:', cleanupError));
        throw error;
      }
    },
    remove: async (keys) => {
      const ownedKeys = (Array.isArray(keys) ? keys : []).filter(Boolean);
      if (!ownedKeys.length) return { deleted: 0, failed: 0 };
      return signS3({ action: 'delete', keys: ownedKeys });
    },
  };
})();
