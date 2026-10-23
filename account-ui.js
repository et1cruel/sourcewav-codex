(() => {
  const swProfileKey = 'sourcewav.profile.v1';
  let swProfileCache = null;
  const swDefaultProfile = {
    name: 'Guest',
    handle: 'guest',
    role: 'ผู้เยี่ยมชมเว็บไซต์',
    city: 'Guest',
    bio: 'กำลังสำรวจเพลง อีเวนต์ และชุมชนบน Sourcewav',
    avatarUrl: ''
  };
  let swGuestHandleCache = '';

  function swGuestHandle() {
    if (swGuestHandleCache) return swGuestHandleCache;
    try { swGuestHandleCache = localStorage.getItem('sourcewav.guest-handle.v1') || ''; } catch {}
    if (!/^sourcewavguest\d{5,7}$/.test(swGuestHandleCache)) {
      swGuestHandleCache = `sourcewavguest${Math.floor(100000 + Math.random() * 900000)}`;
      try { localStorage.setItem('sourcewav.guest-handle.v1', swGuestHandleCache); } catch {}
    }
    window.SourcewavGuestHandle = swGuestHandleCache;
    return swGuestHandleCache;
  }

  function swEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  async function swCompressAvatar(file) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.82);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  function swGetProfile() {
    try {
      if (!window.SourcewavAuthUser) {
        const handle = swGuestHandle();
        return { ...swDefaultProfile, name: handle, handle };
      }
      const stored = swProfileCache || window.SourcewavStore?.getState?.().profile || JSON.parse(localStorage.getItem(swProfileKey) || '{}');
      return {
        ...swDefaultProfile,
        name: stored.displayName || stored.name || swDefaultProfile.name,
        handle: stored.handle || swDefaultProfile.handle,
        role: stored.role || swDefaultProfile.role,
        city: stored.province || stored.city || swDefaultProfile.city,
        bio: stored.bio || swDefaultProfile.bio,
        avatarUrl: stored.avatarUrl || stored.avatar_url || swDefaultProfile.avatarUrl
      };
    } catch {
      return { ...swDefaultProfile };
    }
  }

  function swSaveProfile(profile) {
    if (window.SourcewavStore?.update) {
      return window.SourcewavStore.update(state => {
        state.profile = { ...state.profile, displayName: profile.name, handle: profile.handle, role: profile.role, province: profile.city, bio: profile.bio, avatarUrl: profile.avatarUrl };
      });
    }
    localStorage.setItem(swProfileKey, JSON.stringify(profile));
    return { saved: false };
  }

  function swCacheRemoteProfile(row) {
    if (!row) return;
    swProfileCache = {
      displayName: row.display_name,
      handle: row.username,
      role: row.roles?.[0] || 'นักฟังเพลง',
      province: row.province || row.city || 'กรุงเทพฯ',
      bio: row.bio || '',
      avatarUrl: row.avatar_url || ''
    };
    localStorage.setItem(swProfileKey, JSON.stringify(swProfileCache));
    window.SourcewavStore?.update(state => {
      state.profile = { ...state.profile, displayName: swProfileCache.displayName, handle: swProfileCache.handle, role: swProfileCache.role, province: swProfileCache.province, bio: swProfileCache.bio, avatarUrl: swProfileCache.avatarUrl };
    });
    swUpdateProfileChrome(swGetProfile());
  }

  async function swLoadRemoteProfile() {
    const client = window.SourcewavSupabase;
    const user = window.SourcewavAuthUser;
    if (!client || !user) return null;
    const { data, error } = await client.from('profiles')
      .select('username,display_name,roles,province,bio,avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) swCacheRemoteProfile(data);
    return data;
  }

  function swUpdateProfileChrome(profile) {
    const renderAvatar = (node, label) => {
      if (!node) return;
      node.replaceChildren();
      if (profile.avatarUrl) {
        const image = document.createElement('img');
        image.src = profile.avatarUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        node.append(image);
        node.classList.add('has-avatar-image');
      } else {
        node.textContent = label;
        node.classList.remove('has-avatar-image');
      }
    };
    const trigger = document.querySelector('#profileBtn');
    if (trigger) {
      const avatar = trigger.querySelector('.avatar');
      const label = trigger.querySelector('span:last-child');
      renderAvatar(avatar, [...profile.name][0] || 'S');
      if (label) label.textContent = profile.name.split(/\s+/)[0];
      trigger.setAttribute('aria-label', `โปรไฟล์ ${profile.name}`);
    }
    const railAvatar = document.querySelector('.rail-profile .avatar');
    const railAvatarLink = document.querySelector('.rail-profile-avatar-link');
    const railName = document.querySelector('.rail-profile strong');
    const railMeta = document.querySelector('.rail-profile small');
    const composerAvatar = document.querySelector('.composer .avatar');
    renderAvatar(railAvatar, [...profile.name][0] || 'S');
    renderAvatar(composerAvatar, [...profile.name][0] || 'S');
    if (railAvatarLink) {
      const username = String(profile.handle || '').trim();
      const canOpenArtistProfile = Boolean(window.SourcewavAuthUser && username && username.toLowerCase() !== 'guest');
      if (canOpenArtistProfile) {
        railAvatarLink.href = `#artist/${encodeURIComponent(username)}`;
        railAvatarLink.setAttribute('aria-label', `เปิดโปรไฟล์ศิลปิน ${profile.name}`);
        railAvatarLink.removeAttribute('aria-disabled');
        railAvatarLink.removeAttribute('tabindex');
      } else {
        railAvatarLink.removeAttribute('href');
        railAvatarLink.setAttribute('aria-disabled', 'true');
        railAvatarLink.setAttribute('tabindex', '-1');
        railAvatarLink.removeAttribute('aria-label');
      }
    }
    if (railName) railName.textContent = profile.name;
    if (railMeta) railMeta.textContent = `@${profile.handle} · ${window.SourcewavAuthUser ? profile.city : profile.role}`;
  }

  function swShow(html) {
    openModal(html, { accountModal: true, trigger: document.querySelector('#profileBtn') });
  }

  function swProfileView() {
    const profile = swGetProfile();
    const sessionActive = Boolean(window.SourcewavAuthUser);
    swUpdateProfileChrome(profile);
    if (!sessionActive) {
      swShow(`<section class="profile-page guest-profile-page">
        <div class="profile-cover"><div class="profile-soundwave" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="--wave:${10 + ((i * 17 + 9) % 29)}px"></i>`).join('')}</div><span class="profile-cover-tag">SOURCEWAV / GUEST</span></div>
        <div class="profile-grid"><section class="profile-identity-card" aria-label="สถานะผู้เยี่ยมชม">
          <div class="profile-identity"><div class="profile-avatar">G</div><div class="profile-identity-copy"><span class="account-status"><i></i>ผู้เยี่ยมชมเว็บไซต์</span><h2 id="modalTitle">${swEscape(profile.handle)}</h2><p>เข้าชมแบบไม่ต้องสมัครสมาชิก · username สำหรับผู้เยี่ยมชม</p></div></div>
          <p class="profile-bio">ฟังเพลง ดูโพสต์ ค้นหาศิลปินและดูอีเวนต์สาธารณะได้เลย</p>
          <div class="profile-guest-links"><a href="#music" data-account-action="close">♫ ไปหน้าฟังเพลง</a><a href="#events" data-account-action="close">ตั๋ว · ดูอีเวนต์</a></div>
          <div class="profile-auth-links"><span>อยากโพสต์ กดถูกใจ หรือเก็บรายการไว้?</span><button type="button" data-account-action="register">สร้างบัญชี</button><button type="button" data-account-action="login">เข้าสู่ระบบ</button></div>
        </section></div>
      </section>`);
      return;
    }
    swShow(`<section class="profile-page">
      <div class="profile-cover"><div class="profile-soundwave" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="--wave:${10 + ((i * 17 + 9) % 29)}px"></i>`).join('')}</div><span class="profile-cover-tag">SOURCEWAV / PROFILE</span></div>
      <div class="profile-grid"><section class="profile-identity-card" aria-label="ข้อมูลโปรไฟล์">
      <div class="profile-identity"><div class="profile-avatar">${profile.avatarUrl ? '<img src="' + swEscape(profile.avatarUrl) + '" alt="" />' : swEscape([...profile.name][0] || 'S')}</div><div class="profile-identity-copy"><span class="account-status"><i></i>${sessionActive ? 'บัญชี Sourcewav' : 'โปรไฟล์ตัวอย่าง'}</span><h2 id="modalTitle">${swEscape(profile.name)}</h2><p>@${swEscape(profile.handle)} <span>·</span> ${swEscape(profile.role)}</p></div><button class="profile-edit-icon" type="button" data-account-action="edit" aria-label="แก้ไขโปรไฟล์">✎</button></div>
      <p class="profile-bio">${swEscape(profile.bio)}</p>
      <div class="profile-location"><span aria-hidden="true">⌖</span> ${swEscape(profile.city)} <span class="profile-location-note">· บ้านของคอมมูนิตี้</span></div>
      <div class="profile-stats"><div><b>0</b><span>เพลง</span></div><div><b>0</b><span>ผลงาน</span></div><div><b>0</b><span>กำลังติดตาม</span></div></div>
      </section><section class="profile-work" aria-labelledby="profileWorkTitle">
        <div class="profile-work-heading"><div><span class="account-eyebrow">YOUR CORNER & STORE</span><h3 id="profileWorkTitle">พื้นที่ผลงานและร้านค้าของคุณ</h3></div><span class="profile-work-mark">♫</span></div>
        <p>เพลง เดโม สินค้า Merch เทป ซีดี และบีทที่คุณเปิดขาย รวมทั้งการตั้งค่ารับงาน Booking อยู่ตรงนี้</p>
        <div class="profile-work-actions">
          <a href="#music" class="profile-first-work profile-music-action" data-account-action="close"><span class="profile-action-icon" aria-hidden="true">♫</span><span class="profile-action-copy"><b>ปล่อยเพลงหรือเดโม</b><small>แชร์เสียงของคุณให้ชุมชนได้ฟัง</small></span><span class="profile-action-arrow" aria-hidden="true">↗</span></a>
          <button type="button" class="profile-first-work profile-store-action" data-account-action="open-store"><span class="profile-action-icon" aria-hidden="true">▣</span><span class="profile-action-copy"><b>ร้านค้าศิลปิน</b><small>ขายสินค้าและผลงานสร้างสรรค์</small></span><span class="profile-action-arrow" aria-hidden="true">↗</span></button>
          <button type="button" class="profile-first-work profile-booking-action" data-account-action="open-booking"><span class="profile-action-icon" aria-hidden="true">✳</span><span class="profile-action-copy"><b>รับงาน Booking</b><small>เปิดโปรไฟล์ให้ผู้จัดค้นพบคุณ</small></span><span class="profile-action-arrow" aria-hidden="true">↗</span></button>
          <button type="button" class="profile-first-work profile-organizer-action" data-account-action="organizer"><span class="profile-action-icon" aria-hidden="true">▤</span><span class="profile-action-copy"><b>หลังบ้านผู้จัด</b><small>สร้างอีเวนต์และจัดการบัตร</small></span><span class="profile-action-arrow" aria-hidden="true">↗</span></button>
        </div>
      </section></div>
      <div class="profile-footer">
      <div class="profile-actions"><button type="button" class="modal-primary profile-edit-button" data-account-action="edit">แก้ไขโปรไฟล์</button>${sessionActive ? '<button type="button" class="profile-logout" data-account-action="logout">ออกจากระบบ</button>' : ''}</div>
      </div>
      ${sessionActive ? '' : '<div class="profile-auth-links"><span>จัดการบัญชี</span><button type="button" data-account-action="register">สร้างบัญชี</button><button type="button" data-account-action="login">เข้าสู่ระบบ</button></div>'}
    </section>`);
  }

  function swAuthBrandMarkup() {
    const sourceLogo = document.querySelector('.topbar .brand-logo');
    if (!sourceLogo) return '<a class="auth-brand" href="#home" data-account-action="close"><span>SW</span> sourcewav</a>';
    const logo = sourceLogo.outerHTML
      .replaceAll('swRough', 'authSwRough')
      .replaceAll('swDots', 'authSwDots')
      .replaceAll('swSpeckle', 'authSwSpeckle');
    return `<a class="auth-brand auth-brand-logo" href="#home" aria-label="Sourcewav หน้าแรก" data-account-action="close">${logo}</a>`;
  }

  function swAuthView(mode = 'register') {
    const isRegister = mode === 'register';
    const isRecovery = mode === 'recovery';
    const fields = isRegister ? `<label class="account-field"><span>ชื่อที่ใช้ในคอมมูนิตี้</span><input name="displayName" type="text" autocomplete="name" placeholder="เช่น ชื่อที่ใช้ในวงการ" minlength="2" maxlength="32" required /></label>
      <label class="account-field"><span>ชื่อผู้ใช้</span><input name="username" type="text" autocomplete="username" placeholder="เช่น min_wav" pattern="[A-Za-z0-9_]{3,30}" minlength="3" maxlength="30" required /><small>ใช้ภาษาอังกฤษ ตัวเลข หรือขีดล่าง 3–30 ตัว</small></label>
      <div class="account-field-row"><label class="account-field"><span>คุณทำอะไร</span><select name="role"><option>Rapper / MC</option><option>Producer / Beatmaker</option><option>DJ</option><option>ศิลปิน / นักวาด</option><option>คนทำงานเบื้องหลัง</option><option>Organizer / ผู้จัดงานอีเวนต์</option><option>นักฟังเพลง</option></select></label><label class="account-field"><span>เมืองของคุณ</span><input name="city" type="text" autocomplete="address-level2" value="กรุงเทพฯ" maxlength="40" required /></label></div>` : '';
    const credentialFields = isRecovery
      ? `<label class="account-field"><span>รหัสผ่านใหม่</span><input name="password" type="password" autocomplete="new-password" minlength="8" placeholder="อย่างน้อย 8 ตัวอักษร" required /></label><label class="account-field"><span>ยืนยันรหัสผ่านใหม่</span><input name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" placeholder="กรอกรหัสผ่านอีกครั้ง" required /></label>`
      : `<label class="account-field"><span>อีเมล</span><input name="email" type="email" autocomplete="email" placeholder="you@example.com" required /></label><label class="account-field"><span>รหัสผ่าน</span><span class="password-control"><input name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" placeholder="${isRegister ? 'อย่างน้อย 8 ตัวอักษร' : 'กรอกรหัสผ่าน'}" minlength="${isRegister ? '8' : '1'}" required /><button type="button" data-account-action="toggle-password" aria-label="แสดงรหัสผ่าน">แสดง</button></span></label>`;
    swShow(`<section class="auth-shell auth-${mode}">
      <aside class="auth-art">${swAuthBrandMarkup()}<div class="auth-art-center"><div class="auth-disc" aria-hidden="true"><i></i><i></i><i></i></div><span class="auth-art-note">เสียงของเมืองนี้</span><h2>${isRegister ? 'พื้นที่อิสระ<br />ของศิลปิน' : 'พื้นที่ของคน<br />ที่ทำจริง'}</h2><p>เดโมที่ยังไม่เสร็จ งานที่ยังไม่ลงตัว และคนที่อยากเจอคนแบบเดียวกัน</p></div><div class="auth-wave" aria-hidden="true">${Array.from({ length: 42 }, (_, i) => `<i style="--wave:${8 + ((i * 11 + 13) % 40)}px"></i>`).join('')}</div><span class="auth-art-foot">เพลง · ศิลปะ · คนของเรา</span></aside>
      <div class="auth-panel"><div class="auth-panel-head"><span class="account-status"><i></i> COMMUNITY ACCESS</span><span class="auth-step">${isRecovery ? 'ตั้งรหัสผ่านใหม่' : isRegister ? 'เข้าร่วมคอมมูนิตี้' : 'กลับมาเจอกันอีก'}</span></div>${isRecovery ? '' : `<div class="auth-tabs" role="tablist" aria-label="บัญชีผู้ใช้"><button type="button" role="tab" aria-selected="${isRegister}" class="${isRegister ? 'active' : ''}" data-account-action="register">สมัครสมาชิก</button><button type="button" role="tab" aria-selected="${!isRegister}" class="${!isRegister ? 'active' : ''}" data-account-action="login">เข้าสู่ระบบ</button></div>`}
      <h1 id="modalTitle">${isRecovery ? 'ตั้งรหัสผ่านใหม่' : isRegister ? 'เข้าร่วมชุมชนดนตรี' : 'ยินดีต้อนรับกลับ'}</h1><p class="auth-intro">${isRecovery ? 'เลือกรหัสผ่านใหม่เพื่อกลับเข้าสู่ Sourcewav' : isRegister ? 'สร้างบัญชีเพื่อพบเพื่อนร่วมวงการ แชร์ผลงาน และค้นหาโอกาสใหม่ ๆ' : 'เข้าสู่บัญชีเพื่อกลับไปพบผลงานและผู้คนที่คุณติดตาม'}</p>
      <form id="accountForm" data-auth-mode="${mode}" novalidate>${fields}${credentialFields}${isRegister ? '<label class="account-consent"><input name="terms" type="checkbox" required /><span>ฉันยอมรับ <a href="#community" data-account-action="close">แนวทางชุมชน</a> และต้องการเข้าร่วม Sourcewav</span></label>' : isRecovery ? '' : '<button type="button" class="auth-forgot" data-account-action="forgot">ลืมรหัสผ่าน?</button>'}<p class="auth-error" id="accountError" role="alert" hidden></p><button type="submit" class="auth-submit">${isRecovery ? 'บันทึกรหัสผ่านใหม่' : isRegister ? 'สร้างโปรไฟล์' : 'เข้าสู่ระบบ'} <span aria-hidden="true">↗</span></button>${!isRegister && !isRecovery ? `<div class="auth-google-divider" aria-hidden="true"><span>หรือ</span></div><button type="button" class="auth-google-button" data-account-action="google-login" aria-label="เข้าสู่ระบบด้วย Google"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.9 6-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6v-5.3H5.9a20 20 0 0 0 0 18.2l6.9-5.3Z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.9 29.5 4 24 4A20 20 0 0 0 5.9 14.9l6.9 5.3C14.4 15.5 18.8 12 24 12Z"/></svg><span class="google-label">เข้าสู่ระบบด้วย Google</span></button>` : ''}</form>
      <div class="auth-local-note"><span>ⓘ</span><p>บัญชีของคุณใช้ Supabase Auth และรหัสผ่านจะไม่ถูกเก็บใน Sourcewav</p></div><p class="auth-bottom">${isRecovery ? 'จำรหัสผ่านได้แล้ว?' : isRegister ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'} <button type="button" data-account-action="${isRegister || isRecovery ? 'login' : 'register'}">${isRegister || isRecovery ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button></p></div>
    </section>`);
  }

  function swEditView() {
    const profile = swGetProfile();
    const sessionActive = Boolean(window.SourcewavAuthUser);
    swShow(`<section class="profile-editor"><div class="editor-cover"><div class="profile-soundwave" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="--wave:${10 + ((i * 17 + 9) % 29)}px"></i>`).join('')}</div><span class="profile-cover-tag">SOURCEWAV / PROFILE</span></div><div class="editor-heading"><span class="account-status"><i></i> PROFILE SETTINGS</span><h2 id="modalTitle">ทำโปรไฟล์ให้เป็นคุณ</h2><p>บอกคนในวงการว่าคุณเป็นใคร และอยากทำอะไรต่อไป</p></div><form id="profileForm" aria-labelledby="modalTitle"><div class="editor-layout"><div class="editor-avatar-row"><div class="editor-avatar-stage"><div class="editor-avatar ${profile.avatarUrl ? 'has-avatar-image' : ''}" id="profileAvatarPreview" aria-hidden="true">${profile.avatarUrl ? '<img src="' + swEscape(profile.avatarUrl) + '" alt="" />' : swEscape([...profile.name][0] || 'S')}</div><label class="avatar-camera-pick" for="profileAvatarFile" aria-label="เลือกหรือเปลี่ยนรูปโปรไฟล์"><svg viewBox="0 0 48 48" aria-hidden="true"><path class="camera-body" d="M8 16h7l3-5h12l3 5h7a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3Z"/><circle class="camera-lens" cx="24" cy="27" r="8"/><circle class="camera-glint" cx="27" cy="24" r="2"/></svg><span>เปลี่ยนรูป</span></label></div><input class="avatar-file-input" id="profileAvatarFile" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" aria-label="เลือกรูปโปรไฟล์" /></div><div class="editor-profile-fields"><label class="account-field"><span>ชื่อที่แสดง</span><input name="displayName" value="${swEscape(profile.name)}" minlength="2" maxlength="32" required /></label><label class="account-field"><span>ชื่อผู้ใช้</span><div class="handle-control"><span>@</span><input name="handle" value="${swEscape(profile.handle)}" pattern="[A-Za-z0-9_]{3,30}" minlength="3" maxlength="30" required /></div><small>ใช้ตัวอักษรอังกฤษ ตัวเลข หรือขีดล่าง 3–30 ตัว</small></label><div class="account-field-row"><label class="account-field"><span>บทบาทในวงการ</span><select name="role">${['Rapper / MC','Producer / Beatmaker','DJ','ศิลปิน / นักวาด','คนทำงานเบื้องหลัง','Organizer / ผู้จัดงานอีเวนต์','นักฟังเพลง'].map(role => `<option ${profile.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select></label><label class="account-field"><span>เมือง</span><input name="city" value="${swEscape(profile.city)}" maxlength="40" required /></label></div><label class="account-field"><span>แนะนำตัว</span><textarea name="bio" maxlength="160" rows="3" placeholder="บอกสั้น ๆ ว่าคุณกำลังทำอะไร หรืออยากเจอใคร">${swEscape(profile.bio)}</textarea><small class="field-counter">ไม่เกิน 160 ตัวอักษร</small></label></div><div class="editor-actions"><button type="button" class="editor-cancel" data-account-action="profile">ยกเลิก</button><button type="submit" class="auth-submit">บันทึกโปรไฟล์ <span aria-hidden="true">↗</span></button></div></div></form></section>`);
  }

  function swHandleAction(action, event) {
    if (!action) return false;
    const target = event.target instanceof Element ? event.target : null;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action === 'register') swAuthView('register');
    if (action === 'login') swAuthView('login');
    if (action === 'profile') swProfileView();
    if (action === 'edit') swEditView();
    if (action === 'google-login') {
      const button = target?.closest('[data-account-action="google-login"]');
      const error = document.querySelector('#accountError');
      const client = window.SourcewavSupabase;
      if (!client) {
        if (error) { error.hidden = false; error.textContent = 'ยังเชื่อมต่อ Supabase ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง'; }
        return;
      }
      if (button) {
        button.disabled = true;
        const label = button.querySelector('.google-label');
        if (label) label.textContent = 'กำลังเชื่อมต่อ Google…';
      }
      if (error) error.hidden = true;
      client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${window.location.pathname}` }
      }).then(({ error: oauthError }) => {
        if (oauthError) throw oauthError;
      }).catch(oauthError => {
        if (error) {
          error.hidden = false;
          error.textContent = /provider.*(not enabled|unsupported)|unsupported provider/i.test(oauthError.message || '')
            ? 'Google Login ยังไม่ได้เปิดใน Supabase Auth กรุณาเปิด Google provider และตั้งค่า redirect URL ก่อน'
            : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง';
        }
      }).finally(() => {
        if (button?.isConnected) {
          button.disabled = false;
          const label = button.querySelector('.google-label');
          if (label) label.textContent = 'เข้าสู่ระบบด้วย Google';
        }
      });
    }
    if (action === 'open-store') {
      closeModal();
      location.hash = '#artist-store';
      window.SourcewavFeatures?.openAddProductModal();
      return;
    }
    if (action === 'open-booking') {
      closeModal();
      location.hash = '#booking';
      window.SourcewavFeatures?.openJoinBookingModal();
      return;
    }
    if (action === 'organizer') {
      window.SourcewavFeatures?.openCommandCenterModal();
      return;
    }
    if (action === 'logout') {
      window.SourcewavSupabase?.auth.signOut().then(({ error }) => {
        if (error) return toast('ออกจากระบบไม่สำเร็จ ลองอีกครั้ง');
        swProfileCache = null;
        localStorage.removeItem(swProfileKey);
        swProfileView();
        toast('ออกจากระบบแล้ว');
      });
    }
    if (action === 'toggle-password') {
      const input = event.target.closest('.password-control')?.querySelector('input');
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
        event.target.textContent = input.type === 'password' ? 'แสดง' : 'ซ่อน';
        event.target.setAttribute('aria-label', input.type === 'password' ? 'แสดงรหัสผ่าน' : 'ซ่อนรหัสผ่าน');
      }
    }
    if (action === 'forgot') {
      const error = document.querySelector('#accountError');
      const email = document.querySelector('#accountForm [name="email"]')?.value.trim();
      if (!email) { if (error) { error.hidden = false; error.textContent = 'กรอกอีเมลก่อนขอลิงก์ตั้งรหัสผ่านใหม่'; } return; }
      window.SourcewavSupabase?.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${window.location.pathname}` })
        .then(({ error: resetError }) => {
          if (error) { error.hidden = false; error.textContent = resetError ? 'ส่งลิงก์ไม่สำเร็จ ตรวจสอบอีเมลแล้วลองอีกครั้ง' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว'; }
        });
    }
    if (action === 'close') {
      const destination = target?.closest('a')?.getAttribute('href');
      closeModal();
      if (destination?.startsWith('#')) window.location.hash = destination;
    }
    return true;
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#profileBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      swProfileView();
      return;
    }
    swHandleAction(target.closest('[data-account-action]')?.dataset.accountAction, event);
  }, true);

  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === 'accountForm') {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const error = document.querySelector('#accountError');
      const password = String(data.get('password') || '');
      if (password.length < (form.dataset.authMode === 'register' ? 8 : 1)) {
        error.hidden = false;
        error.textContent = form.dataset.authMode === 'register' ? 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' : 'กรุณากรอกรหัสผ่าน';
        form.querySelector('[name="password"]').focus();
        return;
      }
      if (form.dataset.authMode === 'register' && !data.get('terms')) {
        error.hidden = false;
        error.textContent = 'กรุณายอมรับแนวทางชุมชนก่อนสร้างโปรไฟล์';
        form.querySelector('[name="terms"]').focus();
        return;
      }
      const client = window.SourcewavSupabase;
      if (!client) {
        error.hidden = false;
        error.textContent = 'ยังเชื่อมต่อ Supabase ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
        return;
      }
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      error.hidden = true;
      try {
        if (form.dataset.authMode === 'recovery') {
          if (password !== String(data.get('passwordConfirm') || '')) {
            error.hidden = false;
            error.textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
            return;
          }
          const { error: updateError } = await client.auth.updateUser({ password });
          if (updateError) throw updateError;
          swProfileView();
          toast('ตั้งรหัสผ่านใหม่แล้ว');
        } else if (form.dataset.authMode === 'register') {
          const metadata = {
            username: String(data.get('username') || '').trim(),
            display_name: String(data.get('displayName') || '').trim(),
            province: String(data.get('city') || '').trim(),
            roles: [String(data.get('role') || 'นักฟังเพลง')]
          };
          const redirectTo = window.location.origin.startsWith('http') ? `${window.location.origin}${window.location.pathname}` : undefined;
          const { data: result, error: authError } = await client.auth.signUp({
            email: String(data.get('email') || '').trim(), password,
            options: { data: metadata, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) }
          });
          if (authError) throw authError;
          if (!result.session) {
            error.hidden = false;
            error.textContent = 'ส่งลิงก์ยืนยันไปที่อีเมลแล้ว ยืนยันบัญชีก่อนเข้าสู่ระบบ';
            return;
          }
          window.SourcewavAuthUser = result.user;
          await swLoadRemoteProfile();
          swProfileView();
          toast('สร้างบัญชี Sourcewav แล้ว');
        } else {
          const { data: result, error: authError } = await client.auth.signInWithPassword({
            email: String(data.get('email') || '').trim(), password
          });
          if (authError) throw authError;
          window.SourcewavAuthUser = result.user;
          await swLoadRemoteProfile();
          swProfileView();
          toast('เข้าสู่ระบบแล้ว');
        }
      } catch (authError) {
        error.hidden = false;
        error.textContent = authError.message?.includes('already registered')
          ? 'อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบแทน'
          : authError.message?.includes('Invalid login credentials')
            ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
            : authError.message?.includes('username')
              ? 'ชื่อผู้ใช้นี้ถูกใช้แล้ว หรือรูปแบบไม่ถูกต้อง'
              : 'ดำเนินการไม่สำเร็จ ตรวจสอบข้อมูลแล้วลองอีกครั้ง';
      } finally {
        if (submit.isConnected) submit.disabled = false;
      }
      return;
    }
    if (form.id === 'profileForm') {
      event.preventDefault();
      const data = new FormData(form);
      const profile = {
        name: String(data.get('displayName') || '').trim(),
        handle: String(data.get('handle') || '').trim(),
        role: data.get('role'),
        city: String(data.get('city') || '').trim(),
        bio: String(data.get('bio') || '').trim() || 'อยู่ตรงนี้เพื่อฟังเพลงใหม่ ๆ และเจอคนทำของน่าสนใจ',
        avatarUrl: swGetProfile().avatarUrl
      };
      const avatarFile = data.get('avatar');
      let uploadedAvatarKey = '';
      if (avatarFile instanceof File && avatarFile.size) {
        if (!window.SourcewavAuthUser || !window.SourcewavSupabase) return toast('เข้าสู่ระบบก่อนเพื่ออัปโหลดรูปโปรไฟล์');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(avatarFile.type) || avatarFile.size > 10 * 1024 * 1024) return toast('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 10 MB');
        const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[avatarFile.type];
        uploadedAvatarKey = `${window.SourcewavAuthUser.id}/${crypto.randomUUID()}.${extension}`;
        try {
          profile.avatarUrl = (await window.SourcewavS3.upload('image', uploadedAvatarKey, avatarFile)).publicUrl;
        } catch (uploadError) {
          return toast('อัปโหลดรูปไม่สำเร็จ: ' + uploadError.message);
        }
      }
      if (avatarFile instanceof File && avatarFile.size && !(window.SourcewavAuthUser && window.SourcewavSupabase)) {
        profile.avatarUrl = await swCompressAvatar(avatarFile);
      }
      if (window.SourcewavAuthUser && window.SourcewavSupabase) {
        const { error } = await window.SourcewavSupabase.from('profiles').update({
          username: profile.handle,
          display_name: profile.name,
          roles: [profile.role],
          province: profile.city,
          bio: profile.bio,
          avatar_url: profile.avatarUrl || null
        }).eq('user_id', window.SourcewavAuthUser.id);
        if (error) {
          if (uploadedAvatarKey) await window.SourcewavS3.remove([uploadedAvatarKey]).catch(() => {});
          toast(error.code === '23505' ? 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' : 'บันทึกโปรไฟล์ไม่สำเร็จ');
          return;
        }
        swCacheRemoteProfile({ username: profile.handle, display_name: profile.name, roles: [profile.role], province: profile.city, bio: profile.bio, avatar_url: profile.avatarUrl });
      } else swSaveProfile(profile);
      swUpdateProfileChrome(profile);
      swProfileView();
      toast(window.SourcewavAuthUser ? 'บันทึกโปรไฟล์ใน Supabase แล้ว' : 'บันทึกโปรไฟล์ไว้ในเบราว์เซอร์แล้ว');
    }
  }, true);

  document.addEventListener('change', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.id !== 'profileAvatarFile') return;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      input.value = '';
      toast('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 10 MB');
      return;
    }
    const preview = document.querySelector('#profileAvatarPreview');
    if (!preview) return;
    if (preview.dataset.previewUrl) URL.revokeObjectURL(preview.dataset.previewUrl);
    const url = URL.createObjectURL(file);
    preview.dataset.previewUrl = url;
    preview.classList.add('has-avatar-image');
    preview.replaceChildren(Object.assign(document.createElement('img'), { src: url, alt: 'ตัวอย่างรูปโปรไฟล์ที่เลือก' }));
  }, true);

  window.addEventListener('sourcewav:auth', event => {
    if (event.detail.authEvent === 'PASSWORD_RECOVERY') swAuthView('recovery');
    if (event.detail.user) swLoadRemoteProfile().catch(() => {});
    else { swProfileCache = null; swUpdateProfileChrome(swGetProfile()); }
  });
  swUpdateProfileChrome(swGetProfile());
})();
