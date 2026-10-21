import { hmacHex, serviceClient, sha256Hex } from './http.ts';

type DbClient = ReturnType<typeof serviceClient>;

export async function issueSlipOkSubmission(db: DbClient, submissionId: string, buyerId: string) {
  const { data: submission, error: submissionError } = await db.from('ticket_payment_submissions')
    .select('id,order_id,buyer_id,slipok_status,slipok_amount_minor,trans_ref')
    .eq('id', submissionId).single();
  if (submissionError || !submission || submission.buyer_id !== buyerId) return { error: 'ไม่พบรายการชำระเงินของบัญชีนี้', statusCode: 404 };
  if (submission.slipok_status !== 'verified' || !submission.trans_ref) return { error: 'SlipOK ยังยืนยันสลิปนี้ไม่ได้', statusCode: 409 };

  const { data: order, error: orderError } = await db.from('orders')
    .select('id,event_id,buyer_id,status,total_minor,expires_at')
    .eq('id', submission.order_id).single();
  if (orderError || !order || order.buyer_id !== buyerId) return { error: 'ไม่พบคำสั่งซื้อของบัญชีนี้', statusCode: 404 };
  if (order.status === 'paid') return { status: 'paid', orderId: order.id, ticketCount: null };
  if (order.status !== 'awaiting_payment' || !order.expires_at || new Date(order.expires_at) <= new Date()) {
    if (order.status === 'awaiting_payment') await db.rpc('release_ticket_order', { p_order: order.id, p_status: 'expired' });
    return { error: 'คำสั่งซื้อหมดอายุแล้ว กรุณาเลือกบัตรใหม่', statusCode: 409 };
  }
  if (Number(submission.slipok_amount_minor) !== Number(order.total_minor)) return { error: 'ยอดสลิปไม่ตรงกับยอดคำสั่งซื้อ', statusCode: 409 };

  const qrSecret = Deno.env.get('TICKET_QR_SECRET');
  if (!qrSecret || qrSecret.length < 32) return { error: 'ยังไม่ได้ตั้งค่า TICKET_QR_SECRET ใน Supabase Secrets', statusCode: 503 };
  const { data: items, error: itemsError } = await db.from('order_items').select('id,quantity').eq('order_id', order.id);
  if (itemsError || !items?.length) return { error: 'ไม่พบรายการบัตรในคำสั่งซื้อ', statusCode: 409 };
  const tickets = [];
  for (const item of items) {
    for (let number = 1; number <= item.quantity; number++) {
      const id = crypto.randomUUID();
      const token = `${id}.${await hmacHex(qrSecret, id)}`;
      const qrCodeHash = await sha256Hex(token);
      tickets.push({ id, order_item_id: item.id, ticket_number: number, qr_code_hash: qrCodeHash });
    }
  }
  const { data: status, error } = await db.rpc('issue_slipok_ticket_order', {
    p_submission: submission.id, p_buyer: buyerId, p_ticket_rows: tickets,
  });
  if (error) {
    console.error('Unable to issue verified SlipOK tickets:', error.message);
    return { error: 'SlipOK ยืนยันแล้ว แต่ยังออกบัตรไม่สำเร็จ กรุณากดลองออกบัตรอีกครั้ง', statusCode: 503 };
  }
  if (status === 'expired') {
    await db.rpc('release_ticket_order', { p_order: order.id, p_status: 'expired' });
    return { error: 'คำสั่งซื้อหมดอายุแล้ว กรุณาเลือกบัตรใหม่', statusCode: 409 };
  }
  return { status: 'paid', orderId: order.id, ticketCount: tickets.length };
}
