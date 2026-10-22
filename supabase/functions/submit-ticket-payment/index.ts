import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';
import { decryptSlipOkApiKey } from '../_shared/slipok-crypto.ts';
import { issueSlipOkSubmission } from '../_shared/ticket-issuance.ts';

const maxSlipBytes = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/jfif', 'jfif'],
]);

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
    const { data: order, error: orderError } = await db.from('orders').select('id,event_id,buyer_id,status,total_minor,expires_at').eq('id', orderId).single();
    if (orderError || !order || order.buyer_id !== user.id) return json({ error: 'ไม่พบคำสั่งซื้อของบัญชีนี้' }, 404);
    if (order.status !== 'awaiting_payment' || !order.expires_at || new Date(order.expires_at) <= new Date()) {
      if (order.status === 'awaiting_payment') await db.rpc('release_ticket_order', { p_order: order.id, p_status: 'expired' });
      return json({ error: 'คำสั่งซื้อหมดอายุแล้ว กรุณาเลือกบัตรใหม่' }, 409);
    }
    const { data: payment, error: paymentError } = await db.from('payments').select('id,amount_minor,status').eq('order_id', order.id).eq('provider', 'manual_slipok').single();
    if (paymentError || !payment || payment.status !== 'pending' || Number(payment.amount_minor) !== Number(order.total_minor)) return json({ error: 'ไม่พบรายการชำระเงินที่รอตรวจสอบ' }, 409);
    const { data: method, error: methodError } = await db.from('event_payment_methods')
      .select('organizer_id,slipok_branch_id,slipok_api_key_ciphertext')
      .eq('event_id', order.event_id).single();
    if (methodError || !method) return json({ error: 'ไม่พบข้อมูลรับเงินและบัญชี SlipOK ของผู้จัดงาน' }, 409);
    let apiKey: string;
    try { apiKey = await decryptSlipOkApiKey(method.slipok_api_key_ciphertext); }
    catch (error) {
      console.error('Unable to decrypt SlipOK credentials:', error instanceof Error ? error.message : 'unknown error');
      return json({ error: 'อ่านข้อมูลเชื่อมต่อ SlipOK ไม่ได้ กรุณาให้ผู้จัดตรวจการตั้งค่าบัญชี' }, 503);
    }

    const { data: slip, error: downloadError } = await db.storage.from('sourcewav-ticket-slips').download(storageKey);
    if (downloadError || !slip || slip.size < 1 || slip.size > maxSlipBytes) return json({ error: 'อ่านไฟล์สลิปไม่ได้ หรือไฟล์มีขนาดเกิน 5 MB' }, 400);
    const mime = (slip.type || '').toLowerCase().split(';')[0];
    const extension = allowedTypes.get(mime);
    if (!extension) return json({ error: 'รองรับไฟล์ JPG, PNG, JFIF หรือ WebP เท่านั้น' }, 400);

    const form = new FormData();
    form.append('files', slip, `ticket-slip.${extension}`);
    form.append('amount', (Number(order.total_minor) / 100).toFixed(2));
    // log=true binds receiver checking and duplicate detection to this seller's SlipOK branch.
    form.append('log', 'true');
    const { data: attempts, error: attemptsError } = await db.rpc('claim_slipok_ticket_verification', {
      p_order: order.id, p_buyer: user.id,
    });
    if (attemptsError) {
      console.error('Unable to reserve SlipOK verification attempt:', attemptsError.message);
      return json({ error: 'เริ่มตรวจสลิปไม่ได้ กรุณาลองใหม่ภายหลัง' }, 503);
    }
    if (!Number.isInteger(Number(attempts)) || Number(attempts) < 1 || Number(attempts) > 5) {
      return json({ error: 'รายการนี้ตรวจสลิปครบ 5 ครั้งแล้ว หรือหมดเวลาจองบัตร กรุณาเริ่มรายการใหม่', attemptsRemaining: 0 }, 429);
    }
    const attemptsRemaining = 5 - Number(attempts);
    let response: Response;
    try {
      response = await fetch(`https://api.slipok.com/api/line/apikey/${method.slipok_branch_id}`, {
        method: 'POST', headers: { 'x-authorization': apiKey }, body: form,
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'TimeoutError'
        ? 'SlipOK ใช้เวลาตรวจนานเกินไป ระบบยังยืนยันผลไม่ได้ กรุณาตรวจประวัติการโอนก่อนส่งสลิปใหม่'
        : 'ติดต่อ SlipOK ไม่ได้ ระบบยังยืนยันผลไม่ได้ กรุณาลองใหม่ภายหลัง';
      return json({ error: message, attemptsRemaining, attemptCounted: true }, error instanceof DOMException && error.name === 'TimeoutError' ? 504 : 502);
    }
    const result = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500) {
      console.error('SlipOK verification service returned', response.status, result.code || '');
      const message = response.status === 401 || response.status === 403
        ? 'SlipOK ปฏิเสธ API Key หรือ Branch ID ของผู้จัด กรุณาตรวจการตั้งค่าบัญชี'
        : response.status === 429 ? 'SlipOK ใช้โควต้าตรวจสลิปครบแล้ว กรุณาติดต่อผู้จัด'
          : 'SlipOK ยังตอบกลับไม่ได้ กรุณาลองใหม่ภายหลัง';
      return json({ error: message, attemptsRemaining, attemptCounted: true }, response.status === 429 ? 503 : 502);
    }

    const slipData = result.data && typeof result.data === 'object' ? result.data : {};
    const receiver = slipData.receiver && typeof slipData.receiver === 'object' ? slipData.receiver : null;
    const receiverHasAccount = Boolean(receiver && (
      (typeof receiver.account?.value === 'string' && receiver.account.value.length > 0)
      || (typeof receiver.proxy?.value === 'string' && receiver.proxy.value.length > 0)
    ));
    const observedMinor = Number.isFinite(Number(slipData.amount)) ? Math.round(Number(slipData.amount) * 100) : null;
    const transRef = typeof slipData.transRef === 'string' && slipData.transRef.length > 0 && slipData.transRef.length <= 100 ? slipData.transRef : null;
    const isVerified = response.ok && result.success === true && slipData.success === true
      && observedMinor === Number(order.total_minor) && slipData.countryCode === 'TH'
      && receiverHasAccount && transRef !== null;
    const slipStatus = isVerified ? 'verified' : 'rejected';
    const slipCode = Number.isInteger(Number(result.code)) ? Number(result.code) : null;
    const slipMessage = String(result.message || slipData.message || (isVerified ? 'SlipOK verified' : 'Slip did not pass verification')).slice(0, 500);
    // Keep only facts needed for payment reconciliation. The raw provider response can
    // include the sender's masked name/account and is unnecessary for ticket issuance.
    const auditResult = {
      success: result.success === true,
      slipSuccess: slipData.success === true,
      transRef,
      amount: observedMinor,
      countryCode: typeof slipData.countryCode === 'string' ? slipData.countryCode.slice(0, 2) : null,
    };
    const { data: submissionId, error: insertError } = await db.rpc('record_slipok_ticket_submission', {
      p_order: order.id,
      p_buyer: user.id,
      p_organizer: method.organizer_id,
      p_slip_key: storageKey,
      p_slip_status: slipStatus,
      p_slip_code: slipCode,
      p_message: slipMessage,
      p_amount_minor: observedMinor,
      p_trans_ref: isVerified ? transRef : null,
      p_result: auditResult,
    });
    if (!insertError && submissionId === 'already_paid') {
      return json({ status: 'paid', message: 'คำสั่งซื้อนี้ออกบัตรเรียบร้อยแล้ว' });
    }
    if (!insertError && submissionId === 'expired') {
      return json({ error: 'คำสั่งซื้อหมดอายุแล้ว กรุณาเลือกบัตรใหม่' }, 409);
    }
    if (insertError || typeof submissionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(submissionId)) {
      if (insertError?.code === '23505') return json({ error: 'สลิปนี้เคยถูกตรวจหรือใช้ชำระรายการอื่นแล้ว' }, 409);
      console.error('Unable to save SlipOK verification:', insertError?.message || 'missing submission id');
      return json({ error: 'บันทึกผลตรวจสลิปไม่ได้ กรุณาติดต่อผู้จัดพร้อมเลขคำสั่งซื้อ' }, 500);
    }
    if (!isVerified) return json({ submissionId, status: 'rejected', message: slipMessage, amountMinor: observedMinor, receiver, attemptsRemaining });

    let issuance: Awaited<ReturnType<typeof issueSlipOkSubmission>>;
    try { issuance = await issueSlipOkSubmission(db, submissionId, user.id); }
    catch (error) {
      console.error('Verified SlipOK payment could not issue tickets:', error instanceof Error ? error.message : 'unknown error');
      return json({
        submissionId, status: 'verified_pending', message: 'SlipOK ตรวจผ่านแล้ว แต่ระบบออกบัตรสะดุด กรุณากดลองออกบัตรอีกครั้ง',
        amountMinor: observedMinor, receiver, attemptsRemaining,
      });
    }
    if (issuance.error) {
      return json({
        submissionId, status: 'verified_pending', message: issuance.error,
        amountMinor: observedMinor, receiver, attemptsRemaining,
      });
    }
    return json({
      submissionId, status: 'paid', message: 'SlipOK ตรวจยอด ผู้รับ และสลิปซ้ำผ่าน ออกบัตรให้อัตโนมัติแล้ว',
      amountMinor: observedMinor, receiver, ticketCount: issuance.ticketCount, attemptsRemaining,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'ตรวจสลิปไม่สำเร็จ' }, 400);
  }
});
