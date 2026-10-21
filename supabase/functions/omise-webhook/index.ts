import { constantTimeEqual, corsHeaders, hmacHex, json, serviceClient, sha256Hex } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const signingSecret = Deno.env.get('OMISE_WEBHOOK_SECRET');
  const apiSecret = Deno.env.get('OMISE_SECRET_KEY');
  const qrSecret = Deno.env.get('TICKET_QR_SECRET');
  if (!signingSecret || !apiSecret || !qrSecret) return json({ error: 'Payment webhook secrets are not configured' }, 503);
  const rawBody = await request.text();
  const timestamp = request.headers.get('Omise-Signature-Timestamp') || '';
  const signatures = (request.headers.get('Omise-Signature') || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return json({ error: 'Webhook timestamp invalid or expired' }, 401);
  const expected = await hmacHex(atob(signingSecret), `${timestamp}.${rawBody}`);
  if (!signatures.some(value => constantTimeEqual(value, expected))) return json({ error: 'Invalid webhook signature' }, 401);
  try {
    const event = JSON.parse(rawBody);
    if (!['charge.complete', 'charge.update'].includes(event.key)) return json({ received: true });
    const db = serviceClient();
    const chargeId = event.data?.id;
    if (!chargeId) return json({ error: 'Charge ID missing' }, 400);
    const { data: payment, error: paymentError } = await db.from('payments').select('order_id,amount_minor').eq('provider', 'omise').eq('provider_reference', chargeId).maybeSingle();
    if (paymentError || !payment) return json({ error: 'Unknown charge' }, 404);
    const verifiedResponse = await fetch(`https://api.omise.co/charges/${encodeURIComponent(chargeId)}`, { headers: { Authorization: `Basic ${btoa(`${apiSecret}:`)}` } });
    const charge = await verifiedResponse.json();
    if (!verifiedResponse.ok || charge.amount !== Number(payment.amount_minor) || charge.currency?.toLowerCase() !== 'thb') return json({ error: 'Charge amount does not match' }, 409);
    if (charge.status === 'failed' || charge.status === 'expired') {
      await db.rpc('release_ticket_order', { p_order: payment.order_id, p_status: charge.status === 'expired' ? 'expired' : 'cancelled' });
      await db.from('payment_webhook_events').upsert({ provider: 'omise', provider_event_id: event.id || chargeId, payload_digest: await sha256Hex(rawBody), processed_at: new Date().toISOString() }, { onConflict: 'provider,provider_event_id' });
      return json({ received: true });
    }
    if (charge.status !== 'successful') return json({ received: true, status: charge.status });
    const { data: order, error: orderError } = await db.from('orders').select('id,buyer_id,event_id,order_items(id,quantity)').eq('id', payment.order_id).single();
    if (orderError || !order) return json({ error: 'Order not found' }, 404);
    const tickets = [];
    for (const item of order.order_items) {
      for (let n = 1; n <= item.quantity; n++) {
        const id = crypto.randomUUID();
        const token = `${id}.${await hmacHex(qrSecret, id)}`;
        tickets.push({ id, order_item_id: item.id, ticket_number: n, qr_code_hash: await sha256Hex(token) });
      }
    }
    const { error: completeError } = await db.rpc('complete_ticket_order', {
      p_order: order.id, p_charge_id: chargeId, p_charge_amount: charge.amount, p_ticket_rows: tickets,
    });
    if (completeError) return json({ error: completeError.message }, 500);
    const digest = await sha256Hex(rawBody);
    await db.from('payment_webhook_events').upsert({ provider: 'omise', provider_event_id: event.id || chargeId, payload_digest: digest, processed_at: new Date().toISOString() }, { onConflict: 'provider,provider_event_id' });
    return json({ received: true, orderId: order.id });
  } catch (error) {
    console.error('Omise webhook processing failed:', error);
    return json({ error: 'Webhook processing failed' }, 500);
  }
});
