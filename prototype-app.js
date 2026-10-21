/* Sourcewav app interactions, backed by the local SQLite API. */
(function () {
  const store = window.SourcewavStore;
  if (!store) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let commentTarget = '';
  let chatTarget = '';
  let pendingEvent = '';

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const state = () => store.getState();
  const persist = mutate => store.update(mutate);
  const feedback = (result, savedMessage) => toast(result.saved ? savedMessage : 'เซิร์ฟเวอร์ไม่เชื่อมต่อ ข้อมูลนี้เก็บชั่วคราวในเบราว์เซอร์');
  const close = () => $('#modalClose')?.click();
  const makeId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  function applyProfile(profile = state().profile) {
    const name = profile.displayName || 'มิน';
    const triggerName = $('#profileBtn span:last-child');
    const railName = $('.rail-profile strong');
    const railRole = $('.rail-profile small');
    if (triggerName) triggerName.textContent = name;
    if (railName) railName.textContent = name;
    if (railRole) railRole.textContent = [profile.role || 'นักฟังเพลง', profile.province || 'กรุงเทพฯ'].join(' · ');
  }

  function applyInteractions() {
    const current = state();
    $$('.post-card').forEach((card, index) => {
      card.dataset.postId ||= `seed-post-${index + 1}`;
      const postId = card.dataset.postId;
      const saved = current.interactions[postId];
      const like = $('.like-btn', card);
      const save = $('.save-btn', card);
      const comment = $('.comment-btn', card);
      if (saved?.liked && like) like.classList.add('liked');
      if (saved && like?.querySelector('b')) like.querySelector('b').textContent = saved.likeCount;
      if (current.bookmarks.includes(`post:${postId}`) && save) setSaveLabel(save, true);
      if (comment?.querySelector('b') && current.comments[postId]) comment.querySelector('b').textContent = Number(comment.querySelector('b').textContent) + current.comments[postId].length;
    });
    const eventInfo = $('#eventInfoBtn');
    if (eventInfo && current.bookmarks.includes('event:local-matter')) eventInfo.textContent = '✓ บันทึกไว้แล้ว';
    current.follows.forEach(username => {
      const button = $$('.person-row').find(row => row.dataset.username === username || $('strong', row)?.textContent === username)?.querySelector('.follow-btn');
      if (button) setFollowLabel(button, true);
    });
  }

  function setSaveLabel(button, saved) {
    button.classList.toggle('liked', saved);
    button.setAttribute('aria-pressed', String(saved));
    button.textContent = saved ? '✓ เก็บไว้แล้ว' : '♧ เก็บไว้';
  }

  function setFollowLabel(button, following) {
    button.classList.toggle('following', following);
    button.setAttribute('aria-pressed', String(following));
    button.textContent = following ? 'กำลังติดตาม' : 'ติดตาม';
  }

  function postMarkup(post) {
    const kindLabels = { music: 'เพลง', art: 'ศิลปะ', talk: 'พูดคุย', collab: 'หาเพื่อนร่วมงาน' };
    return `<article class="post-card user-post" data-post-id="${escapeHTML(post.id)}" data-kind="${escapeHTML(post.kind)}">
      <div class="post-top"><div class="avatar avatar-purple">${escapeHTML((post.author || 'ม').slice(0, 1))}</div><div class="post-author"><strong>${escapeHTML(post.author || 'มิน')}</strong><small>โพสต์เมื่อสักครู่ · ${escapeHTML(kindLabels[post.kind] || 'คอมมูนิตี้')}</small></div></div>
      ${post.title ? `<h3 class="user-post-title">${escapeHTML(post.title)}</h3>` : ''}<p class="post-copy">${escapeHTML(post.body).replace(/\n/g, '<br>')}</p>
      <div class="post-actions"><button class="like-btn" aria-pressed="false">♡ <span>ถูกใจ</span> <b>0</b></button><button class="comment-btn" aria-pressed="false">▢ <span>ความคิดเห็น</span> <b>0</b></button><button class="save-btn" aria-pressed="false">♧ เก็บไว้</button></div>
    </article>`;
  }

  function renderPosts() {
    const filterBar = $('.feed-filters');
    if (!filterBar) return;
    $$('.user-post', $('.section-block')).forEach(post => post.remove());
    const posts = state().posts;
    posts.slice().reverse().forEach(post => filterBar.insertAdjacentHTML('afterend', postMarkup(post)));
    applyInteractions();
    const selectedFilter = $('.filter-chip.selected')?.dataset.filter || 'all';
    applyFeedFilter(selectedFilter);
  }

  function applyFeedFilter(filter) {
    $$('.post-card').forEach(post => { post.hidden = filter !== 'all' && post.dataset.kind !== filter; });
  }

  function renderListings() {
    const host = $('#userListings');
    if (!host) return;
    host.innerHTML = state().listings.map(listing => `<article class="market-item user-listing"><div class="market-image listing-image"><span>ลงโดยคุณ</span><b>${escapeHTML(listing.categoryLabel)}</b></div><strong>${escapeHTML(listing.title)}</strong><small>${escapeHTML(listing.description || 'ผลงานจากสมาชิก Sourcewav')}</small><b>${listing.price ? `฿${Number(listing.price).toLocaleString('th-TH')}` : 'สอบถามราคา'}</b></article>`).join('');
  }

  function applyStoredMessages() {
    const panel = $('#chatPanel');
    if (!panel) return;
    $$('.chat-person', panel).forEach(button => {
      const name = button.dataset.chatPerson;
      const last = state().messages.filter(message => message.person === name).at(-1);
      if (last) $('small', button).textContent = `คุณ: ${last.body}`;
    });
  }

  function openComposer() {
    openModal(`<h2 id="modalTitle">แชร์ให้คอมมูนิตี้</h2><p>เดโม ไอเดีย หรือกำลังหาใครมาร่วมทำอะไรอยู่?</p><label class="modal-field">หัวข้อ (ไม่บังคับ)<input id="postTitle" maxlength="120" placeholder="ตั้งชื่อให้โพสต์ของคุณ" /></label><label class="modal-field">ข้อความ<textarea id="postBody" maxlength="3000" required placeholder="เล่าให้คนในวงการฟัง..."></textarea></label><label class="modal-field">หมวดหมู่<select id="postKind"><option value="music">เพลง / เดโม</option><option value="art">ศิลปะ / ผลงาน</option><option value="collab">หาเพื่อนร่วมงาน</option><option value="talk">พูดคุย</option></select></label><button class="modal-primary" id="publishBtn">โพสต์ลงฟีด</button><p class="local-note">บันทึกโพสต์ลงฐานข้อมูลของเว็บนี้</p>`);
  }

  function openProfileEditor() {
    const profile = state().profile;
    openModal(`<h2 id="modalTitle">โปรไฟล์ของฉัน</h2><p>โปรไฟล์ที่จัดเก็บใน Sourcewav</p><label class="modal-field">ชื่อที่แสดง<input id="profileName" maxlength="60" value="${escapeHTML(profile.displayName || 'มิน')}" required /></label><label class="modal-field">บทบาทในวงการ<input id="profileRole" maxlength="80" value="${escapeHTML(profile.role || 'นักฟังเพลง')}" placeholder="เช่น Rapper, Producer, Visual artist" /></label><label class="modal-field">จังหวัด<input id="profileProvince" maxlength="80" value="${escapeHTML(profile.province || 'กรุงเทพฯ')}" /></label><label class="modal-field">แนะนำตัว<textarea id="profileBio" maxlength="500" placeholder="เล่าให้คนอื่นรู้จักคุณ">${escapeHTML(profile.bio || '')}</textarea></label><button class="modal-primary" id="saveProfileBtn">บันทึกโปรไฟล์</button>`);
  }

  function openListingForm() {
    openModal(`<h2 id="modalTitle">ลงผลงานในตลาด</h2><p>เพิ่มผลงานพร้อมราคาและรายละเอียด</p><label class="modal-field">ชื่อผลงาน<input id="listingTitle" maxlength="100" required placeholder="เช่น ปกซิงเกิล / ภาพพิมพ์" /></label><label class="modal-field">ประเภท<select id="listingCategory"><option>ภาพพิมพ์</option><option>ดิจิทัลอาร์ต</option><option>รับ commission</option><option>แลกเปลี่ยน</option></select></label><label class="modal-field">รายละเอียด<textarea id="listingDescription" maxlength="500" placeholder="ขนาด สไตล์ หรือสิ่งที่อยากแลก"></textarea></label><label class="modal-field">ราคา (บาท)<input id="listingPrice" type="number" min="0" max="10000000" step="1" placeholder="เว้นว่างถ้าให้สอบถามราคา" /></label><button class="modal-primary" id="listingPublishBtn">บันทึกลงตลาด</button><p class="local-note">ประกาศนี้จะจัดเก็บในฐานข้อมูล Sourcewav</p>`);
  }

  function openChat(person) {
    chatTarget = person;
    const thread = state().messages.filter(message => message.person === person);
    const messages = thread.length ? thread.map(message => `<p class="local-message"><b>${escapeHTML(message.sender)}</b><br>${escapeHTML(message.body)}</p>`).join('') : '<p>เริ่มบทสนทนาด้วยข้อความสั้น ๆ ได้เลย</p>';
    openModal(`<h2 id="modalTitle">แชทกับ ${escapeHTML(person)}</h2><div class="chat-thread">${messages}</div><label class="modal-field">ข้อความ<textarea id="chatMessage" maxlength="2000" placeholder="พิมพ์ข้อความ..." required></textarea></label><button class="modal-primary" id="sendMessageBtn">ส่งข้อความ</button><p class="local-note">ข้อความจะถูกเก็บไว้ในฐานข้อมูลของเว็บนี้</p>`);
  }

  function toggleLike(button) {
    const card = button.closest('.post-card');
    const postId = card.dataset.postId;
    const old = state().interactions[postId] || { liked: false, likeCount: Number($('.like-btn b', card)?.textContent || 0) };
    const liked = !old.liked;
    const likeCount = Math.max(0, Number(old.likeCount) + (liked ? 1 : -1));
    const result = persist(data => { data.interactions[postId] = { liked, likeCount }; });
    button.classList.toggle('liked', liked);
    button.setAttribute('aria-pressed', String(liked));
    $('b', button).textContent = likeCount;
    button.firstChild.textContent = liked ? '♥ ' : '♡ ';
    feedback(result, liked ? 'ถูกใจโพสต์นี้แล้ว' : 'นำการถูกใจออกแล้ว');
  }

  function toggleSave(button) {
    const postId = button.closest('.post-card').dataset.postId;
    const key = `post:${postId}`;
    const saved = state().bookmarks.includes(key);
    const result = persist(data => { data.bookmarks = saved ? data.bookmarks.filter(item => item !== key) : [...data.bookmarks, key]; });
    setSaveLabel(button, !saved);
    feedback(result, saved ? 'นำโพสต์ออกจากรายการที่บันทึกแล้ว' : 'บันทึกโพสต์ไว้แล้ว');
  }

  function showComments(button) {
    const card = button.closest('.post-card');
    commentTarget = card.dataset.postId;
    const comments = state().comments[commentTarget] || [];
    const existing = comments.map(comment => `<p class="local-message"><b>${escapeHTML(comment.author)}</b><br>${escapeHTML(comment.body)}</p>`).join('');
    const sample = commentTarget.startsWith('seed-') ? '<p><b>มุก · MC</b><br>ชอบบรรยากาศของงานนี้มาก รอฟังเดโมเต็มเลย</p><p><b>ตะวัน · TAWAN</b><br>ขอบคุณครับ เดี๋ยวส่งเวอร์ชันใหม่มาให้ฟังอีกที</p>' : '';
    openModal(`<h2 id="modalTitle">คุยกันใต้โพสต์</h2><div class="comment-list">${existing || sample || '<p>ยังไม่มีความคิดเห็น เริ่มคุยได้เลย</p>'}</div><label class="modal-field">เขียนความคิดเห็น<textarea id="commentBody" maxlength="1000" required placeholder="แสดงความคิดเห็นอย่างสร้างสรรค์..."></textarea></label><button class="modal-primary" id="commentSendBtn">ส่งความคิดเห็น</button><p class="local-note">ความคิดเห็นนี้เก็บไว้ในเบราว์เซอร์เครื่องนี้</p>`);
  }

  function handleClick(event) {
    const target = event.target;
    const button = target.closest('button, a');
    if (!button) return;
    const postLike = target.closest('.like-btn');
    const postSave = target.closest('.save-btn');
    const postComment = target.closest('.comment-btn');
    const follow = target.closest('.follow-btn');
    const person = target.closest('.chat-person');
    const id = button.id;
    const ticketButton = target.closest('.buy-btn');
    const intercepted = postLike || postSave || postComment || follow || person || ticketButton || ['writePostBtn','composerInput','composerSend','joinBtn','publishBtn','saveProfileBtn','createListingBtn','listingPublishBtn','commentSendBtn','sendMessageBtn','rsvpBtn','searchGo','confirmPayBtn','eventInfoBtn','ticketInterestBtn'].includes(id);
    if (!intercepted) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (postLike) return toggleLike(postLike);
    if (postSave) return toggleSave(postSave);
    if (postComment) return showComments(postComment);
    if (ticketButton) {
      pendingEvent = ticketButton.dataset.event || 'อีเวนต์นี้';
      const saved = state().bookmarks.includes(`event:${pendingEvent}`);
      openModal(`<h2 id="modalTitle">ติดตามงานนี้</h2><p><strong>${escapeHTML(pendingEvent)}</strong></p><div class="checkout-event"><div class="checkout-row"><span>สถานะบัตร</span><b>ยังไม่เปิดขาย</b></div><div class="checkout-row"><span>การชำระเงิน</span><b>ยังไม่ได้เชื่อมผู้ให้บริการ</b></div></div><p class="payment-note">การแจ้งเตือนนี้จะบันทึกไว้ใน Sourcewav เท่านั้น ยังไม่มีการรับเงินหรือออกบัตร</p><button class="modal-primary" id="ticketInterestBtn">${saved ? '✓ ติดตามงานนี้แล้ว' : 'แจ้งเตือนเมื่อเปิดขาย'}</button>`);
      return;
    }
    if (follow) {
      const username = follow.closest('.person-row').dataset.username || $('strong', follow.closest('.person-row')).textContent.trim();
      const active = state().follows.includes(username);
      const result = persist(data => { data.follows = active ? data.follows.filter(item => item !== username) : [...data.follows, username]; });
      setFollowLabel(follow, !active);
      return feedback(result, active ? 'เลิกติดตามแล้ว' : 'เริ่มติดตามแล้ว');
    }
    if (person) return openChat(person.dataset.chatPerson || $('b', person).textContent.trim());
    if (['writePostBtn','composerInput','composerSend','joinBtn'].includes(id)) return openComposer();
    if (id === 'createListingBtn') return openListingForm();
    if (id === 'eventInfoBtn') {
      const saved = state().bookmarks.includes('event:local-matter');
      openModal(`<h2 id="modalTitle">LOCAL MATTER: ART MARKET</h2><p>ตลาดนัดของคนทำงานภาพ เสียง และสิ่งพิมพ์อิสระ · ข้อมูลตัวอย่าง</p><div class="checkout-event"><div class="checkout-row"><span>วันและเวลา</span><b>26 ตุลาคม · 14:00–21:00</b></div><div class="checkout-row"><span>สถานที่</span><b>Warehouse 30, กรุงเทพฯ</b></div><div class="checkout-row"><span>ค่าเข้า</span><b>ฟรี</b></div></div><button class="modal-primary" id="rsvpBtn">${saved ? '✓ บันทึกไว้แล้ว' : 'บันทึกงานนี้ไว้'}</button>`);
      return;
    }
    if (id === 'publishBtn') {
      const body = $('#postBody').value.trim();
      if (!body) return toast('พิมพ์ข้อความก่อนโพสต์');
      const profile = state().profile;
      const post = { id: makeId('post'), title: $('#postTitle').value.trim(), body, kind: $('#postKind').value, author: profile.displayName || 'มิน', createdAt: new Date().toISOString() };
      const result = persist(data => { data.posts.unshift(post); });
      close(); renderPosts();
      return feedback(result, 'โพสต์ใหม่อยู่บนฟีดแล้ว');
    }
    if (id === 'saveProfileBtn') {
      const displayName = $('#profileName').value.trim();
      if (!displayName) return toast('ใส่ชื่อที่แสดงก่อนบันทึก');
      const profile = { displayName, role: $('#profileRole').value.trim(), province: $('#profileProvince').value.trim(), bio: $('#profileBio').value.trim() };
      const result = persist(data => { data.profile = profile; }); applyProfile(profile); close(); return feedback(result, 'บันทึกโปรไฟล์แล้ว');
    }
    if (id === 'listingPublishBtn') {
      const title = $('#listingTitle').value.trim();
      const priceText = $('#listingPrice').value;
      if (!title) return toast('ใส่ชื่อผลงานก่อนบันทึก');
      if (priceText && (!Number.isFinite(Number(priceText)) || Number(priceText) < 0 || Number(priceText) > 10000000)) return toast('ตรวจสอบราคาก่อนบันทึก');
      const listing = { id: makeId('listing'), title, categoryLabel: $('#listingCategory').value, description: $('#listingDescription').value.trim(), price: priceText ? Number(priceText) : null, createdAt: new Date().toISOString() };
      const result = persist(data => { data.listings.unshift(listing); }); renderListings(); close(); return feedback(result, 'เพิ่มผลงานในตลาดแล้ว');
    }
    if (id === 'commentSendBtn') {
      const body = $('#commentBody').value.trim();
      if (!body) return toast('พิมพ์ความคิดเห็นก่อนส่ง');
      const comment = { id: makeId('comment'), author: state().profile.displayName || 'มิน', body, createdAt: new Date().toISOString() };
      const result = persist(data => { data.comments[commentTarget] ||= []; data.comments[commentTarget].push(comment); });
      const card = $(`[data-post-id="${CSS.escape(commentTarget)}"]`);
      if ($('.comment-btn b', card)) $('.comment-btn b', card).textContent = Number($('.comment-btn b', card).textContent) + 1;
      close(); return feedback(result, 'เพิ่มความคิดเห็นแล้ว');
    }
    if (id === 'sendMessageBtn') {
      const body = $('#chatMessage').value.trim();
      if (!body) return toast('พิมพ์ข้อความก่อนส่ง');
      const result = persist(data => { data.messages.push({ id: makeId('message'), person: chatTarget, sender: data.profile.displayName || 'มิน', body, createdAt: new Date().toISOString() }); });
      applyStoredMessages(); close(); return feedback(result, 'บันทึกข้อความแล้ว');
    }
    if (id === 'rsvpBtn') {
      const key = 'event:local-matter';
      const result = persist(data => { if (!data.bookmarks.includes(key)) data.bookmarks.push(key); });
      close(); return feedback(result, 'บันทึกงานนี้ไว้ในรายการของคุณแล้ว');
    }
    if (id === 'ticketInterestBtn') {
      const key = `event:${pendingEvent}`;
      const alreadySaved = state().bookmarks.includes(key);
      const result = persist(data => { if (!alreadySaved) data.bookmarks.push(key); });
      close(); return feedback(result, alreadySaved ? 'งานนี้อยู่ในรายการติดตามแล้ว' : 'บันทึกการติดตามงานแล้ว');
    }
    if (id === 'confirmPayBtn') { close(); return toast('ต้นแบบนี้ยังไม่รับชำระเงินจริง จึงยังไม่ออกบัตร'); }
    if (id === 'searchGo') {
      const query = $('.modal-field input')?.value.trim().toLocaleLowerCase('th');
      if (!query) return toast('พิมพ์คำค้นก่อน');
      close();
      let count = 0;
      $$('.post-card, .event-card, .market-item, .person-row').forEach(item => {
        const match = item.textContent.toLocaleLowerCase('th').includes(query);
        item.hidden = !match; if (match) count++;
      });
      return toast(count ? `พบ ${count} รายการที่ตรงกับ “${query}”` : `ยังไม่พบ “${query}”`);
    }
  }

  // Capture phase prevents the original demo-only handlers from showing false success states.
  function refreshStatus() {
    const badge = $('#dbStatus');
    if (!badge) return;
    const current = store.status();
    badge.classList.toggle('is-online', current === 'online');
    badge.classList.toggle('is-offline', current === 'offline');
    badge.classList.toggle('is-connecting', current === 'connecting');
    $('span', badge).textContent = current === 'online' ? 'ฐานข้อมูลเชื่อมต่อแล้ว' : current === 'offline' ? 'ออฟไลน์ · เก็บชั่วคราว' : 'กำลังเชื่อมฐานข้อมูล';
    badge.title = current === 'online' ? 'บันทึกข้อมูลลง SQLite ผ่านเว็บเซิร์ฟเวอร์' : 'กำลังใช้ข้อมูลสำรองในเบราว์เซอร์';
  }
  document.addEventListener('click', handleClick, true);
  window.addEventListener('sourcewav:store', refreshStatus);
  store.ready.then(() => {
    $$('.post-card').forEach((card, index) => { card.dataset.postId ||= `seed-post-${index + 1}`; });
    applyProfile(); renderPosts(); renderListings(); applyInteractions(); applyStoredMessages();
    $$('.person-row').forEach(row => { row.dataset.username ||= $('strong', row)?.textContent.trim() || ''; });
    applyInteractions();
    $$('.filter-chip').forEach(filter => filter.addEventListener('click', () => {
      $$('.filter-chip').forEach(chip => chip.classList.toggle('selected', chip === filter));
      applyFeedFilter(filter.dataset.filter);
    }));
    refreshStatus();
  });
})();
