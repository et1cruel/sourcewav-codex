import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';
import { issueSlipOkSubmission } from '../_shared/ticket-issuance.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const body = await request.json();
    const submissionId = String(body.submissionId || '');
    const attemptId = String(body.attemptId || '');
    if ((!submissionId && !attemptId) || (submissionId && !/^[0-9a-f-]{36}$/i.test(submissionId)) || (attemptId && !/^[0-9a-f-]{36}$/i.test(attemptId))) return json({ error: 'รายการ SlipOK ไม่ถูกต้อง' }, 400);
    const db = serviceClient();
    let resolvedSubmissionId = submissionId;
    if (!resolvedSubmissionId && attemptId) {
      const { data, error } = await db.rpc('recover_slipok_ticket_submission', { p_attempt: attemptId, p_buyer: user.id });
      if (error) throw error;
      if (data === 'already_paid') return json({ status: 'paid', message: 'คำสั่งซื้อนี้ออกบัตรเรียบร้อยแล้ว' });
      if (data === 'review_required') return json({ status: 'review_required', message: 'การโอนยืนยันแล้ว แต่เวลาจองผ่านไปแล้ว ระบบส่งรายการให้ผู้จัดตรวจสอบโดยยังไม่ออกบัตร' });
      if (data === 'duplicate_transaction') return json({ status: 'review_required', message: 'เลขอ้างอิงธุรกรรมนี้ถูกใช้กับคำสั่งซื้ออื่นแล้ว ระบบระงับการออกบัตรซ้ำและส่งรายการเข้าตรวจเพิ่มเติม' });
      if (typeof data !== 'string' || !/^[0-9a-f-]{36}$/i.test(data)) return json({ error: 'กู้คืนรายการชำระเงินไม่ได้ กรุณาติดต่อผู้จัดพร้อมเลขคำสั่งซื้อ' }, 409);
      resolvedSubmissionId = data;
    }
    const result = await issueSlipOkSubmission(db, resolvedSubmissionId, user.id);
    if (result.error) return json({ error: result.error }, result.statusCode || 400);
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'ออกบัตรไม่สำเร็จ' }, 400);
  }
});
