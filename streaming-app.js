/* Sourcewav cloud audio library backed by Supabase Storage and audio_tracks. */
(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const audio = $('#streamAudio');
  const list = $('#trackList');
  if (!audio || !list) return;
  let tracks = [];
  let currentUserId = null;
  let artistRouteRequest = 0;
  let currentTrack = null;
  const waveformCache = new Map();
  let likedTrackIds = new Set();
  let musicTab = 'library';
  let shuffleMode = false;
  let coverPreviewUrl = '';
  let bannerPreviewUrl = '';
  const coverMimeByType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const maxCoverSize = 5 * 1024 * 1024;

  const formatTime = seconds => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };
  const formatSize = bytes => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  function setupListeningRoom() {
    const section = $('#music');
    const player = $('.stream-player', section);
    const controls = $('.stream-controls', player);
    const timeline = $('.stream-timeline', player);
    const heading = $('.track-list-head', section);
    if (!section || !player || !controls || !heading) return;
    $('.stream-now', player).firstChild.textContent = 'NOW PLAYING';
    const artist = $('#streamArtist');
    artist.setAttribute('aria-label', 'เปิดโปรไฟล์ผู้ปล่อยเพลง');
    if (timeline) controls.before(timeline);
    const play = $('#streamPlay');
    const mute = $('#streamMute');
    const volumeSteps = document.createElement('span');
    volumeSteps.className = 'stream-volume-steps';
    volumeSteps.setAttribute('role', 'group');
    volumeSteps.setAttribute('aria-label', 'ปรับระดับเสียง');
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.id = 'streamVolume';
    volumeSlider.className = 'stream-volume-slider';
    volumeSlider.min = '0'; volumeSlider.max = '100'; volumeSlider.step = '1';
    volumeSlider.setAttribute('aria-label', 'ปรับระดับเสียงเพลง');
    volumeSlider.title = 'ลากเพื่อปรับระดับเสียง';
    const actionButton = (action, glyph, label, className = '') => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `stream-extra-control ${className}`.trim();
      button.dataset.streamAction = action; button.setAttribute('aria-label', label); button.title = label; button.textContent = glyph;
      return button;
    };
    volumeSteps.replaceChildren(
      mute,
      volumeSlider
    );
    controls.replaceChildren(
      actionButton('shuffle', '⤨', 'สลับเพลง', 'is-secondary'),
      actionButton('previous', '|◀', 'เพลงก่อนหน้า', 'is-secondary'),
      play,
      actionButton('next', '▶|', 'เพลงถัดไป', 'is-secondary'),
      actionButton('like-current', '♡', 'ถูกใจเพลง', 'is-secondary stream-current-like'),
      volumeSteps
    );
    const releases = document.createElement('section');
    releases.className = 'stream-releases'; releases.id = 'streamReleases';
    releases.innerHTML = '<div class="stream-subheading"><div><span>FRESH FROM THE SCENE</span><h3>เพลงใหม่ล่าสุด</h3></div><button type="button" class="stream-see-all" data-music-tab="library">ดูคลังเพลง ↗</button></div><div class="stream-release-grid" id="streamReleaseGrid"></div>';
    section.insertBefore(releases, heading);
    heading.querySelector('strong').textContent = 'คลังเพลง';
    const nav = document.createElement('nav');
    nav.className = 'stream-library-nav'; nav.setAttribute('aria-label', 'เลือกส่วนเพลง');
    nav.innerHTML = '<button type="button" data-music-tab="library" aria-pressed="true"><span aria-hidden="true">▤</span><b>Library</b></button><button type="button" data-music-tab="radio" aria-pressed="false"><span aria-hidden="true">◉</span><b>Radio</b></button><button type="button" data-music-tab="liked" aria-pressed="false"><span aria-hidden="true">♡</span><b>Liked</b></button>';
    section.append(nav);
    updateRoomTrackInfo();
  }

  function renderNewReleases() {
    const grid = $('#streamReleaseGrid');
    if (!grid) return;
    const recent = tracks.slice(0, 3);
    if (!recent.length) {
      grid.innerHTML = '<div class="stream-release-empty">เพลงที่เพิ่งปล่อยจะปรากฏตรงนี้</div>';
      return;
    }
    grid.innerHTML = recent.map(track => {
      const profile = track.artist_profile;
      const artistName = profile?.display_name || track.artist || 'ศิลปิน';
      const avatarUrl = (() => { try { const url = new URL(profile?.avatar_url || ''); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } })();
      const avatar = `<span class="stream-release-artist-avatar" aria-hidden="true"><span>${escapeHTML([...artistName][0] || '♫')}</span>${avatarUrl ? `<img src="${escapeHTML(avatarUrl)}" alt="" loading="lazy" />` : ''}</span>`;
      const artistLink = profile?.username
        ? `<a class="stream-release-artist-link" href="#artist/${encodeURIComponent(profile.username)}" data-artist-profile="${escapeHTML(profile.username)}" aria-label="เปิดโปรไฟล์ศิลปิน ${escapeHTML(artistName)}">${avatar}</a>`
        : avatar;
      return `<article class="stream-release-card${currentTrack?.id === track.id && !audio.paused ? ' is-playing' : ''}">
      <button type="button" class="stream-release-art" data-track-play="${escapeHTML(track.id)}" aria-label="เล่น ${escapeHTML(track.title)}">${track.cover_url ? `<img src="${escapeHTML(track.cover_url)}" alt="" loading="lazy" />` : '<span aria-hidden="true">♫</span>'}<i>▶</i></button>
      <div class="stream-release-copy"><div class="stream-release-artist-row">${artistLink}<div class="stream-release-artist-details"><small>${profile?.username ? `<a href="#artist/${encodeURIComponent(profile.username)}" data-artist-profile="${escapeHTML(profile.username)}">${escapeHTML(artistName)}</a>` : escapeHTML(artistName)}</small><span>${escapeHTML(track.genre || 'เพลง')}</span></div></div><h4>${escapeHTML(track.title)}</h4><div><span>${formatSize(track.size_bytes)}</span><button type="button" class="stream-like-button${likedTrackIds.has(track.id) ? ' is-liked' : ''}" data-track-like="${escapeHTML(track.id)}" aria-label="${likedTrackIds.has(track.id) ? 'ยกเลิกถูกใจ' : 'ถูกใจ'} ${escapeHTML(track.title)}">${likedTrackIds.has(track.id) ? '♥' : '♡'}</button></div></div>
    </article>`;
    }).join('');
    grid.querySelectorAll('.stream-release-artist-avatar img').forEach(image => image.addEventListener('error', () => image.remove(), { once: true }));
  }

  function updateRoomTrackInfo() {
    const likeButton = $('.stream-current-like');
    if (!likeButton) return;
    const liked = Boolean(currentTrack && likedTrackIds.has(currentTrack.id));
    likeButton.textContent = liked ? '♥' : '♡';
    likeButton.classList.toggle('is-liked', liked);
    likeButton.disabled = !currentTrack;
    likeButton.setAttribute('aria-label', liked ? 'ยกเลิกถูกใจเพลง' : 'ถูกใจเพลง');
    const shuffle = $('[data-stream-action="shuffle"]');
    if (shuffle) {
      shuffle.classList.toggle('is-selected', shuffleMode);
      shuffle.setAttribute('aria-pressed', String(shuffleMode));
    }
  }

  setupListeningRoom();
  renderNewReleases();

  function playTrackStep(direction = 1, random = shuffleMode) {
    if (!tracks.length) return;
    let next;
    if (random && tracks.length > 1) {
      const candidates = tracks.filter(track => track.id !== currentTrack?.id);
      next = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      const index = tracks.findIndex(track => track.id === currentTrack?.id);
      next = tracks[(index + direction + tracks.length) % tracks.length];
    }
    selectTrack(next, true);
  }

  async function toggleLike(trackId) {
    const track = tracks.find(item => item.id === trackId);
    const db = window.SourcewavSupabase;
    if (!track || !db) return;
    let authData;
    try { ({ data: authData } = await db.auth.getUser()); }
    catch { toast('ตรวจสอบบัญชีไม่ได้ ลองอีกครั้ง'); return; }
    const user = authData?.user;
    if (!user) { toast('เข้าสู่ระบบก่อนบันทึกเพลงที่ถูกใจ'); $('#profileBtn')?.click(); return; }
    const wasLiked = likedTrackIds.has(trackId);
    let result;
    try {
      result = wasLiked
        ? await db.from('audio_track_likes').delete().eq('track_id', trackId).eq('user_id', user.id)
        : await db.from('audio_track_likes').insert({ track_id: trackId, user_id: user.id });
    } catch { toast('บันทึกเพลงที่ถูกใจไม่ได้ ลองอีกครั้ง'); return; }
    if (result.error) { toast('บันทึกเพลงที่ถูกใจไม่ได้ ลองอีกครั้ง'); return; }
    if (wasLiked) likedTrackIds.delete(trackId); else likedTrackIds.add(trackId);
    renderTracks(); updateRoomTrackInfo();
  }

  function renderTracks() {
    $('#trackCount').textContent = `${tracks.length} เพลง`;
    renderNewReleases();
    document.querySelectorAll('[data-music-tab]').forEach(button => {
      const selected = button.dataset.musicTab === musicTab;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    });
    const listTitle = $('.track-list-head strong');
    if (listTitle) listTitle.textContent = musicTab === 'liked' ? 'เพลงที่ถูกใจ' : musicTab === 'radio' ? 'Sourcewav Radio' : 'คลังเพลง';
    if (musicTab === 'radio') {
      list.innerHTML = tracks.length ? `<div class="stream-radio-state"><span>◉</span><b>Sourcewav Radio</b><p>${currentTrack ? `กำลังฟัง ${escapeHTML(currentTrack.title)} · ${escapeHTML(currentTrack.artist)}` : 'สุ่มค้นพบเพลงใหม่จากศิลปินใน Sourcewav'}</p><button type="button" data-stream-action="radio">${currentTrack && !audio.paused ? 'สุ่มเพลงถัดไป' : 'เริ่มฟัง Radio'}</button></div>` : '<div class="track-empty"><span>♫</span><b>ยังไม่มีเพลงในคลัง</b><p>เพลงใหม่จากศิลปินจะแสดงที่นี่</p></div>';
      return;
    }
    const visibleTracks = musicTab === 'liked' ? tracks.filter(track => likedTrackIds.has(track.id)) : tracks;
    if (musicTab === 'liked' && !visibleTracks.length) {
      list.innerHTML = '<div class="track-empty"><span>♡</span><b>ยังไม่มีเพลงที่ถูกใจ</b><p>กดรูปหัวใจบนเพลงเพื่อเก็บไว้ที่นี่</p></div>';
      return;
    }
    if (!visibleTracks.length) {
      list.innerHTML = '<div class="track-empty"><span>♫</span><b>ยังไม่มีเพลงในคลัง</b><p>อัปโหลดไฟล์แรก แล้วให้เสียงของคุณเริ่มเดินทาง</p><button type="button" id="emptyUploadBtn">อัปโหลดเพลงแรก</button></div>';
      return;
    }
    list.innerHTML = visibleTracks.map(track => `<article class="track-row${currentTrack?.id === track.id && !audio.paused ? ' is-playing' : ''}" data-track-row="${escapeHTML(track.id)}">
      <button type="button" class="track-row-play" data-track-play="${escapeHTML(track.id)}" aria-label="${currentTrack?.id === track.id && !audio.paused ? 'หยุด' : 'เล่น'} ${escapeHTML(track.title)}">${currentTrack?.id === track.id && !audio.paused ? 'Ⅱ' : '▶'}</button>
      <span class="track-row-cover" aria-hidden="true">${track.cover_url ? `<img src="${escapeHTML(track.cover_url)}" alt="" loading="lazy" />` : '♫'}</span>
      <div class="track-row-copy"><strong>${escapeHTML(track.title)}</strong><small>${track.artist_profile?.username ? `<a class="track-artist-link" href="#artist/${encodeURIComponent(track.artist_profile.username)}" data-artist-profile="${escapeHTML(track.artist_profile.username)}">${escapeHTML(track.artist_profile.display_name || track.artist)}</a>` : escapeHTML(track.artist)}</small></div>
      <div class="track-row-meta"><span class="track-genre">${escapeHTML(track.genre)}</span><span class="track-size">${formatSize(track.size_bytes)}</span>${track.owner_id === currentUserId ? `<button type="button" class="track-edit-button" data-track-edit="${escapeHTML(track.id)}" aria-label="แก้ไขชื่อเพลงและรูปปก ${escapeHTML(track.title)}" title="แก้ไขชื่อเพลงและรูปปก"><img src="assets/edit-pencil-glass.png" alt="" aria-hidden="true" /></button>` : ''}<button type="button" class="stream-like-button${likedTrackIds.has(track.id) ? ' is-liked' : ''}" data-track-like="${escapeHTML(track.id)}" aria-label="${likedTrackIds.has(track.id) ? 'ยกเลิกถูกใจ' : 'ถูกใจ'} ${escapeHTML(track.title)}">${likedTrackIds.has(track.id) ? '♥' : '♡'}</button></div>
    </article>`).join('');
  }

  function showTrackEditForm(track) {
    if (!track || track.owner_id !== currentUserId) return;
    openModal(`<form class="track-edit-modal" id="trackEditForm" data-track-id="${escapeHTML(track.id)}">
      <span class="track-edit-kicker">จัดการเพลงของคุณ</span><h2 id="modalTitle">แก้ไขเพลง</h2>
      <label class="modal-field">ชื่อเพลง<input name="title" required maxlength="100" autocomplete="off" value="${escapeHTML(track.title)}" /></label>
      <label class="modal-field">รูปปกเพลง<input name="cover" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" /><small>รูปสี่เหลี่ยมที่แสดงในรายการเพลง · JPG, PNG หรือ WebP · สูงสุด 5 MB</small></label>
      ${track.cover_url ? `<div class="track-edit-cover-preview"><img src="${escapeHTML(track.cover_url)}" alt="รูปปกปัจจุบัน" /><span>รูปปกปัจจุบัน</span></div>` : ''}
      <label class="modal-field">แบนเนอร์เพลง<input name="banner" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" /><small>ภาพแนวกว้างแสดงด้านหลังเครื่องเล่น · แนะนำ 1500 × 500 px · สูงสุด 5 MB</small></label>
      ${track.banner_url ? `<div class="track-edit-banner-preview"><img src="${escapeHTML(track.banner_url)}" alt="แบนเนอร์เพลงปัจจุบัน" /><span>แบนเนอร์ปัจจุบัน</span></div>` : ''}
      <p class="stream-error" id="trackEditError" role="alert" hidden></p>
      <button class="modal-primary track-edit-submit" id="trackEditSubmit" type="submit">บันทึกการเปลี่ยนแปลง</button>
    </form>`);
  }

  async function saveTrackEdit(form) {
    const error = $('#trackEditError');
    const submit = $('#trackEditSubmit');
    const track = tracks.find(item => item.id === form.dataset.trackId);
    const title = form.elements.title.value.trim();
    const coverFile = form.elements.cover.files?.[0] || null;
    const bannerFile = form.elements.banner.files?.[0] || null;
    error.hidden = true;
    if (!track || track.owner_id !== currentUserId) { error.textContent = 'แก้ไขได้เฉพาะเพลงที่คุณเป็นเจ้าของ'; error.hidden = false; return; }
    if (!title) { error.textContent = 'กรอกชื่อเพลงก่อนบันทึก'; error.hidden = false; return; }
    if (coverFile && !coverMimeByType[coverFile.type]) { error.textContent = 'รูปปกต้องเป็น JPG, PNG หรือ WebP'; error.hidden = false; return; }
    if (coverFile && coverFile.size > maxCoverSize) { error.textContent = 'รูปปกมีขนาดใหญ่เกิน 5 MB'; error.hidden = false; return; }
    if (bannerFile && !coverMimeByType[bannerFile.type]) { error.textContent = 'แบนเนอร์ต้องเป็น JPG, PNG หรือ WebP'; error.hidden = false; return; }
    if (bannerFile && bannerFile.size > maxCoverSize) { error.textContent = 'แบนเนอร์มีขนาดใหญ่เกิน 5 MB'; error.hidden = false; return; }
    const db = window.SourcewavSupabase;
    if (!db) { error.textContent = 'เชื่อมต่อฐานข้อมูลไม่ได้ ลองอีกครั้ง'; error.hidden = false; return; }
    submit.disabled = true;
    submit.textContent = 'กำลังบันทึก…';
    let newCoverKey = '';
    let newBannerKey = '';
    try {
      const update = { title };
      if (coverFile) {
        const ext = coverMimeByType[coverFile.type];
        newCoverKey = `${currentUserId}/${track.id}-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await db.storage.from('sourcewav-track-covers').upload(newCoverKey, coverFile, { contentType: coverFile.type, cacheControl: '3600', upsert: false });
        if (uploadError?.statusCode === '404' || uploadError?.message?.toLowerCase().includes('bucket not found')) {
          throw new Error('ระบบยังไม่พร้อมสำหรับรูปปก โปรดใช้ migration 20261022000100_audio_track_cover_art.sql ก่อน');
        }
        if (uploadError) throw new Error('อัปโหลดรูปปกไม่ได้: ' + uploadError.message);
        update.cover_storage_key = newCoverKey;
      }
      if (bannerFile) {
        const ext = coverMimeByType[bannerFile.type];
        newBannerKey = `${currentUserId}/${track.id}-banner-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await db.storage.from('sourcewav-track-covers').upload(newBannerKey, bannerFile, { contentType: bannerFile.type, cacheControl: '3600', upsert: false });
        if (uploadError) throw new Error('อัปโหลดแบนเนอร์ไม่ได้: ' + uploadError.message);
        update.banner_storage_key = newBannerKey;
      }
      const { error: updateError } = await db.from('audio_tracks').update(update).eq('id', track.id).eq('owner_id', currentUserId);
      if (updateError?.code === '42703' && updateError.message?.includes('banner_storage_key')) {
        throw new Error('ฐานข้อมูลยังไม่พร้อมสำหรับแบนเนอร์เพลง โปรดใช้ migration 20261022000200_audio_track_banner_art.sql ก่อน');
      }
      if (updateError?.code === '42703' && updateError.message?.includes('cover_storage_key')) {
        throw new Error('ฐานข้อมูลยังไม่พร้อมสำหรับรูปปก โปรดใช้ migration 20261022000100_audio_track_cover_art.sql ก่อน');
      }
      if (updateError) throw new Error('บันทึกการแก้ไขไม่ได้: ' + updateError.message);
      if (newCoverKey && track.cover_storage_key) await db.storage.from('sourcewav-track-covers').remove([track.cover_storage_key]);
      if (newBannerKey && track.banner_storage_key) await db.storage.from('sourcewav-track-covers').remove([track.banner_storage_key]);
      await loadTracks();
      const updated = tracks.find(item => item.id === track.id);
      if (updated && currentTrack?.id === track.id) {
        currentTrack = updated;
        $('#streamTitle').textContent = updated.title;
        const playerCover = $('#streamCover');
        $('.stream-cover-image', playerCover)?.remove();
        playerCover.classList.toggle('has-artwork', Boolean(updated.cover_url));
        if (updated.cover_url) playerCover.insertAdjacentHTML('afterbegin', `<img class="stream-cover-image" src="${escapeHTML(updated.cover_url)}" alt="" />`);
        setPlayerBanner(updated);
        updateArtistMini();
      }
      $('#modalClose').click();
      toast('บันทึกการแก้ไขเพลงแล้ว');
    } catch (failure) {
      if (newCoverKey) await db.storage.from('sourcewav-track-covers').remove([newCoverKey]).catch(() => {});
      if (newBannerKey) await db.storage.from('sourcewav-track-covers').remove([newBannerKey]).catch(() => {});
      error.textContent = failure.message || 'บันทึกไม่สำเร็จ ลองอีกครั้ง';
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = 'ลองบันทึกอีกครั้ง';
    }
  }

  function updateArtistMini() {
    const mini = $('#artistMiniPlayer');
    if (!mini) return;
    mini.hidden = !currentTrack;
    if (!currentTrack) return;
    $('#artistMiniTitle').textContent = currentTrack.title;
    $('#artistMiniArtist').textContent = currentTrack.artist_profile?.display_name || currentTrack.artist;
    $('#artistMiniTime').textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    $('#artistMiniSeek').value = audio.duration ? String(Math.round(audio.currentTime / audio.duration * 1000)) : '0';
    const cover = $('#artistMiniCover');
    if (cover.dataset.trackId !== currentTrack.id) {
      cover.innerHTML = currentTrack.cover_url ? `<img src="${escapeHTML(currentTrack.cover_url)}" alt="" />` : '♫';
      cover.dataset.trackId = currentTrack.id;
    }
    const playButton = $('[data-artist-mini-play]', mini);
    playButton.textContent = !audio.paused ? 'Ⅱ' : '▶';
    playButton.setAttribute('aria-label', !audio.paused ? 'หยุดเพลง' : 'เล่นเพลง');
  }

  function setPlayerBanner(track) {
    const player = $('.stream-player');
    if (!player) return;
    $('.stream-player-banner', player)?.remove();
    player.classList.toggle('has-banner', Boolean(track?.banner_url));
    if (track?.banner_url) player.insertAdjacentHTML('afterbegin', `<img class="stream-player-banner" src="${escapeHTML(track.banner_url)}" alt="" aria-hidden="true" />`);
  }

  function updatePlayer() {
    const playing = !audio.paused;
    $('#streamPlay').textContent = playing ? 'Ⅱ' : '▶';
    $('#streamPlay').setAttribute('aria-label', playing ? 'หยุดเพลง' : 'เล่นเพลง');
    $('#streamSeek').value = audio.duration ? String(Math.round(audio.currentTime / audio.duration * 1000)) : '0';
    $('#streamElapsed').textContent = formatTime(audio.currentTime);
    $('#streamDuration').textContent = formatTime(audio.duration);
    $('#streamGenre').textContent = currentTrack ? ` · ${currentTrack.genre} · ${formatTime(audio.currentTime)} of ${formatTime(audio.duration)}` : '';
    $('#streamNowLabel').textContent = !currentTrack ? 'เลือกเพลงในคลัง' : playing ? 'กำลังเล่น' : 'หยุดชั่วคราว';
    document.querySelectorAll('#trackList .track-row, #artistProfileView .track-row').forEach(row => {
      const isPlaying = row.dataset.trackRow === currentTrack?.id && playing;
      row.classList.toggle('is-playing', isPlaying);
      const button = $('.track-row-play', row);
      if (button) {
        button.textContent = isPlaying ? 'Ⅱ' : '▶';
        button.setAttribute('aria-label', `${isPlaying ? 'หยุด' : 'เล่น'} ${$('.track-row-copy strong', row).textContent}`);
      }
    });
    const featuredPlay = $('#artistProfileView .artist-featured-play');
    if (featuredPlay) featuredPlay.textContent = currentTrack?.id === featuredPlay.dataset.trackPlay && playing ? 'Ⅱ หยุดเพลง' : '▶ เล่นเพลง';
    document.querySelectorAll('#artistProfileView [data-artist-wave]').forEach(wave => {
      const isCurrent = wave.dataset.artistWave === currentTrack?.id;
      const played = isCurrent && audio.duration ? Math.floor(audio.currentTime / audio.duration * wave.children.length) : 0;
      [...wave.children].forEach((bar, index) => bar.classList.toggle('is-played', isCurrent && index < played));
    });
    document.querySelectorAll('.stream-release-card').forEach(card => card.classList.toggle('is-playing', Boolean(currentTrack && !audio.paused && card.querySelector(`[data-track-play="${currentTrack.id}"]`))));
    updateRoomTrackInfo();
    updateArtistMini();
  }

  function applyWaveform(wave, peaks) {
    const fragment = document.createDocumentFragment();
    peaks.forEach(peak => {
      const bar = document.createElement('i');
      bar.style.setProperty('--bar', `${peak}%`);
      fragment.append(bar);
    });
    wave.replaceChildren(fragment);
    wave.dataset.waveReady = 'true';
  }

  async function renderArtistWaveform(track, requestId) {
    const wave = $('#artistProfileView [data-artist-wave]');
    if (!wave || !track || wave.dataset.artistWave !== track.id) return;
    if (waveformCache.has(track.id)) { applyWaveform(wave, waveformCache.get(track.id)); return; }
    if (!Number.isFinite(track.size_bytes) || track.size_bytes < 1 || track.size_bytes > 50 * 1024 * 1024) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    try {
      const response = await fetch(track.audio_url, { signal: AbortSignal.timeout(30000), credentials: 'omit' });
      if (!response.ok) throw new Error('Audio download failed');
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 50 * 1024 * 1024) throw new Error('Audio file exceeds waveform limit');
      const decoded = await context.decodeAudioData(buffer);
      const count = 72;
      const energy = Array(count).fill(0);
      const sampleCounts = Array(count).fill(0);
      const samples = decoded.length;
      for (let bar = 0; bar < count; bar++) {
        const start = Math.floor(bar * samples / count);
        const end = Math.max(start + 1, Math.floor((bar + 1) * samples / count));
        const stride = Math.max(1, Math.floor((end - start) / 1200));
        for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
          const data = decoded.getChannelData(channel);
          for (let index = start; index < end; index += stride) {
            const sample = data[index] || 0;
            energy[bar] += sample * sample;
            sampleCounts[bar]++;
          }
        }
      }
      const rms = energy.map((sum, index) => Math.sqrt(sum / Math.max(1, sampleCounts[index])));
      const maximum = Math.max(...rms, 0.0001);
      const normalized = rms.map(value => Math.round(8 + Math.pow(value / maximum, 1.2) * 92));
      waveformCache.set(track.id, normalized);
      if (requestId === artistRouteRequest) {
        const currentWave = $('#artistProfileView [data-artist-wave]');
        if (currentWave?.dataset.artistWave === track.id) applyWaveform(currentWave, normalized);
      }
    } catch (error) {
      console.warn('Unable to generate artist track waveform:', error instanceof Error ? error.message : 'unknown error');
    } finally {
      await context.close().catch(() => {});
    }
  }

  function selectTrack(track, autoplay = true) {
    if (!track) return;
    currentTrack = track;
    const cover = $('#streamCover');
    $('.stream-cover-image', cover)?.remove();
    cover.classList.toggle('has-artwork', Boolean(track.cover_url));
    if (track.cover_url) cover.insertAdjacentHTML('afterbegin', `<img class="stream-cover-image" src="${escapeHTML(track.cover_url)}" alt="" />`);
    setPlayerBanner(track);
    $('#streamTitle').textContent = track.title;
    const artistLine = $('#streamArtist');
    artistLine.textContent = track.artist_profile?.display_name || track.artist;
    if (track.artist_profile?.username) {
      artistLine.href = `#artist/${encodeURIComponent(track.artist_profile.username)}`;
      artistLine.dataset.artistProfile = track.artist_profile.username;
      artistLine.removeAttribute('aria-disabled');
    } else {
      artistLine.removeAttribute('href');
      delete artistLine.dataset.artistProfile;
      artistLine.setAttribute('aria-disabled', 'true');
    }
    $('#streamGenre').textContent = ` · ${track.genre}`;
    $('#streamPlay').disabled = false;
    $('#streamSeek').disabled = false;
    $('#streamMute').disabled = false;
    audio.src = track.audio_url;
    audio.load();
    renderTracks();
    updateRoomTrackInfo();
    updateArtistMini();
    if (autoplay) audio.play().catch(() => toast('ไฟล์นี้เล่นไม่ได้ในเบราว์เซอร์ ลองไฟล์ MP3, WAV หรือ OGG'));
  }

  function showUploadForm() {
    const profile = window.SourcewavStore?.getState().profile || {};
    openModal(`<div class="upload-shell">
      <aside class="upload-art-side" aria-label="พื้นที่ปล่อยเพลงของ Sourcewav">
        <div class="upload-visual" aria-hidden="true"><div class="upload-record"><span>SW</span></div><div class="upload-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
        <div class="upload-copy"><span class="upload-kicker">SOURCEWAV · SOUND FROM THE UNDERGROUND</span><h2 id="modalTitle">ปล่อยเสียง<br>ให้คนที่ใช่ได้ฟัง</h2><p>เพลงของคุณมีที่อยู่แล้วในวงนี้ ส่งเดโมหรือเพลงใหม่ให้คนทำเพลงได้เจอกัน</p></div>
        <div class="upload-art-footer"><span>ไฟล์เสียง</span><b>MP3 / WAV / FLAC / OGG</b></div>
      </aside>
      <div class="upload-form-side"><div class="upload-form-heading"><div><span class="upload-form-kicker">เริ่มปล่อยเพลง</span><p>ใส่รายละเอียดให้คนฟังจำเพลงของคุณได้</p></div><span class="upload-private-mark">♫</span></div>
        <form id="trackUploadForm" class="upload-form" enctype="multipart/form-data">
          <div class="upload-fields">
            <label class="modal-field">ชื่อเพลง<input name="title" required maxlength="100" autocomplete="off" placeholder="เช่น คืนที่เมืองยังไม่หลับ" /></label>
            <label class="modal-field">ศิลปิน / โปรดิวเซอร์<input name="artist" required maxlength="80" autocomplete="off" value="${escapeHTML(profile.displayName || '')}" placeholder="ชื่อที่ใช้ปล่อยเพลง" /></label>
            <label class="modal-field upload-genre-field">แนวเพลง<select name="genre"><option>ฮิปฮอป</option><option>แรป</option><option>บูมแบป</option><option>แทรป</option><option>อาร์แอนด์บี</option><option>อิเล็กทรอนิก</option><option>อื่นๆ</option></select></label>
          </div>
          <div class="track-cover-field">
            <label class="track-cover-label" for="trackCover">รูปปกเพลง <span>ไม่บังคับ</span></label>
            <div class="track-cover-choice">
              <label class="track-cover-picker" id="trackCoverPicker" for="trackCover">
                <input id="trackCover" class="track-cover-input" name="cover" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" aria-label="เลือกรูปปกเพลง" />
                <span class="track-cover-preview" id="trackCoverPreview" aria-hidden="true">♫</span>
                <span class="track-cover-copy"><strong id="trackCoverName">เพิ่มรูปปกเพลง</strong><small id="trackCoverMeta">JPG, PNG หรือ WebP · สูงสุด 5 MB</small></span>
                <span class="track-cover-browse">เลือกรูป</span>
              </label>
              <button class="track-cover-clear" id="clearTrackCover" type="button" hidden>เอารูปออก</button>
            </div>
          </div>
          <div class="track-banner-field">
            <label class="track-cover-label" for="trackBanner">แบนเนอร์เพลง <span>ไม่บังคับ</span></label>
            <label class="track-banner-picker" for="trackBanner">
              <input id="trackBanner" name="banner" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" aria-label="เลือกแบนเนอร์เพลง" />
              <span class="track-banner-preview" id="trackBannerPreview" aria-hidden="true">♫</span>
              <span class="track-cover-copy"><strong id="trackBannerName">เพิ่มภาพแบนเนอร์แนวกว้าง</strong><small id="trackBannerMeta">แนะนำ 1500 × 500 px · JPG, PNG หรือ WebP · สูงสุด 5 MB</small></span>
              <span class="track-cover-browse">เลือกรูป</span>
            </label>
            <button class="track-cover-clear" id="clearTrackBanner" type="button" hidden>เอารูปออก</button>
          </div>
          <label class="track-dropzone" id="trackDropzone"><input id="trackFile" class="track-file-input" name="audio" type="file" required accept=".mp3,.wav,.flac,.ogg,.m4a,.aac,.webm,audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/mp4,audio/aac,audio/webm" aria-label="เลือกไฟล์เสียง" /><span class="drop-orbit" aria-hidden="true"><b>↑</b></span><span class="drop-copy"><strong id="uploadFileName">วางไฟล์เพลงตรงนี้</strong><small id="uploadFileMeta">หรือคลิกเพื่อเลือกจากเครื่อง</small></span><span class="drop-browse">เลือกไฟล์</span></label>
          <p class="upload-file-note" id="uploadFileNote">รองรับ MP3, WAV, FLAC, OGG, M4A, AAC, WEBM · สูงสุด 50 MB</p>
          <p class="upload-rights-note">อัปโหลดเฉพาะเพลงที่คุณมีสิทธิ์เผยแพร่</p>
          <p class="stream-error" id="uploadError" role="alert" hidden></p>
          <button class="modal-primary upload-submit" id="trackSubmit" type="submit"><span>ปล่อยเพลงเข้าสู่วง</span><b aria-hidden="true">↗</b></button>
        </form>
      </div>
    </div>`);
    const fileInput = $('#trackFile');
    const dropzone = $('#trackDropzone');
    const showFile = file => {
      const name = $('#uploadFileName');
      const meta = $('#uploadFileMeta');
      const note = $('#uploadFileNote');
      dropzone.classList.toggle('has-file', Boolean(file));
      note.classList.toggle('is-invalid', Boolean(file && file.size > 50 * 1024 * 1024));
      if (!file) {
        name.textContent = 'วางไฟล์เพลงตรงนี้';
        meta.textContent = 'หรือตรงนี้เพื่อเลือกจากเครื่องของคุณ';
        note.textContent = 'รองรับ MP3, WAV, FLAC, OGG, M4A, AAC, WEBM · สูงสุด 50 MB';
      } else {
        name.textContent = file.name;
        meta.textContent = `${formatSize(file.size)} · ${file.size > 50 * 1024 * 1024 ? 'ไฟล์ใหญ่เกินกำหนด' : 'ไฟล์พร้อมอัปโหลด'}`;
        note.textContent = file.size > 50 * 1024 * 1024 ? 'ไฟล์ใหญ่เกิน 50 MB เลือกไฟล์ที่เล็กกว่านี้' : 'ตรวจสอบชื่อเพลงและศิลปินก่อนกดปล่อยเพลง';
      }
    };
    fileInput?.addEventListener('change', () => showFile(fileInput.files?.[0]));
    const coverInput = $('#trackCover');
    const coverPicker = $('#trackCoverPicker');
    coverInput?.addEventListener('change', () => {
      const file = coverInput.files?.[0];
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
      coverPreviewUrl = '';
      coverPicker.classList.toggle('has-cover', Boolean(file));
      $('#trackCoverName').textContent = file?.name || 'เพิ่มรูปปกเพลง';
      $('#trackCoverMeta').textContent = !file ? 'JPG, PNG หรือ WebP · สูงสุด 5 MB'
        : !coverMimeByType[file.type] ? 'ไฟล์นี้ไม่รองรับ เลือก JPG, PNG หรือ WebP'
          : file.size > maxCoverSize ? 'ไฟล์ใหญ่เกิน 5 MB เลือกรูปที่เล็กกว่านี้'
            : `${formatSize(file.size)} · รูปพร้อมอัปโหลด`;
      const preview = $('#trackCoverPreview');
      preview.innerHTML = '<span aria-hidden="true">♫</span>';
      if (file && coverMimeByType[file.type] && file.size <= maxCoverSize) {
        coverPreviewUrl = URL.createObjectURL(file);
        preview.innerHTML = `<img src="${escapeHTML(coverPreviewUrl)}" alt="" />`;
      }
      $('#clearTrackCover').hidden = !file;
    });
    $('#clearTrackCover')?.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      coverInput.value = '';
      coverInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const bannerInput = $('#trackBanner');
    bannerInput?.addEventListener('change', () => {
      const file = bannerInput.files?.[0];
      if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
      bannerPreviewUrl = '';
      const preview = $('#trackBannerPreview');
      preview.innerHTML = '♫';
      $('#trackBannerName').textContent = file?.name || 'เพิ่มภาพแบนเนอร์แนวกว้าง';
      $('#trackBannerMeta').textContent = !file ? 'แนะนำ 1500 × 500 px · JPG, PNG หรือ WebP · สูงสุด 5 MB'
        : !coverMimeByType[file.type] ? 'ไฟล์นี้ไม่รองรับ เลือก JPG, PNG หรือ WebP'
          : file.size > maxCoverSize ? 'ไฟล์ใหญ่เกิน 5 MB เลือกรูปที่เล็กกว่านี้'
            : `${formatSize(file.size)} · ภาพพร้อมอัปโหลด`;
      if (file && coverMimeByType[file.type] && file.size <= maxCoverSize) {
        bannerPreviewUrl = URL.createObjectURL(file);
        preview.innerHTML = `<img src="${escapeHTML(bannerPreviewUrl)}" alt="" />`;
      }
      $('#clearTrackBanner').hidden = !file;
    });
    $('#clearTrackBanner')?.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      bannerInput.value = '';
      bannerInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    ['dragenter', 'dragover'].forEach(name => dropzone?.addEventListener(name, event => { event.preventDefault(); dropzone.classList.add('is-dragging'); }));
    ['dragleave', 'drop'].forEach(name => dropzone?.addEventListener(name, event => { event.preventDefault(); dropzone.classList.remove('is-dragging'); }));
    dropzone?.addEventListener('drop', event => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileInput.files = transfer.files;
      showFile(file);
    });
  }

  async function loadTracks() {
    const db = window.SourcewavSupabase;
    if (!db || window.SourcewavSupabaseStatus !== 'online') {
      list.innerHTML = '<div class="track-empty"><span>♫</span><b>เชื่อมต่อคลังเพลงไม่ได้</b><p>ตรวจสอบการเชื่อมต่อ Supabase แล้วโหลดหน้าใหม่</p></div>';
      return;
    }
    const fetchTracks = columns => db.from('audio_tracks')
      .select(columns).eq('status', 'published').eq('visibility', 'public').is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(100);
    let { data, error } = await fetchTracks('id,owner_id,title,artist_name,genre,storage_key,cover_storage_key,banner_storage_key,mime_type,byte_size,created_at');
    if (error?.code === '42703' && (error.message?.includes('banner_storage_key') || error.message?.includes('cover_storage_key'))) {
      ({ data, error } = await fetchTracks('id,owner_id,title,artist_name,genre,storage_key,cover_storage_key,mime_type,byte_size,created_at'));
    }
    if (error?.code === '42703' && error.message?.includes('cover_storage_key')) {
      ({ data, error } = await fetchTracks('id,owner_id,title,artist_name,genre,storage_key,mime_type,byte_size,created_at'));
    }
    if (error) {
      list.innerHTML = `<div class="track-empty"><span>♫</span><b>โหลดคลังเพลงไม่ได้</b><p>${escapeHTML(error.message)}</p></div>`;
      return;
    }
    const ownerIds = [...new Set((data || []).map(track => track.owner_id).filter(Boolean))];
    let profileById = {};
    if (ownerIds.length) {
      const { data: profiles } = await db.from('profiles').select('user_id,username,display_name,avatar_url,bio,city,province,roles,portfolio_url').in('user_id', ownerIds);
      profileById = Object.fromEntries((profiles || []).map(profile => [profile.user_id, profile]));
    }
    const normalizeTracks = rows => (rows || []).map(track => ({ ...track,
      artist: track.artist_name, size_bytes: Number(track.byte_size),
      artist_profile: profileById[track.owner_id] || null,
      audio_url: db.storage.from('sourcewav-audio').getPublicUrl(track.storage_key).data.publicUrl,
      cover_url: track.cover_storage_key ? db.storage.from('sourcewav-track-covers').getPublicUrl(track.cover_storage_key).data.publicUrl : '',
      banner_url: track.banner_storage_key ? db.storage.from('sourcewav-track-covers').getPublicUrl(track.banner_storage_key).data.publicUrl : ''
    }));
    tracks = normalizeTracks(data);
    likedTrackIds = new Set();
    const { data: authData } = await db.auth.getUser();
    currentUserId = authData?.user?.id || null;
    if (authData?.user && tracks.length) {
      const { data: likes } = await db.from('audio_track_likes').select('track_id').eq('user_id', authData.user.id).in('track_id', tracks.map(track => track.id));
      likedTrackIds = new Set((likes || []).map(like => like.track_id));
    }
    renderTracks();
    if (window.location.hash.startsWith('#artist/')) renderArtistProfile(window.location.hash);
  }

  async function renderArtistProfile(hash = window.location.hash) {
    const view = $('#artistProfileView');
    if (!view) return;
    const requestId = ++artistRouteRequest;
    const username = (() => { try { return decodeURIComponent(hash.slice('#artist/'.length)); } catch { return ''; } })();
    if (!username || username.length > 30) { window.location.hash = '#music'; return; }
    document.body.classList.add('artist-profile-active');
    $('#home')?.classList.add('artist-profile-active');
    view.hidden = false;
    view.innerHTML = '<div class="artist-profile-loading"><span class="artist-profile-spinner" aria-hidden="true"></span><p>กำลังเปิดโปรไฟล์ศิลปิน…</p></div>';
    const db = window.SourcewavSupabase;
    if (!db || window.SourcewavSupabaseStatus !== 'online') {
      view.innerHTML = '<div class="artist-profile-message"><h2>เชื่อมต่อโปรไฟล์ไม่ได้</h2><p>ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง</p><a href="#music">กลับไปหน้าฟังเพลง</a></div>';
      return;
    }
    const { data: profile, error: profileError } = await db.from('profiles')
      .select('user_id,username,display_name,avatar_url,bio,city,province,roles,portfolio_url')
      .eq('username', username).maybeSingle();
    if (requestId !== artistRouteRequest) return;
    if (profileError || !profile) {
      view.innerHTML = `<div class="artist-profile-message"><h2>ไม่พบโปรไฟล์นี้</h2><p>โปรไฟล์อาจถูกซ่อนหรือลบไปแล้ว</p><a href="#music">กลับไปหน้าฟังเพลง</a></div>`;
      return;
    }
    const fetchArtistTracks = columns => db.from('audio_tracks').select(columns)
      .eq('owner_id', profile.user_id).eq('status', 'published').eq('visibility', 'public')
      .is('deleted_at', null).order('created_at', { ascending: false }).limit(200);
    let { data: artistTracks, error: tracksError } = await fetchArtistTracks('id,owner_id,title,artist_name,genre,storage_key,cover_storage_key,banner_storage_key,mime_type,byte_size,created_at');
    if (tracksError?.code === '42703' && (tracksError.message?.includes('banner_storage_key') || tracksError.message?.includes('cover_storage_key'))) {
      ({ data: artistTracks, error: tracksError } = await fetchArtistTracks('id,owner_id,title,artist_name,genre,storage_key,cover_storage_key,mime_type,byte_size,created_at'));
    }
    if (tracksError?.code === '42703' && tracksError.message?.includes('cover_storage_key')) {
      ({ data: artistTracks, error: tracksError } = await fetchArtistTracks('id,owner_id,title,artist_name,genre,storage_key,mime_type,byte_size,created_at'));
    }
    if (requestId !== artistRouteRequest) return;
    if (tracksError) {
      view.innerHTML = `<div class="artist-profile-message"><h2>โหลดผลงานไม่ได้</h2><p>${escapeHTML(tracksError.message)}</p><a href="#music">กลับไปหน้าฟังเพลง</a></div>`;
      return;
    }
    const [{ count: followerCount, error: followerError }, { data: authData }] = await Promise.all([
      db.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followed_id', profile.user_id),
      db.auth.getUser()
    ]);
    if (requestId !== artistRouteRequest) return;
    const currentUser = authData?.user || null;
    currentUserId = currentUser?.id || null;
    let isFollowing = false;
    if (currentUser && currentUser.id !== profile.user_id) {
      const { data: followRecord } = await db.from('follows').select('follower_id').eq('follower_id', currentUser.id).eq('followed_id', profile.user_id).maybeSingle();
      if (requestId !== artistRouteRequest) return;
      isFollowing = Boolean(followRecord);
    }
    const artistFollowerCount = followerError || followerCount === null ? null : Number(followerCount);
    const safeAvatar = (() => { try { const url = new URL(profile.avatar_url || ''); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } })();
    const safePortfolio = (() => { try { const url = new URL(profile.portfolio_url || ''); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } })();
    const artist = { ...profile };
    const profileTracks = (artistTracks || []).map(track => ({ ...track, artist: track.artist_name, artist_profile: artist,
      size_bytes: Number(track.byte_size),
      audio_url: db.storage.from('sourcewav-audio').getPublicUrl(track.storage_key).data.publicUrl,
      cover_url: track.cover_storage_key ? db.storage.from('sourcewav-track-covers').getPublicUrl(track.cover_storage_key).data.publicUrl : '',
      banner_url: track.banner_storage_key ? db.storage.from('sourcewav-track-covers').getPublicUrl(track.banner_storage_key).data.publicUrl : ''
    }));
    const location = [profile.city, profile.province].filter(Boolean).join(' · ');
    const roles = Array.isArray(profile.roles) ? profile.roles : [];
    const latest = profileTracks[0];
    const bannerUrl = (() => { try { const url = new URL(latest?.banner_url || latest?.cover_url || ''); return ['http:', 'https:'].includes(url.protocol) ? `url("${url.href.replace(/["\\]/g, '')}")` : 'none'; } catch { return 'none'; } })();
    view.style.setProperty('--artist-banner-image', bannerUrl);
    const totalTracks = profileTracks.length;
    const playlist = profileTracks.slice(0, 4);
    const featuredMarkup = latest ? `<article class="artist-featured-track">
      <span class="artist-profile-kicker">SPOTLIGHT · เพลงล่าสุด</span><div class="artist-featured-main">
        <span class="artist-featured-cover">${latest.cover_url ? `<img src="${escapeHTML(latest.cover_url)}" alt="" />` : '<span aria-hidden="true">♫</span>'}</span>
        <div class="artist-featured-copy"><span>${escapeHTML(profile.display_name || profile.username)}</span><h3>${escapeHTML(latest.title)}</h3><p>${escapeHTML(latest.genre)} · ${formatSize(latest.size_bytes)}</p>
          <div class="artist-profile-wave" data-artist-wave="${escapeHTML(latest.id)}" role="img" aria-label="รูปคลื่นเสียง ${escapeHTML(latest.title)}">${Array.from({ length: 72 }, () => '<i style="--bar:10%"></i>').join('')}</div>
          <button class="artist-featured-play" type="button" data-track-play="${escapeHTML(latest.id)}" aria-label="เล่น ${escapeHTML(latest.title)}">${currentTrack?.id === latest.id && !audio.paused ? 'Ⅱ หยุดเพลง' : '▶ เล่นเพลง'}</button>
        </div></div></article>` : '<div class="artist-profile-empty"><span aria-hidden="true">♫</span><h3>ยังไม่มีเพลงที่เผยแพร่</h3><p>เพลงที่เปิดให้ฟังสาธารณะจะแสดงตรงนี้</p></div>';
    const tracksMarkup = profileTracks.map(track => `<article class="track-row${currentTrack?.id === track.id && !audio.paused ? ' is-playing' : ''}" data-track-row="${escapeHTML(track.id)}">
        <button type="button" class="track-row-play" data-track-play="${escapeHTML(track.id)}" aria-label="เล่น ${escapeHTML(track.title)}">${currentTrack?.id === track.id && !audio.paused ? 'Ⅱ' : '▶'}</button>
        <span class="track-row-cover" aria-hidden="true">${track.cover_url ? `<img src="${escapeHTML(track.cover_url)}" alt="" loading="lazy" />` : '♫'}</span>
        <div class="track-row-copy"><strong>${escapeHTML(track.title)}</strong><small>${escapeHTML(track.genre)} · ${new Date(track.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</small></div><div class="track-row-meta"><span class="track-genre">${escapeHTML(track.genre)}</span>${track.owner_id === currentUserId ? `<button type="button" class="track-edit-button" data-track-edit="${escapeHTML(track.id)}" aria-label="แก้ไขชื่อเพลงและรูปปก ${escapeHTML(track.title)}" title="แก้ไขชื่อเพลงและรูปปก"><img src="assets/edit-pencil-glass.png" alt="" aria-hidden="true" /></button>` : ''}</div>
      </article>`).join('');
    const genres = [...new Set(profileTracks.map(track => track.genre).filter(Boolean))].slice(0, 6);
    view.innerHTML = `<header class="artist-profile-hero"><div class="artist-profile-cover-art" aria-hidden="true"></div><div class="artist-profile-hero-shade"></div><div class="artist-profile-identity">
        <div class="artist-profile-avatar">${safeAvatar ? `<img src="${escapeHTML(safeAvatar)}" alt="" />` : `<span>${escapeHTML((profile.display_name || profile.username).slice(0, 1).toUpperCase())}</span>`}</div>
        <div class="artist-profile-names"><span class="artist-profile-kicker">SOURCEWAV ARTIST</span><h1>${escapeHTML(profile.display_name || profile.username)}</h1><p>${roles.length ? `${escapeHTML(roles.slice(0, 3).join(' / '))} · ` : ''}@${escapeHTML(profile.username)}${location ? ` · ${escapeHTML(location)}` : ''}</p>
          ${profile.bio ? `<blockquote>${escapeHTML(profile.bio)}</blockquote>` : ''}</div>
        ${currentUser?.id !== profile.user_id ? `<button type="button" class="artist-profile-follow${isFollowing ? ' is-following' : ''}" data-profile-follow aria-pressed="${isFollowing}">${isFollowing ? '✓ กำลังติดตาม' : '+ ติดตาม'}</button>` : ''}
        ${safePortfolio ? `<a class="artist-profile-external" href="${escapeHTML(safePortfolio)}" target="_blank" rel="noopener noreferrer">ลิงก์ผลงาน ↗</a>` : ''}
      </div></header>
      <nav class="artist-profile-tabs" aria-label="เมนูโปรไฟล์ศิลปิน"><button type="button" class="is-active" data-artist-tab="tracks" aria-selected="true">เพลง <span>${totalTracks}</span></button><button type="button" data-artist-tab="about" aria-selected="false">เกี่ยวกับ</button></nav>
      <div class="artist-profile-grid" data-artist-panel="tracks"><aside class="artist-profile-sidebar">
          <section class="artist-profile-side-block"><h2>เกี่ยวกับ</h2><p>${profile.bio ? escapeHTML(profile.bio) : 'ศิลปินคนนี้ยังไม่ได้เพิ่มคำแนะนำตัว'}</p>${location ? `<small class="artist-profile-location">⌖ ${escapeHTML(location)}</small>` : ''}</section>
          ${roles.length ? `<section class="artist-profile-side-block"><h2>บทบาท</h2><div class="artist-profile-tags">${roles.map(role => `<span>${escapeHTML(role)}</span>`).join('')}</div></section>` : ''}
          ${safePortfolio ? `<a class="artist-profile-side-link" href="${escapeHTML(safePortfolio)}" target="_blank" rel="noopener noreferrer">↗ เว็บไซต์ / ผลงาน</a>` : ''}
        </aside><div class="artist-profile-center">${featuredMarkup}<section class="artist-profile-music"><div class="artist-profile-section-head"><div><span class="artist-profile-kicker">เสียงจากศิลปิน</span><h2>เพลงทั้งหมด</h2></div><span>${totalTracks} เพลง</span></div><div class="track-list artist-profile-track-list">${tracksMarkup}</div></section></div>
        <aside class="artist-profile-right"><section class="artist-profile-side-block artist-profile-stats"><h2>สถิติ</h2><div><span><b>${totalTracks}</b><small>เพลง</small></span>${artistFollowerCount !== null ? `<span><b id="artistFollowerCount">${artistFollowerCount.toLocaleString('th-TH')}</b><small>ผู้ติดตาม</small></span>` : ''}</div></section>
          <section class="artist-profile-side-block"><h2>แนวเพลง</h2>${genres.length ? `<div class="artist-profile-tags">${genres.map(genre => `<span>${escapeHTML(genre)}</span>`).join('')}</div>` : '<p>ยังไม่มีข้อมูลแนวเพลง</p>'}</section>
          ${playlist.length ? `<section class="artist-profile-side-block"><h2>เพลงที่เพิ่งปล่อย</h2><div class="artist-profile-mini-list">${playlist.map(track => `<button type="button" data-track-play="${escapeHTML(track.id)}"><span>${track.cover_url ? `<img src="${escapeHTML(track.cover_url)}" alt="" />` : '♫'}</span><b>${escapeHTML(track.title)}<small>${escapeHTML(track.genre)}</small></b></button>`).join('')}</div></section>` : ''}
        </aside></div>
      <section class="artist-profile-about-panel" data-artist-panel="about" hidden><span class="artist-profile-kicker">ABOUT THE ARTIST</span><h2>${escapeHTML(profile.display_name || profile.username)}</h2><p>${profile.bio ? escapeHTML(profile.bio) : 'ศิลปินคนนี้ยังไม่ได้เพิ่มคำแนะนำตัว'}</p>${location ? `<p class="artist-profile-location">⌖ ${escapeHTML(location)}</p>` : ''}${roles.length ? `<div class="artist-profile-tags">${roles.map(role => `<span>${escapeHTML(role)}</span>`).join('')}</div>` : ''}${safePortfolio ? `<a class="artist-profile-external" href="${escapeHTML(safePortfolio)}" target="_blank" rel="noopener noreferrer">เปิดลิงก์ผลงาน ↗</a>` : ''}</section>
      <footer class="artist-mini-player" id="artistMiniPlayer" hidden><span class="artist-mini-cover" id="artistMiniCover">♫</span><span class="artist-mini-copy"><b id="artistMiniTitle"></b><small id="artistMiniArtist"></small></span><span class="artist-mini-time" id="artistMiniTime">0:00</span><input id="artistMiniSeek" type="range" min="0" max="1000" value="0" aria-label="ตำแหน่งเพลง" /><button type="button" data-artist-mini-play aria-label="เล่นเพลง">▶</button></footer>
      <a class="artist-profile-back" href="#music">← กลับไปหน้าฟังเพลง</a>`;
    tracks = [...new Map([...tracks, ...profileTracks].map(track => [track.id, track])).values()];
    if (latest) renderArtistWaveform(latest, requestId);
    const tabButtons = view.querySelectorAll('[data-artist-tab]');
    tabButtons.forEach(button => button.addEventListener('click', () => {
      const tab = button.dataset.artistTab;
      tabButtons.forEach(item => { const active = item === button; item.classList.toggle('is-active', active); item.setAttribute('aria-selected', String(active)); });
      view.querySelectorAll('[data-artist-panel]').forEach(panel => { panel.hidden = panel.dataset.artistPanel !== tab; });
    }));
    $('[data-profile-follow]', view)?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const { data: sessionData } = await db.auth.getUser();
      const user = sessionData?.user;
      if (!user) { toast('เข้าสู่ระบบก่อนติดตามศิลปิน'); $('#profileBtn')?.click(); return; }
      if (user.id === profile.user_id) return;
      button.disabled = true;
      const wasFollowing = button.getAttribute('aria-pressed') === 'true';
      let result;
      try {
        result = wasFollowing
          ? await db.from('follows').delete().eq('follower_id', user.id).eq('followed_id', profile.user_id)
          : await db.from('follows').insert({ follower_id: user.id, followed_id: profile.user_id });
      } catch {
        button.disabled = false;
        toast('ติดตามไม่สำเร็จ ลองอีกครั้ง');
        return;
      }
      button.disabled = false;
      if (result.error) { toast('ติดตามไม่สำเร็จ ลองอีกครั้ง'); return; }
      const following = !wasFollowing;
      button.setAttribute('aria-pressed', String(following));
      button.classList.toggle('is-following', following);
      button.textContent = following ? '✓ กำลังติดตาม' : '+ ติดตาม';
      const count = $('#artistFollowerCount', view);
      if (count) count.textContent = String(Math.max(0, Number(count.textContent.replace(/,/g, '')) + (following ? 1 : -1)));
      toast(following ? 'เริ่มติดตามศิลปินแล้ว' : 'เลิกติดตามศิลปินแล้ว');
    });
    $('[data-artist-mini-play]', view)?.addEventListener('click', () => $('#streamPlay')?.click());
    $('#artistMiniSeek', view)?.addEventListener('input', event => { if (audio.duration) audio.currentTime = Number(event.target.value) / 1000 * audio.duration; });
    updateArtistMini();
    view.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function syncArtistRoute() {
    if (window.location.hash.startsWith('#artist/')) renderArtistProfile(window.location.hash);
    else {
      artistRouteRequest++;
      document.body.classList.remove('artist-profile-active');
      $('#home')?.classList.remove('artist-profile-active');
      const view = $('#artistProfileView');
      if (view) view.hidden = true;
    }
  }
  window.addEventListener('hashchange', syncArtistRoute);
  syncArtistRoute();

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#navReleaseBtn, #addTrackBtn, #emptyUploadBtn')) { event.preventDefault(); event.stopImmediatePropagation(); showUploadForm(); return; }
    const edit = target.closest('[data-track-edit]');
    if (edit) { event.preventDefault(); event.stopImmediatePropagation(); showTrackEditForm(tracks.find(track => track.id === edit.dataset.trackEdit)); return; }
    const tab = target.closest('[data-music-tab]');
    if (tab) {
      event.preventDefault(); event.stopImmediatePropagation();
      musicTab = tab.dataset.musicTab;
      if (musicTab === 'radio') playTrackStep(1, true);
      renderTracks();
      if (musicTab === 'library') $('.track-list-head')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const action = target.closest('[data-stream-action]');
    if (action) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (action.dataset.streamAction === 'shuffle') { shuffleMode = !shuffleMode; updateRoomTrackInfo(); }
      else if (action.dataset.streamAction === 'previous') playTrackStep(-1, false);
      else if (action.dataset.streamAction === 'next' || action.dataset.streamAction === 'radio') {
        if (action.dataset.streamAction === 'radio') musicTab = 'radio';
        playTrackStep(1, action.dataset.streamAction === 'radio' || shuffleMode);
        renderTracks();
      } else if (action.dataset.streamAction === 'like-current' && currentTrack) toggleLike(currentTrack.id);
      return;
    }
    const like = target.closest('[data-track-like]');
    if (like) { event.preventDefault(); event.stopImmediatePropagation(); toggleLike(like.dataset.trackLike); return; }
    const play = target.closest('[data-track-play]');
    if (play) {
      event.preventDefault(); event.stopImmediatePropagation();
      const track = tracks.find(item => item.id === play.dataset.trackPlay);
      if (!track) return;
      if (currentTrack?.id === track.id && !audio.paused) audio.pause();
      else if (currentTrack?.id === track.id) audio.play().catch(() => toast('ไฟล์นี้เล่นไม่ได้ในเบราว์เซอร์'));
      else selectTrack(track, true);
    }
  }, true);

  document.addEventListener('submit', async event => {
    if (event.target instanceof HTMLFormElement && event.target.id === 'trackEditForm') {
      event.preventDefault(); event.stopImmediatePropagation(); await saveTrackEdit(event.target); return;
    }
    if (!(event.target instanceof HTMLFormElement) || event.target.id !== 'trackUploadForm') return;
    event.preventDefault(); event.stopImmediatePropagation();
    const form = event.target;
    const file = form.elements.audio.files?.[0];
    const coverFile = form.elements.cover.files?.[0] || null;
    const bannerFile = form.elements.banner.files?.[0] || null;
    const error = $('#uploadError');
    const submit = $('#trackSubmit');
    error.hidden = true;
    if (!file) { error.textContent = 'เลือกไฟล์เสียงก่อนอัปโหลด'; error.hidden = false; return; }
    if (file.size > 50 * 1024 * 1024) { error.textContent = 'ไฟล์มีขนาดใหญ่เกิน 50 MB'; error.hidden = false; return; }
    if (coverFile && !coverMimeByType[coverFile.type]) { error.textContent = 'รูปปกต้องเป็น JPG, PNG หรือ WebP'; error.hidden = false; return; }
    if (coverFile && coverFile.size > maxCoverSize) { error.textContent = 'รูปปกมีขนาดใหญ่เกิน 5 MB'; error.hidden = false; return; }
    if (bannerFile && !coverMimeByType[bannerFile.type]) { error.textContent = 'แบนเนอร์ต้องเป็น JPG, PNG หรือ WebP'; error.hidden = false; return; }
    if (bannerFile && bannerFile.size > maxCoverSize) { error.textContent = 'แบนเนอร์มีขนาดใหญ่เกิน 5 MB'; error.hidden = false; return; }
    const db = window.SourcewavSupabase;
    const auth = await db?.auth.getUser();
    if (!db || auth?.error || !auth?.data?.user) { error.textContent = 'เข้าสู่ระบบก่อนอัปโหลดเพลง'; error.hidden = false; submit.disabled = false; submit.textContent = 'ปล่อยเพลงเข้าสู่วง'; return; }
    const mimeByExtension = { mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm' };
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mime = mimeByExtension[extension];
    if (!mime) { error.textContent = 'รองรับเฉพาะ MP3, WAV, FLAC, OGG, M4A, AAC หรือ WEBM'; error.hidden = false; submit.disabled = false; submit.textContent = 'ปล่อยเพลงเข้าสู่วง'; return; }
    submit.disabled = true; submit.textContent = 'กำลังอัปโหลด…';
    let storageKey = '';
    let coverStorageKey = null;
    let bannerStorageKey = null;
    let audioUploaded = false;
    let coverUploaded = false;
    let bannerUploaded = false;
    try {
      const user = auth.data.user;
      const trackId = crypto.randomUUID();
      storageKey = `${user.id}/${trackId}.${extension}`;
      coverStorageKey = coverFile ? `${user.id}/${trackId}.${coverMimeByType[coverFile.type]}` : null;
      bannerStorageKey = bannerFile ? `${user.id}/${trackId}-banner.${coverMimeByType[bannerFile.type]}` : null;
      const { error: uploadError } = await db.storage.from('sourcewav-audio').upload(storageKey, file, { contentType: mime, cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error('อัปโหลดไฟล์เพลงไม่ได้: ' + uploadError.message);
      audioUploaded = true;
      if (coverFile && coverStorageKey) {
        const { error: coverUploadError } = await db.storage.from('sourcewav-track-covers').upload(coverStorageKey, coverFile, { contentType: coverFile.type, cacheControl: '3600', upsert: false });
        if (coverUploadError && (coverUploadError.statusCode === '404' || coverUploadError.message?.toLowerCase().includes('bucket not found'))) {
          throw new Error('ระบบฐานข้อมูลยังไม่พร้อมสำหรับรูปปกเพลง โปรดใช้ migration 20261022000100_audio_track_cover_art.sql ก่อน แล้วลองอีกครั้ง');
        }
        if (coverUploadError) throw new Error('อัปโหลดรูปปกไม่ได้: ' + coverUploadError.message);
        coverUploaded = true;
      }
      if (bannerFile && bannerStorageKey) {
        const { error: bannerUploadError } = await db.storage.from('sourcewav-track-covers').upload(bannerStorageKey, bannerFile, { contentType: bannerFile.type, cacheControl: '3600', upsert: false });
        if (bannerUploadError) throw new Error('อัปโหลดแบนเนอร์ไม่ได้: ' + bannerUploadError.message);
        bannerUploaded = true;
      }
      const trackRecord = {
        id: trackId, owner_id: user.id, title: form.elements.title.value.trim(),
        artist_name: form.elements.artist.value.trim(), genre: form.elements.genre.value,
        storage_key: storageKey, mime_type: mime, byte_size: file.size,
        visibility: 'public', status: 'published'
      };
      if (coverStorageKey) trackRecord.cover_storage_key = coverStorageKey;
      if (bannerStorageKey) trackRecord.banner_storage_key = bannerStorageKey;
      const { error: insertError } = await db.from('audio_tracks').insert(trackRecord);
      if (insertError?.code === '42703' && insertError.message?.includes('banner_storage_key')) {
        throw new Error('ฐานข้อมูลยังไม่พร้อมสำหรับแบนเนอร์เพลง โปรดใช้ migration 20261022000200_audio_track_banner_art.sql ก่อน แล้วลองอีกครั้ง');
      }
      if (insertError?.code === '42703' && insertError.message?.includes('cover_storage_key')) {
        throw new Error('ฐานข้อมูลยังไม่พร้อมสำหรับรูปปกเพลง โปรดใช้ migration 20261022000100_audio_track_cover_art.sql ก่อน แล้วลองอีกครั้ง');
      }
      if (insertError) throw new Error('บันทึกข้อมูลเพลงไม่ได้: ' + insertError.message);
      audioUploaded = false;
      coverUploaded = false;
      bannerUploaded = false;
      await loadTracks();
      const created = tracks.find(track => track.id === trackId);
      if (created) selectTrack(created, false);
      $('#modalClose').click();
      toast('อัปโหลดเพลงแล้ว กดเล่นเพื่อฟังได้เลย');
    } catch (failure) {
      const cleanup = [];
      if (audioUploaded && storageKey) cleanup.push(db.storage.from('sourcewav-audio').remove([storageKey]));
      if (coverUploaded && coverStorageKey) cleanup.push(db.storage.from('sourcewav-track-covers').remove([coverStorageKey]));
      if (bannerUploaded && bannerStorageKey) cleanup.push(db.storage.from('sourcewav-track-covers').remove([bannerStorageKey]));
      await Promise.allSettled(cleanup);
      error.textContent = failure.message || 'อัปโหลดไม่สำเร็จ ลองตรวจสอบไฟล์อีกครั้ง';
      error.hidden = false;
      submit.disabled = false; submit.textContent = 'ลองอัปโหลดอีกครั้ง';
    }
  }, true);

  $('#streamPlay').addEventListener('click', () => {
    if (!currentTrack && tracks.length) return selectTrack(tracks[0], true);
    if (!currentTrack) return showUploadForm();
    if (audio.paused) audio.play().catch(() => toast('ไฟล์นี้เล่นไม่ได้ในเบราว์เซอร์'));
    else audio.pause();
  });
  $('#streamSeek').addEventListener('input', event => { if (audio.duration) audio.currentTime = Number(event.target.value) / 1000 * audio.duration; });
  const updateVolumeControls = () => {
    const mute = $('#streamMute');
    mute.textContent = audio.muted ? '×' : '◖';
    mute.setAttribute('aria-label', audio.muted ? 'เปิดเสียง' : 'ปิดเสียง');
    mute.title = `${audio.muted ? 'เปิดเสียง' : 'ปิดเสียง'} · ${Math.round(audio.volume * 100)}%`;
    const slider = $('#streamVolume');
    if (slider) {
      const percent = Math.round(audio.volume * 100);
      slider.value = String(percent);
      slider.style.setProperty('--stream-volume-level', `${percent}%`);
      slider.setAttribute('aria-valuetext', `${percent}%${audio.muted ? ' ปิดเสียง' : ''}`);
    }
  };
  $('#streamMute').addEventListener('click', () => { audio.muted = !audio.muted; });
  $('#streamVolume').addEventListener('input', event => {
    audio.volume = Number(event.currentTarget.value) / 100;
    if (audio.volume > 0 && audio.muted) audio.muted = false;
  });
  audio.addEventListener('volumechange', updateVolumeControls);
  updateVolumeControls();
  ['play', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'ended'].forEach(name => audio.addEventListener(name, updatePlayer));
  audio.addEventListener('ended', () => { if (shuffleMode && tracks.length > 1) playTrackStep(1, true); });
  audio.addEventListener('error', () => { if (currentTrack) toast('ไม่สามารถเล่นไฟล์เสียงนี้ได้'); });
  const clearCoverPreview = () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
    coverPreviewUrl = ''; bannerPreviewUrl = '';
  };
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('#modalClose') || target?.id === 'modalBackdrop') clearCoverPreview();
  }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') clearCoverPreview(); });
  window.SourcewavSupabaseReady?.then(client => client && loadTracks());
  window.addEventListener('sourcewav:auth', loadTracks);
})();
