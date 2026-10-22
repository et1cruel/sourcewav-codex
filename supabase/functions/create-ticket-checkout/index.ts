import { corsHeaders, json } from '../_shared/http.ts';

// Ticket sales now use seller-specific SlipOK verification. Keep this route as a
// compatibility response so stale clients cannot start new Omise checkouts.
Deno.serve((request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  return json({ error: 'ช่องทางชำระเงินนี้ปิดแล้ว กรุณาใช้การโอนและตรวจสลิปด้วย SlipOK' }, 410);
});
