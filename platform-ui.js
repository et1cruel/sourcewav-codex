/* Live community, marketplace, event checkout, tickets, and door-scanning UI. */
(() => {
  const db = window.SourcewavSupabase;
  if (!db) {
    document.querySelector('#myTicketsBtn')?.addEventListener('click', () => {
      const backdrop = document.querySelector('#modalBackdrop');
      const content = document.querySelector('#modalContent');
      if (!backdrop || !content) return;
      content.innerHTML = '<section class="tickets-load-error tickets-offline-state" role="status"><span aria-hidden="true">▱</span><h2 id="modalTitle">เชื่อมต่อกระเป๋าบัตรไม่ได้</h2><p>ระบบข้อมูลยังไม่พร้อม ลองโหลดหน้าเว็บใหม่อีกครั้ง</p><button type="button" id="ticketsRetry">โหลดหน้าใหม่</button></section>';
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');
    });
    document.querySelector('#modalContent')?.addEventListener('click', event => {
      if (event.target.closest('#ticketsRetry')) location.reload();
    });
    return;
  }
  window.SourcewavPlatform = { isLive: false };
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = n => `฿${(Number(n || 0) / 100).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
  const initials = name => [...String(name || '?')][0] || '?';
  const safeImageUrl = value => { try { const url = new URL(value || ''); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
  const parseSlipOkBranchId = value => {
    const input = String(value || '').trim();
    if (/^\d{1,20}$/.test(input)) return input;
    try {
      const url = new URL(input);
      const match = url.protocol === 'https:' && url.hostname === 'api.slipok.com'
        ? url.pathname.match(/^\/api\/line\/apikey\/(\d{1,20})\/?$/)
        : null;
      return match?.[1] || '';
    } catch { return ''; }
  };
  const toast = message => { const node = $('#toast'); if (node) { node.textContent = message; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 3000); } };
  const modal = html => {
    if (html.includes('ticket-sell-modal') && location.hash === '#sell-event') {
      const page = $('#eventSellPage');
      page.innerHTML = `<div class="event-sell-page-toolbar"><a href="#events">← กลับหน้ากิจกรรม</a><span>SOURCEWAV LIVE</span></div>${html}`;
      page.hidden = false;
      document.body.classList.add('event-sell-page-active');
      return;
    }
    const backdrop = $('#modalBackdrop'); backdrop.classList.toggle('tickets-page-open', html.includes('my-tickets-page')); const modalRoot = backdrop.querySelector('.modal'); modalRoot?.classList.toggle('is-ticket-payment', html.includes('manual-payment')); modalRoot?.classList.toggle('is-ticket-purchase', html.includes('ticket-purchase')); $('#modalContent').innerHTML = html; backdrop.classList.add('open'); backdrop.setAttribute('aria-hidden', 'false'); if (html.includes('room-chat-page')) document.body.classList.add('modal-open');
  };
  let eventPosterPreviewUrls = [];
  let eventPurchaseRequest = 0;
  const closeModal = () => { const backdrop = $('#modalBackdrop'); backdrop.classList.remove('open', 'tickets-page-open'); backdrop.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open'); eventPosterPreviewUrls.forEach(url => URL.revokeObjectURL(url)); eventPosterPreviewUrls = []; document.body.classList.remove('event-sell-page-active'); const page = $('#eventSellPage'); if (page) { page.hidden = true; page.replaceChildren(); } };
  const closeTicketPurchasePage = () => { eventPurchaseRequest++; document.body.classList.remove('event-purchase-page-active'); const page = $('#eventPurchasePage'); if (page) { page.hidden = true; page.replaceChildren(); } };
  const needUser = async () => { const { data } = await db.auth.getUser(); if (!data.user) { toast('เข้าสู่ระบบก่อนใช้ฟีเจอร์นี้'); $('#profileBtn')?.click(); return null; } return data.user; };
  const call = async (name, body) => {
    const { data, error } = await db.functions.invoke(name, { body });
    if (error) {
      let payload = null;
      if (typeof error.context?.clone === 'function') {
        try {
          payload = await error.context.clone().json();
        } catch { /* Use the function client's message when its response isn't JSON. */ }
      }
      if (name === 'submit-ticket-payment') {
        const paymentError = new Error(payload?.error || error.message || 'ตรวจสลิปไม่สำเร็จ');
        paymentError.attemptsRemaining = Number.isInteger(payload?.attemptsRemaining) ? payload.attemptsRemaining : null;
        paymentError.attemptCounted = payload?.attemptCounted === true;
        throw paymentError;
      }
      if (error.context?.status === 404) {
        const messages = {
          'create-ticket-checkout': 'ระบบชำระเงินค่าบัตรยังไม่เปิดให้บริการในขณะนี้ ยังไม่มีการเรียกเก็บเงิน',
          'create-event': 'ระบบเปิดขายบัตรยังไม่พร้อมใช้งานในขณะนี้',
          'create-manual-ticket-order': 'ระบบสร้างรายการบัตรยังไม่พร้อมใช้งานในขณะนี้',
          'submit-ticket-payment': 'ระบบตรวจสอบสลิปยังไม่พร้อมใช้งานในขณะนี้',
          'finalize-ticket-payment': 'ระบบออกบัตรอัตโนมัติยังไม่พร้อมใช้งานในขณะนี้',
          'my-tickets': 'ระบบบัตรของฉันยังไม่พร้อมใช้งานในขณะนี้',
          'my-orders': 'ระบบติดตามคำสั่งซื้อยังไม่พร้อมใช้งานในขณะนี้',
          'validate-ticket': 'ระบบตรวจบัตรเข้างานยังไม่พร้อมใช้งานในขณะนี้',
        };
        if (messages[name]) throw new Error(messages[name]);
      }
      throw new Error(payload?.error || error.message || 'เชื่อมต่อบริการไม่สำเร็จ');
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };
  let feedFilter = 'all', activeConversation = null, chatChannel = null, roomChannel = null, activeRoomId = null, paymentTimer = null, scannerStream = null, scannerRunning = false, ticketsOpening = false;

  async function searchSourcewav() {
    const input = $('#modalContent .modal-field input');
    const term = input?.value.trim();
    if (!term || term.length < 2) return toast('พิมพ์คำค้นอย่างน้อย 2 ตัวอักษร');
    const host = $('#modalContent');
    const pattern = `%${term.replace(/[\\%_,]/g, '\\$&')}%`;
    const [people, postsByTitle, postsByBody, events, listings] = await Promise.all([
      db.from('profiles').select('user_id,username,display_name,roles,province').ilike('display_name', pattern).is('deleted_at', null).limit(5),
      db.from('posts').select('id,title,body,kind,created_at').eq('status', 'published').eq('visibility', 'public').is('deleted_at', null).ilike('title', pattern).limit(5),
      db.from('posts').select('id,title,body,kind,created_at').eq('status', 'published').eq('visibility', 'public').is('deleted_at', null).ilike('body', pattern).limit(5),
      db.from('events').select('id,title,venue_name,starts_at').eq('status', 'published').is('deleted_at', null).ilike('title', pattern).limit(5),
      db.from('listings').select('id,seller_id,title,category,profiles!listings_seller_id_fkey(display_name)').eq('status', 'published').is('deleted_at', null).ilike('title', pattern).limit(5),
    ]);
    const failure = [people, postsByTitle, postsByBody, events, listings].find(result => result.error);
    if (failure) return toast(`ค้นหาไม่ได้: ${failure.error.message}`);
    const { data: rooms } = await db.from('community_rooms').select('id,name,description').is('archived_at', null).ilike('name', pattern).limit(5);
    const posts = [...new Map([...(postsByTitle.data || []), ...(postsByBody.data || [])].map(post => [post.id, post])).values()];
    const section = (title, rows, render) => rows.length ? `<section class="source-search-group"><h3>${title}</h3>${rows.map(render).join('')}</section>` : '';
    const results = [
      section('สมาชิก', people.data || [], p => `<button class="chat-search-result" data-search-chat="${esc(p.user_id)}" data-name="${esc(p.display_name)}"><b>${esc(p.display_name)}</b><small>@${esc(p.username)} · ${esc(p.province || 'ไม่ระบุพื้นที่')}</small></button>`),
      section('โพสต์', posts, p => `<article class="source-search-result"><b>${esc(p.title || p.kind)}</b><p>${esc(p.body.slice(0, 220))}</p></article>`),
      section('อีเวนต์', events.data || [], e => `<article class="source-search-result"><b>${esc(e.title)}</b><small>${esc(e.venue_name || 'ไม่ระบุสถานที่')} · ${esc(new Date(e.starts_at).toLocaleDateString('th-TH'))}</small></article>`),
      section('ตลาดงานศิลปะ', listings.data || [], l => `<button class="source-search-result" data-contact-seller="${esc(l.seller_id)}" data-seller-name="${esc(l.profiles?.display_name || 'ผู้ขาย')}"><b>${esc(l.title)}</b><small>${esc(l.profiles?.display_name || 'ศิลปิน')} · แตะเพื่อทัก</small></button>`),
      section('ห้องคุย', rooms || [], r => `<button class="source-search-result" data-open-room="${esc(r.id)}" data-room-name="${esc(r.name)}"><b>${esc(r.name)}</b><small>${esc(r.description || 'ห้องคุยสาธารณะ')}</small></button>`),
    ].filter(Boolean).join('');
    host.innerHTML = `<h2 id="modalTitle">ผลการค้นหา</h2><p>ผลลัพธ์สำหรับ “${esc(term)}”</p>${results || '<p class="platform-empty">ยังไม่พบรายการที่ตรงกับคำค้น</p>'}`;
  }

  async function loadRooms() {
    document.querySelectorAll('.left-rail .room-item:not([data-live-room])').forEach(node => node.remove());
    const { data, error } = await db.from('community_rooms').select('id,name,description').is('archived_at', null).order('created_at', { ascending: false }).limit(20);
    if (error) return;
    const rail = $('.left-rail');
    const button = $('#roomBtn');
    if (!rail || !button) return;
    rail.querySelectorAll('[data-live-room]').forEach(node => node.remove());
    (data || []).forEach(room => button.insertAdjacentHTML('beforebegin', `<button type="button" class="room-item" data-live-room="${esc(room.id)}" data-room-name="${esc(room.name)}" title="${esc(room.description)}"><i class="room-dot lime"></i><span>${esc(room.name)}</span></button>`));
  }

  async function getRoomMessages(roomId) {
    const { data, error } = await db.from('community_room_messages').select('id,body,image_storage_key,author_id,created_at,profiles!community_room_messages_author_id_fkey(display_name)').eq('room_id', roomId).order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    return (data || []).map(m => {
      const imageUrl = m.image_storage_key
        ? db.storage.from('sourcewav-room-images').getPublicUrl(m.image_storage_key).data.publicUrl
        : '';
      return `<article class="local-message"><b>${esc(m.profiles?.display_name || 'สมาชิก')}</b>${m.body ? `<p>${esc(m.body).replace(/\n/g, '<br>')}</p>` : ''}${imageUrl ? `<img class="room-message-image" src="${esc(imageUrl)}" alt="รูปที่ส่งในห้องคุย" loading="lazy" />` : ''}<small>${esc(new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))}</small></article>`;
    }).join('');
  }

  async function refreshRoomMessages(roomId) {
    try {
      const messages = await getRoomMessages(roomId);
      if (activeRoomId !== roomId) return;
      const thread = $('#modalContent #roomThread');
      if (thread) { thread.innerHTML = messages || '<p class="room-thread-empty">ยังไม่มีข้อความในห้องนี้ เริ่มบทสนทนาได้เลย</p>'; thread.scrollTop = thread.scrollHeight; }
    } catch (error) { toast('โหลดข้อความไม่ได้: ' + error.message); }
  }

  async function closeRoomChannel() {
    activeRoomId = null;
    if (roomChannel) {
      await db.removeChannel(roomChannel);
      roomChannel = null;
    }
  }

  async function openRoom(roomId, roomName) {
    activeRoomId = roomId;
    let messages;
    try { messages = await getRoomMessages(roomId); }
    catch (error) { return toast('เปิดห้องคุยไม่ได้: ' + error.message); }
    if (roomChannel) await closeRoomChannel();
    activeRoomId = roomId;
    const listedRooms = [...document.querySelectorAll('.left-rail [data-live-room]')].map(node => {
      const id = node.dataset.liveRoom;
      const name = node.dataset.roomName || node.textContent.trim();
      return `<button type="button" class="room-directory-item${id === roomId ? ' is-active' : ''}" data-room-switch="${esc(id)}" data-room-name="${esc(name)}"><i class="room-dot lime" aria-hidden="true"></i><span>${esc(name)}</span></button>`;
    });
    if (!listedRooms.some(node => node.includes(`data-room-switch="${roomId}"`))) {
      listedRooms.unshift(`<button type="button" class="room-directory-item is-active" data-room-switch="${esc(roomId)}" data-room-name="${esc(roomName)}"><i class="room-dot lime" aria-hidden="true"></i><span>${esc(roomName)}</span></button>`);
    }
    const roomButtons = listedRooms.join('');
    modal(`<main class="room-chat-page" aria-labelledby="roomHeading"><button type="button" class="room-chat-back-fab" id="roomBack" aria-label="กลับจากห้องแชท">← <span>กลับ</span></button><header class="room-chat-topbar"><a href="#feed" class="room-chat-brand" aria-label="Sourcewav หน้าแรก"><img class="room-chat-logo" src="assets/sourcewav-logo.svg" alt="SOURCEWAV BKK" /></a><span id="modalTitle">ห้องพูดคุย</span><button type="button" id="roomClose" aria-label="ปิดห้องพูดคุย">กลับหน้าเว็บ <b aria-hidden="true">×</b></button></header><div class="room-chat-layout"><aside class="room-directory"><div class="room-directory-heading"><h2>ห้องคุย</h2><p>เลือกห้องแล้วคุยกับคอมมูนิตี้</p></div><nav aria-label="รายการห้องพูดคุย">${roomButtons || '<p class="room-directory-empty">ยังไม่มีห้องคุย</p>'}</nav><button type="button" class="room-create-action" id="roomCreateShortcut">＋ สร้างห้องคุย</button></aside><section class="room-chat-main" aria-labelledby="roomHeading"><header class="room-active-heading"><span class="room-active-mark" aria-hidden="true">#</span><div><h1 id="roomHeading">${esc(roomName)}</h1><p>พื้นที่แลกเปลี่ยนไอเดียและพูดคุยกับสมาชิก</p></div></header><div class="room-thread" id="roomThread" aria-live="polite">${messages || '<p class="room-thread-empty">ยังไม่มีข้อความในห้องนี้ เริ่มบทสนทนาได้เลย</p>'}</div><form id="roomMessageForm" class="room-compose"><label class="room-compose-message" for="roomMessage">ข้อความ<textarea id="roomMessage" maxlength="2000" placeholder="เขียนข้อความถึงห้องนี้…"></textarea></label><div class="room-compose-actions"><label class="room-image-pick" for="roomImage"><span aria-hidden="true">＋</span> แนบรูป<input id="roomImage" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG หรือ WebP · สูงสุด 5 MB</small></label><button class="room-send-button" type="submit"><span>ส่งข้อความ</span><b aria-hidden="true">↗</b></button></div></form></section></div></main>`);
    const initialThread = $('#roomThread'); if (initialThread) initialThread.scrollTop = initialThread.scrollHeight;
    $('.room-chat-brand').onclick = async event => { event.preventDefault(); closeModal(); await closeRoomChannel(); location.hash = 'feed'; };
    $('#roomClose').onclick = async () => { closeModal(); await closeRoomChannel(); };
    $('#roomBack').onclick = async () => { closeModal(); await closeRoomChannel(); };
    $('#roomCreateShortcut').onclick = () => { closeModal(); $('#roomBtn')?.click(); };
    $('#roomMessageForm').onsubmit = async event => {
      event.preventDefault();
      const user = await needUser(); if (!user) return;
      const body = $('#roomMessage').value.trim();
      const imageFile = $('#roomImage').files?.[0];
      if (!body && !imageFile) return toast('พิมพ์ข้อความหรือเลือกรูปก่อนส่ง');
      if (body.length > 2000) return toast('ข้อความยาวได้ไม่เกิน 2,000 ตัวอักษร');
      if (imageFile && (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024)) return toast('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB');
      const submit = event.submitter || event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true;
      let imageStorageKey = null;
      try {
        if (imageFile) {
          const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[imageFile.type];
          imageStorageKey = `${user.id}/${roomId}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await db.storage.from('sourcewav-room-images').upload(imageStorageKey, imageFile, {
            contentType: imageFile.type, cacheControl: '3600', upsert: false
          });
          if (uploadError) throw uploadError;
        }
        const { error } = await db.from('community_room_messages').insert({ room_id: roomId, author_id: user.id, body, image_storage_key: imageStorageKey });
        if (error) throw error;
        await refreshRoomMessages(roomId);
        $('#roomMessage').value = '';
        $('#roomImage').value = '';
      } catch (error) {
        if (imageStorageKey) await db.storage.from('sourcewav-room-images').remove([imageStorageKey]);
        toast('ส่งข้อความไม่ได้: ' + error.message);
      } finally {
        if (submit?.isConnected) submit.disabled = false;
      }
    };
    roomChannel = db.channel(`community-room-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_room_messages', filter: `room_id=eq.${roomId}` }, () => refreshRoomMessages(roomId))
      .subscribe();
  }

  async function createRoom() {
    const user = await needUser(); if (!user) return;
    const name = $('#newRoomName')?.value.trim().replace(/^#+\s*/, '');
    const description = $('#newRoomDescription')?.value.trim() || '';
    if (!name || name.length < 2) return toast('ตั้งชื่อห้องอย่างน้อย 2 ตัวอักษร');
    const { data, error } = await db.from('community_rooms').insert({ created_by: user.id, name: `# ${name}`, description }).select('id,name').single();
    if (error) return toast('สร้างห้องไม่ได้: ' + error.message);
    closeModal(); await loadRooms(); toast('สร้างห้องคุยแล้ว');
    await openRoom(data.id, data.name);
  }

  function postCard(post, userId, savedSet) {
    const author = post.profiles || {};
    const comments = post.comments?.[0]?.count || 0;
    const likes = post.reactions || [];
    const liked = userId && likes.some(row => row.user_id === userId);
    const kind = { music: 'เพลง', art: 'ศิลปะ', talk: 'พูดคุย', collab: 'หาเพื่อนร่วมงาน', announcement: 'ประกาศ' }[post.kind] || post.kind;
    const date = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.created_at));
    const saved = savedSet?.has(post.id);
    const avatarUrl = (() => { try { const url = new URL(author.avatar_url || ''); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } })();
    return `<article class="post-card live-post-card" data-live-post="${esc(post.id)}" data-kind="${esc(post.kind)}"><div class="post-top"><div class="avatar avatar-purple live-post-avatar">${esc(initials(author.display_name || author.username))}${avatarUrl ? `<img src="${esc(avatarUrl)}" alt="" loading="lazy" />` : ''}</div><div class="post-author"><strong>${esc(author.display_name || author.username || 'ศิลปิน')}</strong><small>${esc(kind)} · ${esc(date)}</small></div></div>${post.title ? `<h3 class="live-post-title">${esc(post.title)}</h3>` : ''}<p class="post-copy">${esc(post.body).replace(/\n/g, '<br>')}</p><div class="post-actions"><button class="live-like-btn ${liked ? 'liked' : ''}" data-live-like="${esc(post.id)}" aria-pressed="${Boolean(liked)}" aria-label="${liked ? 'ยกเลิกถูกใจ' : 'ถูกใจ'} โพสต์นี้"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.9c0 5.1-8.8 10-8.8 10S3.2 14 3.2 8.9a4.4 4.4 0 0 1 8.8-.1 4.4 4.4 0 0 1 8.8.1Z"/></svg><span>ถูกใจ</span><b>${likes.length}</b></button><button data-live-comment="${esc(post.id)}" aria-expanded="false" aria-label="แสดงความคิดเห็น"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4H12a8 8 0 0 1 8 7.5Z"/><path d="M8 11h8M8 14.5h5"/></svg><span>ความคิดเห็น</span><b>${comments}</b></button><button data-live-share="${esc(post.id)}" aria-label="แชร์โพสต์"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg><span>แชร์</span></button><button class="${saved ? 'liked' : ''}" data-live-save="${esc(post.id)}" aria-pressed="${Boolean(saved)}" aria-label="${saved ? 'นำโพสต์ออกจากรายการที่บันทึก' : 'บันทึกโพสต์'}"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h12v16l-6-4-6 4v-16Z"/></svg><span>${saved ? 'บันทึกแล้ว' : 'เก็บไว้'}</span></button></div></article>`;
  }

  async function loadFeed() {
    const root = $('#liveFeed'); if (!root) return;
    const openPostId = activePostComments?.postId || null;
    const { data: userResult } = await db.auth.getUser();
    let query = db.from('posts').select('id,author_id,kind,title,body,created_at,profiles!posts_author_id_fkey(display_name,username,avatar_url),reactions(user_id),comments(count)').eq('status', 'published').eq('visibility', 'public').is('deleted_at', null).order('created_at', { ascending: false }).limit(60);
    const { data, error } = await query;
    if (error) { root.innerHTML = `<p class="platform-empty">โหลดฟีดไม่ได้: ${esc(error.message)}</p>`; return; }
    const posts = (data || []).filter(post => feedFilter === 'all' || post.kind === feedFilter);
    let savedSet = new Set();
    if (userResult.user && posts.length) {
      const { data: saved } = await db.from('saved_items').select('item_id').eq('user_id', userResult.user.id).eq('item_type', 'post').in('item_id', posts.map(post => post.id));
      savedSet = new Set((saved || []).map(item => item.item_id));
    }
    root.innerHTML = posts.length ? posts.map(post => postCard(post, userResult.user?.id, savedSet)).join('') : '<p class="platform-empty">ยังไม่มีโพสต์ในหมวดนี้ — เริ่มบทสนทนาแรกได้เลย</p>';
    root.querySelectorAll('.live-post-avatar img').forEach(image => image.addEventListener('error', () => image.remove(), { once: true }));
    if (openPostId) {
      const trigger = root.querySelector(`.live-post-card[data-live-post="${openPostId}"] [data-live-comment]`);
      const card = trigger?.closest('.live-post-card');
      activePostComments = null;
      if (trigger && card) {
        const title = card.querySelector('.live-post-title')?.textContent?.trim()
          || card.querySelector('.post-copy')?.textContent?.trim().slice(0, 80)
          || 'โพสต์';
        openPostComments(trigger, openPostId, title, { focus: false });
      }
    }
  }

  async function loadListings() {
    const root = $('#userListings'); if (!root) return;
    const { data, error } = await db.from('listings').select('id,seller_id,title,description,category,price_minor,currency,delivery_type,profiles!listings_seller_id_fkey(display_name,username),listing_media(storage_key,alt_text,position)').eq('status', 'published').is('deleted_at', null).order('created_at', { ascending: false }).limit(30);
    if (error) { root.innerHTML = `<p class="platform-empty">โหลดตลาดไม่ได้: ${esc(error.message)}</p>`; return; }
    root.innerHTML = (data || []).map(item => { const media = (item.listing_media || []).sort((a,b) => a.position-b.position)[0]; const image = media ? db.storage.from('sourcewav-listings').getPublicUrl(media.storage_key).data.publicUrl : ''; return `<article class="live-listing">${image ? `<img class="listing-art-image" src="${esc(image)}" alt="${esc(media.alt_text || item.title)}" loading="lazy" />` : `<div class="listing-art-mark">${esc(initials(item.title))}</div>`}<div class="listing-copy"><strong>${esc(item.title)}</strong><small>${esc(item.profiles?.display_name || 'ศิลปิน')} · ${esc(item.category)}</small><p>${esc(item.description || '')}</p><b>${item.price_minor === null ? 'สอบถามราคา' : money(item.price_minor)}</b></div><button data-contact-seller="${esc(item.seller_id)}" data-seller-name="${esc(item.profiles?.display_name || item.profiles?.username || 'ผู้ขาย')}">ทักผู้ขาย</button></article>`; }).join('') || '<p class="platform-empty">ยังไม่มีผลงานในตลาด ลงงานแรกของคุณได้เลย</p>';
  }

  async function loadEvents() {
    const root = $('#liveEvents'); if (!root) return;
    const { data, error } = await db.from('events').select('id,title,description,category,starts_at,ends_at,venue_name,venue_address,cover_url,ticket_types(id,name,price_minor,quantity_total,quantity_sold,quantity_reserved,sales_start,sales_end)').eq('status', 'published').is('deleted_at', null).gte('ends_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(20);
    if (error) { root.innerHTML = `<p class="platform-empty">โหลดอีเวนต์ไม่ได้: ${esc(error.message)}</p>`; return; }
    root.innerHTML = (data || []).map(event => {
      const date = new Date(event.starts_at);
      const now = Date.now();
      const saleTiers = (event.ticket_types || []).filter(t => t.quantity_total > t.quantity_sold + t.quantity_reserved && (!t.sales_start || new Date(t.sales_start).getTime() <= now) && (!t.sales_end || new Date(t.sales_end).getTime() >= now));
      const available = saleTiers.reduce((sum, tier) => sum + tier.quantity_total - tier.quantity_sold - tier.quantity_reserved, 0);
      const startingPrice = saleTiers.length ? Math.min(...saleTiers.map(tier => Number(tier.price_minor))) : null;
      const availability = saleTiers.length ? `เหลือ ${available.toLocaleString('th-TH')} ใบ` : 'ยังไม่มีบัตรเปิดขาย';
      const poster = safeImageUrl(event.cover_url);
      return `<article class="event-card live-event-card"><div class="event-poster poster-one">${poster ? `<img class="live-event-poster-image" src="${esc(poster)}" alt="โปสเตอร์ ${esc(event.title)}" loading="lazy" />` : ''}<span>${esc(date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }))}</span><b>${esc(event.category === 'music' ? 'LIVE' : event.category.toUpperCase())}</b><small>SOURCEWAV</small></div><div class="event-info"><div class="event-date"><b>${esc(date.toLocaleDateString('th-TH', { day: '2-digit' }))}</b><span>${esc(date.toLocaleDateString('th-TH', { month: 'short' }))} · ${esc(date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))}</span></div><h3>${esc(event.title)}</h3><p>${esc(event.venue_name || 'สถานที่แจ้งภายหลัง')}${event.venue_address ? ` · ${esc(event.venue_address)}` : ''}</p><div class="event-bottom"><div class="event-ticket-price"><strong>${startingPrice === null ? 'บัตรยังไม่เปิดขาย' : `เริ่ม ${money(startingPrice)}`}</strong><small>${availability}</small></div><button class="buy-btn" data-buy-event="${esc(event.id)}" ${saleTiers.length ? '' : 'disabled'}>${saleTiers.length ? 'เลือกบัตร' : 'ปิดขาย'}</button></div></div></article>`;
    }).join('') || '<p class="platform-empty">ยังไม่มีอีเวนต์เปิดขาย งานที่ผู้จัดสร้างจะปรากฏที่นี่</p>';
    root.querySelectorAll('.live-event-poster-image').forEach(image => image.addEventListener('error', () => image.remove(), { once: true }));
  }

  const ticketPurchaseHash = eventId => `#buy-ticket/${encodeURIComponent(eventId)}`;
  function openTicketPurchase(eventId) {
    const nextHash = ticketPurchaseHash(eventId);
    if (location.hash === nextHash) return ticketPicker(eventId);
    location.hash = nextHash;
  }
  async function ticketPicker(eventId) {
    const page = $('#eventPurchasePage');
    const requestId = ++eventPurchaseRequest;
    page.hidden = false;
    document.body.classList.add('event-purchase-page-active');
    window.scrollTo(0, 0);
    page.innerHTML = '<div class="event-purchase-toolbar"><a href="#events">← กลับหน้าอีเวนต์</a><span>SOURCEWAV TICKETS</span></div><div class="event-purchase-loading" role="status">กำลังโหลดรายละเอียดงาน…</div>';
    const { data: event, error } = await db.from('events').select('id,organizer_id,title,description,category,cover_url,poster_urls,starts_at,ends_at,venue_name,venue_address,ticket_types(id,name,price_minor,quantity_total,quantity_sold,quantity_reserved,sales_start,sales_end),event_payment_methods(qr_storage_key,bank_name,beneficiary_name,account_last4)').eq('id', eventId).single();
    if (requestId !== eventPurchaseRequest || location.hash !== ticketPurchaseHash(eventId)) return;
    if (error || !event) {
      page.innerHTML = '<div class="event-purchase-toolbar"><a href="#events">← กลับหน้าอีเวนต์</a><span>SOURCEWAV TICKETS</span></div><section class="event-purchase-error"><h1>เปิดรายละเอียดงานไม่ได้</h1><p>งานนี้อาจถูกนำออกหรือไม่พร้อมให้เข้าชม ลองกลับไปเลือกงานอีกครั้ง</p></section>';
      return;
    }
    const now = Date.now();
    const tiers = (event.ticket_types || []).filter(t => t.quantity_total > t.quantity_sold + t.quantity_reserved && (!t.sales_start || new Date(t.sales_start).getTime() <= now) && (!t.sales_end || new Date(t.sales_end).getTime() >= now));
    const method = Array.isArray(event.event_payment_methods) ? event.event_payment_methods[0] : event.event_payment_methods;
    const { data: authData } = await db.auth.getUser();
    const canManagePayment = authData.user?.id === event.organizer_id;
    const categoryNames = { music: 'ดนตรี', art: 'ศิลปะ', community: 'คอมมูนิตี้', market: 'ตลาด', other: 'อีเวนต์' };
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    const startDate = new Date(event.starts_at);
    const endDate = event.ends_at ? new Date(event.ends_at) : null;
    const posters = [...new Set([...(Array.isArray(event.poster_urls) ? event.poster_urls : []), event.cover_url].map(safeImageUrl).filter(Boolean))].slice(0, 4);
    const posterMarkup = posters.length
      ? `<figure class="event-purchase-poster"><img id="eventPosterGalleryImage" src="${esc(posters[0])}" alt="โปสเตอร์งาน ${esc(event.title)} · 1 จาก ${posters.length}" />${posters.length > 1 ? `<div class="event-poster-gallery-controls" aria-label="เลือกรูปโปสเตอร์">${posters.map((url, index) => `<button type="button" class="event-poster-gallery-thumb${index === 0 ? ' is-active' : ''}" data-poster-index="${index}" aria-label="ดูโปสเตอร์รูปที่ ${index + 1}" aria-pressed="${index === 0}"><img src="${esc(url)}" alt="" /></button>`).join('')}</div>` : ''}<figcaption>โปสเตอร์งาน${posters.length > 1 ? ` · 1 / ${posters.length}` : ''}</figcaption></figure>`
      : '<div class="event-purchase-poster event-purchase-poster-empty"><span aria-hidden="true">✦</span><p>ผู้จัดยังไม่ได้เพิ่มโปสเตอร์</p></div>';
    const tierOptions = tiers.map(t => {
      const left = t.quantity_total - t.quantity_sold - t.quantity_reserved;
      return `<option value="${esc(t.id)}" data-price="${t.price_minor}" data-left="${left}">${esc(t.name)} · ${money(t.price_minor)} · เหลือ ${left.toLocaleString('th-TH')} ใบ</option>`;
    }).join('');
    const purchaseAction = method && tiers.length
      ? '<p>ชำระตรงเข้าบัญชีผู้จัด ระบบตรวจสลิปผ่าน SlipOK ก่อนออกบัตร</p><button class="modal-primary" id="startManualCheckout" type="button">ดู QR และชำระเงิน <span aria-hidden="true">↗</span></button>'
      : `<p>${!tiers.length ? 'บัตรหมดหรือยังไม่เปิดขายในขณะนี้' : 'งานนี้ยังไม่ได้ตั้งค่าบัญชีรับเงิน จึงยังชำระเงินไม่ได้'}</p><button class="modal-primary" id="startManualCheckout" type="button" disabled>${!tiers.length ? 'ยังไม่มีบัตรพร้อมขาย' : 'ยังไม่พร้อมรับชำระ'}</button>`;
    page.innerHTML = `<div class="event-purchase-page-inner"><div class="event-purchase-toolbar"><a href="#events">← กลับหน้าอีเวนต์</a><span>SOURCEWAV TICKETS</span></div><div class="event-purchase-layout"><section class="event-purchase-art" aria-label="โปสเตอร์งาน">${posterMarkup}</section><div class="event-purchase-content"><article class="event-purchase-info"><span class="event-purchase-category">${esc(categoryNames[event.category] || 'อีเวนต์')}</span><h1 id="eventPurchaseTitle">${esc(event.title)}</h1><div class="event-purchase-facts"><div><span aria-hidden="true">◷</span><p><b>วันและเวลา</b><time datetime="${esc(event.starts_at)}">${esc(startDate.toLocaleString('th-TH', dateOptions))}</time>${endDate ? `<time datetime="${esc(event.ends_at)}">ถึง ${esc(endDate.toLocaleString('th-TH', dateOptions))}</time>` : ''}</p></div><div><span aria-hidden="true">⌖</span><p><b>สถานที่</b><strong>${esc(event.venue_name || 'แจ้งสถานที่ภายหลัง')}</strong>${event.venue_address ? `<span>${esc(event.venue_address)}</span>` : ''}</p></div></div><section class="event-purchase-description"><h2>รายละเอียดงาน</h2><p>${event.description ? esc(event.description) : 'ผู้จัดยังไม่ได้เพิ่มรายละเอียดงาน'}</p></section></article>${canManagePayment ? `<section class="event-purchase-owner-tools"><div><span>สำหรับผู้จัดงาน</span><h2>การตรวจสลิป SlipOK</h2><p>อัปเดต Branch ID หรือ API Key ได้ ระบบจะตรวจการเชื่อมต่อก่อนบันทึก</p></div><button type="button" id="manageSlipokSettings" data-event-id="${esc(event.id)}" data-branch-id="${esc(method?.slipok_branch_id || '')}">ตั้งค่าการเชื่อมต่อ</button></section>` : ''}<section class="event-purchase-checkout" aria-labelledby="ticketPurchaseHeading"><header><span>เลือกบัตรเข้าร่วมงาน</span><h2 id="ticketPurchaseHeading">เลือก Tier บัตร</h2></header><label class="modal-field">ประเภทบัตร<select id="ticketTier" ${tiers.length ? '' : 'disabled'}>${tiers.length ? tierOptions : '<option value="">ไม่มีบัตรพร้อมขาย</option>'}</select></label><label class="modal-field">จำนวน<input id="ticketQuantity" type="number" min="1" max="10" value="1" ${tiers.length ? '' : 'disabled'} /></label><div class="checkout-event"><div class="checkout-row"><span>ยอดรวม</span><b id="ticketTotal">${tiers.length ? money(tiers[0].price_minor) : '—'}</b></div>${purchaseAction}</div></section></div></div>${method && tiers.length ? '<button class="mobile-ticket-cta" type="button">เลือกบัตร</button>' : ''}`;
    if (posters.length > 1) {
      const caption = $('.event-purchase-poster figcaption', page);
      const image = $('#eventPosterGalleryImage', page);
      page.querySelectorAll('[data-poster-index]').forEach(button => button.addEventListener('click', () => {
        const index = Number(button.dataset.posterIndex);
        image.src = posters[index];
        image.alt = `โปสเตอร์งาน ${event.title} · ${index + 1} จาก ${posters.length}`;
        caption.textContent = `โปสเตอร์งาน · ${index + 1} / ${posters.length}`;
        page.querySelectorAll('[data-poster-index]').forEach(item => { const active = item === button; item.classList.toggle('is-active', active); item.setAttribute('aria-pressed', String(active)); });
      }));
    }
    const updateTotal = () => {
      const selected = $('#ticketTier')?.selectedOptions[0];
      const maxQuantity = Math.min(10, Number(selected?.dataset.left || 0));
      const quantityInput = $('#ticketQuantity');
      if (!selected || !maxQuantity || !quantityInput) return;
      const quantity = Math.max(1, Math.min(maxQuantity, Number(quantityInput.value || 1)));
      quantityInput.max = String(maxQuantity);
      quantityInput.value = String(quantity);
      $('#ticketTotal').textContent = money(Number(selected.dataset.price) * quantity);
    };
    if (tiers.length) {
      $('#ticketTier').addEventListener('change', updateTotal);
      $('#ticketQuantity').addEventListener('input', updateTotal);
    }
    $('.mobile-ticket-cta', page)?.addEventListener('click', () => $('#ticketTier')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    $('#startManualCheckout', page)?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      beginManualCheckout();
    });
  }

  function openSlipOkSettings(eventId, branchId) {
    modal(`<section class="slipok-settings-modal"><span class="payment-eyebrow">SOURCEWAV TICKETS</span><h2 id="modalTitle">ตั้งค่า SlipOK</h2><p>กรอก Branch ID และ API Key จากหน้าตั้งค่าสาขา SlipOK ระบบจะตรวจสิทธิ์ผ่านหน้าโควตาโดยไม่ส่งสลิปและไม่ใช้โควตาตรวจสลิป</p><form id="slipokSettingsForm" data-event-id="${esc(eventId)}"><label class="modal-field">Branch ID<input id="slipokSettingsBranch" inputmode="numeric" autocomplete="off" value="${esc(branchId)}" placeholder="เช่น 12345" required /></label><label class="modal-field">API Key<input id="slipokSettingsKey" type="password" autocomplete="new-password" placeholder="วาง API Key ของสาขานี้" required /></label><div id="slipokSettingsResult" role="status" aria-live="polite"></div><button class="modal-primary" id="saveSlipokSettings" type="submit">ตรวจสอบและบันทึก</button></form></section>`);
  }

  async function saveSlipOkSettings(form) {
    const button = $('#saveSlipokSettings');
    const keyInput = $('#slipokSettingsKey');
    const branchId = parseSlipOkBranchId($('#slipokSettingsBranch')?.value);
    const apiKey = keyInput?.value.trim() || '';
    if (!branchId) { $('#slipokSettingsBranch')?.focus(); return toast('กรอก Branch ID เป็นตัวเลข หรือวาง URL API จาก SlipOK'); }
    if (apiKey.length < 8 || apiKey.length > 512) { keyInput?.focus(); return toast('กรอก API Key ของสาขา SlipOK'); }
    button.disabled = true; button.textContent = 'กำลังตรวจสอบ…';
    try {
      await call('update-event-slipok', { eventId: form.dataset.eventId, slipokBranchId: branchId, slipokApiKey: apiKey });
      closeModal(); toast('เชื่อมต่อ SlipOK สำเร็จและบันทึกการตั้งค่าแล้ว');
      const page = $('#eventPurchasePage');
      if (page && !page.hidden) ticketPicker(form.dataset.eventId);
    } catch (error) {
      const result = $('#slipokSettingsResult');
      if (result) result.textContent = error.message || 'บันทึกการตั้งค่าไม่สำเร็จ';
      button.disabled = false; button.textContent = 'ตรวจสอบและบันทึก';
    } finally { if (keyInput) keyInput.value = ''; }
  }

  async function beginManualCheckout() {
    const tier = $('#ticketTier')?.value, quantity = Number($('#ticketQuantity')?.value || 1);
    const button = $('#startManualCheckout');
    if (!tier || !button || button.disabled) return;
    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError) return toast('ตรวจสอบการเข้าสู่ระบบไม่ได้ กรุณาลองใหม่');
    if (!authData.user) {
      toast('เข้าสู่ระบบก่อนเพื่อจองบัตรและเปิด QR ชำระเงิน');
      $('#profileBtn')?.click();
      return;
    }
    button.disabled = true; button.textContent = 'กำลังสร้างรายการ…';
    try {
      const checkout = await call('create-manual-ticket-order', { ticketTypeId: tier, quantity, idempotencyKey: button.dataset.idempotencyKey ||= crypto.randomUUID() });
      delete button.dataset.idempotencyKey;
      showManualPayment(checkout);
    } catch (error) { button.disabled = false; button.innerHTML = 'ดู QR และชำระเงิน <span aria-hidden="true">↗</span>'; toast(error.message || 'สร้างรายการจองไม่สำเร็จ กรุณาลองใหม่'); }
  }

  function verificationFollowUp(order) {
    const issue = order?.verificationIssue;
    if (issue === 'invalid_slipok_credentials') return 'ผู้จัดต้องแก้ข้อมูลเชื่อมต่อ SlipOK ของสาขาเดิมก่อน ระบบเก็บสลิปไว้ตรวจซ้ำแล้ว ไม่ต้องโอนเงินซ้ำ';
    if (issue === 'quota_exhausted' || order?.verificationStatus === 'quota_exhausted') return 'SlipOK ใช้โควต้าตรวจครบแล้ว ระบบเก็บรายการไว้ให้ผู้จัดติดตาม ไม่ต้องโอนเงินซ้ำ';
    if (issue === 'provider_timeout' || order?.verificationStatus === 'timeout') return 'SlipOK ยังไม่ตอบกลับ ระบบเก็บรายการไว้แล้ว โปรดรอผลหรือติดต่อผู้จัด ไม่ต้องโอนเงินซ้ำ';
    if (issue === 'provider_unavailable' || order?.verificationStatus === 'error') return 'ระบบติดต่อ SlipOK ไม่ได้ ระบบเก็บสลิปไว้ให้ตรวจซ้ำ โปรดรอผลหรือติดต่อผู้จัด ไม่ต้องโอนเงินซ้ำ';
    return '';
  }

  function showManualPayment(checkout) {
    const until = new Date(checkout.expiresAt).getTime();
    const initialSeconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    const initialCountdown = `${Math.floor(initialSeconds / 60)}:${String(initialSeconds % 60).padStart(2, '0')}`;
    const eventDate = checkout.startsAt ? new Date(checkout.startsAt).toLocaleString('th-TH', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'ยังไม่ระบุวัน';
    modal(`<div class="manual-payment"><header class="payment-heading"><span class="payment-eyebrow">SOURCEWAV TICKETS</span><h2 id="modalTitle">ชำระเงินเพื่อรับบัตร</h2><p>${esc(checkout.eventTitle)} · ${esc(checkout.tierName)} × ${checkout.quantity}</p><p class="payment-event-meta">${esc(eventDate)} · ${esc(checkout.venueName || 'ยังไม่ระบุสถานที่')}${checkout.venueAddress ? ` · ${esc(checkout.venueAddress)}` : ''}</p></header><ol class="payment-steps" aria-label="ขั้นตอนชำระเงิน"><li class="is-current"><b>1</b><span>สแกน QR</span></li><li><b>2</b><span>แนบสลิป</span></li><li><b>3</b><span>รับบัตร</span></li></ol><div class="payment-layout"><section class="payment-qr-column" aria-label="QR สำหรับชำระเงิน"><div class="payment-total"><span>ยอดที่ต้องโอน</span><strong>${money(checkout.totalMinor)}<small> บาท</small></strong></div><div class="real-payment-qr"><img src="${esc(checkout.paymentQrUrl)}" alt="QR รับชำระเงินของผู้จัดงาน ${esc(checkout.eventTitle)}" /></div><p class="qr-hint">สแกนด้วยแอปธนาคาร แล้วตรวจชื่อผู้รับก่อนยืนยัน</p></section><section class="payment-details"><h3>ข้อมูลผู้รับเงิน</h3><div class="checkout-row"><span>ธนาคาร</span><b>${esc(checkout.bankName)}</b></div><div class="checkout-row"><span>ชื่อบัญชี</span><b>${esc(checkout.beneficiaryName)}</b></div>${checkout.accountLast4 ? `<div class="checkout-row"><span>เลขบัญชีลงท้าย</span><b>•••• ${esc(checkout.accountLast4)}</b></div>` : ''}<div class="checkout-row payment-expiry"><span>เวลาจองคงเหลือ</span><b><time data-payment-countdown datetime="${esc(checkout.expiresAt)}">${initialCountdown}</time></b></div><p class="payment-order-ref">รายการ #SW-${esc(checkout.orderId.replace(/-/g, '').slice(-8).toUpperCase())}</p></section></div>${checkout.latestSubmission?.status === 'rejected' ? '<p class="order-retry-note">สลิปครั้งก่อนตรวจไม่ผ่าน คุณส่งสลิปต้นฉบับใหม่ได้โดยไม่ต้องสร้างคำสั่งซื้อใหม่</p>' : ''}<p class="order-payee-note">ยอดชำระเข้าบัญชีผู้จัดโดยตรง โปรดตรวจชื่อผู้รับในแอปธนาคารก่อนยืนยัน</p><form id="ticketSlipForm" data-order-id="${esc(checkout.orderId)}"><label class="modal-field">ส่งสลิปตัวจริง<input id="ticketSlipFile" type="file" accept="image/jpeg,image/png,image/webp,image/jfif" required /><small>ไฟล์ JPG, PNG, JFIF หรือ WebP ขนาดไม่เกิน 5 MB · ตรวจได้สูงสุด 5 ครั้งต่อรายการ</small></label><button class="modal-primary" id="submitTicketSlip" type="submit">ตรวจสลิปและออกบัตร</button></form><div id="ticketSlipResult" role="status" aria-live="polite"></div></div>`);
    const followUp = verificationFollowUp(checkout);
    if (followUp) {
      const orderRef = `SW-${checkout.orderId.replace(/-/g, '').slice(-8).toUpperCase()}`;
      const contact = checkout.organizerId
        ? `<button type="button" class="modal-secondary" data-order-contact="${esc(checkout.organizerId)}" data-order-ref="${esc(orderRef)}" data-name="${esc(checkout.organizerName || 'ผู้จัดงาน')}">ติดต่อผู้จัดพร้อมเลขคำสั่งซื้อ</button>`
        : '';
      $('#ticketSlipForm')?.insertAdjacentHTML('beforebegin', `<p class="order-retry-note" role="status">${esc(followUp)}</p>${contact}`);
      if (['invalid_slipok_credentials', 'quota_exhausted'].includes(checkout.verificationIssue) || checkout.verificationStatus === 'quota_exhausted') {
        const qrColumn = $('#modalContent .payment-qr-column'); if (qrColumn) qrColumn.hidden = true;
        const input = $('#ticketSlipFile'); if (input) input.disabled = true;
        const submit = $('#submitTicketSlip'); if (submit) { submit.disabled = true; submit.textContent = 'รอผู้จัดตรวจสอบ'; }
      }
    }
    $('#ticketSlipForm')?.insertAdjacentHTML('beforebegin', `<details class="payment-refund-policy" open><summary>เงื่อนไขการยกเลิกและคืนเงิน</summary><p>${esc(checkout.refundPolicy || 'ยังไม่ได้ระบุเงื่อนไขโดยละเอียด กรุณาติดต่อผู้จัดงานก่อนชำระเงิน')}</p><small>ยอดชำระเข้าบัญชีผู้จัดโดยตรง การคืนเงินจึงประสานกับผู้จัดงานผ่านแชท</small></details>`);
    if (checkout.organizerName) $('#modalContent .payment-details h3')?.insertAdjacentHTML('afterend', `<div class="checkout-row"><span>ผู้จัดงาน</span><b>${esc(checkout.organizerName)}</b></div>`);
    $('#modalContent .qr-hint')?.insertAdjacentHTML('afterend', '<p class="qr-mobile-hint">ใช้มือถือเครื่องเดียว? ลองบันทึกภาพ QR แล้วเลือกภาพในแอปธนาคาร (หากรองรับ) หรือใช้มือถืออีกเครื่องสแกน</p>');
    clearInterval(paymentTimer);
    paymentTimer = setInterval(async () => {
      if (!$('#ticketSlipForm')) { clearInterval(paymentTimer); return; }
      const countdown = $('#modalContent [data-payment-countdown]');
      if (countdown) {
        const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        countdown.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      }
      if (Date.now() >= until) {
        clearInterval(paymentTimer);
        const result = $('#ticketSlipResult'); if (result) result.textContent = 'หมดเวลาจองแล้ว อย่าโอนเงินจาก QR นี้ กรุณาเลือกบัตรใหม่';
        const qr = $('#modalContent .payment-qr-column'); if (qr) qr.hidden = true;
        const submit = $('#submitTicketSlip'); if (submit) submit.disabled = true;
        return;
      }
      const { order } = await call('my-orders', { orderId: checkout.orderId });
      if (order?.status === 'paid') {
        clearInterval(paymentTimer); closeModal(); toast('SlipOK ตรวจผ่าน · บัตรของคุณพร้อมใช้งาน'); openMyTickets();
      }
    }, 5000);
  }

  async function submitTicketSlip(event) {
    event.preventDefault();
    const orderId = $('#ticketSlipForm')?.dataset.orderId;
    const input = $('#ticketSlipFile');
    const file = input?.files?.[0];
    const button = $('#submitTicketSlip');
    const result = $('#ticketSlipResult');
    if (!orderId || !file) return toast('เลือกไฟล์สลิปก่อนส่งตรวจ');
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/jfif': 'jfif' };
    if (!extensions[file.type] || file.size > 5 * 1024 * 1024) return toast('เลือกรูป JPG, PNG, JFIF หรือ WebP ไม่เกิน 5 MB');
    const user = await needUser(); if (!user) return;
    button.disabled = true; button.textContent = 'กำลังตรวจสลิป…';
    button.dataset.exhausted = 'false';
    const storageKey = `${user.id}/${orderId}/${crypto.randomUUID()}.${extensions[file.type]}`;
    try {
      const { error: uploadError } = await db.storage.from('sourcewav-ticket-slips').upload(storageKey, file, {
        contentType: file.type, cacheControl: '3600', upsert: false,
      });
      if (uploadError) throw new Error('อัปโหลดสลิปไม่สำเร็จ: ' + uploadError.message);
      const verification = await call('submit-ticket-payment', { orderId, slipStorageKey: storageKey });
      if (verification.status === 'paid') {
        clearInterval(paymentTimer);
        closeModal(); toast('SlipOK ตรวจผู้รับและยอดผ่าน · ออกบัตรอัตโนมัติแล้ว'); openMyTickets();
        return;
      } else if (verification.status === 'verified_pending') {
        result.innerHTML = `<div class="slip-check-result is-verified"><strong>SlipOK ตรวจผ่าน · กำลังออกบัตร</strong><span>${esc(verification.message || 'สลิปผ่านแล้ว')}</span><small>กดปุ่มด้านล่างเพื่อลองออกบัตรอีกครั้งได้ โดยไม่ต้องส่งสลิปใหม่</small></div>`;
        button.type = 'button'; button.textContent = 'ลองออกบัตรอีกครั้ง';
        button.onclick = async () => {
          button.disabled = true; button.textContent = 'กำลังออกบัตร…';
          try {
            const issued = await call('finalize-ticket-payment', { submissionId: verification.submissionId, attemptId: verification.attemptId });
            if (issued.status === 'paid') { clearInterval(paymentTimer); closeModal(); toast('บัตรของคุณพร้อมใช้งานแล้ว'); openMyTickets(); }
            else if (issued.status === 'review_required') {
              result.innerHTML = `<div class="slip-check-result is-verified"><strong>ต้องตรวจเพิ่มเติม</strong><span>${esc(issued.message || 'คำสั่งซื้อถูกส่งให้ผู้จัดตรวจสอบ')}</span><small>ไม่ต้องโอนซ้ำ · ติดต่อผู้จัดพร้อมเลขคำสั่งซื้อ</small></div>`;
              button.disabled = true; button.textContent = 'ส่งตรวจสอบแล้ว'; button.dataset.exhausted = 'true';
            }
            else throw new Error('ยังออกบัตรไม่ได้ กรุณาลองอีกครั้ง');
          } catch (error) { button.disabled = false; button.textContent = 'ลองออกบัตรอีกครั้ง'; toast(error.message); }
        };
        input.value = '';
      } else if (verification.status === 'review_required') {
        clearInterval(paymentTimer);
        result.innerHTML = `<div class="slip-check-result is-verified"><strong>ส่งรายการให้ผู้จัดตรวจสอบแล้ว</strong><span>${esc(verification.message || 'ระบบต้องตรวจเวลาโอนและจำนวนบัตรก่อนออกบัตร')}</span><small>ระบบยังไม่ออกบัตรอัตโนมัติ ผู้จัดต้องตรวจเวลาโอน ยอดจริง และจำนวนบัตรคงเหลือก่อน</small></div>`;
        button.disabled = true; button.textContent = 'ส่งตรวจสอบแล้ว';
        button.dataset.exhausted = 'true'; input.value = '';
      } else {
        const remaining = Number.isInteger(verification.attemptsRemaining) ? verification.attemptsRemaining : null;
        const exhausted = remaining === 0;
        result.innerHTML = `<div class="slip-check-result is-rejected"><strong>SlipOK ยังยืนยันสลิปไม่ได้</strong><span>${esc(verification.message || 'ตรวจยอดหรือ QR ไม่ผ่าน')}</span><small>${exhausted ? 'ใช้จำนวนครั้งตรวจครบแล้ว กรุณาเริ่มคำสั่งซื้อใหม่' : `ตรวจยอดและเลือกสลิปต้นฉบับให้ถูกต้อง แล้วส่งใหม่${remaining === null ? '' : ` · เหลือ ${remaining} ครั้ง`}`}</small></div>`;
        button.textContent = exhausted ? 'ตรวจครบจำนวนครั้งแล้ว' : 'ตรวจสลิปอีกครั้ง';
        button.disabled = exhausted;
        button.dataset.exhausted = String(exhausted);
        input.disabled = exhausted;
        input.value = '';
      }
    } catch (error) {
      // Keep slips for provider timeouts and counted attempts so the order remains
      // auditable. Remove files only when verification never consumed the upload.
      if (error.attemptCounted !== true) await db.storage.from('sourcewav-ticket-slips').remove([storageKey]);
      const remaining = Number.isInteger(error.attemptsRemaining) ? error.attemptsRemaining : null;
      const exhausted = remaining === 0;
      const retryNote = error.attemptCounted
        ? `จำนวนครั้งถูกนับแล้ว · เหลือ ${remaining ?? 'ไม่ทราบ'} ครั้ง`
        : remaining === null ? 'เลือกสลิปแล้วลองอีกครั้ง' : `เหลือ ${remaining} ครั้ง`;
      result.innerHTML = `<div class="slip-check-result is-rejected" role="alert"><strong>ยังตรวจสอบผลการโอนไม่ได้</strong><span>${esc(error.message || 'ตรวจสลิปไม่สำเร็จ')}</span><small>${esc(exhausted ? 'ใช้จำนวนครั้งตรวจครบแล้ว กรุณาเริ่มคำสั่งซื้อใหม่' : retryNote)}</small></div>`;
      button.textContent = exhausted ? 'ตรวจครบจำนวนครั้งแล้ว' : 'ลองตรวจอีกครั้ง';
      button.disabled = exhausted;
      button.dataset.exhausted = String(exhausted);
      input.disabled = exhausted;
    } finally { button.disabled = button.dataset.exhausted === 'true'; }
  }

  async function resumeTicketOrder(orderId, trigger) {
    if (!orderId) return;
    if (trigger) { trigger.disabled = true; trigger.setAttribute('aria-busy', 'true'); }
    try {
      const { order } = await call('my-orders', { orderId });
      if (!order) throw new Error('ไม่พบคำสั่งซื้อ');
      if (order.verificationStatus === 'processing') {
        showOrderVerifying(order);
        return;
      }
      if ((order.latestSubmission?.status === 'verified' || order.verifiedAttemptId) && ['awaiting_payment','expired'].includes(order.status)) {
        showVerifiedOrderRecovery(order);
        return;
      }
      if (order.status === 'expired') {
        showLateSlipUpload(order);
        return;
      }
      if (order.status !== 'awaiting_payment' || !order.paymentQrUrl) {
        clearInterval(paymentTimer);
        const rejected = order.status === 'disputed' && order.latestReview?.decision === 'rejected';
        const orderRef = `SW-${order.orderId.replace(/-/g, '').slice(-8).toUpperCase()}`;
        const title = rejected ? 'ผู้จัดปฏิเสธการอนุมัติรายการ' : order.status === 'disputed' ? 'ส่งคำสั่งซื้อให้ตรวจเพิ่มเติมแล้ว' : order.status === 'expired' ? 'คำสั่งซื้อหมดเวลาชำระ' : order.status === 'paid' ? 'ชำระเงินแล้ว' : 'สถานะคำสั่งซื้อ';
        const message = rejected ? 'ผู้จัดบันทึกผลตรวจแล้ว การปฏิเสธไม่ได้ยืนยันว่าคืนเงินแล้ว กรุณาติดตามการคืนเงินกับผู้จัดโดยตรง'
          : order.status === 'disputed' ? order.verificationIssue === 'duplicate_transaction_reference' ? 'เลขอ้างอิงธุรกรรมนี้ถูกใช้กับคำสั่งซื้ออื่น ระบบจึงยังไม่ยืนยันการชำระเงินหรือออกบัตร กรุณาติดต่อผู้จัดพร้อมเลขคำสั่งซื้อนี้' : 'ระบบยังไม่ออกบัตรอัตโนมัติ ผู้จัดต้องตรวจยอดเงินจริงและจำนวนบัตรก่อน กรุณาติดต่อผู้จัดพร้อมเลขคำสั่งซื้อนี้'
          : order.status === 'expired' ? 'อย่าโอนเงินจาก QR เดิม หากโอนก่อนหมดเวลาแล้ว โปรดติดต่อผู้จัดพร้อมหลักฐานและเลขคำสั่งซื้อ'
          : order.status === 'paid' ? 'คำสั่งซื้อนี้ยืนยันแล้ว บัตรจะแสดงในกระเป๋าบัตรของคุณ' : 'ไม่สามารถกลับไปชำระคำสั่งซื้อนี้ได้';
        modal(`<section class="order-status-view"><span class="payment-eyebrow">SOURCEWAV TICKETS · #${esc(orderRef)}</span><h2 id="modalTitle">${esc(title)}</h2><p>${esc(message)}</p>${order.latestReview?.note ? `<p class="order-review-note">หมายเหตุจากผู้จัด: ${esc(order.latestReview.note)}</p>` : ''}${order.status === 'disputed' && order.organizerId ? `<button type="button" class="modal-secondary" data-order-contact="${esc(order.organizerId)}" data-order-ref="${esc(orderRef)}" data-name="${esc(order.organizerName || 'ผู้จัดงาน')}">ติดต่อผู้จัดพร้อมเลขคำสั่งซื้อ</button>` : ''}<button type="button" class="modal-primary" data-back-to-tickets>กลับไปบัตรของฉัน</button></section>`);
        $('#modalContent [data-back-to-tickets]')?.addEventListener('click', openMyTickets);
        if (order.status === 'paid') openMyTickets();
        return;
      }
      const item = order.items?.[0] || {};
      showManualPayment({
        orderId: order.orderId, eventId: order.eventId, eventTitle: order.eventTitle,
        startsAt: order.startsAt, endsAt: order.endsAt, venueName: order.venueName, venueAddress: order.venueAddress,
        tierName: item.tierName || 'บัตรเข้างาน', quantity: item.quantity || 1,
        totalMinor: order.totalMinor, expiresAt: order.expiresAt, paymentQrUrl: order.paymentQrUrl, organizerName: order.organizerName,
        bankName: order.bankName, beneficiaryName: order.recipientName, accountLast4: order.accountLast4,
        latestSubmission: order.latestSubmission, verificationStatus: order.verificationStatus,
        verificationIssue: order.verificationIssue, organizerId: order.organizerId,
      });
    } catch (error) { toast(error.message || 'เปิดคำสั่งซื้อไม่ได้'); }
    finally { if (trigger?.isConnected) { trigger.disabled = false; trigger.removeAttribute('aria-busy'); } }
  }

  function showOrderVerifying(order) {
    clearInterval(paymentTimer);
    const ref = order.orderId.replace(/-/g, '').slice(-8).toUpperCase();
    modal(`<section class="order-status-view"><span class="payment-eyebrow">SOURCEWAV TICKETS · #SW-${esc(ref)}</span><h2 id="modalTitle">กำลังตรวจสอบสลิป</h2><p>ระบบรับสลิปแล้ว กำลังรอผลตรวจจาก SlipOK <strong>ไม่ต้องโอนหรือส่งสลิปซ้ำ</strong></p><button type="button" class="modal-primary" id="refreshOrderVerification">ตรวจสอบสถานะล่าสุด</button></section>`);
    $('#refreshOrderVerification')?.addEventListener('click', () => resumeTicketOrder(order.orderId));
  }

  function showLateSlipUpload(order) {
    clearInterval(paymentTimer);
    const ref = order.orderId.replace(/-/g, '').slice(-8).toUpperCase();
    const item = order.items?.[0] || {};
    const eventDate = order.startsAt ? new Date(order.startsAt).toLocaleString('th-TH', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'ยังไม่ระบุวัน';
    const followUp = verificationFollowUp(order);
    const contact = followUp && order.organizerId
      ? `<button type="button" class="modal-secondary" data-order-contact="${esc(order.organizerId)}" data-order-ref="SW-${esc(ref)}" data-name="${esc(order.organizerName || 'ผู้จัดงาน')}">ติดต่อผู้จัดพร้อมเลขคำสั่งซื้อ</button>`
      : '';
    const waitForOrganizer = ['invalid_slipok_credentials', 'quota_exhausted'].includes(order.verificationIssue)
      || order.verificationStatus === 'quota_exhausted';
    modal(`<section class="manual-payment late-slip-upload">
      <header class="payment-heading"><span class="payment-eyebrow">SOURCEWAV TICKETS · #SW-${esc(ref)}</span><h2 id="modalTitle">ส่งสลิปของคำสั่งซื้อที่หมดเวลา</h2><p>${esc(order.eventTitle)} · ${esc(item.tierName || 'บัตรเข้างาน')} × ${Number(item.quantity || 1)}</p><p class="payment-event-meta">${esc(eventDate)} · ${esc(order.venueName || 'ยังไม่ระบุสถานที่')}${order.venueAddress ? ` · ${esc(order.venueAddress)}` : ''}</p></header>
      <p class="order-retry-note">QR นี้หมดเวลาจองแล้ว อย่าโอนซ้ำ หากคุณโอนก่อนหมดเวลา ระบบจะตรวจเวลาธุรกรรมจาก SlipOK; ถ้าโอนหลังหมดเวลา รายการจะส่งให้ผู้จัดตรวจยอดและจำนวนบัตรก่อน</p>
      ${followUp ? `<p class="order-retry-note" role="status">${esc(followUp)}</p>${contact}` : ''}
      <div class="payment-details"><div class="checkout-row"><span>ยอดคำสั่งซื้อ</span><b>${esc(money(order.totalMinor))}</b></div>${order.organizerName ? `<div class="checkout-row"><span>ผู้จัดงาน</span><b>${esc(order.organizerName)}</b></div>` : ''}<div class="checkout-row"><span>ธนาคารผู้รับ</span><b>${esc(order.bankName || '—')}</b></div><div class="checkout-row"><span>ชื่อบัญชีรับเงิน</span><b>${esc(order.recipientName || '—')}</b></div>${order.accountLast4 ? `<div class="checkout-row"><span>เลขบัญชีลงท้าย</span><b>•••• ${esc(order.accountLast4)}</b></div>` : ''}<div class="checkout-row"><span>หมดเวลาจอง</span><b>${esc(new Date(order.expiresAt).toLocaleString('th-TH'))}</b></div></div>
      <form id="ticketSlipForm" data-order-id="${esc(order.orderId)}"><label class="modal-field">แนบสลิปต้นฉบับที่ใช้โอน<input id="ticketSlipFile" type="file" accept="image/jpeg,image/png,image/webp,image/jfif" ${waitForOrganizer ? 'disabled' : ''} required /><small>JPG, PNG, JFIF หรือ WebP ไม่เกิน 5 MB · ส่งได้ไม่เกิน 5 ครั้งต่อคำสั่งซื้อ</small></label><button class="modal-primary" id="submitTicketSlip" type="submit" ${waitForOrganizer ? 'disabled' : ''}>${waitForOrganizer ? 'รอผู้จัดตรวจสอบ' : 'ตรวจสอบเวลาโอนและส่งให้ผู้จัดหากจำเป็น'}</button></form>${order.eventStatus === 'published' ? '<button class="modal-secondary" id="startNewTicketOrder" type="button">หากยังไม่ได้โอน · เลือกบัตรใหม่</button>' : ''}<div id="ticketSlipResult" role="status" aria-live="polite"></div>
    </section>`);
    $('#startNewTicketOrder')?.addEventListener('click', () => { closeModal(); openTicketPurchase(order.eventId); });
  }

  function showVerifiedOrderRecovery(order) {
    clearInterval(paymentTimer);
    const ref = order.orderId.replace(/-/g, '').slice(-8).toUpperCase();
    modal(`<section class="order-status-view order-verified-view"><span class="payment-eyebrow">SOURCEWAV TICKETS · #SW-${esc(ref)}</span><h2 id="modalTitle">ยืนยันการชำระเงินแล้ว</h2><p>SlipOK ตรวจสอบการโอนแล้ว ระบบกำลังกู้คืนคำสั่งซื้อ <strong>ไม่ต้องชำระเงินซ้ำ</strong></p><p>${esc(order.eventTitle)} · ${esc(money(order.totalMinor))}</p><button type="button" class="modal-primary" id="retryTicketIssue">กู้คืนและจัดเตรียมบัตร</button><div id="orderRecoveryStatus" role="status" aria-live="polite"></div></section>`);
    $('#retryTicketIssue')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true; button.textContent = 'กำลังจัดเตรียมบัตร…';
      const status = $('#orderRecoveryStatus');
      try {
        const result = await call('finalize-ticket-payment', { submissionId: order.latestSubmission?.id, attemptId: order.verifiedAttemptId });
        if (result.status === 'paid') { closeModal(); toast('บัตรของคุณพร้อมใช้งานแล้ว'); openMyTickets(); return; }
        if (result.status === 'review_required') {
          if (status) status.textContent = `${result.message} · ไม่ต้องชำระเงินซ้ำ`;
          button.remove();
          return;
        }
        throw new Error(result.error || 'ระบบยังจัดเตรียมบัตรไม่สำเร็จ');
      } catch (error) {
        if (status) status.textContent = `${error.message} · การชำระเงินยืนยันแล้ว ไม่ต้องโอนซ้ำ`;
        button.disabled = false; button.textContent = 'ลองจัดเตรียมบัตรอีกครั้ง';
      }
    });
  }

  async function openMyTickets() {
    if (ticketsOpening) return;
    ticketsOpening = true;
    const trigger = $('#myTicketsBtn');
    if (trigger) { trigger.disabled = true; trigger.setAttribute('aria-busy', 'true'); }
    modal('<div class="my-tickets-page"><div class="tickets-load-state" role="status" aria-live="polite"><span class="tickets-load-spinner" aria-hidden="true"></span><h2 id="modalTitle">กำลังเปิดบัตรของคุณ</h2><p>กำลังโหลดกระเป๋าบัตร…</p></div></div>');
    try {
    const previewMode = location.hostname === 'localhost' && new URLSearchParams(location.search).get('preview') === 'tickets';
    const { data: auth } = previewMode ? { data: { user: { id: 'local-ticket-preview' } } } : await db.auth.getUser();
    const user = auth.user;
      const previewTickets = [{
        id: 'local-preview-ticket', status: 'valid', issued_at: '2026-08-18T12:00:00+07:00', qr_payload: 'SOURCEWAV-LOCAL-PREVIEW',
        events: { title: 'SUMMER ECHO FESTIVAL', category: 'music', starts_at: '2026-11-14T18:00:00+07:00', venue_name: 'IMPACT ARENA', venue_address: 'อิมแพ็ค เมืองทองธานี', status: 'published' },
        order_items: { unit_price_minor: 250000, ticket_types: { name: 'Zone A · Row 12 · Seat 34' }, orders: { id: 'SW-92481', created_at: '2026-08-18T12:00:00+07:00' } }
      }];
      const { tickets = previewTickets } = previewMode ? {} : user ? await call('my-tickets', {}) : { tickets: [] };
      const orderResult = previewMode || !user ? { orders: [] } : await call('my-orders', {}).catch(error => ({ orders: [], error }));
      const orders = orderResult.orders || [];
      const avatarResult = previewMode || !user ? { avatarUrl: '' } : await db.from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => ({ avatarUrl: data?.avatar_url || '' }))
        .catch(() => ({ avatarUrl: '' }));
      const avatarUrl = (() => { try { const url = new URL(avatarResult.avatarUrl || ''); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } })();
      const avatarLetter = esc(user?.user_metadata?.display_name?.slice?.(0, 1) || 'ม');
      const avatarHtml = avatarUrl ? `<img src="${esc(avatarUrl)}" alt="" loading="lazy" />` : avatarLetter;
      const classify = ticket => {
        if (ticket.status === 'checked_in') return 'used';
        if (['cancelled', 'refunded'].includes(ticket.status) || ticket.events?.status === 'cancelled') return 'cancelled';
        return 'valid';
      };
      const when = value => value && !Number.isNaN(new Date(value).getTime())
        ? new Date(value).toLocaleString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'ยังไม่ระบุวัน';
      const shortDate = value => value && !Number.isNaN(new Date(value).getTime())
        ? new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      const ticketCards = tickets.map((ticket, index) => {
        const state = classify(ticket);
        const status = state === 'valid' ? 'ยังไม่ถึงวันงาน' : state === 'used' ? 'ใช้แล้ว' : 'ยกเลิกแล้ว';
        const venue = ticket.events?.venue_name || ticket.events?.venues?.name || 'ยังไม่ระบุสถานที่';
        const address = ticket.events?.venue_address || ticket.events?.venues?.address || '';
        const date = when(ticket.events?.starts_at || ticket.issued_at);
        const order = ticket.order_items?.orders || {};
        const ticketType = ticket.order_items?.ticket_types?.name || 'General Admission';
        const cover = ticket.events?.cover_url || 'assets/tickets-live-cover.svg';
        const orderId = String(order.id || ticket.id).replace(/-/g, '').slice(-5).toUpperCase();
        return `<article class="my-ticket ticket-state-${state}" data-ticket-id="${esc(ticket.id)}" data-ticket-state="${state}">
          <div class="ticket-art"><img src="${esc(cover)}" alt="ภาพปกงาน ${esc(ticket.events?.title || '')}" loading="lazy"><span>บัตรอีเวนต์ · ${esc(new Date(ticket.events?.starts_at || ticket.issued_at).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }))}</span></div>
          <div class="ticket-copy"><span class="ticket-status">${status}</span><h3>${esc(ticket.events?.title || 'Live event')}</h3>
            <p class="ticket-detail-line"><i aria-hidden="true">♙</i>${esc(ticketType)}</p>
            <p class="ticket-detail-line"><i aria-hidden="true">⌖</i>${esc(venue)}${address ? ` · ${esc(address)}` : ''}</p>
            <p class="ticket-detail-line"><i aria-hidden="true">▦</i>${esc(date)}</p>
            ${ticket.order_items?.unit_price_minor != null ? `<p class="ticket-price">${esc(money(ticket.order_items.unit_price_minor))} THB</p>` : ''}
            <button type="button" class="ticket-detail-toggle" aria-expanded="false">รายละเอียดบัตร</button>
            <div class="ticket-extra" hidden><span>ประเภทบัตร</span><strong>${esc(ticketType)}</strong><span>ออกบัตรเมื่อ</span><strong>${esc(when(ticket.issued_at))}</strong><span>ที่อยู่</span><strong>${esc(address || venue)}</strong></div>
          </div>
          <aside class="ticket-qr-panel">${state === 'valid' ? `<div class="ticket-qr" data-qr="${esc(ticket.qr_payload)}"></div><small>สแกนเข้างาน</small>` : `<span class="ticket-qr-state">${state === 'used' ? 'บัตรนี้ใช้แล้ว' : 'บัตรนี้ถูกยกเลิก'}</span>`}</aside>
          <footer class="ticket-order-summary">${index + 1} จาก ${tickets.length} ใบ <span>·</span> คำสั่งซื้อ #SW-${orderId} <span>·</span> ซื้อเมื่อ ${shortDate(order.created_at || ticket.issued_at)}</footer>
        </article>`;
      }).join('');
      const statusFilters = [['all','ทั้งหมด','▱'],['valid','ยังไม่ถึงวันงาน','▦'],['used','ใช้แล้ว','✓'],['cancelled','ยกเลิก','×']];
      const counts = Object.fromEntries(statusFilters.map(([key]) => [key, key === 'all' ? tickets.length : tickets.filter(ticket => classify(ticket) === key).length]));
      const orderLabel = order => {
        if (order.status === 'paid') return ['ชำระแล้ว · บัตรพร้อมใช้งาน', 'paid'];
        if (order.status === 'disputed' && order.latestReview?.decision === 'rejected') return ['ผู้จัดปฏิเสธ · ประสานคืนเงิน', 'review'];
        if (order.status === 'disputed') return ['ต้องตรวจเพิ่มเติม · ติดต่อผู้จัด', 'review'];
        if (order.verificationStatus === 'processing') return ['กำลังตรวจสอบสลิป', 'pending'];
        if (order.latestSubmission?.status === 'verified' || order.verifiedAttemptId) return ['ยืนยันการชำระแล้ว · กำลังกู้คืนบัตร', 'pending'];
        if (['timeout','error','quota_exhausted'].includes(order.verificationStatus)) return ['ผลตรวจยังไม่ยืนยัน · อย่าโอนซ้ำ', 'attention'];
        if (order.latestSubmission?.status === 'rejected') return ['ตรวจสลิปไม่ผ่าน · ส่งใหม่ได้', 'attention'];
        if (order.status === 'expired') return ['หมดเวลาชำระ · ส่งสลิปที่โอนแล้วได้', 'closed'];
        if (order.status === 'cancelled') return ['ยกเลิกแล้ว', 'closed'];
        if (order.status === 'refunded') return ['คืนเงินแล้ว', 'closed'];
        return ['รอชำระเงิน', 'pending'];
      };
      const orderCards = orders.map(order => {
        const [label, tone] = orderLabel(order);
        const item = order.items?.[0] || {};
        const orderRef = order.orderId.replace(/-/g, '').slice(-8).toUpperCase();
        const canResume = order.status === 'expired' || order.status === 'awaiting_payment' && order.verificationStatus !== 'processing';
        const nextAction = order.verifiedAttemptId ? 'กู้คืนรายการ' : order.latestSubmission?.status === 'verified' ? 'ลองออกบัตร' : order.latestSubmission?.status === 'rejected' ? 'ส่งสลิปใหม่' : order.status === 'expired' ? 'ส่งสลิปที่โอนแล้ว' : 'เปิดคำสั่งซื้อ';
        return `<article class="my-order-card" data-order-id="${esc(order.orderId)}">
          <div><span class="my-order-status is-${tone}">${esc(label)}</span><h4>${esc(order.eventTitle)}</h4><p>${esc(item.tierName || 'บัตรเข้างาน')} × ${Number(item.quantity || 0)} · ${esc(when(order.startsAt))}</p><p class="my-order-venue">${esc(order.venueName || 'ยังไม่ระบุสถานที่')}${order.venueAddress ? ` · ${esc(order.venueAddress)}` : ''}</p><small>คำสั่งซื้อ #SW-${orderRef} · ${esc(shortDate(order.createdAt))}</small>${order.latestReview?.decision === 'rejected' && order.latestReview.note ? `<p class="my-order-review-note">เหตุผลจากผู้จัด: ${esc(order.latestReview.note)}</p>` : ''}<details class="my-order-policy"><summary>เงื่อนไขการยกเลิกและคืนเงิน</summary><p>${esc(order.refundPolicy || 'ยังไม่ได้ระบุเงื่อนไขโดยละเอียด กรุณาติดต่อผู้จัดงาน')}</p></details></div>
          <div class="my-order-total"><b>${esc(money(order.totalMinor))}</b>${canResume ? `<button type="button" data-order-resume="${esc(order.orderId)}">${nextAction} ↗</button>` : ''}${order.organizerId ? `<button type="button" class="my-order-contact" data-order-contact="${esc(order.organizerId)}" data-order-ref="SW-${orderRef}" data-name="${esc(order.organizerName || 'ผู้จัดงาน')}">ติดต่อผู้จัด</button>` : ''}</div>
        </article>`;
      }).join('');
      modal(`<div class="my-tickets-page tickets-shell">
        <aside class="tickets-sidebar">
          <a class="tickets-sidebar-brand" href="#home" data-ticket-nav="home" aria-label="Sourcewav หน้าแรก"><img src="assets/sourcewav-logo.svg" alt="SOURCEWAV" /></a>
          <nav aria-label="เมนูบัตรของฉัน">
            <a href="#home" data-ticket-nav="home"><span aria-hidden="true">⌂</span>หน้าแรก</a>
            <a href="#events" data-ticket-nav="events"><span aria-hidden="true">⌕</span>ค้นหาอีเวนต์</a>
            <a href="#my-tickets" class="is-current" aria-current="page"><span aria-hidden="true">▣</span>บัตรของฉัน</a>
            <button type="button" data-ticket-profile><span aria-hidden="true">⚙</span>บัญชีของฉัน</button>
          </nav>
          <div class="tickets-sidebar-note"><span>SUPPORT THE SCENE</span><b>เพลงพาเรา<br>มาเจอกัน</b><small>พื้นที่ของคนรักดนตรีและชุมชนอิสระ</small></div>
          <footer>© 2026 Sourcewav<br><span>Music lives deeper.</span></footer>
        </aside>
        <div class="tickets-main">
          <header class="tickets-topbar"><span>COMMUNITY <i>/</i> MY TICKETS</span><button type="button" data-ticket-profile><span class="tickets-avatar${avatarUrl ? ' has-avatar-image' : ''}" aria-hidden="true">${avatarHtml}</span><span>บัญชีของฉัน</span><b aria-hidden="true">⌄</b></button></header>
          <section class="tickets-page-hero" aria-label="Sourcewav community"><div><span>PLAY · CONNECT · SUPPORT</span><h1>REAL MUSIC<br>REAL PEOPLE</h1><p>ดนตรี ผู้คน และช่วงเวลาที่ได้เจอกัน</p></div><span class="tickets-hero-mark" aria-hidden="true">SW</span></section>
          <div class="tickets-page-content">
            <header class="my-tickets-heading"><div><span class="tickets-section-kicker">MY LIBRARY</span><h2 id="modalTitle">บัตรของฉัน</h2><p>จัดการบัตรสมาชิก บัตรอีเวนต์ และสิทธิพิเศษของคุณ</p></div><button type="button" class="tickets-add-button" data-ticket-nav="events"><span aria-hidden="true">＋</span> เพิ่มบัตร</button></header>
            <section class="my-orders-section" aria-labelledby="myOrdersTitle"><div class="tickets-list-heading"><h3 id="myOrdersTitle">คำสั่งซื้อ</h3><span>${orders.length} รายการ</span></div>${orderResult.error ? `<p class="my-orders-unavailable" role="status">ยังโหลดสถานะคำสั่งซื้อไม่ได้ · ${esc(orderResult.error.message)}</p>` : orderCards || '<p class="my-orders-empty">คำสั่งซื้อและสถานะการชำระเงินจะแสดงที่นี่</p>'}<p class="my-orders-support">เงินชำระเข้าบัญชีผู้จัดโดยตรง · ใช้ปุ่ม “ติดต่อผู้จัด” เพื่อติดตามพร้อมเลขคำสั่งซื้อ · การปฏิเสธรายการไม่ได้ยืนยันว่าคืนเงินแล้ว ผู้จัดเป็นผู้ประสานการคืนเงินโดยตรง</p></section>
            <div class="tickets-list-heading"><h3>บัตรทั้งหมด</h3><span>${tickets.length} ใบ</span></div>
            <div class="ticket-filters" role="group" aria-label="กรองบัตรตามสถานะ">${statusFilters.map(([key,label,icon]) => `<button type="button" class="ticket-filter${key === 'all' ? ' is-active' : ''}" data-ticket-filter="${key}" aria-pressed="${key === 'all'}"><span class="ticket-filter-icon" aria-hidden="true">${icon}</span><span>${label}</span><b>${counts[key]}</b></button>`).join('')}</div>
            <div class="my-ticket-list">${ticketCards || `<div class="tickets-empty"><h3>${user ? 'ยังไม่มีบัตรในกระเป๋า' : 'เข้าสู่ระบบเพื่อดูบัตรของคุณ'}</h3><p>${user ? 'บัตรที่ซื้อสำเร็จจะแสดงอยู่ที่นี่' : 'บัตรที่ซื้อสำเร็จจะแสดงอยู่ที่นี่ เมื่อเข้าสู่ระบบด้วยบัญชีที่ใช้ซื้อบัตร'}</p>${user ? '<button type="button" class="ticket-login-action" data-ticket-nav="events">เลือกดูอีเวนต์</button>' : '<button type="button" class="ticket-login-action" data-ticket-login>เข้าสู่ระบบ</button>'}</div>`}</div>
            <div class="tickets-filter-empty" hidden>ไม่มีบัตรในหมวดนี้</div>
          </div>
        </div>
      </div>`);
      const host = $('#modalContent');
      host.querySelectorAll('.tickets-avatar img').forEach(image => image.addEventListener('error', () => {
        const avatar = image.closest('.tickets-avatar');
        avatar.classList.remove('has-avatar-image');
        avatar.textContent = avatarLetter;
      }, { once: true }));
      host.querySelectorAll('.ticket-qr').forEach(node => { if (window.QRCode && node.dataset.qr) new QRCode(node, { text: node.dataset.qr, width: 148, height: 148, correctLevel: QRCode.CorrectLevel.M }); });
      host.querySelectorAll('[data-ticket-filter]').forEach(button => button.addEventListener('click', () => {
        host.querySelectorAll('[data-ticket-filter]').forEach(filter => { const active = filter === button; filter.classList.toggle('is-active', active); filter.setAttribute('aria-pressed', String(active)); });
        const filterKey = button.dataset.ticketFilter;
        const cards = [...host.querySelectorAll('.my-ticket')];
        cards.forEach(card => { card.hidden = filterKey !== 'all' && card.dataset.ticketState !== filterKey; });
        const noMatches = cards.length > 0 && cards.every(card => card.hidden);
        host.querySelector('.tickets-filter-empty').hidden = !noMatches;
      }));
      host.querySelectorAll('.ticket-detail-toggle').forEach(button => button.addEventListener('click', () => {
        const target = button.closest('.my-ticket').querySelector('.ticket-extra');
        const expanded = button.getAttribute('aria-expanded') === 'true';
        target.hidden = expanded; button.setAttribute('aria-expanded', String(!expanded));
        button.textContent = expanded ? 'รายละเอียดบัตร' : 'ซ่อนรายละเอียด';
      }));
      host.querySelectorAll('[data-order-resume]').forEach(button => button.addEventListener('click', () => resumeTicketOrder(button.dataset.orderResume, button)));
      host.querySelectorAll('[data-ticket-nav]').forEach(link => link.addEventListener('click', event => {
        event.preventDefault();
        const destination = link.dataset.ticketNav;
        closeModal();
        if (destination === 'events') document.querySelector('#events')?.scrollIntoView({ behavior: 'smooth' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      }));
      host.querySelector('[data-ticket-login]')?.addEventListener('click', () => { closeModal(); $('#profileBtn')?.click(); });
      host.querySelector('[data-ticket-profile]')?.addEventListener('click', () => { closeModal(); $('#profileBtn')?.click(); });
    } catch (error) {
      const host = $('#modalContent');
      if (host) {
        host.innerHTML = `<section class="tickets-load-error" role="alert"><span aria-hidden="true">!</span><h2 id="modalTitle">เปิดบัตรของฉันไม่ได้</h2><p>${esc(error.message || 'โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง')}</p><button type="button" id="ticketsRetry">ลองอีกครั้ง</button></section>`;
        $('#ticketsRetry')?.addEventListener('click', openMyTickets);
      }
    } finally {
      ticketsOpening = false;
      if (trigger) { trigger.disabled = false; trigger.removeAttribute('aria-busy'); }
    }
  }
  $('#myTicketsBtn')?.addEventListener('click', event => {
    event.preventDefault();
    openMyTickets();
  });

  async function openScan() {
    const user = await needUser(); if (!user) return;
    modal(`<h2 id="modalTitle">สแกนบัตรเข้างาน</h2><p>เฉพาะ Organizer ของงานหรือผู้ดูแลระบบ</p><div class="scanner-wrap"><video id="ticketCamera" playsinline muted></video></div><div id="scanResult" role="status">กดเปิดกล้องเพื่อเริ่มสแกน</div><div class="scanner-actions"><button class="modal-primary" id="startCamera">เปิดกล้อง</button><button class="outline-btn" id="stopCamera">ปิดกล้อง</button></div><label class="modal-field">หรือวางรหัส QR<input id="manualTicketCode" autocomplete="off" placeholder="รหัสบัตร" /></label><button class="outline-btn" id="validateManual">ตรวจบัตร</button>`);
    $('#startCamera').onclick = startCamera;
  }
  async function validateQR(qrPayload) {
    $('#scanResult').textContent = 'กำลังตรวจสอบ…';
    try {
      const result = await call('validate-ticket', { qrPayload });
      const message = result.result === 'accepted' ? `✓ ผ่าน · ${result.event_title || 'ยืนยันแล้ว'}` : result.result === 'already_used' ? 'บัตรนี้ถูกใช้ไปแล้ว' : 'ไม่พบบัตรหรือ QR ไม่ถูกต้อง';
      $('#scanResult').textContent = message; $('#scanResult').dataset.state = result.result;
    } catch (error) { $('#scanResult').textContent = error.message; }
  }
  async function startCamera() {
    if (!('BarcodeDetector' in window)) { $('#scanResult').textContent = 'เบราว์เซอร์นี้ไม่รองรับการอ่าน QR จากกล้อง กรุณาใช้ช่องวางรหัสด้านล่าง'; return; }
    try {
      scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const video = $('#ticketCamera'); video.srcObject = scannerStream; await video.play(); scannerRunning = true;
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const scan = async () => { if (!scannerRunning || !video.isConnected) return; try { const codes = await detector.detect(video); if (codes.length && codes[0].rawValue) { scannerRunning = false; await stopCamera(); await validateQR(codes[0].rawValue); return; } } catch (_) {} requestAnimationFrame(scan); };
      scan();
    } catch (error) { $('#scanResult').textContent = `เปิดกล้องไม่ได้: ${error.message}`; }
  }
  async function stopCamera() { scannerRunning = false; scannerStream?.getTracks().forEach(track => track.stop()); scannerStream = null; const video = $('#ticketCamera'); if (video) video.srcObject = null; }

  let eventFormOpening = false;
  async function openCreateEvent() {
    const page = $('#eventSellPage');
    if (page && !page.hidden && $('#newEventTitle', page)) return;
    if (eventFormOpening) return;
    eventFormOpening = true;
    if (!await needUser()) { eventFormOpening = false; return; }
    modal(`<div class="ticket-sell-modal">
      <header class="ticket-sell-heading">
        <div class="ticket-sell-title-row"><img class="ticket-sell-logo" src="assets/sourcewav-logo.svg" alt="Sourcewav" /><div><span class="ticket-sell-eyebrow">SELL YOUR EVENT · SOURCEWAV LIVE</span><h2 id="modalTitle">เปิดขายบัตรงานของคุณ</h2></div></div>
        <p>สร้างหน้ากิจกรรม ตั้งค่าบัตร และรับชำระเงินจากบัญชีของคุณโดยตรง</p>
      </header>
      <section class="ticket-sell-section">
        <div class="ticket-sell-section-heading"><span class="ticket-sell-icon-ticket" aria-hidden="true"><svg viewBox="0 0 48 38" focusable="false"><defs><linearGradient id="sellTicketBody" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e9dcff"/><stop offset=".48" stop-color="#bda4f2"/><stop offset="1" stop-color="#8e77d0"/></linearGradient><linearGradient id="sellTicketGlass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".72"/><stop offset=".52" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#65509b" stop-opacity=".18"/></linearGradient></defs><path d="M8 5h32v7a5 5 0 0 0 0 10v7H8v-7a5 5 0 0 0 0-10V5Z" fill="url(#sellTicketBody)" stroke="#f5efff" stroke-opacity=".92" stroke-width="1.5"/><path d="M10 7h28v5.7a7 7 0 0 0 0 13.6V27H10v-3.7a7 7 0 0 0 0-13.6V7Z" fill="url(#sellTicketGlass)"/><path d="M24 9v16" stroke="#654e9e" stroke-opacity=".5" stroke-width="1.3" stroke-dasharray="2 2"/><path d="m16 13 .9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3.9-1.9Z" fill="#fff" fill-opacity=".95"/><circle cx="33" cy="17" r="1.1" fill="#fff" fill-opacity=".82"/></svg></span><div><h3>รายละเอียดงาน</h3><p>บอกให้คนในชุมชนรู้ว่าจะได้พบกับอะไร</p></div></div>
        <label class="modal-field">ชื่องาน<input id="newEventTitle" maxlength="180" required placeholder="เช่น Bangkok Underground Night" /></label>
        <div class="ticket-sell-grid">
          <label class="modal-field">ประเภทงาน<select id="newEventCategory"><option value="music">ดนตรี</option><option value="art">ศิลปะ</option><option value="community">คอมมูนิตี้</option><option value="market">ตลาด</option></select></label>
          <label class="modal-field">ชื่อสถานที่<input id="newEventVenue" maxlength="160" required placeholder="เช่น Warehouse 30" /></label>
          <label class="modal-field">วันและเวลาเริ่ม<input id="newEventStarts" type="datetime-local" step="60" required /><small>คลิกช่องหรือไอคอนเพื่อเลือกวันและเวลา</small></label>
          <label class="modal-field">วันและเวลาจบ<input id="newEventEnds" type="datetime-local" step="60" required /><small>เลือกเวลาจบหลังเวลาเริ่มงาน</small></label>
        </div>
        <label class="modal-field">ที่อยู่สถานที่<input id="newEventAddress" maxlength="400" required placeholder="ที่อยู่สำหรับผู้เข้าร่วมงาน" /></label>
        <div class="event-poster-upload"><label class="modal-field">โปสเตอร์งาน (สูงสุด 4 รูป)<input id="newEventPoster" type="file" accept="image/jpeg,image/png,image/webp" multiple /><small>เลือกได้ไม่เกิน 4 รูป · แนวตั้ง 2:3 แนะนำ 1200 × 1800 px · JPG, PNG หรือ WebP · รูปละไม่เกิน 5 MB</small><span id="eventPosterSelectionCount" class="event-poster-selection-count" aria-live="polite">ยังไม่ได้เลือกรูป</span></label><div class="event-poster-preview-grid" id="eventPosterPreviewGrid" aria-label="ตัวอย่างโปสเตอร์"><div class="event-poster-preview"><span>รูปที่ 1</span></div><div class="event-poster-preview"><span>รูปที่ 2</span></div><div class="event-poster-preview"><span>รูปที่ 3</span></div><div class="event-poster-preview"><span>รูปที่ 4</span></div></div></div>
        <label class="modal-field">รายละเอียดงาน<textarea id="newEventDescription" maxlength="5000" placeholder="ไลน์อัป กำหนดการ หรือข้อมูลที่อยากให้ผู้ชมทราบ"></textarea><small>ไม่เกิน 5,000 ตัวอักษร</small></label>
        <label class="modal-field">เงื่อนไขการยกเลิกและคืนเงิน<textarea id="newEventRefundPolicy" maxlength="2000" minlength="10" required placeholder="อธิบายกรณีที่คืนเงินได้ วิธีติดต่อผู้จัด และระยะเวลาดำเนินการ"></textarea><small>ผู้ซื้อจะเห็นข้อความนี้ก่อนชำระเงิน และจะถูกบันทึกไว้กับคำสั่งซื้อ</small></label>
      </section>
      <section class="ticket-sell-section ticket-sell-inventory">
        <div class="ticket-sell-section-heading"><span aria-hidden="true">▣</span><div><h3>ประเภทและจำนวนบัตร</h3><p>กำหนดราคาและจำนวนที่เปิดขาย</p></div></div>
        <div class="ticket-sell-grid ticket-sell-tier-grid">
          <label class="modal-field">ชื่อประเภทบัตร<input id="newTierName" value="บัตรทั่วไป" maxlength="100" /></label>
          <label class="modal-field">ราคา (บาท)<input id="newTierPrice" type="number" min="20" max="150000" step="1" value="250" /></label>
          <label class="modal-field">จำนวนบัตร<input id="newTierStock" type="number" min="1" max="10000" value="100" /></label>
        </div>
        <p class="ticket-sell-assurance"><span aria-hidden="true">✓</span> ผู้จัดรับเงินตรง · SlipOK ตรวจสอบสลิปก่อนออกบัตรอัตโนมัติ</p>
      </section>
      <section class="ticket-sell-section ticket-payment-settings">
        <div class="ticket-sell-section-heading"><span aria-hidden="true">◈</span><div><h3>บัญชีรับเงินและ SlipOK</h3><p>ใช้ข้อมูลบัญชีเดียวกับ QR ที่ผู้ซื้อจะสแกนชำระ</p></div><span class="ticket-sell-secure">ปลอดภัย</span></div>
        <div class="ticket-sell-grid">
          <label class="modal-field">ธนาคาร / PromptPay<input id="newPaymentBank" maxlength="80" required placeholder="เช่น กสิกรไทย / PromptPay" /></label>
          <label class="modal-field">ชื่อบัญชีผู้รับเงิน<input id="newPaymentBeneficiary" maxlength="120" required placeholder="ชื่อที่ตรงกับบัญชีธนาคาร" /></label>
          <label class="modal-field">เลขบัญชี 4 ตัวท้าย<input id="newPaymentLast4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="ไม่บังคับ" /></label>
          <label class="modal-field ticket-qr-upload">QR Code รับเงิน<input id="newPaymentQr" type="file" accept="image/jpeg,image/png,image/webp" required /><small>JPG, PNG หรือ WebP · ไม่เกิน 5 MB</small></label>
          <label class="modal-field">SlipOK Branch ID<input id="newSlipOkBranch" maxlength="200" inputmode="text" autocomplete="off" required placeholder="เลข Branch ID หรือวาง URL จาก SlipOK" /><small>วาง URL รูปแบบ https://api.slipok.com/api/line/apikey/… ได้ ระบบจะดึงเลข Branch ID ให้อัตโนมัติ</small></label>
          <label class="modal-field">SlipOK API Key<input id="newSlipOkApiKey" type="password" maxlength="512" autocomplete="new-password" required placeholder="API Key ของ Branch นี้" /></label>
        </div>
        <p class="payment-credential-note">API Key จะถูกส่งไปเข้ารหัสบนเซิร์ฟเวอร์และไม่ถูกเก็บไว้ในหน้าเว็บ ต้องใช้ Branch ID และ API Key ที่ตรงกับบัญชีผู้รับเงินใน QR</p>
      </section>
      <footer class="ticket-sell-footer"><span>ตรวจข้อมูลและบัญชีรับเงินก่อนเผยแพร่</span><button class="modal-primary" id="publishEvent" type="button"><span>เผยแพร่งานและเปิดขายบัตร</span><b aria-hidden="true">↗</b></button></footer>
    </div>`);
    const startsInput = $('#newEventStarts');
    const endsInput = $('#newEventEnds');
    const localDateTimeNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    startsInput.min = localDateTimeNow();
    startsInput.addEventListener('change', () => { endsInput.min = startsInput.value || localDateTimeNow(); });
    endsInput.min = startsInput.value || localDateTimeNow();
    [startsInput, endsInput].forEach(input => input.addEventListener('click', () => {
      if (typeof input.showPicker === 'function') {
        try { input.showPicker(); } catch { /* Native picker may already be open. */ }
      }
    }));
    $('#newEventPoster')?.addEventListener('change', event => {
      const files = [...(event.currentTarget.files || [])];
      const count = $('#eventPosterSelectionCount');
      const previews = $$('#eventPosterPreviewGrid .event-poster-preview');
      eventPosterPreviewUrls.forEach(url => URL.revokeObjectURL(url));
      eventPosterPreviewUrls = [];
      if (files.length > 4) { event.currentTarget.value = ''; count.textContent = 'เลือกได้ไม่เกิน 4 รูป'; toast('เลือกโปสเตอร์ได้ไม่เกิน 4 รูป'); }
      const chosen = files.slice(0, 4);
      count.textContent = chosen.length ? `เลือกแล้ว ${chosen.length} / 4 รูป` : 'ยังไม่ได้เลือกรูป';
      previews.forEach((slot, index) => {
        slot.replaceChildren();
        slot.classList.toggle('has-poster', Boolean(chosen[index]));
        if (!chosen[index]) { const label = document.createElement('span'); label.textContent = `รูปที่ ${index + 1}`; slot.append(label); return; }
        const file = chosen[index];
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
          const label = document.createElement('span'); label.textContent = file.size > 5 * 1024 * 1024 ? 'ไฟล์เกิน 5 MB' : 'รองรับ JPG, PNG, WebP'; slot.append(label); return;
        }
        const url = URL.createObjectURL(file); eventPosterPreviewUrls.push(url);
        const image = document.createElement('img'); image.src = url; image.alt = `ตัวอย่างโปสเตอร์รูปที่ ${index + 1}`; slot.append(image);
      });
    });
    eventFormOpening = false;
  }
  async function publishEvent() {
    const value = id => $(`#${id}`).value;
    const button = $('#publishEvent');
    const title = value('newEventTitle').trim();
    const startsAt = new Date(value('newEventStarts'));
    const endsAt = new Date(value('newEventEnds'));
    const price = Number(value('newTierPrice'));
    const quantity = Number(value('newTierStock'));
    const venue = value('newEventVenue').trim();
    const address = value('newEventAddress').trim();
    const refundPolicy = value('newEventRefundPolicy').trim();
    const bankName = value('newPaymentBank').trim();
    const beneficiaryName = value('newPaymentBeneficiary').trim();
    const accountLast4 = value('newPaymentLast4').trim();
    const slipokBranchId = parseSlipOkBranchId(value('newSlipOkBranch'));
    const slipokApiKeyInput = $('#newSlipOkApiKey');
    const slipokApiKey = slipokApiKeyInput.value.trim();
    const qrFile = $('#newPaymentQr')?.files?.[0];
    const posterFiles = [...($('#newEventPoster')?.files || [])];
    const invalid = (id, message) => { $(`#${id}`)?.focus(); toast(message); };
    if (title.length < 4) return invalid('newEventTitle', 'ใส่ชื่องานอย่างน้อย 4 ตัวอักษร');
    if (!Number.isFinite(+startsAt) || startsAt <= new Date()) return invalid('newEventStarts', 'เลือกวันเริ่มงานในอนาคต');
    if (!Number.isFinite(+endsAt) || endsAt <= startsAt) return invalid('newEventEnds', 'วันจบงานต้องอยู่หลังวันเริ่มงาน');
    if (venue.length < 2 || !address) return invalid(venue.length < 2 ? 'newEventVenue' : 'newEventAddress', 'กรอกชื่อและที่อยู่สถานที่จัดงาน');
    if (refundPolicy.length < 10 || refundPolicy.length > 2000) return invalid('newEventRefundPolicy', 'ระบุเงื่อนไขการยกเลิกและคืนเงินอย่างน้อย 10 ตัวอักษร');
    if (!Number.isInteger(price) || price < 20 || price > 150000) return invalid('newTierPrice', 'ราคาบัตรต้องอยู่ระหว่าง ฿20 ถึง ฿150,000');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) return invalid('newTierStock', 'จำนวนบัตรต้องอยู่ระหว่าง 1 ถึง 10,000 ใบ');
    if (!bankName || !beneficiaryName || (accountLast4 && !/^\d{4}$/.test(accountLast4))) return invalid('newPaymentBank', 'กรอกธนาคารและชื่อบัญชี และเลขท้าย 4 หลักถ้าต้องการแสดง');
    if (!slipokBranchId) return invalid('newSlipOkBranch', 'กรอก Branch ID เป็นตัวเลข หรือวาง URL API Key จาก api.slipok.com');
    if (slipokApiKey.length < 8 || slipokApiKey.length > 512) return invalid('newSlipOkApiKey', 'กรอก SlipOK API Key ของบัญชีผู้รับ');
    if (!qrFile || !['image/jpeg', 'image/png', 'image/webp'].includes(qrFile.type) || qrFile.size > 5 * 1024 * 1024) return invalid('newPaymentQr', 'อัปโหลด QR Code เป็น JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB');
    if (posterFiles.length > 4) return invalid('newEventPoster', 'เลือกโปสเตอร์ได้ไม่เกิน 4 รูป');
    if (posterFiles.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) return invalid('newEventPoster', 'โปสเตอร์ทุกไฟล์ต้องเป็น JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB');
    button.disabled = true; button.textContent = 'กำลังเผยแพร่…';
    const user = await needUser(); if (!user) { button.disabled = false; button.textContent = 'เผยแพร่งานและเปิดขายบัตร'; return; }
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[qrFile.type];
    const paymentQrKey = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const posterStorageKeys = posterFiles.map(file => `${user.id}/posters/${crypto.randomUUID()}.${{ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]}`);
    try {
      for (const [index, posterFile] of posterFiles.entries()) {
        const { error: posterUploadError } = await db.storage.from('sourcewav-event-payment-qr').upload(posterStorageKeys[index], posterFile, { contentType: posterFile.type, cacheControl: '3600', upsert: false });
        if (posterUploadError) throw new Error('อัปโหลดโปสเตอร์งานไม่สำเร็จ: ' + posterUploadError.message);
      }
      const { error: uploadError } = await db.storage.from('sourcewav-event-payment-qr').upload(paymentQrKey, qrFile, { contentType: qrFile.type, cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error('อัปโหลด QR รับเงินไม่สำเร็จ: ' + uploadError.message);
      await call('create-event', { title, category: value('newEventCategory'), startsAt: value('newEventStarts'), endsAt: value('newEventEnds'), venueName: venue, venueAddress: address, description: value('newEventDescription'), refundPolicy, tierName: value('newTierName'), priceBaht: price, quantity, paymentQrKey, posterStorageKeys, bankName, beneficiaryName, accountLast4, slipokBranchId, slipokApiKey });
      slipokApiKeyInput.value = '';
      location.hash = '#events'; closeModal(); await loadEvents(); toast('สร้างอีเวนต์และ Tier บัตรแล้ว');
    } catch (error) { slipokApiKeyInput.value = ''; await db.storage.from('sourcewav-event-payment-qr').remove([paymentQrKey, ...posterStorageKeys]); button.disabled = false; button.textContent = 'เผยแพร่งานและเปิดขายบัตร'; toast(error.message); }
  }

  async function loadChatList() {
    const root = $('#chatPanel');
    root.classList.remove('has-active-chat');
    root.innerHTML = `<div class="chat-head"><div class="chat-page-title"><span class="chat-page-kicker">SOURCEWAV · INBOX</span><h1>ข้อความ</h1><small>พื้นที่สำหรับบทสนทนาของคุณ</small></div><button id="chatClose" aria-label="กลับไปหน้า Sourcewav"><span aria-hidden="true">←</span><span>กลับไปหน้าเว็บ</span></button></div><div class="chat-search"><label for="peopleSearch">ค้นหาแชท</label><input id="peopleSearch" aria-label="ค้นหาชื่อหรือชื่อผู้ใช้" placeholder="ค้นหาชื่อหรือ @username..." autocomplete="off" /><div id="peopleResults"></div></div><div id="conversationList"><p class="platform-loading">กำลังโหลดแชท…</p></div><div id="chatThreadView" hidden></div>`;
    $('#chatClose').onclick = () => { root.classList.remove('open'); root.dataset.liveBound = ''; $('#chatBtn')?.focus(); };
    $('#peopleSearch').oninput = async e => {
      const q = e.target.value.trim(); const results = $('#peopleResults');
      if (q.length < 2) { results.innerHTML = ''; return; }
      const { data, error } = await db.from('profiles').select('user_id,username,display_name,roles,province').or(`username.ilike.%${q.replace(/[%,()]/g, '')}%,display_name.ilike.%${q.replace(/[%,()]/g, '')}%`).limit(8);
      if (error) { results.innerHTML = '<p>ค้นหาสมาชิกไม่ได้</p>'; return; }
      results.innerHTML = (data || []).map(p => `<button class="chat-search-result" data-start-chat="${esc(p.user_id)}" data-name="${esc(p.display_name)}"><span class="avatar">${esc(initials(p.display_name))}</span><span><b>${esc(p.display_name)}</b><small>@${esc(p.username)} · ${esc(p.roles?.join(', ') || 'สมาชิก')}</small></span></button>`).join('') || '<p>ไม่พบสมาชิก</p>';
    };
    await refreshConversationList();
  }
  async function refreshConversationList() {
    const { data: auth } = await db.auth.getUser(); if (!auth.user) { $('#conversationList').innerHTML = '<p class="platform-empty">เข้าสู่ระบบเพื่อดูข้อความ</p>'; return; }
    const { data: memberships, error } = await db.from('conversation_members').select('conversation_id,last_read_at,conversations(id,updated_at,conversation_members(user_id,profiles(display_name,username))),messages(body,sender_id,created_at)').eq('user_id', auth.user.id).order('joined_at', { ascending: false });
    const root = $('#conversationList');
    if (error) { root.innerHTML = `<p class="platform-empty">โหลดบทสนทนาไม่ได้: ${esc(error.message)}</p>`; return; }
    root.innerHTML = (memberships || []).map(m => {
      const members = m.conversations?.conversation_members || [];
      const other = members.find(x => x.user_id !== auth.user.id)?.profiles;
      const last = (m.conversations?.messages || []).sort((a,b) => new Date(b.created_at)-new Date(a.created_at))[0];
      return `<button class="chat-person live-chat-person" data-open-conversation="${esc(m.conversation_id)}"><span class="avatar avatar-purple">${esc(initials(other?.display_name))}</span><span><b>${esc(other?.display_name || other?.username || 'สมาชิก')}</b><small>${esc(last?.body || 'เริ่มบทสนทนา')}</small></span></button>`;
    }).join('') || '<p class="platform-empty">ยังไม่มีแชท ค้นหาชื่อสมาชิกด้านบนเพื่อเริ่มคุย</p>';
  }
  async function startConversation(otherUserId, otherName) {
    const { data, error } = await db.rpc('start_direct_conversation', { p_other_user: otherUserId });
    if (error) return toast(error.message);
    await openConversation(data, otherName);
  }
  async function openConversation(id, displayName) {
    activeConversation = id;
    const { data, error } = await db.from('messages').select('id,body,sender_id,created_at,profiles!messages_sender_id_fkey(display_name)').eq('conversation_id', id).order('created_at', { ascending: true }).limit(200);
    if (error) return toast('เปิดแชทไม่ได้: ' + error.message);
    const { data: me } = await db.auth.getUser();
    const root = $('#chatPanel');
    const view = $('#chatThreadView'); view.hidden = false; root.classList.add('has-active-chat');
    view.innerHTML = `<div class="chat-thread-head"><button id="backToChats" type="button" aria-label="กลับไปยังรายการแชท">← <span>กลับรายการแชท</span></button><div class="chat-recipient"><span class="chat-recipient-avatar">${esc(initials(displayName))}</span><span><b>${esc(displayName || 'บทสนทนา')}</b><small>บทสนทนาส่วนตัว</small></span></div></div><div class="chat-thread-messages" id="threadMessages">${(data || []).map(m => `<p class="live-chat-message ${m.sender_id === me.user?.id ? 'mine' : ''}"><b>${esc(m.profiles?.display_name || 'สมาชิก')}</b><br>${esc(m.body)}<small>${esc(new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))}</small></p>`).join('') || '<p class="chat-first-message">เริ่มบทสนทนาด้วยข้อความสั้น ๆ ได้เลย</p>'}</div><form id="chatCompose" class="chat-compose"><input id="chatText" maxlength="5000" aria-label="ข้อความที่จะส่ง" placeholder="เขียนข้อความ..." required /><button type="submit"><span>ส่งข้อความ</span><span aria-hidden="true">↗</span></button></form>`;
    $('#backToChats').onclick = async () => { if (chatChannel) db.removeChannel(chatChannel); chatChannel = null; root.classList.remove('has-active-chat'); view.hidden = true; await refreshConversationList(); };
    $('#chatCompose').onsubmit = async e => { e.preventDefault(); const body = $('#chatText').value.trim(); if (!body) return; const { error: sendError } = await db.from('messages').insert({ conversation_id: id, sender_id: me.user.id, body }); if (sendError) return toast(sendError.message); $('#chatText').value = ''; await refreshConversationList(); };
    view.querySelector('#threadMessages').scrollTop = 999999;
    if (chatChannel) db.removeChannel(chatChannel);
    chatChannel = db.channel(`conversation:${id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, () => openConversation(id, displayName)).subscribe();
  }

  async function createListing() {
    const user = await needUser(); if (!user) return;
    const title = $('#listingTitle')?.value.trim(), priceText = $('#listingPrice')?.value;
    if (!title) return toast('ใส่ชื่อผลงานก่อนบันทึก');
    const imageFile = $('#listingImage')?.files?.[0];
    if (imageFile && (!['image/jpeg','image/png','image/webp'].includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024)) return toast('ภาพต้องเป็น JPG, PNG หรือ WebP และขนาดไม่เกิน 5 MB');
    const map = { 'ภาพพิมพ์': 'print', 'ดิจิทัลอาร์ต': 'digital', 'รับ commission': 'commission', 'แลกเปลี่ยน': 'trade' };
    const { data: listing, error } = await db.from('listings').insert({ seller_id: user.id, title, category: map[$('#listingCategory').value] || 'artwork', description: $('#listingDescription').value.trim(), price_minor: priceText ? Math.round(Number(priceText) * 100) : null, delivery_type: map[$('#listingCategory').value] === 'trade' ? 'exchange' : 'digital', status: 'published' }).select('id').single();
    if (error) return toast('ลงผลงานไม่ได้: ' + error.message);
    if (imageFile) {
      const ext = imageFile.type === 'image/jpeg' ? 'jpg' : imageFile.type.split('/')[1];
      const storageKey = `${user.id}/${listing.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await db.storage.from('sourcewav-listings').upload(storageKey, imageFile, { contentType: imageFile.type, cacheControl: '3600', upsert: false });
      if (uploadError) { await db.from('listings').delete().eq('id', listing.id); return toast('อัปโหลดภาพไม่ได้: ' + uploadError.message); }
      const { error: mediaError } = await db.from('listing_media').insert({ listing_id: listing.id, storage_key: storageKey, alt_text: title, position: 0 });
      if (mediaError) { await db.storage.from('sourcewav-listings').remove([storageKey]); await db.from('listings').delete().eq('id', listing.id); return toast('เชื่อมภาพกับผลงานไม่ได้: ' + mediaError.message); }
    }
    closeModal(); await loadListings(); toast('ลงผลงานในตลาดแล้ว');
  }

  function openCreateListing() {
    modal(`<h2 id="modalTitle">ลงผลงานในตลาด</h2><p>ประกาศงานพร้อมราคาและข้อมูลติดต่อ</p><label class="modal-field">ชื่อผลงาน<input id="listingTitle" maxlength="180" required placeholder="เช่น ปกซิงเกิล / ภาพพิมพ์" /></label><label class="modal-field">ประเภท<select id="listingCategory"><option>ภาพพิมพ์</option><option>ดิจิทัลอาร์ต</option><option>รับ commission</option><option>แลกเปลี่ยน</option></select></label><label class="modal-field">ภาพผลงาน<input id="listingImage" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG หรือ WebP · ไม่เกิน 5 MB</small></label><label class="modal-field">รายละเอียด<textarea id="listingDescription" maxlength="5000" placeholder="ขนาด สไตล์ เงื่อนไข หรือสิ่งที่อยากแลก"></textarea></label><label class="modal-field">ราคา (บาท)<input id="listingPrice" type="number" min="0" max="10000000" step="1" placeholder="เว้นว่างถ้าสอบถามราคา" /></label><button class="modal-primary" id="listingPublishBtn">ลงผลงาน</button>`);
  }

  let activePostComments = null;

  function closePostComments() {
    if (!activePostComments) return;
    activePostComments.trigger?.setAttribute('aria-expanded', 'false');
    activePostComments.panel.remove();
    activePostComments = null;
  }

  async function loadPostComments(postId, panel) {
    const list = $('.post-comments-inline-list', panel);
    if (!list) return;
    list.innerHTML = '<p class="post-comments-status" role="status">กำลังโหลดความคิดเห็น…</p>';
    try {
      const { data, error } = await db.from('comments').select('body,created_at,profiles!comments_author_id_fkey(display_name)')
        .eq('post_id', postId).is('deleted_at', null).order('created_at');
      if (error) throw error;
      if (!panel.isConnected) return;
      list.innerHTML = (data || []).map(comment => `<article class="post-comment-entry"><b>${esc(comment.profiles?.display_name || 'สมาชิก')}</b><p>${esc(comment.body)}</p><time datetime="${esc(comment.created_at)}">${esc(new Date(comment.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }))}</time></article>`).join('')
        || '<p class="post-comments-status">ยังไม่มีความคิดเห็น เริ่มคุยได้เลย</p>';
    } catch (error) {
      console.error('Unable to load post comments:', error?.message || error);
      if (!panel.isConnected) return;
      list.innerHTML = '<div class="post-comments-error" role="alert"><p>โหลดความคิดเห็นไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง</p><button type="button" data-post-comments-retry>ลองอีกครั้ง</button></div>';
      $('[data-post-comments-retry]', list)?.addEventListener('click', () => loadPostComments(postId, panel));
    }
  }

  function openPostComments(trigger, postId, postTitle, options = {}) {
    if (activePostComments?.postId === postId) { closePostComments(); return; }
    closePostComments();
    const card = trigger.closest('.live-post-card');
    if (!card) return;
    const panel = document.createElement('section');
    panel.className = 'post-comments-inline';
    panel.dataset.postCommentsPanel = postId;
    panel.setAttribute('aria-label', `ความคิดเห็นของ ${postTitle}`);
    panel.innerHTML = `<div class="post-comments-inline-head"><div><span>SOURCEWAV · COMMUNITY</span><h3>ความคิดเห็น</h3><p>${esc(postTitle)}</p></div><button type="button" data-post-comments-close aria-label="ปิดความคิดเห็น">ปิด ×</button></div><div class="post-comments-inline-list" aria-live="polite"></div><form class="post-comments-inline-form" data-post-id="${esc(postId)}"><label for="postCommentBody-${esc(postId)}">เขียนความคิดเห็น</label><textarea id="postCommentBody-${esc(postId)}" name="body" maxlength="2000" required placeholder="แสดงความคิดเห็นอย่างสร้างสรรค์…"></textarea><div class="post-comments-inline-actions"><small>ไม่เกิน 2,000 ตัวอักษร</small><button type="submit">ส่งความคิดเห็น <span aria-hidden="true">↗</span></button></div></form>`;
    card.append(panel);
    activePostComments = { postId, panel, trigger };
    trigger.setAttribute('aria-expanded', 'true');
    if (options.focus !== false) {
      panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      $('textarea', panel)?.focus({ preventScroll: true });
    }
    loadPostComments(postId, panel);
  }

  async function submitPostComment(form) {
    const postId = form.dataset.postId;
    const textarea = form.elements.body;
    const body = textarea?.value.trim();
    if (!body) return toast('พิมพ์ความคิดเห็นก่อนส่ง');
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const user = await needUser(); if (!user) return;
      const { error } = await db.from('comments').insert({ post_id: postId, author_id: user.id, body });
      if (error) throw error;
      textarea.value = '';
      const panel = form.closest('.post-comments-inline');
      if (panel) {
        await loadPostComments(postId, panel);
        const list = $('.post-comments-inline-list', panel);
        if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
        textarea.focus({ preventScroll: true });
      }
      const count = document.querySelector(`.live-post-card[data-live-post="${postId}"] [data-live-comment] b`);
      if (count) count.textContent = Number(count.textContent || 0) + 1;
      toast('เพิ่มความคิดเห็นแล้ว');
    } catch (error) {
      console.error('Unable to post comment:', error?.message || error);
      toast('ส่งความคิดเห็นไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      if (submit?.isConnected) submit.disabled = false;
    }
  }

  document.addEventListener('click', async event => {
    const target = event.target.closest('button'); if (!target) return;
    if (target.dataset.liveLike) {
      event.preventDefault(); event.stopImmediatePropagation();
      const user = window.SourcewavAuthUser || await needUser(); if (!user) return;
      const id = target.dataset.liveLike, wasLiked = target.getAttribute('aria-pressed') === 'true';
      const count = target.querySelector('b');
      const oldCount = Number(count?.textContent || 0);
      const liked = !wasLiked;
      target.setAttribute('aria-pressed', String(liked));
      target.setAttribute('aria-label', `${liked ? 'ยกเลิกถูกใจ' : 'ถูกใจ'} โพสต์นี้`);
      target.classList.toggle('liked', liked);
      if (count) count.textContent = Math.max(0, oldCount + (liked ? 1 : -1));
      target.classList.remove('is-bouncing'); void target.offsetWidth; if (liked) target.classList.add('is-bouncing');
      const result = wasLiked ? await db.from('reactions').delete().eq('post_id', id).eq('user_id', user.id) : await db.from('reactions').upsert({ post_id: id, user_id: user.id, reaction: 'like' }, { onConflict: 'post_id,user_id' });
      if (result.error) { target.setAttribute('aria-pressed', String(wasLiked)); target.setAttribute('aria-label', `${wasLiked ? 'ยกเลิกถูกใจ' : 'ถูกใจ'} โพสต์นี้`); target.classList.toggle('liked', wasLiked); if (count) count.textContent = oldCount; toast(result.error.message); }
      else window.setTimeout(() => { if (document.contains(target)) loadFeed(); }, 480);
      return;
    }
    if (target.dataset.liveSave) { event.preventDefault(); event.stopImmediatePropagation(); const user = await needUser(); if (!user) return; const id = target.dataset.liveSave; const saved = target.getAttribute('aria-pressed') === 'true'; const result = saved ? await db.from('saved_items').delete().eq('user_id', user.id).eq('item_type', 'post').eq('item_id', id) : await db.from('saved_items').insert({ user_id: user.id, item_type: 'post', item_id: id }); if (result.error) toast(result.error.message); else await loadFeed(); return; }
    if (target.hasAttribute('data-post-comments-close')) { event.preventDefault(); event.stopImmediatePropagation(); return closePostComments(); }
    if (target.dataset.liveComment) {
      event.preventDefault(); event.stopImmediatePropagation();
      const card = target.closest('.live-post-card');
      const title = card?.querySelector('.live-post-title')?.textContent?.trim()
        || card?.querySelector('.post-copy')?.textContent?.trim().slice(0, 80)
        || 'โพสต์';
      return openPostComments(target, target.dataset.liveComment, title);
    }
    if (target.dataset.liveShare) { const url = `${location.origin}${location.pathname}#post-${target.dataset.liveShare}`; try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์โพสต์แล้ว'); } catch (_) { toast(url); } return; }
    if (target.dataset.buyEvent) { event.preventDefault(); event.stopImmediatePropagation(); return openTicketPurchase(target.dataset.buyEvent); }
    if (target.id === 'manageSlipokSettings') { event.preventDefault(); event.stopImmediatePropagation(); return openSlipOkSettings(target.dataset.eventId, target.dataset.branchId); }
    if (target.id === 'searchGo') { event.preventDefault(); event.stopImmediatePropagation(); return searchSourcewav(); }
    if (target.id === 'createRoomBtn') { event.preventDefault(); event.stopImmediatePropagation(); return createRoom(); }
    if (target.dataset.liveRoom || target.dataset.openRoom || target.dataset.roomSwitch) { event.preventDefault(); event.stopImmediatePropagation(); return openRoom(target.dataset.liveRoom || target.dataset.openRoom || target.dataset.roomSwitch, target.dataset.roomName || target.textContent.trim()); }
    if (target.dataset.chatArtist) {
      event.preventDefault(); event.stopImmediatePropagation();
      const user = await needUser(); if (!user) return;
      if (user.id === target.dataset.chatArtist) return toast('นี่คือบัญชีของคุณ');
      $('#chatPanel').classList.add('open'); $('#chatPanel').dataset.liveBound = '1';
      await loadChatList(); return startConversation(target.dataset.chatArtist, target.dataset.artistName || 'ศิลปิน');
    }
    if (target.dataset.searchChat) {
      event.preventDefault(); event.stopImmediatePropagation();
      const user = await needUser(); if (!user) return;
      if (user.id === target.dataset.searchChat) return toast('นี่คือบัญชีของคุณ');
      $('#chatPanel').classList.add('open'); $('#chatPanel').dataset.liveBound = '1';
      await loadChatList(); return startConversation(target.dataset.searchChat, target.dataset.name || 'สมาชิก');
    }
    if (target.dataset.orderContact) {
      event.preventDefault(); event.stopImmediatePropagation();
      const user = await needUser(); if (!user) return;
      if (user.id === target.dataset.orderContact) return toast('คำสั่งซื้อนี้เป็นของคุณ');
      const organizerId = target.dataset.orderContact;
      const organizerName = target.dataset.name || 'ผู้จัดงาน';
      const orderRef = target.dataset.orderRef || '';
      closeModal();
      $('#chatPanel').classList.add('open'); $('#chatPanel').dataset.liveBound = '1';
      await loadChatList();
      await startConversation(organizerId, organizerName);
      const message = $('#chatText');
      if (message && orderRef) { message.value = `ขอติดต่อเรื่องคำสั่งซื้อ ${orderRef}`; message.focus(); }
      return;
    }
    if (target.dataset.contactSeller) { event.preventDefault(); const user = await needUser(); if (user) { if (user.id === target.dataset.contactSeller) return toast('นี่คือผลงานของคุณ'); $('#chatPanel').classList.add('open'); await loadChatList(); await startConversation(target.dataset.contactSeller, target.dataset.sellerName); } return; }
    if (target.id === 'createListingBtn') { event.preventDefault(); event.stopImmediatePropagation(); return openCreateListing(); }
    if (target.id === 'listingPublishBtn') { event.preventDefault(); event.stopImmediatePropagation(); return createListing(); }
    if (target.id === 'createEventBtn') { event.preventDefault(); event.stopImmediatePropagation(); if (location.hash !== '#sell-event') location.hash = '#sell-event'; else return openCreateEvent(); return; }
    if (target.id === 'publishEvent') { event.preventDefault(); return publishEvent(); }
    if (target.id === 'scanTicketBtn') { event.preventDefault(); if (location.pathname !== '/scan') history.pushState({}, '', '/scan'); return openScan(); }
    if (target.id === 'startCamera') { event.preventDefault(); return startCamera(); }
    if (target.id === 'stopCamera') { event.preventDefault(); return stopCamera(); }
    if (target.id === 'validateManual') { event.preventDefault(); return validateQR($('#manualTicketCode').value.trim()); }
    if (target.dataset.startChat) { event.preventDefault(); const { data: me } = await db.auth.getUser(); if (me.user?.id === target.dataset.startChat) return toast('นี่คือบัญชีของคุณ'); return startConversation(target.dataset.startChat, target.dataset.name); }
    if (target.dataset.openConversation) { event.preventDefault(); const label = target.querySelector('b')?.textContent; return openConversation(target.dataset.openConversation, label); }
  }, true);

  document.addEventListener('submit', event => {
    if (event.target?.matches?.('.post-comments-inline-form')) {
      event.preventDefault(); event.stopImmediatePropagation();
      return submitPostComment(event.target);
    }
    if (event.target?.id === 'slipokSettingsForm') {
      event.preventDefault(); event.stopImmediatePropagation();
      return saveSlipOkSettings(event.target);
    }
    if (event.target?.id !== 'ticketSlipForm') return;
    event.stopImmediatePropagation();
    submitTicketSlip(event);
  }, true);

  document.addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target || !['publishBtn', 'sendMessageBtn', 'commentSendBtn'].includes(target.id)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (target.id === 'publishBtn') {
      if (target.dataset.submitting === 'true') return;
      target.dataset.submitting = 'true';
      target.disabled = true;
      target.setAttribute('aria-busy', 'true');
      const originalLabel = target.textContent;
      target.textContent = 'กำลังเผยแพร่…';
      try {
        const user = await needUser(); if (!user) return;
        const body = $('#postBody')?.value.trim();
        if (!body) { toast('พิมพ์ข้อความก่อนโพสต์'); return; }
        const profile = await db.from('profiles').select('user_id').eq('user_id', user.id).single();
        if (profile.error) { toast('ไม่พบโปรไฟล์ผู้ใช้'); return; }
        const kind = $('#postKind')?.value;
        const { error } = await db.from('posts').insert({ author_id: user.id, kind, title: $('#postTitle')?.value.trim() || null, body, status: 'published', visibility: 'public' });
        if (error) { toast('โพสต์ไม่ได้: ' + error.message); return; }
        closeModal(); await loadFeed(); toast('โพสต์เผยแพร่แล้ว');
      } catch (error) {
        console.error('Unable to publish post:', error?.message || error);
        toast('โพสต์ไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง');
      } finally {
        target.dataset.submitting = 'false';
        target.disabled = false;
        target.removeAttribute('aria-busy');
        target.textContent = originalLabel;
      }
      return;
    }
    const user = await needUser(); if (!user) return;
  }, true);

  document.addEventListener('click', async event => {
    const filter = event.target.closest('.filter-chip'); if (!filter) return;
    feedFilter = filter.dataset.filter || 'all'; await loadFeed();
  }, true);

  window.addEventListener('sourcewav:auth', async event => {
    await loadFeed(); await loadListings(); await loadEvents();
    if (location.hash !== '#sell-event') return;
    const page = $('#eventSellPage');
    if (!event.detail?.user && page && !page.hidden && $('#newEventTitle', page)) {
      closeModal(); location.hash = '#events'; toast('เซสชันสิ้นสุดแล้ว กรุณาเข้าสู่ระบบใหม่'); return;
    }
    openCreateEvent();
  });
  $('#chatBtn')?.addEventListener('click', () => {
    const root = $('#chatPanel');
    const opening = !root.classList.contains('open');
    root.classList.toggle('open', opening);
    if (opening && !root.dataset.liveBound) { root.dataset.liveBound = '1'; loadChatList(); $('#peopleSearch')?.focus(); }
  });
  $('#modalClose')?.addEventListener('click', () => { stopCamera(); closeRoomChannel(); });
  $('#modalBackdrop')?.addEventListener('click', event => { if (event.target.id === 'modalBackdrop') { stopCamera(); closeRoomChannel(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && roomChannel) closeRoomChannel(); });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#sell-event') openCreateEvent();
    else if (/^#buy-ticket\/[^/?#]+$/.test(location.hash)) {
      try { ticketPicker(decodeURIComponent(location.hash.slice('#buy-ticket/'.length))); } catch { closeTicketPurchasePage(); }
    } else {
      if (document.body.classList.contains('event-sell-page-active')) closeModal();
      if (document.body.classList.contains('event-purchase-page-active')) closeTicketPurchasePage();
    }
  });
  if (location.pathname === '/scan') openScan();
  if (location.hash === '#sell-event') openCreateEvent();
  else if (/^#buy-ticket\/[^/?#]+$/.test(location.hash)) {
    try { ticketPicker(decodeURIComponent(location.hash.slice('#buy-ticket/'.length))); } catch { closeTicketPurchasePage(); }
  }
  window.SourcewavSupabaseReady?.then(client => {
    if (!client) return;
    window.SourcewavPlatform.isLive = true;
    return Promise.all([loadFeed(), loadListings(), loadEvents(), loadRooms()]);
  });
  db.channel('sourcewav-public-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, loadFeed).subscribe();
  db.channel('sourcewav-post-activity').on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, loadFeed).on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, loadFeed).subscribe();
  db.channel('sourcewav-public-market').on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, loadListings).subscribe();
  db.channel('sourcewav-public-events').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadEvents).subscribe();
  db.channel('sourcewav-community-rooms').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_rooms' }, loadRooms).subscribe();
})();
