import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';

const uuid = /^[0-9a-f-]{36}$/i;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const orderId = String(body?.orderId || url.searchParams.get('orderId') || '');
    if (orderId && !uuid.test(orderId)) return json({ error: 'เลขคำสั่งซื้อไม่ถูกต้อง' }, 400);
    const db = serviceClient();
    const s3PublicUrl = Deno.env.get('MEDIA_PUBLIC_URL') || '';
    let query = db.from('orders').select(
      'id,event_id,status,currency,total_minor,expires_at,created_at,event_title_snapshot,event_starts_at_snapshot,event_ends_at_snapshot,event_venue_name_snapshot,event_venue_address_snapshot,organizer_id_snapshot,organizer_name_snapshot,refund_policy_snapshot,payment_qr_storage_key_snapshot,payment_bank_name_snapshot,payment_beneficiary_name_snapshot,payment_account_last4_snapshot,events!inner(title,starts_at,ends_at,venue_name,venue_address,status,cover_url),order_items!inner(quantity,unit_price_minor,ticket_types!inner(name)),payments!inner(status,provider),ticket_payment_submissions(id,slipok_status,slipok_message,slipok_amount_minor,transfer_timestamp,submitted_at,ticket_payment_reviews(decision,note,reviewer_role,created_at))'
    ).eq('buyer_id', user.id).eq('payments.provider', 'manual_slipok').order('created_at', { ascending: false }).limit(orderId ? 1 : 50);
    if (orderId) query = query.eq('id', orderId);
    const { data: rows, error } = await query;
    if (error) throw error;
    if (orderId && !rows?.length) return json({ error: 'ไม่พบคำสั่งซื้อของบัญชีนี้' }, 404);
    const orders = (rows || []).map((row: any) => {
      const event = Array.isArray(row.events) ? row.events[0] : row.events;
      const itemRows = Array.isArray(row.order_items) ? row.order_items : [row.order_items];
      const paymentRows = Array.isArray(row.payments) ? row.payments : [row.payments];
      const submissions = Array.isArray(row.ticket_payment_submissions) ? row.ticket_payment_submissions : [];
      const latestSubmission = submissions.slice().sort((a: any, b: any) =>
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0] || null;
      const latestReview = submissions.flatMap((submission: any) => Array.isArray(submission.ticket_payment_reviews) ? submission.ticket_payment_reviews : [])
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
      const now = Date.now();
      const expired = row.expires_at && new Date(row.expires_at).getTime() <= now;
      const paymentQrUrl = s3PublicUrl && row.status === 'awaiting_payment' && !expired && row.payment_qr_storage_key_snapshot
        ? `${s3PublicUrl}/${row.payment_qr_storage_key_snapshot}`
        : null;
      return {
        orderId: row.id, eventId: row.event_id, status: expired && row.status === 'awaiting_payment' ? 'expired' : row.status,
        totalMinor: Number(row.total_minor), currency: row.currency, expiresAt: row.expires_at,
        createdAt: row.created_at, eventTitle: row.event_title_snapshot || event?.title || 'อีเวนต์', startsAt: row.event_starts_at_snapshot || event?.starts_at || null,
        endsAt: row.event_ends_at_snapshot || event?.ends_at || null, venueName: row.event_venue_name_snapshot || event?.venue_name || '', venueAddress: row.event_venue_address_snapshot || event?.venue_address || '',
        eventStatus: event?.status || '', coverUrl: event?.cover_url || '',
        items: itemRows.filter(Boolean).map((item: any) => ({ tierName: item.ticket_types?.name || 'บัตรเข้างาน', quantity: item.quantity, unitPriceMinor: Number(item.unit_price_minor) })),
        paymentStatus: paymentRows.find((payment: any) => payment?.provider === 'manual_slipok')?.status || 'pending',
        organizerId: row.organizer_id_snapshot || null, organizerName: row.organizer_name_snapshot || '',
        refundPolicy: row.refund_policy_snapshot || 'ยังไม่ได้ระบุเงื่อนไขโดยละเอียด กรุณาติดต่อผู้จัดงานก่อนชำระเงิน',
        recipientName: row.payment_beneficiary_name_snapshot || '', bankName: row.payment_bank_name_snapshot || '',
        accountLast4: row.payment_account_last4_snapshot || '', paymentQrUrl,
        latestSubmission: latestSubmission ? {
          id: latestSubmission.id, status: latestSubmission.slipok_status,
          message: latestSubmission.slipok_message, amountMinor: latestSubmission.slipok_amount_minor,
          transferAt: latestSubmission.transfer_timestamp, submittedAt: latestSubmission.submitted_at,
        } : null,
        latestReview: latestReview ? {
          decision: latestReview.decision, note: latestReview.note || '',
          reviewerRole: latestReview.reviewer_role, createdAt: latestReview.created_at,
        } : null,
      };
    });
    const ids = orders.map((order: any) => order.orderId);
    const { data: attempts, error: attemptError } = ids.length
      ? await db.from('slip_verification_attempts').select('id,order_id,status,created_at,transfer_timestamp,failure_reason').in('order_id', ids).order('created_at', { ascending: false })
      : { data: [], error: null };
    if (attemptError) throw attemptError;
    for (const order of orders) {
      const latest = (attempts || []).find((attempt: any) => attempt.order_id === order.orderId);
      const attemptIsLive = latest?.status === 'processing' && Date.now() - new Date(latest.created_at).getTime() < 120_000;
      order.verificationStatus = attemptIsLive ? 'processing' : latest?.status === 'processing' ? 'error' : latest?.status || null;
      order.submissionId = order.latestSubmission?.status === 'verified' ? order.latestSubmission.id : null;
      order.verifiedAttemptId = !order.submissionId && latest?.status === 'verified' ? latest.id : null;
      order.verificationIssue = latest?.failure_reason || null;
      order.latestTransferAt = latest?.transfer_timestamp || order.latestSubmission?.transferAt || null;
    }
    return orderId ? json({ order: orders[0] }) : json({ orders });
  } catch (error) {
    console.error('Unable to load buyer ticket orders:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'โหลดคำสั่งซื้อไม่ได้ กรุณาลองใหม่' }, 400);
  }
});
