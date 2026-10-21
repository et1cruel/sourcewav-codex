import { authenticatedUser, corsHeaders, constantTimeEqual, hmacHex, json, serviceClient, sha256Hex } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const secret = Deno.env.get('TICKET_QR_SECRET');
    if (!secret) return json({ error: 'ระบบเช็กอินยังไม่ได้ตั้งค่า' }, 503);
    const { qrPayload } = await request.json();
    if (typeof qrPayload !== 'string' || qrPayload.length > 200) return json({ error: 'QR ไม่ถูกต้อง' }, 400);
    const [ticketId, signature, extra] = qrPayload.split('.');
    if (extra || !/^[0-9a-f-]{36}$/i.test(ticketId || '') || !signature || !constantTimeEqual(signature, await hmacHex(secret, ticketId))) return json({ error: 'QR ไม่ถูกต้อง' }, 400);
    const db = serviceClient();
    const { data, error } = await db.rpc('validate_ticket_once', { p_ticket_id: ticketId, p_qr_hash: await sha256Hex(qrPayload), p_scanner: user.id });
    if (error) return json({ error: error.message }, 403);
    return json(data?.[0] || { result: 'invalid' });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' }, 400);
  }
});
