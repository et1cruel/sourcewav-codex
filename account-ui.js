(() => {
  const swProfileKey = 'sourcewav.profile.v1';
  const swSessionKey = 'sourcewav.demo-session';
  const swDefaultProfile = {
    name: 'มินตรา',
    handle: 'min.wav',
    role: 'นักฟังเพลง',
    city: 'กรุงเทพฯ',
    bio: 'อยู่ตรงนี้เพื่อฟังเพลงใหม่ ๆ และเจอคนทำของน่าสนใจ'
  };

  function swEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function swGetProfile() {
    try {
      const stored = window.SourcewavStore?.getState?.().profile || JSON.parse(localStorage.getItem(swProfileKey) || '{}');
      return {
        ...swDefaultProfile,
        name: stored.displayName || stored.name || swDefaultProfile.name,
        handle: stored.handle || swDefaultProfile.handle,
        role: stored.role || swDefaultProfile.role,
        city: stored.province || stored.city || swDefaultProfile.city,
        bio: stored.bio || swDefaultProfile.bio
      };
    } catch {
      return { ...swDefaultProfile };
    }
  }

  function swSaveProfile(profile) {
    if (window.SourcewavStore?.update) {
      return window.SourcewavStore.update(state => {
        state.profile = { ...state.profile, displayName: profile.name, handle: profile.handle, role: profile.role, province: profile.city, bio: profile.bio };
      });
    }
    localStorage.setItem(swProfileKey, JSON.stringify(profile));
    return { saved: false };
  }

  function swUpdateProfileChrome(profile) {
    const trigger = document.querySelector('#profileBtn');
    if (trigger) {
      const avatar = trigger.querySelector('.avatar');
      const label = trigger.querySelector('span:last-child');
      if (avatar) avatar.textContent = [...profile.name][0] || 'S';
      if (label) label.textContent = profile.name.split(/\s+/)[0];
      trigger.setAttribute('aria-label', `โปรไฟล์ ${profile.name}`);
    }
    const railAvatar = document.querySelector('.rail-profile .avatar');
    const railName = document.querySelector('.rail-profile strong');
    const railMeta = document.querySelector('.rail-profile small');
    if (railAvatar) railAvatar.textContent = [...profile.name][0] || 'S';
    if (railName) railName.textContent = profile.name;
    if (railMeta) railMeta.textContent = `@${profile.handle} · ${profile.city}`;
  }

  function swShow(html) {
    openModal(html, { accountModal: true, trigger: document.querySelector('#profileBtn') });
  }

  function swProfileView() {
    const profile = swGetProfile();
    const sessionActive = sessionStorage.getItem(swSessionKey) === 'active';
    swUpdateProfileChrome(profile);
    swShow(`<section class="profile-page">
      <div class="profile-cover"><div class="profile-soundwave" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="--wave:${10 + ((i * 17 + 9) % 29)}px"></i>`).join('')}</div><span class="profile-cover-tag">SOURCEWAV / PROFILE</span></div>
      <div class="profile-identity"><div class="profile-avatar">${swEscape([...profile.name][0] || 'S')}</div><div class="profile-identity-copy"><span class="account-status"><i></i>${sessionActive ? 'เซสชันตัวอย่าง' : 'โปรไฟล์ตัวอย่าง'}</span><h2 id="modalTitle">${swEscape(profile.name)}</h2><p>@${swEscape(profile.handle)} <span>·</span> ${swEscape(profile.role)}</p></div><button class="profile-edit-icon" type="button" data-account-action="edit" aria-label="แก้ไขโปรไฟล์">✎</button></div>
      <p class="profile-bio">${swEscape(profile.bio)}</p>
      <div class="profile-location"><span aria-hidden="true">⌖</span> ${swEscape(profile.city)} <span class="profile-location-note">· บ้านของคอมมูนิตี้</span></div>
      <div class="profile-stats"><div><b>0</b><span>เพลง</span></div><div><b>0</b><span>ผลงาน</span></div><div><b>0</b><span>กำลังติดตาม</span></div></div>
      <div class="profile-work"><div class="profile-work-heading"><div><span class="account-eyebrow">YOUR CORNER</span><h3>พื้นที่ของคุณ</h3></div><span class="profile-work-mark">♫</span></div><p>เพลง เดโม และงานศิลปะที่คุณเผยแพร่จะแสดงอยู่ตรงนี้</p><a href="#music" class="profile-first-work" data-account-action="close">＋ ปล่อยเพลงแรก</a></div>
      <div class="profile-account-note"><span>ⓘ</span><p>${window.SourcewavStore?.status?.() === 'online' ? 'โปรไฟล์บันทึกผ่านฐานข้อมูล Sourcewav แล้ว' : 'กำลังใช้ข้อมูลสำรองในเบราว์เซอร์ การเข้าสู่ระบบจริงยังไม่ได้เชื่อมต่อ'}</p></div>
      <div class="profile-actions"><button type="button" class="modal-primary profile-edit-button" data-account-action="edit">แก้ไขโปรไฟล์</button>${sessionActive ? '<button type="button" class="profile-logout" data-account-action="logout">ออกจากระบบตัวอย่าง</button>' : ''}</div>
      <div class="profile-auth-links"><span>จัดการบัญชี</span><button type="button" data-account-action="register">สร้างบัญชี</button><button type="button" data-account-action="login">เข้าสู่ระบบ</button></div>
    </section>`);
  }

  function swAuthView(mode = 'register') {
    const isRegister = mode === 'register';
    const fields = isRegister ? `<label class="account-field"><span>ชื่อที่ใช้ในคอมมูนิตี้</span><input name="displayName" type="text" autocomplete="name" placeholder="เช่น มินตรา" minlength="2" maxlength="32" required /></label>
      <div class="account-field-row"><label class="account-field"><span>คุณทำอะไร</span><select name="role"><option>Rapper / MC</option><option>Producer / Beatmaker</option><option>DJ</option><option>ศิลปิน / นักวาด</option><option>คนทำงานเบื้องหลัง</option><option>นักฟังเพลง</option></select></label><label class="account-field"><span>เมืองของคุณ</span><input name="city" type="text" autocomplete="address-level2" value="กรุงเทพฯ" maxlength="40" required /></label></div>` : '';
    swShow(`<section class="auth-shell">
      <aside class="auth-art"><a class="auth-brand" href="#home" data-account-action="close"><span>SW</span> sourcewav</a><div class="auth-art-center"><div class="auth-disc" aria-hidden="true"><i></i><i></i><i></i></div><span class="auth-art-note">เสียงของเมืองนี้</span><h2>พื้นที่ของคน<br />ที่ทำจริง</h2><p>เดโมที่ยังไม่เสร็จ งานที่ยังไม่ลงตัว และคนที่อยากเจอคนแบบเดียวกัน</p></div><div class="auth-wave" aria-hidden="true">${Array.from({ length: 42 }, (_, i) => `<i style="--wave:${8 + ((i * 11 + 13) % 40)}px"></i>`).join('')}</div><span class="auth-art-foot">เพลง · ศิลปะ · คนของเรา</span></aside>
      <div class="auth-panel"><div class="auth-panel-head"><span class="account-status"><i></i> COMMUNITY ACCESS</span><span class="auth-step">${isRegister ? 'เข้าร่วมคอมมูนิตี้' : 'กลับมาเจอกันอีก'}</span></div><div class="auth-tabs" role="tablist" aria-label="บัญชีผู้ใช้"><button type="button" role="tab" aria-selected="${isRegister}" class="${isRegister ? 'active' : ''}" data-account-action="register">สมัครสมาชิก</button><button type="button" role="tab" aria-selected="${!isRegister}" class="${!isRegister ? 'active' : ''}" data-account-action="login">เข้าสู่ระบบ</button></div>
      <h1 id="modalTitle">${isRegister ? 'มาเป็นส่วนหนึ่ง' : 'ดีใจที่ได้เจอกันอีก'}</h1><p class="auth-intro">${isRegister ? 'สร้างพื้นที่ของคุณ แล้วเริ่มรู้จักคนทำเพลงและศิลปะในวงการ' : 'เข้าสู่พื้นที่ของคุณ แล้วไปต่อจากที่ค้างไว้'}</p>
      <form id="accountForm" data-auth-mode="${mode}" novalidate>${fields}<label class="account-field"><span>อีเมล</span><input name="email" type="email" autocomplete="email" placeholder="you@example.com" required /></label><label class="account-field"><span>รหัสผ่าน</span><span class="password-control"><input name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" placeholder="${isRegister ? 'อย่างน้อย 8 ตัวอักษร' : 'กรอกรหัสผ่าน'}" minlength="${isRegister ? '8' : '1'}" required /><button type="button" data-account-action="toggle-password" aria-label="แสดงรหัสผ่าน">แสดง</button></span></label>${isRegister ? '<label class="account-consent"><input name="terms" type="checkbox" required /><span>ฉันยอมรับ <a href="#community" data-account-action="close">แนวทางชุมชน</a> และต้องการเข้าร่วม Sourcewav</span></label>' : '<button type="button" class="auth-forgot" data-account-action="forgot">ลืมรหัสผ่าน?</button>'}<p class="auth-error" id="accountError" role="alert" hidden></p><button type="submit" class="auth-submit">${isRegister ? 'สร้างโปรไฟล์' : 'เข้าสู่ระบบ'} <span aria-hidden="true">↗</span></button></form>
      <div class="auth-local-note"><span>ⓘ</span><p>ต้นแบบหน้าจอ: บัญชีและการยืนยันตัวตนยังไม่ได้เชื่อมระบบจริง รหัสผ่านจะไม่ถูกบันทึก</p></div><p class="auth-bottom">${isRegister ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'} <button type="button" data-account-action="${isRegister ? 'login' : 'register'}">${isRegister ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button></p></div>
    </section>`);
  }

  function swEditView() {
    const profile = swGetProfile();
    swShow(`<section class="profile-editor"><div class="editor-heading"><span class="account-status"><i></i> PROFILE SETTINGS</span><h2 id="modalTitle">ทำโปรไฟล์ให้เป็นคุณ</h2><p>บอกคนในวงการว่าคุณเป็นใคร และอยากทำอะไรต่อไป</p></div><form id="profileForm"><div class="editor-avatar-row"><div class="editor-avatar">${swEscape([...profile.name][0] || 'S')}</div><div><b>รูปโปรไฟล์</b><small>อัปโหลดรูปภาพจะเปิดให้ใช้ในเวอร์ชันถัดไป</small></div><span class="editor-avatar-pending">เร็ว ๆ นี้</span></div><label class="account-field"><span>ชื่อที่แสดง</span><input name="displayName" value="${swEscape(profile.name)}" minlength="2" maxlength="32" required /></label><label class="account-field"><span>ชื่อผู้ใช้</span><div class="handle-control"><span>@</span><input name="handle" value="${swEscape(profile.handle)}" pattern="[A-Za-z0-9._-]{3,24}" maxlength="24" required /></div><small>ใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง</small></label><div class="account-field-row"><label class="account-field"><span>บทบาทในวงการ</span><select name="role">${['Rapper / MC','Producer / Beatmaker','DJ','ศิลปิน / นักวาด','คนทำงานเบื้องหลัง','นักฟังเพลง'].map(role => `<option ${profile.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select></label><label class="account-field"><span>เมือง</span><input name="city" value="${swEscape(profile.city)}" maxlength="40" required /></label></div><label class="account-field"><span>แนะนำตัว</span><textarea name="bio" maxlength="160" rows="3" placeholder="บอกสั้น ๆ ว่าคุณกำลังทำอะไร หรืออยากเจอใคร">${swEscape(profile.bio)}</textarea><small class="field-counter">ไม่เกิน 160 ตัวอักษร</small></label><p class="editor-save-note"><span>ⓘ</span> ข้อมูลจะบันทึกไว้ในเบราว์เซอร์นี้</p><div class="editor-actions"><button type="button" class="editor-cancel" data-account-action="profile">ยกเลิก</button><button type="submit" class="auth-submit">บันทึกโปรไฟล์ <span aria-hidden="true">↗</span></button></div></form></section>`);
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
    if (action === 'logout') {
      sessionStorage.removeItem(swSessionKey);
      swProfileView();
      toast('ออกจากระบบตัวอย่างแล้ว');
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
      if (error) {
        error.hidden = false;
        error.textContent = 'ระบบรีเซ็ตรหัสผ่านจะเปิดใช้เมื่อเชื่อมต่อระบบบัญชี';
      }
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

  document.addEventListener('submit', event => {
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
      if (form.dataset.authMode === 'register') {
        const name = String(data.get('displayName') || '').trim();
        const handle = name.toLowerCase().replace(/[^a-z0-9ก-๙]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24) || 'new.wav';
        swSaveProfile({ name, handle, role: data.get('role'), city: String(data.get('city') || '').trim(), bio: 'เพิ่งเข้าร่วม Sourcewav กำลังหาคนทำเพลงและศิลปะที่อยากร่วมทางกัน' });
      }
      sessionStorage.setItem(swSessionKey, 'active');
      swProfileView();
      toast(form.dataset.authMode === 'register' ? 'สร้างโปรไฟล์ตัวอย่างแล้ว' : 'เข้าสู่ระบบตัวอย่างแล้ว');
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
        bio: String(data.get('bio') || '').trim() || 'อยู่ตรงนี้เพื่อฟังเพลงใหม่ ๆ และเจอคนทำของน่าสนใจ'
      };
      swSaveProfile(profile);
      swUpdateProfileChrome(profile);
      swProfileView();
      toast('บันทึกโปรไฟล์ไว้ในเบราว์เซอร์แล้ว');
    }
  }, true);

  swUpdateProfileChrome(swGetProfile());
})();
