import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const db = serviceClient();
    const { data: roles, error: roleError } = await db.from('user_roles').select('role')
      .eq('user_id', user.id).eq('role', 'admin');
    if (roleError) throw roleError;
    if (!roles?.length) return json({ error: 'ผู้ดูแลระบบเท่านั้น' }, 403);

    const url = new URL(request.url);
    const requested = Number(url.searchParams.get('limit') || 50);
    const limit = Number.isInteger(requested) ? Math.min(100, Math.max(1, requested)) : 50;
    const status = url.searchParams.get('status');
    let query = db.from('ticket_payment_submissions')
      .select('id,order_id,event_id,buyer_id,organizer_id,slip_storage_key,slipok_status,slipok_code,slipok_message,slipok_amount_minor,trans_ref,slipok_result,submitted_at,orders!inner(id,status,total_minor,created_at),events!inner(title)')
      .order('submitted_at', { ascending: false }).limit(limit);
    if (status === 'verified' || status === 'rejected' || status === 'error') query = query.eq('slipok_status', status);
    const { data: submissions, error } = await query;
    if (error) throw error;
    const rows = submissions || [];
    const orderIds = [...new Set(rows.map((row) => row.order_id))];
    const { data: attempts, error: attemptError } = orderIds.length
      ? await db.from('slip_verification_attempts').select('id,order_id,status,provider_response_code,failure_reason,created_at,completed_at').in('order_id', orderIds).order('created_at', { ascending: false })
      : { data: [], error: null };
    if (attemptError) throw attemptError;
    const payments = await Promise.all(rows.map(async (row) => {
      const { data: slip } = await db.storage.from('sourcewav-ticket-slips').createSignedUrl(row.slip_storage_key, 600);
      return {
        id: row.id, orderId: row.order_id, orderStatus: row.orders.status,
        amountMinor: row.slipok_amount_minor, expectedAmountMinor: row.orders.total_minor,
        eventTitle: row.events.title, buyerId: row.buyer_id, organizerId: row.organizer_id,
        status: row.slipok_status, providerCode: row.slipok_code, message: row.slipok_message,
        transRef: row.trans_ref, providerFacts: row.slipok_result,
        submittedAt: row.submitted_at, slipUrl: slip?.signedUrl || null,
        attempts: (attempts || []).filter((attempt) => attempt.order_id === row.order_id),
      };
    }));
    let attemptsQuery = db.from('slip_verification_attempts')
      .select('id,order_id,buyer_id,status,provider_response_code,failure_reason,amount_minor,receiver_verified,trans_ref,created_at,completed_at,orders!inner(id,event_id,status,total_minor,created_at,events!inner(title))')
      .order('created_at', { ascending: false }).limit(limit);
    if (status === 'verified' || status === 'rejected' || status === 'error') attemptsQuery = attemptsQuery.eq('status', status);
    const { data: allAttempts, error: allAttemptsError } = await attemptsQuery;
    if (allAttemptsError) throw allAttemptsError;
    const auditAttempts = (allAttempts || []).map((row) => ({
      id: row.id, orderId: row.order_id, buyerId: row.buyer_id,
      orderStatus: row.orders.status, expectedAmountMinor: row.orders.total_minor,
      eventTitle: row.orders.events.title, status: row.status,
      providerCode: row.provider_response_code, failureReason: row.failure_reason,
      amountMinor: row.amount_minor, receiverVerified: row.receiver_verified,
      transRef: row.trans_ref, createdAt: row.created_at, completedAt: row.completed_at,
    }));
    return json({ payments, attempts: auditAttempts });
  } catch (error) {
    console.error('Unable to list admin ticket payments:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: error instanceof Error ? error.message : 'โหลดรายการชำระเงินไม่ได้' }, 400);
  }
});
