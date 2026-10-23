import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const body = await request.json();
    const ticketTypeId = String(body.ticketTypeId || '');
    const quantity = Number(body.quantity);
    const idempotencyKey = String(body.idempotencyKey || '');
    if (!/^[0-9a-f-]{36}$/i.test(ticketTypeId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10 || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
      return json({ error: 'ข้อมูลบัตรไม่ถูกต้อง' }, 400);
    }
    const db = serviceClient();
    const { data, error } = await db.rpc('reserve_manual_ticket_order', {
      p_buyer: user.id, p_type: ticketTypeId, p_quantity: quantity, p_idempotency_key: idempotencyKey,
    });
    if (error) return json({ error: error.message }, 409);
    const order = data?.[0];
    if (!order) return json({ error: 'สร้างรายการไม่ได้ หรือรายการเดิมหมดอายุแล้ว กรุณาเริ่มใหม่' }, 409);
    const { data: current, error: stateError } = await db.from('orders').select('status,buyer_id,expires_at').eq('id', order.order_id).single();
    if (stateError || current?.buyer_id !== user.id || current.status !== 'awaiting_payment' || new Date(current.expires_at) <= new Date()) {
      return json({ error: 'รายการนี้หมดอายุแล้ว กรุณาเริ่มใหม่' }, 409);
    }
    const s3PublicUrl = Deno.env.get('MEDIA_PUBLIC_URL') || '';
    if (!s3PublicUrl || !order.qr_storage_key) return json({ error: 'โหลด QR รับเงินของผู้จัดไม่ได้' }, 500);
    const paymentQrUrl = `${s3PublicUrl}/${order.qr_storage_key}`;
    return json({
      orderId: order.order_id, eventId: order.event_id, eventTitle: order.event_title,
      startsAt: order.event_starts_at, endsAt: order.event_ends_at,
      venueName: order.venue_name || '', venueAddress: order.venue_address || '',
      tierName: order.tier_name, quantity: order.quantity, totalMinor: Number(order.total_minor),
      expiresAt: order.expires_at, paymentQrUrl, bankName: order.bank_name,
      organizerName: order.organizer_name || '', beneficiaryName: order.beneficiary_name, accountLast4: order.account_last4,
      refundPolicy: order.refund_policy || 'ยังไม่ได้ระบุเงื่อนไขโดยละเอียด กรุณาติดต่อผู้จัดงานก่อนชำระเงิน',
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' }, 400);
  }
});
