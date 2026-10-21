import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const body = await request.json();
    const title = String(body.title || '').trim();
    const venueName = String(body.venueName || '').trim();
    const venueAddress = String(body.venueAddress || '').trim();
    const category = ['music', 'art', 'community', 'market', 'other'].includes(body.category) ? body.category : 'other';
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    const price = Math.round(Number(body.priceBaht) * 100);
    const stock = Number(body.quantity);
    if (title.length < 4 || title.length > 180 || venueName.length < 2 || venueName.length > 160 || venueAddress.length > 400 || !Number.isFinite(+startsAt) || !Number.isFinite(+endsAt) || endsAt <= startsAt || startsAt <= new Date() || !Number.isInteger(price) || price < 2000 || price > 15000000 || !Number.isInteger(stock) || stock < 1 || stock > 10000) {
      return json({ error: 'กรอกข้อมูลงาน ราคา (อย่างน้อย ฿20) จำนวนบัตร และวันเวลาให้ถูกต้อง' }, 400);
    }
    const db = serviceClient();
    const { data: profile, error: profileError } = await db.from('profiles').select('roles').eq('user_id', user.id).single();
    if (profileError || !profile?.roles?.some((role: string) => ['organizer', 'admin'].includes(role))) return json({ error: 'ฟีเจอร์นี้สำหรับบัญชี Organizer ที่ผ่านการยืนยันเท่านั้น' }, 403);
    const { data: event, error } = await db.from('events').insert({ organizer_id: user.id, title, description: String(body.description || '').slice(0, 5000), category, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), venue_name: venueName, venue_address: venueAddress, status: 'published', currency: 'THB' }).select('id').single();
    if (error) throw error;
    const { error: tierError } = await db.from('ticket_types').insert({ event_id: event.id, name: String(body.tierName || 'บัตรทั่วไป').slice(0, 100), price_minor: price, currency: 'THB', quantity_total: stock });
    if (tierError) {
      await db.from('events').delete().eq('id', event.id);
      throw tierError;
    }
    return json({ eventId: event.id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' }, 400);
  }
});
