import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';
import { decryptSlipOkApiKey } from '../_shared/slipok-crypto.ts';
import { issueSlipOkSubmission } from '../_shared/ticket-issuance.ts';
import { attemptStatusForHttp, detectSlipImage, evaluateSlipOk } from '../_shared/slipok-validation.mjs';

const maxSlipBytes = 10 * 1024 * 1024;
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const rawBody = await request.text();
    if (rawBody.length > 4096) return json({ error: 'คำขอตรวจสลิปมีขนาดใหญ่เกินไป' }, 413);
    const body = JSON.parse(rawBody);
    const orderId = String(body.orderId || '');
    const storageKey = String(body.slipStorageKey || '');
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || !storageKey.startsWith(`${user.id}/${orderId}/`) || storageKey.length > 300) {
      return json({ error: 'ไฟล์สลิปหรือคำสั่งซื้อไม่ถูกต้อง' }, 400);
    }
    const qrSecret = Deno.env.get('TICKET_QR_SECRET');
    if (!qrSecret || qrSecret.length < 32) return json({ error: 'ระบบยังไม่ได้ตั้งค่า TICKET_QR_SECRET ใน Supabase Secrets' }, 503);

    const db = serviceClient();
    const { data: order, error: orderError } = await db.from('orders').select('id,event_id,buyer_id,status,total_minor,created_at,expires_at,slipok_verification_attempts,organizer_id_snapshot,payment_account_last4_snapshot,slipok_branch_id_snapshot,slipok_api_key_ciphertext_snapshot').eq('id', orderId).single();
    if (orderError || !order || order.buyer_id !== user.id) return json({ error: 'ไม่พบคำสั่งซื้อของบัญชีนี้' }, 404);
    if (!['awaiting_payment','expired'].includes(order.status) || !order.expires_at) {
      return json({ error: 'รายการนี้ไม่อยู่ในสถานะที่ส่งสลิปได้ กรุณาติดต่อผู้จัดพร้อมเลขคำสั่งซื้อ' }, 409);
    }
    if (order.status === 'awaiting_payment' && new Date(order.expires_at) <= new Date()) {
      const { error: releaseError } = await db.rpc('release_ticket_order', { p_order: order.id, p_status: 'expired' });
      if (releaseError) return json({ error: 'ปล่อยการจองบัตรไม่สำเร็จ กรุณาลองส่งสลิปอีกครั้งโดยไม่ต้องโอนซ้ำ' }, 503);
      order.status = 'expired';
    }
    if (order.status === 'awaiting_payment' && new Date(order.expires_at) <= new Date()) {
      return json({ error: 'คำสั่งซื้อหมดอายุแล้ว กรุณาเลือกบัตรใหม่' }, 409);
    }
    const { data: payment, error: paymentError } = await db.from('payments').select('id,amount_minor,status').eq('order_id', order.id).eq('provider', 'manual_slipok').single();
    const paymentIsSubmittable = payment?.status === 'pending' && order.status === 'awaiting_payment'
      || payment?.status === 'expired' && order.status === 'expired';
    if (paymentError || !payment || !paymentIsSubmittable || Number(payment.amount_minor) !== Number(order.total_minor)) return json({ error: 'ไม่พบรายการชำระเงินที่รอตรวจสอบ' }, 409);
    const method = order.organizer_id_snapshot && order.slipok_branch_id_snapshot && order.slipok_api_key_ciphertext_snapshot
      ? { organizer_id: order.organizer_id_snapshot, account_last4: order.payment_account_last4_snapshot || '', slipok_branch_id: order.slipok_branch_id_snapshot, slipok_api_key_ciphertext: order.slipok_api_key_ciphertext_snapshot }
      : null;
    if (!method) return json({ error: 'ไม่พบข้อมูลบัญชีรับเงินที่ผูกกับคำสั่งซื้อนี้ กรุณาติดต่อผู้จัดพร้อมเลขคำสั่งซื้อ' }, 409);
    let apiKey: string;
    try { apiKey = await decryptSlipOkApiKey(method.slipok_api_key_ciphertext); }
    catch (error) {
      console.error('Unable to decrypt SlipOK credentials:', error instanceof Error ? error.message : 'unknown error');
      return json({ error: 'อ่านข้อมูลเชื่อมต่อ SlipOK ไม่ได้ กรุณาให้ผู้จัดตรวจการตั้งค่าบัญชี' }, 503);
    }

    const { data: slip, error: downloadError } = await db.storage.from('sourcewav-ticket-slips').download(storageKey);
    if (downloadError || !slip || slip.size < 1 || slip.size > maxSlipBytes) return json({ error: 'อ่านไฟล์สลิปไม่ได้ หรือไฟล์มีขนาดเกิน 10 MB' }, 400);
    const bytes = new Uint8Array(await slip.arrayBuffer());
    const image = detectSlipImage(bytes, slip.type);
    if (!image) return json({ error: 'ไฟล์ไม่ใช่รูป JPG, PNG หรือ WebP ที่ถูกต้อง' }, 400);
    const { data: attempts, error: attemptsError } = await db.rpc('claim_slipok_ticket_verification', {
      p_order: order.id, p_buyer: user.id,
    });
    if (attemptsError) {
      console.error('Unable to reserve SlipOK verification attempt:', attemptsError.message);
      return json({ error: 'เริ่มตรวจสลิปไม่ได้ กรุณาลองใหม่ภายหลัง' }, 503);
    }
    if (attempts === 'processing') {
      return json({ error: 'คำสั่งซื้อนี้กำลังตรวจสอบสลิปอยู่ กรุณารอผลก่อนส่งซ้ำ', status: 'verifying' }, 409);
    }
    if (typeof attempts !== 'string' || !/^[0-9a-f-]{36}$/i.test(attempts)) {
      return json({ error: 'รายการนี้ตรวจสลิปครบ 5 ครั้งแล้ว หรือหมดเวลาจองบัตร กรุณาเริ่มรายการใหม่', attemptsRemaining: 0 }, 429);
    }
    const { data: counter } = await db.from('orders').select('slipok_verification_attempts').eq('id', order.id).maybeSingle();
    const attemptsRemaining = Math.max(0, 5 - Number(counter?.slipok_verification_attempts ?? Number(order.slipok_verification_attempts || 0) + 1));
    const finishAttempt = async (status: string, providerCode: number | null, reason: string, amountMinor: number | null = null, receiverVerified: boolean | null = null, transRef: string | null = null, transferAt: string | null = null) => {
      const { error } = await db.rpc('finish_slipok_ticket_verification_with_slip', {
        p_attempt: attempts, p_status: status, p_provider_code: providerCode, p_failure_reason: reason,
        p_amount_minor: amountMinor, p_receiver_verified: receiverVerified, p_trans_ref: transRef,
        p_transfer_at: transferAt, p_slip_key: storageKey,
      });
      if (error) throw new Error('บันทึกประวัติการตรวจสลิปไม่ได้');
    };
    const form = new FormData();
    form.append('files', new Blob([bytes], { type: image.mime }), `ticket-slip.${image.extension}`);
    form.append('amount', (Number(order.total_minor) / 100).toFixed(2));
    // log=true checks the receiver and duplicate transfers against this seller's SlipOK branch.
    form.append('log', 'true');
    let response: Response;
    try {
      response = await fetch(`https://api.slipok.com/api/line/apikey/${method.slipok_branch_id}`, {
        method: 'POST', headers: { 'x-authorization': apiKey }, body: form,
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
      await finishAttempt(timedOut ? 'timeout' : 'error', null, timedOut ? 'provider_timeout' : 'provider_unavailable');
      const message = timedOut
        ? 'SlipOK ใช้เวลาตรวจนานเกินไป ระบบยังยืนยันผลไม่ได้ กรุณาตรวจประวัติการโอนก่อนส่งสลิปใหม่'
        : 'ติดต่อ SlipOK ไม่ได้ ระบบยังยืนยันผลไม่ได้ กรุณาลองใหม่ภายหลัง';
      return json({ error: message, attemptsRemaining, attemptCounted: true }, timedOut ? 504 : 502);
    }
    const result = await response.json().catch(() => ({}));
    const providerCode = Number.isInteger(Number(result.code)) ? Number(result.code) : null;
    if (response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500 || providerCode === 1001 || providerCode === 1002) {
      console.error('SlipOK verification service returned', response.status, providerCode || '');
      const quota = response.status === 429;
      // SlipOK may report invalid branch/key either as a provider code or only
      // as an HTTP authentication failure. Neither means the buyer's slip was
      // checked, so don't consume one of their five verification attempts.
      const credentialError = response.status === 401 || response.status === 403
        || providerCode === 1001 || providerCode === 1002;
      await finishAttempt(attemptStatusForHttp(response.status), providerCode, quota ? 'quota_exhausted' : credentialError ? 'invalid_slipok_credentials' : 'provider_unavailable');
      const message = providerCode === 1002
        ? 'SlipOK ไม่ยอมรับ API Key ของผู้จัด กรุณาอัปเดต API Key ในหน้าตั้งค่าการเชื่อมต่อของอีเวนต์'
        : providerCode === 1001
          ? 'ไม่พบ Branch ID นี้ใน SlipOK กรุณาตรวจเลขสาขาในหน้าตั้งค่าการเชื่อมต่อของอีเวนต์'
        : response.status === 401 || response.status === 403
            ? 'SlipOK ปฏิเสธ Branch ID หรือ API Key ของผู้จัด กรุณาให้ผู้จัดอัปเดตข้อมูลในหน้าตั้งค่าการเชื่อมต่อของอีเวนต์'
        : quota ? 'SlipOK ใช้โควต้าตรวจสลิปครบแล้ว กรุณาติดต่อผู้จัด'
          : 'SlipOK ยังตอบกลับไม่ได้ กรุณาลองใหม่ภายหลัง';
      return json({ error: message, attemptsRemaining: Math.min(5, attemptsRemaining + (credentialError ? 1 : 0)), attemptCounted: !credentialError }, quota ? 503 : 502);
    }

    const checked = evaluateSlipOk({ responseOk: response.ok, responseStatus: response.status, result,
      expectedAmountMinor: Number(order.total_minor), expectedAccountLast4: method.account_last4 || '' });
    const isVerified = checked.verified;
    const slipStatus = isVerified ? 'verified' : 'rejected';
    const slipCode = checked.code;
    const slipMessage = String(result.message || result.data?.message || (isVerified ? 'SlipOK verified' : 'Slip did not pass verification')).slice(0, 500);
    // Keep only facts needed for payment reconciliation. The raw provider response can
    // include the sender's masked name/account and is unnecessary for ticket issuance.
    const auditResult = checked.safeResult;
    if (isVerified) {
      // Persist the provider-confirmed reference and private slip key before trying the
      // submission/issuance transaction. A later DB outage can then recover this payment
      // without calling SlipOK again or asking the buyer to transfer again.
      await finishAttempt('verified', slipCode, '', checked.observedMinor, checked.receiverVerified, checked.transRef, checked.transferAt);
    }
    const { data: submissionId, error: insertError } = await db.rpc('record_slipok_ticket_submission', {
      p_order: order.id,
      p_buyer: user.id,
      p_organizer: method.organizer_id,
      p_slip_key: storageKey,
      p_slip_status: slipStatus,
      p_slip_code: slipCode,
      p_message: slipMessage,
      p_amount_minor: checked.observedMinor,
      p_trans_ref: isVerified ? checked.transRef : null,
      p_transfer_at: isVerified ? checked.transferAt : null,
      p_result: auditResult,
    });
    if (!insertError && submissionId === 'already_paid') {
      if (!isVerified) await finishAttempt(slipStatus, slipCode, checked.failureReason, checked.observedMinor, checked.receiverVerified);
      return json({ status: 'paid', message: 'คำสั่งซื้อนี้ออกบัตรเรียบร้อยแล้ว' });
    }
    if (!insertError && submissionId === 'expired') {
      if (!isVerified) await finishAttempt(slipStatus, slipCode, checked.failureReason, checked.observedMinor, checked.receiverVerified);
      return json({ error: 'คำสั่งซื้อหมดอายุแล้ว กรุณาเลือกบัตรใหม่' }, 409);
    }
    if (!insertError && submissionId === 'review_required') {
      return json({ status: 'review_required', message: 'ตรวจพบการโอนหลังเวลาจองแล้ว รายการถูกส่งให้ผู้จัดตรวจสอบ ระบบยังไม่ออกบัตรอัตโนมัติ', attemptsRemaining }, 202);
    }
    if (insertError || typeof submissionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(submissionId)) {
      const duplicate = insertError?.code === '23505';
      if (!isVerified) await finishAttempt('rejected', slipCode, duplicate ? 'duplicate_transaction_reference' : 'submission_save_failed', checked.observedMinor, checked.receiverVerified);
      if (duplicate && isVerified) {
        const { data: recovered, error: recoveryError } = await db.rpc('recover_slipok_ticket_submission', {
          p_attempt: attempts, p_buyer: user.id,
        });
        if (!recoveryError && recovered === 'duplicate_transaction') {
          return json({ status: 'review_required', message: 'เลขอ้างอิงธุรกรรมนี้ถูกใช้กับคำสั่งซื้ออื่นแล้ว ระบบระงับการออกบัตรซ้ำและส่งรายการให้ผู้จัดตรวจเพิ่มเติม' }, 202);
        }
        return json({ status: 'verified_pending', attemptId: attempts, message: 'SlipOK ยืนยันการโอนแล้ว แต่บันทึกผลคำสั่งซื้อไม่สมบูรณ์ กรุณากู้คืนจากหน้าคำสั่งซื้อโดยไม่ต้องโอนซ้ำ' }, 202);
      }
      if (duplicate) return json({ error: 'สลิปนี้เคยถูกตรวจหรือใช้ชำระรายการอื่นแล้ว', attemptsRemaining }, 409);
      console.error('Unable to save SlipOK verification:', insertError?.message || 'missing submission id');
      if (isVerified) return json({ status: 'verified_pending', attemptId: attempts, message: 'SlipOK ยืนยันการโอนแล้ว แต่บันทึกคำสั่งซื้อไม่สำเร็จ กรุณากู้คืนรายการจากหน้าคำสั่งซื้อ โดยไม่ต้องโอนซ้ำ' }, 202);
      return json({ error: 'บันทึกผลตรวจสลิปไม่ได้ กรุณาติดต่อผู้จัดพร้อมเลขคำสั่งซื้อ' }, 500);
    }
    if (!isVerified) await finishAttempt(slipStatus, slipCode, checked.failureReason, checked.observedMinor, checked.receiverVerified);
    if (!isVerified) return json({ submissionId, status: 'rejected', message: slipMessage, amountMinor: checked.observedMinor, attemptsRemaining });

    let issuance: Awaited<ReturnType<typeof issueSlipOkSubmission>>;
    try { issuance = await issueSlipOkSubmission(db, submissionId, user.id); }
    catch (error) {
      console.error('Verified SlipOK payment could not issue tickets:', error instanceof Error ? error.message : 'unknown error');
      return json({
        submissionId, status: 'verified_pending', message: 'SlipOK ตรวจผ่านแล้ว แต่ระบบออกบัตรสะดุด กรุณากดลองออกบัตรอีกครั้ง',
        amountMinor: checked.observedMinor, attemptsRemaining,
      });
    }
    if (issuance.error) {
      return json({
        submissionId, status: 'verified_pending', message: issuance.error,
        amountMinor: checked.observedMinor, attemptsRemaining,
      });
    }
    if (issuance.status === 'review_required') {
      return json({ status: 'review_required', message: issuance.message, attemptsRemaining }, 202);
    }
    return json({
      submissionId, status: 'paid', message: 'SlipOK ตรวจยอด ผู้รับ และสลิปซ้ำผ่าน ออกบัตรให้อัตโนมัติแล้ว',
      amountMinor: checked.observedMinor, ticketCount: issuance.ticketCount, attemptsRemaining,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'ตรวจสลิปไม่สำเร็จ' }, 400);
  }
});
