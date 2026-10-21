import { authenticatedUser, corsHeaders, hmacHex, json, serviceClient, sha256Hex } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await authenticatedUser(request);
    const secret = Deno.env.get('TICKET_QR_SECRET');
    if (!secret) return json({ error: 'Ticket QR is not configured' }, 503);
    const db = serviceClient();
    const { data, error } = await db.from('tickets').select('id,event_id,status,issued_at,checked_in_at,qr_code_hash,events(title,starts_at,venue_id,venues(name,address)),order_items(ticket_types(name))').eq('owner_id', user.id).order('issued_at', { ascending: false });
    if (error) throw error;
    const tickets = (data || []).map(ticket => ({ ...ticket, qr_payload: '' }));
    // Sign tokens with the same deterministic HMAC used when the payment webhook created the ticket hash.
    for (const ticket of tickets) {
      const token = `${ticket.id}.${await hmacHex(secret, ticket.id)}`;
      if (await sha256Hex(token) !== ticket.qr_code_hash) throw new Error('Ticket code verification failed');
      ticket.qr_payload = token;
    }
    return json({ tickets });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' }, 400);
  }
});
