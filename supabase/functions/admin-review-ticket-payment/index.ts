import { authenticatedUser, corsHeaders, hmacHex, json, serviceClient, sha256Hex } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const rawBody = await request.text();
    if (rawBody.length > 8192) return json({ error: 'คำขอใหญ่เกินไป' }, 413);
    const body = JSON.parse(rawBody);
    const submissionId = String(body.submissionId || '');
    const decision = String(body.decision || '');
    const note = String(body.note || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(submissionId) || !['approved', 'rejected'].includes(decision) || note.length < 3 || note.length > 1000) {
      return json({ error: 'ข้อมูลตรวจสอบไม่ถูกต้อง' }, 400);
    }

    const db = serviceClient();
    const { data: roles, error: roleError } = await db.from('user_roles').select('role')
      .eq('user_id', user.id).in('role', ['admin', 'organizer']);
    if (roleError) throw roleError;
    if (!roles?.length) return json({ error: 'สำหรับผู้จัดงานหรือผู้ดูแลระบบเท่านั้น' }, 403);

    const secret = Deno.env.get('TICKET_QR_SECRET');
    if (!secret || secret.length < 32) return json({ error: 'ระบบออกบัตรยังไม่ได้ตั้งค่า' }, 503);
    const { data: submission, error: submissionError } = await db.from('ticket_payment_submissions')
      .select('id,order_id,buyer_id,slipok_status,trans_ref,slipok_amount_minor')
      .eq('id', submissionId).single();
    if (submissionError || !submission) return json({ error: 'ไม่พบรายการตรวจสลิป' }, 404);
    const { data: order, error: orderError } = await db.from('orders')
      .select('id,status,total_minor,event_id,buyer_id,events!inner(organizer_id)').eq('id', submission.order_id).single();
    if (orderError || !order) return json({ error: 'ไม่พบคำสั่งซื้อ' }, 404);
    const isAdmin = roles.some((role) => role.role === 'admin');
    const event = Array.isArray(order.events) ? order.events[0] : order.events;
    if (!isAdmin && event?.organizer_id !== user.id) return json({ error: 'คุณไม่มีสิทธิ์ตรวจคำสั่งซื้อนี้' }, 403);
    if (order.buyer_id !== submission.buyer_id || order.status !== 'disputed') {
      return json({ error: 'รายการนี้ไม่ได้อยู่ระหว่างรอตรวจสอบ' }, 409);
    }

    const ticketRows = [];
    if (decision === 'approved') {
      const { data: items, error: itemsError } = await db.from('order_items').select('id,quantity').eq('order_id', order.id);
      if (itemsError || !items?.length) return json({ error: 'ไม่พบรายการบัตรในออเดอร์' }, 409);
      for (const item of items) {
        for (let number = 1; number <= item.quantity; number++) {
          const id = crypto.randomUUID();
          const token = `${id}.${await hmacHex(secret, id)}`;
          ticketRows.push({ id, order_item_id: item.id, ticket_number: number, qr_code_hash: await sha256Hex(token) });
        }
      }
    }
    const { data: result, error } = await db.rpc('review_slipok_ticket_payment', {
      p_submission: submissionId, p_admin: user.id, p_decision: decision, p_note: note, p_ticket_rows: ticketRows,
    });
    if (error) {
      console.error('Unable to review ticket payment:', error.message);
      return json({ error: error.message.includes('Inventory unavailable')
        ? 'บัตรถูกจองหรือขายหมดแล้ว จึงยังออกบัตรไม่ได้ ให้คงรายการรอตรวจและจัดการคืนเงิน' : 'บันทึกผลตรวจสอบไม่ได้' }, 409);
    }
    return json({ status: result, ticketCount: decision === 'approved' ? ticketRows.length : 0 });
  } catch (error) {
    console.error('Admin ticket payment review failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'ตรวจสอบรายการชำระเงินไม่ได้' }, 400);
  }
});
