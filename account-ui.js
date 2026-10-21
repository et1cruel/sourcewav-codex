(() => {
  const swProfileKey = 'sourcewav.profile.v1';
  let swProfileCache = null;
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
      const stored = swProfileCache || window.SourcewavStore?.getState?.().profile || JSON.parse(localStorage.getItem(swProfileKey) || '{}');
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

  function swCacheRemoteProfile(row) {
    if (!row) return;
    swProfileCache = {
      displayName: row.display_name,
      handle: row.username,
      role: row.roles?.[0] || 'นักฟังเพลง',
      province: row.province || row.city || 'กรุงเทพฯ',
      bio: row.bio || ''
    };
    localStorage.setItem(swProfileKey, JSON.stringify(swProfileCache));
    window.SourcewavStore?.update(state => {
      state.profile = { ...state.profile, displayName: swProfileCache.displayName, handle: swProfileCache.handle, role: swProfileCache.role, province: swProfileCache.province, bio: swProfileCache.bio };
    });
    swUpdateProfileChrome(swGetProfile());
  }

  async function swLoadRemoteProfile() {
    const client = window.SourcewavSupabase;
    const user = window.SourcewavAuthUser;
    if (!client || !user) return null;
    const { data, error } = await client.from('profiles')
      .select('username,display_name,roles,province,bio')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) swCacheRemoteProfile(data);
    return data;
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
    const sessionActive = Boolean(window.SourcewavAuthUser);
    swUpdateProfileChrome(profile);
    swShow(`<section class="profile-page">
      <div class="profile-cover"><div class="profile-soundwave" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="--wave:${10 + ((i * 17 + 9) % 29)}px"></i>`).join('')}</div><span class="profile-cover-tag">SOURCEWAV / PROFILE</span></div>
      <div class="profile-identity"><div class="profile-avatar">${swEscape([...profile.name][0] || 'S')}</div><div class="profile-identity-copy"><span class="account-status"><i></i>${sessionActive ? 'บัญชี Sourcewav' : 'โปรไฟล์ตัวอย่าง'}</span><h2 id="modalTitle">${swEscape(profile.name)}</h2><p>@${swEscape(profile.handle)} <span>·</span> ${swEscape(profile.role)}</p></div><button class="profile-edit-icon" type="button" data-account-action="edit" aria-label="แก้ไขโปรไฟล์">✎</button></div>
      <p class="profile-bio">${swEscape(profile.bio)}</p>
      <div class="profile-location"><span aria-hidden="true">⌖</span> ${swEscape(profile.city)} <span class="profile-location-note">· บ้านของคอมมูนิตี้</span></div>
      <div class="profile-stats"><div><b>0</b><span>เพลง</span></div><div><b>0</b><span>ผลงาน</span></div><div><b>0</b><span>กำลังติดตาม</span></div></div>
      <div class="profile-work">
        <div class="profile-work-heading"><div><span class="account-eyebrow">YOUR CORNER & STORE</span><h3>พื้นที่ผลงานและร้านค้าของคุณ</h3></div><span class="profile-work-mark">♫</span></div>
        <p>เพลง เดโม สินค้า Merch เทป ซีดี และบีทที่คุณเปิดขาย รวมทั้งการตั้งค่ารับงาน Booking อยู่ตรงนี้</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
          <a href="#music" class="profile-first-work" data-account-action="close">＋ ปล่อยเพลงแรก</a>
          <button type="button" class="profile-first-work" style="background: #eef2ff; border-color: #c7d2fe; color: #4338ca; cursor: pointer;" data-account-action="open-store">🛍 ร้านค้าศิลปิน</button>
          <button type="button" class="profile-first-work" style="background: #fdf2f8; border-color: #fbcfe8; color: #be185d; cursor: pointer;" data-account-action="open-booking">⚡ การ์ดรับงาน Booking</button>
        </div>
      </div>
      <div class="profile-account-note"><span>ⓘ</span><p>${sessionActive ? 'บัญชีและโปรไฟล์เชื่อมต่อกับ Supabase แล้ว' : window.SourcewavSupabaseStatus === 'online' ? 'เชื่อมต่อฐานข้อมูล Supabase แล้ว · เข้าสู่ระบบเพื่อบันทึกโปรไฟล์ของคุณ' : 'กำลังเชื่อมต่อฐานข้อมูล Supabase'}</p></div>
      <div class="profile-actions"><button type="button" class="modal-primary profile-edit-button" data-account-action="edit">แก้ไขโปรไฟล์</button>${sessionActive ? '<button type="button" class="profile-logout" data-account-action="logout">ออกจากระบบ</button>' : ''}</div>
      ${sessionActive ? '' : '<div class="profile-auth-links"><span>จัดการบัญชี</span><button type="button" data-account-action="register">สร้างบัญชี</button><button type="button" data-account-action="login">เข้าสู่ระบบ</button></div>'}
    </section>`);
  }

  function swAuthView(mode = 'register') {
    const isRegister = mode === 'register';
    const isRecovery = mode === 'recovery';
    const fields = isRegister ? `<label class="account-field"><span>ชื่อที่ใช้ในคอมมูนิตี้</span><input name="displayName" type="text" autocomplete="name" placeholder="เช่น มินตรา" minlength="2" maxlength="32" required /></label>
      <label class="account-field"><span>ชื่อผู้ใช้</span><input name="username" type="text" autocomplete="username" placeholder="เช่น min_wav" pattern="[A-Za-z0-9_]{3,30}" minlength="3" maxlength="30" required /><small>ใช้ภาษาอังกฤษ ตัวเลข หรือขีดล่าง 3–30 ตัว</small></label>
      <div class="account-field-row"><label class="account-field"><span>คุณทำอะไร</span><select name="role"><option>Rapper / MC</option><option>Producer / Beatmaker</option><option>DJ</option><option>ศิลปิน / นักวาด</option><option>คนทำงานเบื้องหลัง</option><option>นักฟังเพลง</option></select></label><label class="account-field"><span>เมืองของคุณ</span><input name="city" type="text" autocomplete="address-level2" value="กรุงเทพฯ" maxlength="40" required /></label></div>` : '';
    const credentialFields = isRecovery
      ? `<label class="account-field"><span>รหัสผ่านใหม่</span><input name="password" type="password" autocomplete="new-password" minlength="8" placeholder="อย่างน้อย 8 ตัวอักษร" required /></label><label class="account-field"><span>ยืนยันรหัสผ่านใหม่</span><input name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" placeholder="กรอกรหัสผ่านอีกครั้ง" required /></label>`
      : `<label class="account-field"><span>อีเมล</span><input name="email" type="email" autocomplete="email" placeholder="you@example.com" required /></label><label class="account-field"><span>รหัสผ่าน</span><span class="password-control"><input name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" placeholder="${isRegister ? 'อย่างน้อย 8 ตัวอักษร' : 'กรอกรหัสผ่าน'}" minlength="${isRegister ? '8' : '1'}" required /><button type="button" data-account-action="toggle-password" aria-label="แสดงรหัสผ่าน">แสดง</button></span></label>`;
    swShow(`<section class="auth-shell">
      <aside class="auth-art"><a class="auth-brand" href="#home" data-account-action="close"><span>SW</span> sourcewav</a><div class="auth-art-center"><div class="auth-disc" aria-hidden="true"><i></i><i></i><i></i></div><span class="auth-art-note">เสียงของเมืองนี้</span><h2>พื้นที่ของคน<br />ที่ทำจริง</h2><p>เดโมที่ยังไม่เสร็จ งานที่ยังไม่ลงตัว และคนที่อยากเจอคนแบบเดียวกัน</p></div><div class="auth-wave" aria-hidden="true">${Array.from({ length: 42 }, (_, i) => `<i style="--wave:${8 + ((i * 11 + 13) % 40)}px"></i>`).join('')}</div><span class="auth-art-foot">เพลง · ศิลปะ · คนของเรา</span></aside>
      <div class="auth-panel"><div class="auth-panel-head"><span class="account-status"><i></i> COMMUNITY ACCESS</span><span class="auth-step">${isRecovery ? 'ตั้งรหัสผ่านใหม่' : isRegister ? 'เข้าร่วมคอมมูนิตี้' : 'กลับมาเจอกันอีก'}</span></div>${isRecovery ? '' : `<div class="auth-tabs" role="tablist" aria-label="บัญชีผู้ใช้"><button type="button" role="tab" aria-selected="${isRegister}" class="${isRegister ? 'active' : ''}" data-account-action="register">สมัครสมาชิก</button><button type="button" role="tab" aria-selected="${!isRegister}" class="${!isRegister ? 'active' : ''}" data-account-action="login">เข้าสู่ระบบ</button></div>`}
      <h1 id="modalTitle">${isRecovery ? 'ตั้งรหัสผ่านใหม่' : isRegister ? 'มาเป็นส่วนหนึ่ง' : 'ดีใจที่ได้เจอกันอีก'}</h1><p class="auth-intro">${isRecovery ? 'เลือกรหัสผ่านใหม่เพื่อกลับเข้าสู่ Sourcewav' : isRegister ? 'สร้างพื้นที่ของคุณ แล้วเริ่มรู้จักคนทำเพลงและศิลปะในวงการ' : 'เข้าสู่พื้นที่ของคุณ แล้วไปต่อจากที่ค้างไว้'}</p>
      <form id="accountForm" data-auth-mode="${mode}" novalidate>${fields}${credentialFields}${isRegister ? '<label class="account-consent"><input name="terms" type="checkbox" required /><span>ฉันยอมรับ <a href="#community" data-account-action="close">แนวทางชุมชน</a> และต้องการเข้าร่วม Sourcewav</span></label>' : isRecovery ? '' : '<button type="button" class="auth-forgot" data-account-action="forgot">ลืมรหัสผ่าน?</button>'}<p class="auth-error" id="accountError" role="alert" hidden></p><button type="submit" class="auth-submit">${isRecovery ? 'บันทึกรหัสผ่านใหม่' : isRegister ? 'สร้างโปรไฟล์' : 'เข้าสู่ระบบ'} <span aria-hidden="true">↗</span></button></form>
      <div class="auth-local-note"><span>ⓘ</span><p>บัญชีของคุณใช้ Supabase Auth และรหัสผ่านจะไม่ถูกเก็บใน Sourcewav</p></div><p class="auth-bottom">${isRecovery ? 'จำรหัสผ่านได้แล้ว?' : isRegister ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'} <button type="button" data-account-action="${isRegister || isRecovery ? 'login' : 'register'}">${isRegister || isRecovery ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button></p></div>
    </section>`);
  }

  function swEditView() {
    const profile = swGetProfile();
    swShow(`<section class="profile-editor"><div class="editor-heading"><span class="account-status"><i></i> PROFILE SETTINGS</span><h2 id="modalTitle">ทำโปรไฟล์ให้เป็นคุณ</h2><p>บอกคนในวงการว่าคุณเป็นใคร และอยากทำอะไรต่อไป</p></div><form id="profileForm"><div class="editor-avatar-row"><div class="editor-avatar">${swEscape([...profile.name][0] || 'S')}</div><div><b>รูปโปรไฟล์</b><small>อัปโหลดรูปภาพจะเปิดให้ใช้ในเวอร์ชันถัดไป</small></div><span class="editor-avatar-pending">เร็ว ๆ นี้</span></div><label class="account-field"><span>ชื่อที่แสดง</span><input name="displayName" value="${swEscape(profile.name)}" minlength="2" maxlength="32" required /></label><label class="account-field"><span>ชื่อผู้ใช้</span><div class="handle-control"><span>@</span><input name="handle" value="${swEscape(profile.handle)}" pattern="[A-Za-z0-9_]{3,30}" minlength="3" maxlength="30" required /></div><small>ใช้ตัวอักษรอังกฤษ ตัวเลข หรือขีดล่าง 3–30 ตัว</small></label><div class="account-field-row"><label class="account-field"><span>บทบาทในวงการ</span><select name="role">${['Rapper / MC','Producer / Beatmaker','DJ','ศิลปิน / นักวาด','คนทำงานเบื้องหลัง','นักฟังเพลง'].map(role => `<option ${profile.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select></label><label class="account-field"><span>เมือง</span><input name="city" value="${swEscape(profile.city)}" maxlength="40" required /></label></div><label class="account-field"><span>แนะนำตัว</span><textarea name="bio" maxlength="160" rows="3" placeholder="บอกสั้น ๆ ว่าคุณกำลังทำอะไร หรืออยากเจอใคร">${swEscape(profile.bio)}</textarea><small class="field-counter">ไม่เกิน 160 ตัวอักษร</small></label><p class="editor-save-note"><span>ⓘ</span> โปรไฟล์ของคุณบันทึกไว้ใน Supabase</p><div class="editor-actions"><button type="button" class="editor-cancel" data-account-action="profile">ยกเลิก</button><button type="submit" class="auth-submit">บันทึกโปรไฟล์ <span aria-hidden="true">↗</span></button></div></form></section>`);
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
        bio: String(data.get('bio') || '').trim() || 'อยู่ตรงนี้เพื่อฟังเพลงใหม่ ๆ และเจอคนทำของน่าสนใจ'
      };
      if (window.SourcewavAuthUser && window.SourcewavSupabase) {
        const { error } = await window.SourcewavSupabase.from('profiles').update({
          username: profile.handle,
          display_name: profile.name,
          roles: [profile.role],
          province: profile.city,
          bio: profile.bio
        }).eq('user_id', window.SourcewavAuthUser.id);
        if (error) {
          toast(error.code === '23505' ? 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' : 'บันทึกโปรไฟล์ไม่สำเร็จ');
          return;
        }
        swCacheRemoteProfile({ username: profile.handle, display_name: profile.name, roles: [profile.role], province: profile.city, bio: profile.bio });
      } else swSaveProfile(profile);
      swUpdateProfileChrome(profile);
      swProfileView();
      toast(window.SourcewavAuthUser ? 'บันทึกโปรไฟล์ใน Supabase แล้ว' : 'บันทึกโปรไฟล์ไว้ในเบราว์เซอร์แล้ว');
    }
  }, true);

  window.addEventListener('sourcewav:auth', event => {
    if (event.detail.authEvent === 'PASSWORD_RECOVERY') swAuthView('recovery');
    if (event.detail.user) swLoadRemoteProfile().catch(() => {});
    else swProfileCache = null;
  });
  swUpdateProfileChrome(swGetProfile());
})();
