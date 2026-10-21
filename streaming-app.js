/* Sourcewav cloud audio library backed by Supabase Storage and audio_tracks. */
(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const audio = $('#streamAudio');
  const list = $('#trackList');
  if (!audio || !list) return;
  let tracks = [];
  let currentTrack = null;

  const formatTime = seconds => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };
  const formatSize = bytes => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  function renderTracks() {
    $('#trackCount').textContent = `${tracks.length} เพลง`;
    if (!tracks.length) {
      list.innerHTML = '<div class="track-empty"><span>♫</span><b>ยังไม่มีเพลงในคลัง</b><p>อัปโหลดไฟล์แรก แล้วให้เสียงของคุณเริ่มเดินทาง</p><button type="button" id="emptyUploadBtn">อัปโหลดเพลงแรก</button></div>';
      return;
    }
    list.innerHTML = tracks.map(track => `<article class="track-row${currentTrack?.id === track.id && !audio.paused ? ' is-playing' : ''}" data-track-row="${escapeHTML(track.id)}">
      <button type="button" class="track-row-play" data-track-play="${escapeHTML(track.id)}" aria-label="${currentTrack?.id === track.id && !audio.paused ? 'หยุด' : 'เล่น'} ${escapeHTML(track.title)}">${currentTrack?.id === track.id && !audio.paused ? 'Ⅱ' : '▶'}</button>
      <div class="track-row-copy"><strong>${escapeHTML(track.title)}</strong><small>${escapeHTML(track.artist)}</small></div>
      <div class="track-row-meta"><span class="track-genre">${escapeHTML(track.genre)}</span><span class="track-size">${formatSize(track.size_bytes)}</span></div>
    </article>`).join('');
  }

  function updatePlayer() {
    const playing = !audio.paused;
    $('#streamPlay').textContent = playing ? 'Ⅱ' : '▶';
    $('#streamPlay').setAttribute('aria-label', playing ? 'หยุดเพลง' : 'เล่นเพลง');
    $('#streamSeek').value = audio.duration ? String(Math.round(audio.currentTime / audio.duration * 1000)) : '0';
    $('#streamElapsed').textContent = formatTime(audio.currentTime);
    $('#streamDuration').textContent = formatTime(audio.duration);
    $('#streamNowLabel').textContent = !currentTrack ? 'เลือกเพลงในคลัง' : playing ? 'กำลังเล่น' : 'หยุดชั่วคราว';
    list.querySelectorAll('.track-row').forEach(row => {
      const isPlaying = row.dataset.trackRow === currentTrack?.id && playing;
      row.classList.toggle('is-playing', isPlaying);
      const button = $('.track-row-play', row);
      if (button) {
        button.textContent = isPlaying ? 'Ⅱ' : '▶';
        button.setAttribute('aria-label', `${isPlaying ? 'หยุด' : 'เล่น'} ${$('.track-row-copy strong', row).textContent}`);
      }
    });
  }

  function selectTrack(track, autoplay = true) {
    if (!track) return;
    currentTrack = track;
    $('#streamTitle').textContent = track.title;
    $('#streamArtist').textContent = `${track.artist} · ${track.genre}`;
    $('#streamPlay').disabled = false;
    $('#streamSeek').disabled = false;
    $('#streamMute').disabled = false;
    audio.src = track.audio_url;
    audio.load();
    renderTracks();
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
    const { data, error } = await db.from('audio_tracks')
      .select('id,title,artist_name,genre,storage_key,mime_type,byte_size,created_at')
      .eq('status', 'published').eq('visibility', 'public').is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(100);
    if (error) {
      list.innerHTML = `<div class="track-empty"><span>♫</span><b>โหลดคลังเพลงไม่ได้</b><p>${escapeHTML(error.message)}</p></div>`;
      return;
    }
    tracks = (data || []).map(track => ({ ...track,
      artist: track.artist_name, size_bytes: Number(track.byte_size),
      audio_url: db.storage.from('sourcewav-audio').getPublicUrl(track.storage_key).data.publicUrl
    }));
    renderTracks();
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#navReleaseBtn, #addTrackBtn, #emptyUploadBtn')) { event.preventDefault(); event.stopImmediatePropagation(); showUploadForm(); return; }
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
    if (!(event.target instanceof HTMLFormElement) || event.target.id !== 'trackUploadForm') return;
    event.preventDefault(); event.stopImmediatePropagation();
    const form = event.target;
    const file = form.elements.audio.files?.[0];
    const error = $('#uploadError');
    const submit = $('#trackSubmit');
    error.hidden = true;
    if (!file) { error.textContent = 'เลือกไฟล์เสียงก่อนอัปโหลด'; error.hidden = false; return; }
    if (file.size > 50 * 1024 * 1024) { error.textContent = 'ไฟล์มีขนาดใหญ่เกิน 50 MB'; error.hidden = false; return; }
    const db = window.SourcewavSupabase;
    const auth = await db?.auth.getUser();
    if (!db || auth?.error || !auth?.data?.user) { error.textContent = 'เข้าสู่ระบบก่อนอัปโหลดเพลง'; error.hidden = false; submit.disabled = false; submit.textContent = 'ปล่อยเพลงเข้าสู่วง'; return; }
    const mimeByExtension = { mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm' };
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mime = mimeByExtension[extension];
    if (!mime) { error.textContent = 'รองรับเฉพาะ MP3, WAV, FLAC, OGG, M4A, AAC หรือ WEBM'; error.hidden = false; submit.disabled = false; submit.textContent = 'ปล่อยเพลงเข้าสู่วง'; return; }
    submit.disabled = true; submit.textContent = 'กำลังอัปโหลด…';
    try {
      const user = auth.data.user;
      const trackId = crypto.randomUUID();
      const storageKey = `${user.id}/${trackId}.${extension}`;
      const { error: uploadError } = await db.storage.from('sourcewav-audio').upload(storageKey, file, { contentType: mime, cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error('อัปโหลดไฟล์เพลงไม่ได้: ' + uploadError.message);
      const { error: insertError } = await db.from('audio_tracks').insert({
        id: trackId, owner_id: user.id, title: form.elements.title.value.trim(),
        artist_name: form.elements.artist.value.trim(), genre: form.elements.genre.value,
        storage_key: storageKey, mime_type: mime, byte_size: file.size,
        visibility: 'public', status: 'published'
      });
      if (insertError) {
        await db.storage.from('sourcewav-audio').remove([storageKey]);
        throw new Error('บันทึกข้อมูลเพลงไม่ได้: ' + insertError.message);
      }
      await loadTracks();
      const created = tracks.find(track => track.id === trackId);
      if (created) selectTrack(created, false);
      $('#modalClose').click();
      toast('อัปโหลดเพลงแล้ว กดเล่นเพื่อฟังได้เลย');
    } catch (failure) {
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
  $('#streamMute').addEventListener('click', () => { audio.muted = !audio.muted; $('#streamMute').textContent = audio.muted ? '×' : '◖'; $('#streamMute').setAttribute('aria-label', audio.muted ? 'เปิดเสียง' : 'ปิดเสียง'); });
  ['play', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'ended'].forEach(name => audio.addEventListener(name, updatePlayer));
  audio.addEventListener('error', () => { if (currentTrack) toast('ไม่สามารถเล่นไฟล์เสียงนี้ได้'); });
  window.SourcewavSupabaseReady?.then(client => client && loadTracks());
  window.addEventListener('sourcewav:auth', loadTracks);
})();
