/* Live community, marketplace, event checkout, tickets, and door-scanning UI. */
(() => {
  const db = window.SourcewavSupabase;
  if (!db) return;
  window.SourcewavPlatform = { isLive: true };
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = n => `฿${(Number(n || 0) / 100).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
  const initials = name => [...String(name || '?')][0] || '?';
  const toast = message => { const node = $('#toast'); if (node) { node.textContent = message; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 3000); } };
  const modal = html => { const backdrop = $('#modalBackdrop'); $('#modalContent').innerHTML = html; backdrop.classList.add('open'); backdrop.setAttribute('aria-hidden', 'false'); };
  const closeModal = () => { const backdrop = $('#modalBackdrop'); backdrop.classList.remove('open'); backdrop.setAttribute('aria-hidden', 'true'); };
  const needUser = async () => { const { data } = await db.auth.getUser(); if (!data.user) { toast('เข้าสู่ระบบก่อนใช้ฟีเจอร์นี้'); $('#profileBtn')?.click(); return null; } return data.user; };
  const call = async (name, body) => {
    const { data, error } = await db.functions.invoke(name, { body });
    if (error) {
      if (error.context?.status === 404) {
        const messages = {
          'create-ticket-checkout': 'ระบบชำระเงินค่าบัตรยังไม่เปิดให้บริการในขณะนี้ ยังไม่มีการเรียกเก็บเงิน',
          'create-event': 'ระบบเปิดขายบัตรยังไม่พร้อมใช้งานในขณะนี้',
          'my-tickets': 'ระบบบัตรของฉันยังไม่พร้อมใช้งานในขณะนี้',
          'validate-ticket': 'ระบบตรวจบัตรเข้างานยังไม่พร้อมใช้งานในขณะนี้',
        };
        if (messages[name]) throw new Error(messages[name]);
      }
      throw new Error(error.message || 'เชื่อมต่อบริการไม่สำเร็จ');
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };
  let feedFilter = 'all', activeConversation = null, chatChannel = null, paymentTimer = null, scannerStream = null, scannerRunning = false;

  function postCard(post, userId, savedSet) {
    const author = post.profiles || {};
    const comments = post.comments?.[0]?.count || 0;
    const likes = post.reactions || [];
    const liked = userId && likes.some(row => row.user_id === userId);
    const kind = { music: 'เพลง', art: 'ศิลปะ', talk: 'พูดคุย', collab: 'หาเพื่อนร่วมงาน', announcement: 'ประกาศ' }[post.kind] || post.kind;
    const date = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.created_at));
    const saved = savedSet?.has(post.id);
    return `<article class="post-card live-post-card" data-live-post="${esc(post.id)}" data-kind="${esc(post.kind)}"><div class="post-top"><div class="avatar avatar-purple">${esc(initials(author.display_name))}</div><div class="post-author"><strong>${esc(author.display_name || author.username || 'ศิลปิน')}</strong><small>${esc(kind)} · ${esc(date)}</small></div></div>${post.title ? `<h3 class="live-post-title">${esc(post.title)}</h3>` : ''}<p class="post-copy">${esc(post.body).replace(/\n/g, '<br>')}</p><div class="post-actions"><button class="live-like-btn ${liked ? 'liked' : ''}" data-live-like="${esc(post.id)}" aria-pressed="${Boolean(liked)}">${liked ? '♥' : '♡'} <span>ถูกใจ</span> <b>${likes.length}</b></button><button data-live-comment="${esc(post.id)}">▢ <span>ความคิดเห็น</span> <b>${comments}</b></button><button data-live-share="${esc(post.id)}">↗ <span>แชร์</span></button><button class="${saved ? 'liked' : ''}" data-live-save="${esc(post.id)}" aria-pressed="${Boolean(saved)}">♧ <span>${saved ? 'บันทึกแล้ว' : 'เก็บไว้'}</span></button></div></article>`;
  }

  async function loadFeed() {
    const root = $('#liveFeed'); if (!root) return;
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
      return `<article class="event-card live-event-card"><div class="event-poster poster-one"><span>${esc(date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }))}</span><b>${esc(event.category === 'music' ? 'LIVE' : event.category.toUpperCase())}</b><small>SOURCEWAV</small></div><div class="event-info"><div class="event-date"><b>${esc(date.toLocaleDateString('th-TH', { day: '2-digit' }))}</b><span>${esc(date.toLocaleDateString('th-TH', { month: 'short' }))} · ${esc(date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))}</span></div><h3>${esc(event.title)}</h3><p>${esc(event.venue_name || 'สถานที่แจ้งภายหลัง')}${event.venue_address ? ` · ${esc(event.venue_address)}` : ''}</p><div class="event-bottom"><div class="event-ticket-price"><strong>${startingPrice === null ? 'บัตรยังไม่เปิดขาย' : `เริ่ม ${money(startingPrice)}`}</strong><small>${availability}</small></div><button class="buy-btn" data-buy-event="${esc(event.id)}" ${saleTiers.length ? '' : 'disabled'}>${saleTiers.length ? 'เลือกบัตร' : 'ปิดขาย'}</button></div></div></article>`;
    }).join('') || '<p class="platform-empty">ยังไม่มีอีเวนต์เปิดขาย งานที่ผู้จัดสร้างจะปรากฏที่นี่</p>';
  }

  async function ticketPicker(eventId) {
    const user = await needUser(); if (!user) return;
    const { data: event, error } = await db.from('events').select('id,title,starts_at,venue_name,venue_address,ticket_types(id,name,price_minor,quantity_total,quantity_sold,quantity_reserved,sales_start,sales_end)').eq('id', eventId).single();
    if (error) return toast('เปิดรายละเอียดงานไม่ได้');
    const tiers = (event.ticket_types || []).filter(t => t.quantity_total > t.quantity_sold + t.quantity_reserved && (!t.sales_start || new Date(t.sales_start) <= new Date()) && (!t.sales_end || new Date(t.sales_end) >= new Date()));
    if (!tiers.length) return toast('บัตรหมดหรือยังไม่เปิดขาย');
    modal(`<h2 id="modalTitle">เลือกบัตร · ${esc(event.title)}</h2><p>${esc(event.venue_name || '')} · ${esc(new Date(event.starts_at).toLocaleString('th-TH'))}</p><label class="modal-field">ประเภทบัตร<select id="ticketTier">${tiers.map(t => `<option value="${esc(t.id)}" data-price="${t.price_minor}" data-left="${t.quantity_total - t.quantity_sold - t.quantity_reserved}">${esc(t.name)} · ${money(t.price_minor)} · เหลือ ${t.quantity_total - t.quantity_sold - t.quantity_reserved} ใบ</option>`).join('')}</select></label><label class="modal-field">จำนวน<input id="ticketQuantity" type="number" min="1" max="10" value="1" /></label><div class="checkout-event"><div class="checkout-row"><span>ยอดรวม</span><b id="ticketTotal">${money(tiers[0].price_minor)}</b></div><p>ชำระด้วย PromptPay ผ่าน Omise · ระบบออกบัตรหลัง webhook ยืนยันยอดเท่านั้น</p></div><button class="modal-primary" id="startCheckout">สร้าง QR เพื่อชำระ</button>`);
    const updateTotal = () => { const selected = $('#ticketTier')?.selectedOptions[0]; const qty = Math.max(1, Math.min(10, Number($('#ticketQuantity')?.value || 1), Number(selected?.dataset.left || 1))); if ($('#ticketQuantity')) $('#ticketQuantity').value = qty; if ($('#ticketTotal')) $('#ticketTotal').textContent = money(Number(selected?.dataset.price) * qty); };
    $('#ticketTier').addEventListener('change', updateTotal); $('#ticketQuantity').addEventListener('input', updateTotal);
  }

  async function beginCheckout() {
    const tier = $('#ticketTier')?.value, quantity = Number($('#ticketQuantity')?.value || 1);
    if (!tier || !await needUser()) return;
    const idempotencyKey = crypto.randomUUID();
    const button = $('#startCheckout'); button.disabled = true; button.textContent = 'กำลังสร้างรายการ…';
    try {
      const checkout = await call('create-ticket-checkout', { ticketTypeId: tier, quantity, idempotencyKey });
      showPayment(checkout);
    } catch (error) { button.disabled = false; button.textContent = 'สร้าง QR เพื่อชำระ'; toast(error.message); }
  }

  function showPayment(checkout) {
    clearInterval(paymentTimer);
    const until = new Date(checkout.expiresAt).getTime();
    modal(`<h2 id="modalTitle">สแกน PromptPay เพื่อชำระ</h2><p>${esc(checkout.eventTitle)} · ${esc(checkout.tierName)} × ${checkout.quantity}</p><div class="real-payment-qr"><img src="${esc(checkout.qrUrl)}" alt="QR PromptPay จาก Omise สำหรับรายการ ${esc(checkout.orderId)}" /></div><div class="checkout-event"><div class="checkout-row"><span>ยอดชำระ</span><b>${money(checkout.totalMinor)}</b></div><div class="checkout-row"><span>Order</span><code>${esc(checkout.orderId)}</code></div><div class="checkout-row"><span>หมดอายุ</span><b id="paymentCountdown">—</b></div></div><p class="payment-note">บัตรจะเข้าบัญชีหลัง Omise ส่ง webhook ยืนยันการชำระ ระบบกำลังตรวจสอบอัตโนมัติ</p><button class="modal-primary" id="refreshPayment">ตรวจสถานะ</button>`);
    const poll = async () => {
      if (Date.now() >= until) { clearInterval(paymentTimer); $('#paymentCountdown') && ($('#paymentCountdown').textContent = 'หมดเวลา'); return; }
      const remain = Math.max(0, until - Date.now()); const timer = $('#paymentCountdown'); if (timer) timer.textContent = `${Math.floor(remain / 60000)}:${String(Math.floor(remain % 60000 / 1000)).padStart(2, '0')}`;
      const { data, error } = await db.from('orders').select('status').eq('id', checkout.orderId).maybeSingle();
      if (!error && data?.status === 'paid') { clearInterval(paymentTimer); closeModal(); toast('ชำระแล้ว — บัตรของคุณอยู่ใน “บัตรของฉัน”'); openMyTickets(); }
    };
    poll(); paymentTimer = setInterval(poll, 4000);
  }

  async function openMyTickets() {
    const user = await needUser(); if (!user) return;
    try {
      const { tickets = [] } = await call('my-tickets', {});
      modal(`<h2 id="modalTitle">บัตรของฉัน</h2><div class="my-ticket-list">${tickets.map(ticket => `<article class="my-ticket" data-ticket-id="${esc(ticket.id)}"><div><span class="section-kicker">${esc(ticket.status === 'valid' ? 'พร้อมเข้างาน' : ticket.status === 'checked_in' ? 'ใช้สิทธิ์แล้ว' : 'ยกเลิก')}</span><h3>${esc(ticket.events?.title || 'อีเวนต์')}</h3><p>${esc(ticket.order_items?.ticket_types?.name || '')} · ${esc(ticket.events?.venue_name || ticket.events?.venues?.name || '')}</p><small>${esc(ticket.events?.venue_address || ticket.events?.venues?.address || '')} · ${esc(new Date(ticket.events?.starts_at || ticket.issued_at).toLocaleString('th-TH'))}</small></div><div class="ticket-qr" data-qr="${esc(ticket.qr_payload)}"></div></article>`).join('') || '<p class="platform-empty">ยังไม่มีบัตรที่ซื้อ</p>'}</div>`);
      document.querySelectorAll('.ticket-qr').forEach(node => { if (window.QRCode) new QRCode(node, { text: node.dataset.qr, width: 132, height: 132, correctLevel: QRCode.CorrectLevel.M }); });
    } catch (error) { toast(error.message); }
  }

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

  async function openCreateEvent() {
    if (!await needUser()) return;
    modal(`<div class="ticket-sell-modal"><div class="ticket-sell-heading"><span>SELL YOUR EVENT</span><h2 id="modalTitle">เปิดขายบัตรงานของคุณ</h2><p>เพิ่มข้อมูลงาน ตั้งราคาและจำนวนบัตร แล้วให้ผู้ชมเลือกซื้อจากหน้าอีเวนต์</p></div><div class="ticket-sell-section"><strong>รายละเอียดอีเวนต์</strong><label class="modal-field">ชื่องาน<input id="newEventTitle" maxlength="180" required placeholder="ชื่ออีเวนต์" /></label><div class="ticket-sell-grid"><label class="modal-field">ประเภท<select id="newEventCategory"><option value="music">ดนตรี</option><option value="art">ศิลปะ</option><option value="community">คอมมูนิตี้</option><option value="market">ตลาด</option></select></label><label class="modal-field">ชื่อสถานที่<input id="newEventVenue" maxlength="160" required placeholder="เช่น Warehouse 30" /></label><label class="modal-field">วันเริ่มงาน<input id="newEventStarts" type="datetime-local" required /></label><label class="modal-field">วันจบงาน<input id="newEventEnds" type="datetime-local" required /></label></div><label class="modal-field">ที่อยู่<input id="newEventAddress" maxlength="400" required placeholder="ที่อยู่สถานที่จัดงาน" /></label><label class="modal-field">รายละเอียด<textarea id="newEventDescription" maxlength="5000" placeholder="บอกผู้ชมว่าในงานมีอะไรบ้าง"></textarea></label></div><div class="ticket-sell-section ticket-sell-inventory"><strong>ตั้งค่าบัตร</strong><div class="ticket-sell-grid"><label class="modal-field">ชื่อประเภทบัตร<input id="newTierName" value="บัตรทั่วไป" maxlength="100" /></label><label class="modal-field">ราคา (บาท)<input id="newTierPrice" type="number" min="20" max="150000" step="1" value="250" /></label><label class="modal-field">จำนวนบัตร<input id="newTierStock" type="number" min="1" max="10000" value="100" /></label></div><p>ขายได้เฉพาะบัญชีผู้จัดงานที่ผ่านการยืนยัน · PromptPay ขั้นต่ำ ฿20 ต่อคำสั่งซื้อ</p></div><button class="modal-primary" id="publishEvent">เผยแพร่งานและเปิดขายบัตร</button></div>`);
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
    const invalid = (id, message) => { $(`#${id}`)?.focus(); toast(message); };
    if (title.length < 4) return invalid('newEventTitle', 'ใส่ชื่องานอย่างน้อย 4 ตัวอักษร');
    if (!Number.isFinite(+startsAt) || startsAt <= new Date()) return invalid('newEventStarts', 'เลือกวันเริ่มงานในอนาคต');
    if (!Number.isFinite(+endsAt) || endsAt <= startsAt) return invalid('newEventEnds', 'วันจบงานต้องอยู่หลังวันเริ่มงาน');
    if (venue.length < 2 || !address) return invalid(venue.length < 2 ? 'newEventVenue' : 'newEventAddress', 'กรอกชื่อและที่อยู่สถานที่จัดงาน');
    if (!Number.isInteger(price) || price < 20 || price > 150000) return invalid('newTierPrice', 'ราคาบัตรต้องอยู่ระหว่าง ฿20 ถึง ฿150,000');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) return invalid('newTierStock', 'จำนวนบัตรต้องอยู่ระหว่าง 1 ถึง 10,000 ใบ');
    button.disabled = true; button.textContent = 'กำลังเผยแพร่…';
    try {
      await call('create-event', { title, category: value('newEventCategory'), startsAt: value('newEventStarts'), endsAt: value('newEventEnds'), venueName: venue, venueAddress: address, description: value('newEventDescription'), tierName: value('newTierName'), priceBaht: price, quantity });
      closeModal(); await loadEvents(); toast('สร้างอีเวนต์และ Tier บัตรแล้ว');
    } catch (error) { button.disabled = false; button.textContent = 'เผยแพร่งานและเปิดขายบัตร'; toast(error.message); }
  }

  async function loadChatList() {
    const root = $('#chatPanel');
    root.innerHTML = `<div class="chat-head"><div><b>ข้อความ</b><small>แชทส่วนตัวระหว่างสมาชิก</small></div><button id="chatClose" aria-label="ปิดแชท">×</button></div><div class="chat-search"><input id="peopleSearch" placeholder="ค้นหาชื่อหรือ @username..." autocomplete="off" /><div id="peopleResults"></div></div><div id="conversationList"><p class="platform-loading">กำลังโหลดแชท…</p></div><div id="chatThreadView" hidden></div>`;
    $('#chatClose').onclick = () => root.classList.remove('open');
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
    const view = $('#chatThreadView'); view.hidden = false;
    view.innerHTML = `<div class="chat-thread-head"><button id="backToChats">←</button><b>${esc(displayName || 'บทสนทนา')}</b></div><div class="chat-thread-messages" id="threadMessages">${(data || []).map(m => `<p class="live-chat-message ${m.sender_id === me.user?.id ? 'mine' : ''}"><b>${esc(m.profiles?.display_name || 'สมาชิก')}</b><br>${esc(m.body)}<small>${esc(new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))}</small></p>`).join('')}</div><form id="chatCompose" class="chat-compose"><input id="chatText" maxlength="5000" placeholder="พิมพ์ข้อความ…" required /><button>ส่ง</button></form>`;
    $('#conversationList').hidden = true; $('.chat-search').hidden = true;
    $('#backToChats').onclick = async () => { if (chatChannel) db.removeChannel(chatChannel); chatChannel = null; view.hidden = true; $('#conversationList').hidden = false; $('.chat-search').hidden = false; await refreshConversationList(); };
    $('#chatCompose').onsubmit = async e => { e.preventDefault(); const body = $('#chatText').value.trim(); if (!body) return; const { error: sendError } = await db.from('messages').insert({ conversation_id: id, sender_id: me.user.id, body }); if (sendError) return toast(sendError.message); $('#chatText').value = ''; };
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

  document.addEventListener('click', async event => {
    const target = event.target.closest('button'); if (!target) return;
    if (target.dataset.liveLike) { event.preventDefault(); event.stopImmediatePropagation(); const user = await needUser(); if (!user) return; const id = target.dataset.liveLike; const on = target.getAttribute('aria-pressed') === 'true'; const result = on ? await db.from('reactions').delete().eq('post_id', id).eq('user_id', user.id) : await db.from('reactions').upsert({ post_id: id, user_id: user.id, reaction: 'like' }, { onConflict: 'post_id,user_id' }); if (result.error) toast(result.error.message); else await loadFeed(); return; }
    if (target.dataset.liveSave) { event.preventDefault(); event.stopImmediatePropagation(); const user = await needUser(); if (!user) return; const id = target.dataset.liveSave; const saved = target.getAttribute('aria-pressed') === 'true'; const result = saved ? await db.from('saved_items').delete().eq('user_id', user.id).eq('item_type', 'post').eq('item_id', id) : await db.from('saved_items').insert({ user_id: user.id, item_type: 'post', item_id: id }); if (result.error) toast(result.error.message); else await loadFeed(); return; }
    if (target.dataset.liveComment) { event.preventDefault(); event.stopImmediatePropagation(); const postId = target.dataset.liveComment; const { data } = await db.from('comments').select('body,created_at,profiles!comments_author_id_fkey(display_name)').eq('post_id', postId).is('deleted_at', null).order('created_at'); const entries = data || []; modal(`<h2 id="modalTitle">คุยกันใต้โพสต์</h2><div class="comment-list">${entries.map(c => `<p class="local-message"><b>${esc(c.profiles?.display_name || 'สมาชิก')}</b><br>${esc(c.body)}</p>`).join('') || '<p>ยังไม่มีความคิดเห็น เริ่มคุยได้เลย</p>'}</div><form id="commentForm"><label class="modal-field">เขียนความคิดเห็น<textarea id="liveCommentBody" maxlength="2000" required></textarea></label><button class="modal-primary">ส่งความคิดเห็น</button></form>`); $('#commentForm').onsubmit = async e => { e.preventDefault(); const user = await needUser(); if (!user) return; const body = $('#liveCommentBody').value.trim(); const { error } = await db.from('comments').insert({ post_id: postId, author_id: user.id, body }); if (error) return toast(error.message); closeModal(); await loadFeed(); }; return; }
    if (target.dataset.liveShare) { const url = `${location.origin}${location.pathname}#post-${target.dataset.liveShare}`; try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์โพสต์แล้ว'); } catch (_) { toast(url); } return; }
    if (target.dataset.buyEvent) { event.preventDefault(); event.stopImmediatePropagation(); return ticketPicker(target.dataset.buyEvent); }
    if (target.id === 'startCheckout') { event.preventDefault(); event.stopImmediatePropagation(); return beginCheckout(); }
    if (target.id === 'refreshPayment') { event.preventDefault(); const { data: order } = await db.from('orders').select('status').eq('id', $('#modalContent code')?.textContent || '').maybeSingle(); toast(order?.status === 'paid' ? 'ชำระแล้ว' : 'รอ Omise ยืนยันการชำระ'); return; }
    if (target.dataset.contactSeller) { event.preventDefault(); const user = await needUser(); if (user) { if (user.id === target.dataset.contactSeller) return toast('นี่คือผลงานของคุณ'); $('#chatPanel').classList.add('open'); await loadChatList(); await startConversation(target.dataset.contactSeller, target.dataset.sellerName); } return; }
    if (target.id === 'createListingBtn') { event.preventDefault(); event.stopImmediatePropagation(); return openCreateListing(); }
    if (target.id === 'listingPublishBtn') { event.preventDefault(); event.stopImmediatePropagation(); return createListing(); }
    if (target.id === 'createEventBtn') { event.preventDefault(); event.stopImmediatePropagation(); return openCreateEvent(); }
    if (target.id === 'publishEvent') { event.preventDefault(); return publishEvent(); }
    if (target.id === 'myTicketsBtn') { event.preventDefault(); return openMyTickets(); }
    if (target.id === 'scanTicketBtn') { event.preventDefault(); if (location.pathname !== '/scan') history.pushState({}, '', '/scan'); return openScan(); }
    if (target.id === 'startCamera') { event.preventDefault(); return startCamera(); }
    if (target.id === 'stopCamera') { event.preventDefault(); return stopCamera(); }
    if (target.id === 'validateManual') { event.preventDefault(); return validateQR($('#manualTicketCode').value.trim()); }
    if (target.dataset.startChat) { event.preventDefault(); const { data: me } = await db.auth.getUser(); if (me.user?.id === target.dataset.startChat) return toast('นี่คือบัญชีของคุณ'); return startConversation(target.dataset.startChat, target.dataset.name); }
    if (target.dataset.openConversation) { event.preventDefault(); const label = target.querySelector('b')?.textContent; return openConversation(target.dataset.openConversation, label); }
  }, true);

  document.addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target || !['publishBtn', 'sendMessageBtn', 'commentSendBtn'].includes(target.id)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const user = await needUser(); if (!user) return;
    if (target.id === 'publishBtn') {
      const body = $('#postBody').value.trim(); if (!body) return toast('พิมพ์ข้อความก่อนโพสต์');
      const profile = await db.from('profiles').select('user_id').eq('user_id', user.id).single();
      if (profile.error) return toast('ไม่พบโปรไฟล์ผู้ใช้');
      const kind = $('#postKind').value;
      const { error } = await db.from('posts').insert({ author_id: user.id, kind, title: $('#postTitle').value.trim() || null, body, status: 'published', visibility: 'public' });
      if (error) return toast('โพสต์ไม่ได้: ' + error.message);
      closeModal(); await loadFeed(); toast('โพสต์เผยแพร่แล้ว');
    }
  }, true);

  document.addEventListener('click', async event => {
    const filter = event.target.closest('.filter-chip'); if (!filter) return;
    feedFilter = filter.dataset.filter || 'all'; await loadFeed();
  }, true);

  window.addEventListener('sourcewav:auth', async () => { await loadFeed(); await loadListings(); await loadEvents(); });
  $('#chatBtn')?.addEventListener('click', () => { if (!$('#chatPanel').dataset.liveBound) { $('#chatPanel').dataset.liveBound = '1'; loadChatList(); } });
  $('#chatBtn')?.addEventListener('click', () => { if ($('#chatPanel').classList.contains('open')) { $('#chatPanel').dataset.liveBound = ''; } });
  $('#modalClose')?.addEventListener('click', stopCamera);
  $('#modalBackdrop')?.addEventListener('click', event => { if (event.target.id === 'modalBackdrop') stopCamera(); });
  if (location.pathname === '/scan') openScan();
  db.auth.getSession().then(() => Promise.all([loadFeed(), loadListings(), loadEvents()]));
  db.channel('sourcewav-public-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, loadFeed).subscribe();
  db.channel('sourcewav-post-activity').on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, loadFeed).on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, loadFeed).subscribe();
  db.channel('sourcewav-public-market').on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, loadListings).subscribe();
  db.channel('sourcewav-public-events').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadEvents).subscribe();
})();
