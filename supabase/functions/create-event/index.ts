import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';
import { encryptSlipOkApiKey } from '../_shared/slipok-crypto.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const body = await request.json();
    const title = String(body.title || '').trim();
    const venueName = String(body.venueName || '').trim();
    const venueAddress = String(body.venueAddress || '').trim();
    const category = ['music', 'art', 'community', 'market', 'other'].includes(body.category) ? body.category : 'other';
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    const price = Math.round(Number(body.priceBaht) * 100);
    const stock = Number(body.quantity);
    const paymentQrKey = String(body.paymentQrKey || '');
    const legacyPosterStorageKey = String(body.posterStorageKey || '');
    const posterStorageKeys = Array.isArray(body.posterStorageKeys)
      ? body.posterStorageKeys.map((key: unknown) => String(key || ''))
      : legacyPosterStorageKey ? [legacyPosterStorageKey] : [];
    const bankName = String(body.bankName || '').trim();
    const beneficiaryName = String(body.beneficiaryName || '').trim();
    const accountLast4 = String(body.accountLast4 || '').trim();
    const slipokBranchId = String(body.slipokBranchId || '').trim();
    const slipokApiKey = String(body.slipokApiKey || '').trim();
    if (title.length < 4 || title.length > 180 || venueName.length < 2 || venueName.length > 160 || venueAddress.length > 400 || !Number.isFinite(+startsAt) || !Number.isFinite(+endsAt) || endsAt <= startsAt || startsAt <= new Date() || !Number.isInteger(price) || price < 2000 || price > 15000000 || !Number.isInteger(stock) || stock < 1 || stock > 10000 || bankName.length < 1 || bankName.length > 80 || beneficiaryName.length < 1 || beneficiaryName.length > 120 || (accountLast4 && !/^\d{4}$/.test(accountLast4)) || !paymentQrKey.startsWith(`${user.id}/`) || paymentQrKey.length > 300 || posterStorageKeys.length > 4 || posterStorageKeys.some((key: string) => !key.startsWith(`${user.id}/`) || key.length > 300) || !/^\d{1,20}$/.test(slipokBranchId) || slipokApiKey.length < 8 || slipokApiKey.length > 512) {
      return json({ error: 'กรอกข้อมูลงาน ราคา (อย่างน้อย ฿20) จำนวนบัตร และวันเวลาให้ถูกต้อง' }, 400);
    }
    const encryptionKey = Deno.env.get('SLIPOK_CREDENTIAL_ENCRYPTION_KEY') || '';
    if (!/^[0-9a-f]{64}$/i.test(encryptionKey)) return json({ error: 'ระบบยังไม่ได้ตั้งค่ากุญแจเข้ารหัสข้อมูล SlipOK ฝั่งเซิร์ฟเวอร์' }, 503);
    const encryptedSlipOkApiKey = await encryptSlipOkApiKey(slipokApiKey);
    const db = serviceClient();
    const { data: qrFile, error: qrError } = await db.storage.from('sourcewav-event-payment-qr').download(paymentQrKey);
    if (qrError || !qrFile || qrFile.size > 5 * 1024 * 1024 || !['image/jpeg','image/png','image/webp'].includes(qrFile.type)) return json({ error: 'ไม่พบ QR รับเงินที่อัปโหลด หรือไฟล์ไม่ถูกต้อง' }, 400);
    const posterUrls: string[] = [];
    for (const posterStorageKey of posterStorageKeys) {
      const { data: posterFile, error: posterError } = await db.storage.from('sourcewav-event-payment-qr').download(posterStorageKey);
      if (posterError || !posterFile || posterFile.size > 5 * 1024 * 1024 || !['image/jpeg','image/png','image/webp'].includes(posterFile.type)) return json({ error: 'ไม่พบโปสเตอร์งานที่อัปโหลด หรือไฟล์ไม่ถูกต้อง' }, 400);
      posterUrls.push(db.storage.from('sourcewav-event-payment-qr').getPublicUrl(posterStorageKey).data.publicUrl);
    }
    const { data: roles, error: rolesError } = await db.from('user_roles')
      .select('role').eq('user_id', user.id).in('role', ['organizer', 'admin']);
    if (rolesError) {
      console.error('Unable to load event publisher authorization:', rolesError.message);
      return json({ error: 'ตรวจสอบสิทธิ์ผู้จัดงานไม่ได้ กรุณาลองอีกครั้งภายหลัง' }, 503);
    }
    if (!roles?.length) return json({ error: 'ฟีเจอร์นี้สำหรับบัญชี Organizer ที่ผ่านการยืนยันเท่านั้น' }, 403);
    const { data: event, error } = await db.from('events').insert({ organizer_id: user.id, title, description: String(body.description || '').slice(0, 5000), category, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), venue_name: venueName, venue_address: venueAddress, cover_url: posterUrls[0] || null, poster_urls: posterUrls, status: 'published', currency: 'THB' }).select('id').single();
    if (error) throw error;
    const { error: tierError } = await db.from('ticket_types').insert({ event_id: event.id, name: String(body.tierName || 'บัตรทั่วไป').slice(0, 100), price_minor: price, currency: 'THB', quantity_total: stock });
    if (tierError) {
      await db.from('events').delete().eq('id', event.id);
      throw tierError;
    }
    const { error: paymentError } = await db.from('event_payment_methods').insert({
      event_id: event.id, organizer_id: user.id, qr_storage_key: paymentQrKey,
      bank_name: bankName, beneficiary_name: beneficiaryName, account_last4: accountLast4,
      slipok_branch_id: slipokBranchId, slipok_api_key_ciphertext: encryptedSlipOkApiKey,
    });
    if (paymentError) {
      await db.from('events').delete().eq('id', event.id);
      throw paymentError;
    }
    return json({ eventId: event.id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' }, 400);
  }
});
