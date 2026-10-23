import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';
import { encryptSlipOkApiKey } from '../_shared/slipok-crypto.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const rawBody = await request.text();
    if (rawBody.length > 4096) return json({ error: 'คำขอมีขนาดใหญ่เกินไป' }, 413);
    const body = JSON.parse(rawBody);
    const eventId = String(body.eventId || '');
    const branchId = String(body.slipokBranchId || '').trim();
    const apiKey = String(body.slipokApiKey || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(eventId) || !/^\d{1,20}$/.test(branchId) || apiKey.length < 8 || apiKey.length > 512) {
      return json({ error: 'กรอก Event ID, Branch ID และ API Key ให้ถูกต้อง' }, 400);
    }

    const db = serviceClient();
    const [{ data: event, error: eventError }, { data: roles, error: rolesError }] = await Promise.all([
      db.from('events').select('organizer_id').eq('id', eventId).single(),
      db.from('user_roles').select('role').eq('user_id', user.id).in('role', ['organizer', 'admin']),
    ]);
    if (eventError || !event) return json({ error: 'ไม่พบอีเวนต์นี้' }, 404);
    if (event.organizer_id !== user.id || rolesError || !roles?.length) return json({ error: 'บัญชีนี้ไม่มีสิทธิ์แก้ไขการรับชำระของอีเวนต์' }, 403);

    let verification: Response;
    try {
      verification = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}/quota`, {
        method: 'GET', headers: { 'x-authorization': apiKey }, signal: AbortSignal.timeout(12000),
      });
    } catch {
      return json({ error: 'ติดต่อ SlipOK ไม่ได้ กรุณาลองใหม่ภายหลัง' }, 502);
    }
    const result = await verification.json().catch(() => ({}));
    if (!verification.ok || result?.success !== true) {
      const code = Number.isInteger(Number(result?.code)) ? Number(result.code) : null;
      const message = code === 1001 ? 'Branch ID นี้ไม่พบใน SlipOK กรุณาตรวจเลขสาขา'
        : code === 1002 ? 'SlipOK ไม่ยอมรับ API Key นี้ กรุณาคัดลอก API Key จากสาขาที่เลือก'
          : code === 1003 ? 'แพ็กเกจ SlipOK หมดอายุแล้ว กรุณาต่ออายุบัญชีก่อน'
            : code === 1004 ? 'โควตา SlipOK หมดแล้ว กรุณาต่อแพ็กเกจ'
              : 'SlipOK ยังยืนยันการเชื่อมต่อไม่ได้ กรุณาตรวจการตั้งค่าสาขา';
      console.error('SlipOK credential check failed', verification.status, code || '');
      return json({ error: message, providerCode: code }, verification.status === 429 ? 429 : 422);
    }

    const encryptedApiKey = await encryptSlipOkApiKey(apiKey);
    const { error: updateError } = await db.from('event_payment_methods').update({
      slipok_branch_id: branchId, slipok_api_key_ciphertext: encryptedApiKey,
    }).eq('event_id', eventId).eq('organizer_id', user.id);
    if (updateError) {
      console.error('Unable to update event SlipOK configuration:', updateError.message);
      return json({ error: 'เชื่อมต่อ SlipOK ได้ แต่บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองอีกครั้ง' }, 500);
    }
    return json({ status: 'saved', branchId, quota: Number.isFinite(Number(result?.data?.quota)) ? Number(result.data.quota) : null });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'บันทึกการตั้งค่า SlipOK ไม่สำเร็จ' }, 400);
  }
});
