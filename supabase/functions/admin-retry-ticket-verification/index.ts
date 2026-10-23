import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';
import { decryptSlipOkApiKey } from '../_shared/slipok-crypto.ts';
import { issueSlipOkSubmission } from '../_shared/ticket-issuance.ts';
import { attemptStatusForHttp, detectSlipImage, evaluateSlipOk } from '../_shared/slipok-validation.mjs';

const maxSlipBytes = 5 * 1024 * 1024;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const rawBody = await request.text();
    if (rawBody.length > 4096) return json({ error: 'คำขอใหญ่เกินไป' }, 413);
    const body = JSON.parse(rawBody);
    const attemptId = String(body.attemptId || '');
    if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return json({ error: 'รายการตรวจสลิปไม่ถูกต้อง' }, 400);

    const db = serviceClient();
    const { data: roles, error: roleError } = await db.from('user_roles').select('role')
      .eq('user_id', user.id).in('role', ['admin', 'organizer']);
    if (roleError) throw roleError;
    if (!roles?.length) return json({ error: 'สำหรับผู้จัดงานหรือผู้ดูแลระบบเท่านั้น' }, 403);
    const isAdmin = roles.some((role) => role.role === 'admin');

    const { data: previous, error: attemptError } = await db.from('slip_verification_attempts')
      .select('id,order_id,buyer_id,status,failure_reason,slip_storage_key,orders!inner(id,event_id,buyer_id,status,total_minor,created_at,expires_at,organizer_id_snapshot,payment_account_last4_snapshot,slipok_branch_id_snapshot,slipok_api_key_ciphertext_snapshot,events!inner(organizer_id))')
      .eq('id', attemptId).single();
    if (attemptError || !previous) return json({ error: 'ไม่พบรายการตรวจสลิป' }, 404);
    const order = Array.isArray(previous.orders) ? previous.orders[0] : previous.orders;
    const event = Array.isArray(order.events) ? order.events[0] : order.events;
    if (!isAdmin && event?.organizer_id !== user.id) return json({ error: 'คุณไม่มีสิทธิ์ตรวจคำสั่งซื้อนี้' }, 403);
    if (!['error', 'timeout'].includes(previous.status)
      || !['provider_timeout', 'provider_unavailable', 'invalid_slipok_credentials'].includes(previous.failure_reason)
      || !previous.slip_storage_key) {
      return json({ error: 'รายการนี้ไม่สามารถตรวจซ้ำอัตโนมัติได้ กรุณาตรวจสลิปและรายการเดินบัญชีด้วยตนเอง' }, 409);
    }
    if (!['awaiting_payment', 'expired'].includes(order.status)) {
      return json({ error: 'คำสั่งซื้อนี้เปลี่ยนสถานะแล้ว กรุณารีเฟรชคิวตรวจสอบ' }, 409);
    }
    if (!previous.slip_storage_key.startsWith(`${previous.buyer_id}/${order.id}/`)) {
      return json({ error: 'ไฟล์สลิปไม่ตรงกับคำสั่งซื้อ' }, 409);
    }

    let apiKeyCiphertext = order.slipok_api_key_ciphertext_snapshot;
    if (previous.failure_reason === 'invalid_slipok_credentials') {
      const { data: currentMethod, error: methodError } = await db.from('event_payment_methods')
        .select('organizer_id,slipok_branch_id,slipok_api_key_ciphertext')
        .eq('event_id', order.event_id).maybeSingle();
      if (methodError) throw methodError;
      // Permit key rotation only for the same organizer and SlipOK branch captured
      // on the order; a changed branch could represent a different payment receiver.
      if (currentMethod?.organizer_id !== order.organizer_id_snapshot
        || currentMethod?.slipok_branch_id !== order.slipok_branch_id_snapshot
        || !currentMethod?.slipok_api_key_ciphertext) {
        return json({ error: 'ข้อมูลผู้รับหรือ Branch ID เปลี่ยนจากตอนสร้างคำสั่งซื้อ กรุณาตรวจยอดเงินจริงและติดต่อผู้ซื้อ' }, 409);
      }
      apiKeyCiphertext = currentMethod.slipok_api_key_ciphertext;
    }
    const method = order.organizer_id_snapshot && order.slipok_branch_id_snapshot && apiKeyCiphertext
      ? { organizer_id: order.organizer_id_snapshot, account_last4: order.payment_account_last4_snapshot || '',
        slipok_branch_id: order.slipok_branch_id_snapshot, slipok_api_key_ciphertext: apiKeyCiphertext }
      : null;
    if (!method) return json({ error: 'ไม่มีข้อมูล SlipOK ที่บันทึกไว้กับคำสั่งซื้อนี้' }, 409);
    let apiKey: string;
    try { apiKey = await decryptSlipOkApiKey(method.slipok_api_key_ciphertext); }
    catch (error) {
      console.error('Unable to decrypt order SlipOK credentials:', error instanceof Error ? error.message : 'unknown error');
      return json({ error: 'อ่านข้อมูล SlipOK ของคำสั่งซื้อไม่ได้ กรุณาตรวจรายการเดินบัญชีด้วยตนเอง' }, 503);
    }

    const { data: slip, error: downloadError } = await db.storage.from('sourcewav-ticket-slips').download(previous.slip_storage_key);
    if (downloadError || !slip || slip.size < 1 || slip.size > maxSlipBytes) return json({ error: 'อ่านสลิปส่วนตัวไม่ได้' }, 409);
    const bytes = new Uint8Array(await slip.arrayBuffer());
    const image = detectSlipImage(bytes, slip.type);
    if (!image) return json({ error: 'ไฟล์สลิปไม่ใช่รูป JPG, PNG หรือ WebP ที่ถูกต้อง' }, 409);

    // A submission owns a unique storage key; keep each verification audit row
    // addressable by copying the same private slip under this attempt's key.
    const retrySlipKey = `${previous.buyer_id}/${order.id}/verification-${crypto.randomUUID()}.${image.extension}`;
    const { error: copyError } = await db.storage.from('sourcewav-ticket-slips').upload(retrySlipKey, bytes, {
      contentType: image.mime, upsert: false,
    });
    if (copyError) return json({ error: 'เก็บสำเนาสลิปสำหรับตรวจซ้ำไม่ได้ กรุณาลองอีกครั้ง' }, 503);

    const { data: attempt, error: claimError } = await db.rpc('claim_slipok_ticket_verification', {
      p_order: order.id, p_buyer: previous.buyer_id,
    });
    if (claimError) {
      await db.storage.from('sourcewav-ticket-slips').remove([retrySlipKey]);
      throw claimError;
    }
    if (attempt === 'processing') {
      await db.storage.from('sourcewav-ticket-slips').remove([retrySlipKey]);
      return json({ error: 'คำสั่งซื้อนี้กำลังตรวจสลิปอยู่ กรุณารอผลก่อน' }, 409);
    }
    if (typeof attempt !== 'string' || !/^[0-9a-f-]{36}$/i.test(attempt)) {
      await db.storage.from('sourcewav-ticket-slips').remove([retrySlipKey]);
      return json({ error: 'คำสั่งซื้อนี้ตรวจสลิปครบจำนวนครั้งแล้ว หรือไม่อยู่ในสถานะที่ตรวจได้' }, 429);
    }
    const finishAttempt = async (status: string, code: number | null, reason: string,
      amount: number | null = null, receiver: boolean | null = null, reference: string | null = null, transferAt: string | null = null) => {
      const { error } = await db.rpc('finish_slipok_ticket_verification_with_slip', {
        p_attempt: attempt, p_status: status, p_provider_code: code, p_failure_reason: reason,
        p_amount_minor: amount, p_receiver_verified: receiver, p_trans_ref: reference,
        p_transfer_at: transferAt, p_slip_key: retrySlipKey,
      });
      if (error) throw new Error('บันทึกประวัติการตรวจสลิปไม่ได้');
    };
    const form = new FormData();
    form.append('files', new Blob([bytes], { type: image.mime }), `ticket-slip.${image.extension}`);
    form.append('amount', (Number(order.total_minor) / 100).toFixed(2));
    form.append('log', 'true');
    let response: Response;
    try {
      response = await fetch(`https://api.slipok.com/api/line/apikey/${method.slipok_branch_id}`, {
        method: 'POST', headers: { 'x-authorization': apiKey }, body: form, signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
      await finishAttempt(timedOut ? 'timeout' : 'error', null, timedOut ? 'provider_timeout' : 'provider_unavailable');
      return json({ status: timedOut ? 'timeout' : 'error', message: timedOut ? 'SlipOK ยังไม่ตอบกลับ เก็บรายการไว้ในคิวแล้ว' : 'ติดต่อ SlipOK ไม่ได้ เก็บรายการไว้ในคิวแล้ว' }, 202);
    }
    const result = await response.json().catch(() => ({}));
    const code = Number.isInteger(Number(result.code)) ? Number(result.code) : null;
    if (response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500 || code === 1001 || code === 1002) {
      const reason = response.status === 429 ? 'quota_exhausted'
        : response.status === 401 || response.status === 403 || code === 1001 || code === 1002 ? 'invalid_slipok_credentials' : 'provider_unavailable';
      await finishAttempt(attemptStatusForHttp(response.status), code, reason);
      return json({ status: 'error', message: reason === 'invalid_slipok_credentials'
        ? 'SlipOK ปฏิเสธข้อมูลเชื่อมต่อ กรุณาตรวจยอดเงินจริงและอัปเดตการตั้งค่าของผู้จัด'
        : reason === 'quota_exhausted' ? 'SlipOK ใช้โควต้าตรวจครบแล้ว เก็บรายการไว้ให้ตรวจสอบ' : 'SlipOK ยังตอบกลับไม่ได้ เก็บรายการไว้ให้ตรวจสอบ' }, 202);
    }

    const checked = evaluateSlipOk({ responseOk: response.ok, responseStatus: response.status, result,
      expectedAmountMinor: Number(order.total_minor), expectedAccountLast4: method.account_last4 });
    const verified = checked.verified;
    const providerMessage = String(result.message || result.data?.message || (verified ? 'SlipOK verified' : 'Slip did not pass verification')).slice(0, 500);
    if (verified) await finishAttempt('verified', checked.code, '', checked.observedMinor, checked.receiverVerified, checked.transRef, checked.transferAt);
    else await finishAttempt('rejected', checked.code, checked.failureReason, checked.observedMinor, checked.receiverVerified);

    const { data: submissionId, error: recordError } = await db.rpc('record_slipok_ticket_submission', {
      p_order: order.id, p_buyer: previous.buyer_id, p_organizer: method.organizer_id,
      p_slip_key: retrySlipKey, p_slip_status: verified ? 'verified' : 'rejected',
      p_slip_code: checked.code, p_message: providerMessage, p_amount_minor: checked.observedMinor,
      p_trans_ref: verified ? checked.transRef : null, p_transfer_at: verified ? checked.transferAt : null,
      p_result: checked.safeResult,
    });
    if (!recordError && submissionId === 'already_paid') return json({ status: 'paid', message: 'คำสั่งซื้อนี้ออกบัตรแล้ว' });
    if (!recordError && submissionId === 'review_required') return json({ status: 'review_required', message: 'ตรวจพบการโอนแล้ว แต่ต้องตรวจยอดและจำนวนบัตรก่อนออกบัตร' }, 202);
    if (!recordError && submissionId === 'expired') return json({ status: 'review_required', message: 'คำสั่งซื้อหมดเวลาจองแล้ว รายการถูกส่งให้ตรวจเพิ่มเติม' }, 202);
    if (recordError || typeof submissionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(submissionId)) {
      if (recordError?.code === '23505' && verified) {
        const { data: recovered, error: recoveryError } = await db.rpc('recover_slipok_ticket_submission', {
          p_attempt: attempt, p_buyer: previous.buyer_id,
        });
        if (!recoveryError && recovered === 'duplicate_transaction') {
          return json({ status: 'review_required', message: 'เลขอ้างอิงนี้ถูกใช้แล้ว ระงับการออกบัตรซ้ำและส่งเข้าคิวตรวจเพิ่มเติม' }, 202);
        }
      }
      if (verified) return json({ status: 'verified_pending', attemptId: attempt, message: 'SlipOK ยืนยันการโอนแล้ว แต่บันทึกรายการไม่สมบูรณ์ ระบบเก็บข้อมูลไว้ให้กู้คืน' }, 202);
      return json({ status: 'rejected', message: providerMessage });
    }
    if (!verified) return json({ status: 'rejected', submissionId, message: providerMessage });

    const issued = await issueSlipOkSubmission(db, submissionId, previous.buyer_id);
    if (issued.error) return json({ status: 'verified_pending', submissionId, message: issued.error }, 202);
    if (issued.status === 'review_required') return json({ status: 'review_required', message: issued.message }, 202);
    return json({ status: 'paid', submissionId, ticketCount: issued.ticketCount, message: 'ตรวจสลิปซ้ำผ่านและจัดเตรียมบัตรเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Organizer slip verification retry failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'ตรวจสอบสลิปซ้ำไม่ได้ กรุณารีเฟรชคิวแล้วลองใหม่' }, 400);
  }
});
