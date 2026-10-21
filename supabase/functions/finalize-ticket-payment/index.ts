import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';
import { issueSlipOkSubmission } from '../_shared/ticket-issuance.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const body = await request.json();
    const submissionId = String(body.submissionId || '');
    if (!/^[0-9a-f-]{36}$/i.test(submissionId)) return json({ error: 'รายการ SlipOK ไม่ถูกต้อง' }, 400);
    const result = await issueSlipOkSubmission(serviceClient(), submissionId, user.id);
    if (result.error) return json({ error: result.error }, result.statusCode || 400);
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'ออกบัตรไม่สำเร็จ' }, 400);
  }
});
