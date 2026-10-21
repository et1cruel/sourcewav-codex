import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const secret = Deno.env.get('OMISE_SECRET_KEY');
    if (!secret) return json({ error: 'ระบบชำระเงินยังไม่ได้ตั้งค่า Omise' }, 503);
    const body = await request.json();
    const typeId = String(body.ticketTypeId || '');
    const quantity = Number(body.quantity);
    const key = String(body.idempotencyKey || '');
    if (!/^[0-9a-f-]{36}$/i.test(typeId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10 || !/^[0-9a-f-]{36}$/i.test(key)) {
      return json({ error: 'ข้อมูลบัตรไม่ถูกต้อง' }, 400);
    }
    const db = serviceClient();
    const { data: reserved, error: reserveError } = await db.rpc('reserve_ticket_order', {
      p_buyer: user.id, p_type: typeId, p_quantity: quantity, p_idempotency_key: key,
    });
    if (reserveError) return json({ error: reserveError.message }, 409);
    const order = reserved?.[0];
    if (!order) return json({ error: 'สร้างคำสั่งซื้อไม่สำเร็จ' }, 500);
    const { data: orderState } = await db.from('orders').select('status').eq('id', order.order_id).maybeSingle();
    if (orderState?.status !== 'awaiting_payment') return json({ error: 'คำสั่งซื้อนี้ชำระแล้วหรือหมดอายุ กรุณาเริ่มรายการใหม่' }, 409);
    const { data: existingPayment } = await db.from('payments').select('provider_reference,provider_payload,status').eq('order_id', order.order_id).maybeSingle();
    if (existingPayment?.provider_reference && existingPayment.status === 'pending' && existingPayment.provider_payload?.qr_url) {
      return json({ orderId: order.order_id, status: 'awaiting_payment', totalMinor: order.total_minor, eventTitle: order.event_title, tierName: order.tier_name, quantity: order.quantity, expiresAt: order.expires_at, qrUrl: existingPayment.provider_payload.qr_url });
    }
    // PromptPay is asynchronous and has a THB 20 minimum per Omise's current documentation.
    if (Number(order.total_minor) < 2000) {
      await db.rpc('release_ticket_order', { p_order: order.order_id, p_status: 'cancelled' });
      return json({ error: 'ยอดชำระ PromptPay ขั้นต่ำ ฿20' }, 422);
    }
    const form = new URLSearchParams({ amount: String(order.total_minor), currency: 'thb', 'source[type]': 'promptpay', description: `Sourcewav ticket order ${order.order_id}`, 'metadata[order_id]': order.order_id, expires_at: order.expires_at });
    const response = await fetch('https://api.omise.co/charges', {
      method: 'POST', headers: { Authorization: `Basic ${btoa(`${secret}:`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
    });
    const charge = await response.json();
    if (!response.ok) {
      await db.rpc('release_ticket_order', { p_order: order.order_id, p_status: 'cancelled' });
      return json({ error: charge.message || 'Omise สร้างรายการชำระไม่สำเร็จ' }, 502);
    }
    const qrUrl = charge.source?.scannable_code?.image?.download_uri;
    if (!qrUrl || !String(qrUrl).startsWith('https://api.omise.co/')) {
      await db.rpc('release_ticket_order', { p_order: order.order_id, p_status: 'cancelled' });
      return json({ error: 'Omise ไม่ส่ง QR PromptPay กลับมา ตรวจสอบการเปิดใช้ PromptPay ในบัญชี' }, 502);
    }
    const { error: updateError } = await db.from('payments').update({ provider_reference: charge.id, provider_payload: { qr_url: qrUrl, charge_status: charge.status } }).eq('order_id', order.order_id);
    if (updateError) return json({ error: 'สร้าง QR แล้วแต่บันทึกรายการไม่ได้ กรุณาติดต่อทีมงานพร้อมเลขคำสั่งซื้อ ' + order.order_id }, 500);
    return json({ orderId: order.order_id, status: 'awaiting_payment', totalMinor: order.total_minor, eventTitle: order.event_title, tierName: order.tier_name, quantity: order.quantity, expiresAt: order.expires_at, qrUrl });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' }, 400);
  }
});
