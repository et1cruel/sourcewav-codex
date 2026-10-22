/* Feature 8: Artist Store — ร้านขายของศิลปิน */
(function (global) {
  'use strict';
  const Core = global.SourcewavFeaturesCore;
  const { $, $$, esc, money, toast, showModal, closeModal, state } = Core;
  const F = global.SourcewavFeatures || (global.SourcewavFeatures = {});

  /* --------------------------------------------------------------------------
     FEATURE 8: ARTIST STORE
  --------------------------------------------------------------------------- */
  let activeStoreCategory = 'all';
  const beatPreviewTypes = {
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg',
    m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm'
  };

  function renderArtistStore() {
    const host = $('#artistStoreGrid');
    if (!host) return;

    const filtered = state.artistStoreProducts.filter(p => activeStoreCategory === 'all' || p.category === activeStoreCategory);

    if (!filtered.length) {
      host.innerHTML = `<div class="store-empty">
        <div class="store-empty-art" aria-hidden="true"><svg viewBox="0 0 190 140" role="presentation"><defs><linearGradient id="storeBag" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#bdfaff" stop-opacity=".92"/><stop offset=".45" stop-color="#4dbadd" stop-opacity=".52"/><stop offset="1" stop-color="#164b77" stop-opacity=".82"/></linearGradient><radialGradient id="storeVinyl"><stop stop-color="#a6f2ff" stop-opacity=".85"/><stop offset=".15" stop-color="#256181"/><stop offset=".72" stop-color="#132b43"/><stop offset=".9" stop-color="#81e6f2" stop-opacity=".9"/><stop offset="1" stop-color="#16344d"/></radialGradient><filter id="storeGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter></defs><ellipse cx="94" cy="124" rx="62" ry="8" fill="#26c9ed" opacity=".25" filter="url(#storeGlow)"/><g transform="rotate(-12 61 71)"><circle cx="58" cy="73" r="43" fill="url(#storeVinyl)" stroke="#a5edf8" stroke-width="2"/><circle cx="58" cy="73" r="34" fill="none" stroke="#a5edf84d"/><circle cx="58" cy="73" r="27" fill="none" stroke="#a5edf84d"/><circle cx="58" cy="73" r="18" fill="none" stroke="#a5edf84d"/><circle cx="58" cy="73" r="7" fill="#c8f9ff" stroke="#1a6c8e" stroke-width="2"/></g><g transform="rotate(5 126 78)"><path d="M96 53h59l7 62H89z" fill="url(#storeBag)" stroke="#a9f4fb" stroke-width="2.5"/><path d="M108 54c0-19 35-19 35 0" fill="none" stroke="#a9f4fb" stroke-width="5"/><path d="M108 54c0-19 35-19 35 0" fill="none" stroke="#256988" stroke-width="1.4"/><path d="m105 76 8-8 8 8-8 8zM130 91l6-6 6 6-6 6z" fill="#d9ff75" opacity=".9"/><path d="m131 66 2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#fff"/></g><path d="m28 26 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#d9ff75"/><circle cx="172" cy="41" r="2" fill="#71e8fa"/><circle cx="81" cy="26" r="1.7" fill="#d9ff75"/></svg></div>
        <span class="store-empty-kicker">MAKE SOMETHING. PUT IT OUT THERE.</span>
        <h3>ยังไม่มีสินค้าในหมวดหมู่นี้</h3>
        <p>เปิดหน้าร้านของคุณ แล้วให้ผลงานชิ้นต่อไปได้เจอเจ้าของคนใหม่</p>
        <button class="booking-primary-btn store-empty-cta" id="emptyAddStoreBtn" type="button"><span aria-hidden="true">＋</span> ลงขายสินค้าชิ้นแรก</button>
      </div>`;
      $('#emptyAddStoreBtn')?.addEventListener('click', openAddProductModal);
      return;
    }

    host.innerHTML = filtered.map(prod => {
      const typeBadge = prod.type === 'digital'
        ? '<span class="badge-digital">💾 สินค้าดิจิทัล</span>'
        : '<span class="badge-physical">📦 จัดส่งสินค้าจริง</span>';

      const stockLabel = prod.type === 'digital' ? 'เปิดรับคำขอซื้อ' : `เหลือ ${prod.stock} ชิ้น`;

      return `
        <article class="store-product-card" data-product-id="${esc(prod.id)}">
          <div class="product-image-wrap">
            ${prod.imageUrl ? `<img src="${esc(prod.imageUrl)}" alt="${esc(prod.title)}" loading="lazy" />` : `<div class="product-art-placeholder" aria-label="ไม่มีภาพปกสินค้า"><span>♫</span><b>${esc(prod.title)}</b></div>`}
            <div class="product-tag-floating">
              ${typeBadge}
            </div>
            ${prod.category === 'beats' && prod.previewAudioUrl ? `<div class="product-beat-player"><audio controls preload="none" src="${esc(prod.previewAudioUrl)}" aria-label="ฟังตัวอย่าง ${esc(prod.title)}"></audio></div>` : ''}
          </div>

          <div class="product-info">
            <div>
              <span class="product-category-sub">${esc(prod.categoryLabel)}</span>
              <h4>${esc(prod.title)}</h4>
              <small class="product-creator">โดย ${esc(prod.artistName || 'โปรดิวเซอร์')}</small>
              <p>${esc(prod.description)}</p>
            </div>

            <div>
              <div class="product-price-row">
                <b>${money(prod.price)}</b>
                <small>${esc(stockLabel)}</small>
              </div>
              ${prod.artistId === global.SourcewavAuthUser?.id
                ? '<span class="platform-empty">สินค้าของคุณ</span>'
                : prod.stock === 0
                  ? '<button class="buy-product-btn" type="button" disabled>สินค้าหมด</button>'
                  : `<div class="product-card-actions"><button class="buy-product-btn" data-buy-product="${esc(prod.id)}">ส่งคำขอสั่งซื้อ</button>${prod.category === 'beats' ? `<button class="product-chat-btn" data-chat-artist="${esc(prod.artistId)}" data-artist-name="${esc(prod.artistName || 'โปรดิวเซอร์')}" type="button">✉ ทักโปรดิวเซอร์</button>` : ''}</div>`}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function openAddProductModal() {
    showModal(`
      <section class="store-create-view">
        <header class="store-create-heading"><span class="store-create-mark" aria-hidden="true">✳</span><div><span class="store-form-eyebrow">SOURCEWAV · CREATOR MARKET</span><h2 id="modalTitle">ลงผลงานใน Artist Store</h2><p>เปิดพื้นที่ให้คนในชุมชนค้นพบและสนับสนุนงานของคุณ</p></div></header>
        <form id="addProductForm" class="store-product-form">
          <div class="store-product-fields">
            <label class="modal-field store-field-wide">ชื่อสินค้า / ชิ้นงาน<input id="prodTitle" required maxlength="180" placeholder="เช่น BOOM BAP BEAT PACK VOL. 01" /></label>
            <label class="modal-field">หมวดหมู่<select id="prodCategory"><option value="beats" selected>Beat & Sample Pack</option><option value="merch">เสื้อผ้า & Merch</option><option value="tape_cd">เทปคาสเซ็ท / ซีดี</option><option value="art">Artwork & สิ่งพิมพ์</option></select></label>
            <label class="modal-field">ประเภทสินค้า<select id="prodType"><option value="digital" selected>ดิจิทัล</option><option value="physical">สินค้าจริง · จัดส่ง</option></select></label>
            <label class="modal-field">ราคาขาย (บาท)<input id="prodPrice" type="number" min="50" step="10" value="650" required /></label>
            <label class="modal-field store-stock-field" id="prodStockField" hidden>จำนวนสต็อก<input id="prodStock" type="number" min="0" step="1" placeholder="ระบุจำนวนชิ้น" /></label>
            <div class="modal-field store-field-wide store-image-field"><span class="store-image-label">ภาพสินค้า / ปกผลงาน</span><label class="store-image-pick" for="prodImageFile"><span class="store-image-pick-mark" aria-hidden="true">＋</span><span><b>เลือกภาพจากอุปกรณ์</b><small>JPG, PNG หรือ WebP · ไม่เกิน 5 MB</small></span><input id="prodImageFile" type="file" accept="image/jpeg,image/png,image/webp" aria-label="อัปโหลดภาพสินค้า" /></label><div class="store-image-preview-wrap" id="prodImagePreviewWrap" hidden><img id="prodImagePreview" alt="ตัวอย่างภาพสินค้า" /><button type="button" id="removeProdImage" aria-label="นำภาพสินค้าออก">ลบภาพ</button></div></div>
            <label class="modal-field store-field-wide">คำอธิบายและสิทธิ์การใช้งาน<textarea id="prodDesc" rows="3" required maxlength="2000" placeholder="แนวเพลง รายละเอียดไฟล์ วิธีใช้งาน หรือสิทธิ์การนำไปใช้..."></textarea></label>
            <section class="store-beat-upload store-field-wide" id="beatPreviewField" aria-labelledby="beatPreviewTitle">
              <div class="store-beat-upload-copy"><span class="store-beat-icon" aria-hidden="true">♫</span><div><strong id="beatPreviewTitle">เพิ่มเสียงพรีวิวบีท</strong><small>ให้ผู้ฟังกดลองฟังก่อนตัดสินใจ · ไม่บังคับ</small></div></div>
              <label class="store-audio-pick" for="prodBeatPreview"><span aria-hidden="true">＋</span> เลือกไฟล์เสียงพรีวิว<input id="prodBeatPreview" type="file" accept=".mp3,.wav,.flac,.ogg,.m4a,.aac,.webm,audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/mp4,audio/aac,audio/webm" /><small>MP3, WAV, FLAC, OGG, M4A, AAC หรือ WebM · ไม่เกิน 20 MB · แนะนำ 30–60 วินาที</small></label>
              <audio id="prodBeatPreviewPlayer" controls preload="metadata" hidden aria-label="ตัวอย่างเสียงพรีวิวบีท"></audio>
              <p>อัปโหลดเฉพาะคลิปพรีวิวสั้น ๆ ไฟล์นี้จะเปิดฟังได้สาธารณะ อย่าใช้ไฟล์ master เต็มที่ต้องการเก็บไว้ขาย</p>
            </section>
          </div>
          <div class="store-create-note"><span aria-hidden="true">ⓘ</span><p>คำสั่งซื้อจะถูกบันทึกเป็นคำขอ ระบบยังไม่รับชำระเงินและไม่ส่งไฟล์ขายอัตโนมัติ</p></div>
          <button type="submit" class="store-publish-btn"><span>เปิดขายผลงาน</span><b aria-hidden="true">↗</b></button>
        </form>
      </section>
    `, 'artist-store-modal');

    const categorySelect = $('#prodCategory');
    const typeSelect = $('#prodType');
    const stockField = $('#prodStockField');
    const stockInput = $('#prodStock');
    const beatFileInput = $('#prodBeatPreview');
    const beatPlayer = $('#prodBeatPreviewPlayer');
    const imageFileInput = $('#prodImageFile');
    const imagePreview = $('#prodImagePreview');
    const imagePreviewWrap = $('#prodImagePreviewWrap');
    imageFileInput.addEventListener('change', () => {
      const file = imageFileInput.files?.[0];
      if (!file) { imagePreviewWrap.hidden = true; imagePreview.removeAttribute('src'); return; }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        imageFileInput.value = ''; imagePreviewWrap.hidden = true;
        toast('เลือกรูป JPG, PNG หรือ WebP ที่มีขนาดไม่เกิน 5 MB'); return;
      }
      imagePreview.src = URL.createObjectURL(file); imagePreviewWrap.hidden = false;
    });
    $('#removeProdImage').addEventListener('click', () => { imageFileInput.value = ''; imagePreviewWrap.hidden = true; imagePreview.removeAttribute('src'); });
    const syncConditionalFields = () => {
      const isPhysical = typeSelect.value === 'physical';
      stockField.hidden = !isPhysical;
      stockInput.required = isPhysical;
      $('#beatPreviewField').hidden = categorySelect.value !== 'beats';
    };
    categorySelect.addEventListener('change', () => {
      if (categorySelect.value === 'beats') typeSelect.value = 'digital';
      syncConditionalFields();
    });
    typeSelect.addEventListener('change', syncConditionalFields);
    syncConditionalFields();
    beatFileInput.addEventListener('change', () => {
      const file = beatFileInput.files?.[0];
      if (!file) { beatPlayer.pause(); beatPlayer.removeAttribute('src'); beatPlayer.hidden = true; return; }
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!beatPreviewTypes[extension] || file.size > 20 * 1024 * 1024) {
        beatFileInput.value = '';
        toast('เลือกไฟล์เสียงพรีวิวที่รองรับและมีขนาดไม่เกิน 20 MB');
        return;
      }
      beatPlayer.src = URL.createObjectURL(file);
      beatPlayer.hidden = false;
      beatPlayer.load();
    });

    $('#addProductForm')?.addEventListener('submit', e => {
      e.preventDefault();
      if (!global.SourcewavAuthUser) { toast('เข้าสู่ระบบก่อนลงขายสินค้า'); document.querySelector('#profileBtn')?.click(); return; }
      const category = $('#prodCategory').value;
      const type = $('#prodType').value;
      const price = Number($('#prodPrice').value) || 0;
      const stockInput = $('#prodStock').value.trim();
      if (type === 'physical' && (!stockInput || !Number.isInteger(Number(stockInput)))) {
        toast('ระบุจำนวนสต็อกสินค้าจริงเป็นจำนวนเต็ม');
        return;
      }

      const previewFile = category === 'beats' ? beatFileInput.files?.[0] : null;
      const imageFile = imageFileInput.files?.[0] || null;
      const newProduct = {
        title: $('#prodTitle').value.trim(),
        category: category,
        type: type,
        price: price,
        stock: type === 'digital' ? null : Number(stockInput),
        imageUrl: '',
        description: $('#prodDesc').value.trim(),
        previewFile
      };
      const submitButton = $('#addProductForm button[type="submit"]');
      submitButton.disabled = true;
      submitButton.setAttribute('aria-busy', 'true');
      const persistProduct = async () => {
        let previewKey = '';
        let imageKey = '';
        try {
          if (imageFile) {
            const extension = imageFile.type === 'image/jpeg' ? 'jpg' : imageFile.type.split('/')[1];
            const bucket = global.SourcewavSupabase.storage.from('sourcewav-listings');
            imageKey = `${global.SourcewavAuthUser.id}/store-images/${crypto.randomUUID()}.${extension}`;
            const { error } = await bucket.upload(imageKey, imageFile, { contentType: imageFile.type, cacheControl: '3600', upsert: false });
            if (error) throw error;
            newProduct.imageUrl = bucket.getPublicUrl(imageKey).data.publicUrl;
          }
          if (previewFile) {
            const extension = previewFile.name.split('.').pop().toLowerCase();
            const bucket = global.SourcewavSupabase.storage.from('sourcewav-audio');
            previewKey = `${global.SourcewavAuthUser.id}/store-previews/${crypto.randomUUID()}.${extension}`;
            const { error } = await bucket.upload(previewKey, previewFile, { contentType: beatPreviewTypes[extension], cacheControl: '3600', upsert: false });
            if (error) throw error;
            newProduct.previewAudioUrl = bucket.getPublicUrl(previewKey).data.publicUrl;
          }
          const product = await global.SourcewavFeatureData.createProduct(newProduct);
          if (!product) { if (previewKey) await global.SourcewavSupabase.storage.from('sourcewav-audio').remove([previewKey]); if (imageKey) await global.SourcewavSupabase.storage.from('sourcewav-listings').remove([imageKey]); return; }
          renderArtistStore();
          closeModal();
          toast(previewFile ? 'เปิดขายสินค้าและเผยแพร่เสียงพรีวิวแล้ว' : 'บันทึกสินค้าในฐานข้อมูลและเปิดขายแล้ว');
        } catch (error) {
          if (previewKey) await global.SourcewavSupabase.storage.from('sourcewav-audio').remove([previewKey]).catch(() => {});
          if (imageKey) await global.SourcewavSupabase.storage.from('sourcewav-listings').remove([imageKey]).catch(() => {});
          toast(`บันทึกสินค้าไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`);
        } finally {
          if (submitButton.isConnected) { submitButton.disabled = false; submitButton.removeAttribute('aria-busy'); }
        }
      };
      persistProduct();
    });
  }

  function openBuyProductModal(productId) {
    const prod = state.artistStoreProducts.find(p => p.id === productId);
    if (!prod) return;

    showModal(`
      <h2 id="modalTitle">สั่งซื้อ · ${esc(prod.title)}</h2>
      <p style="margin-bottom: 14px;">ส่งคำขอซื้อให้ศิลปิน ระบบจะบันทึกคำขอไว้ในฐานข้อมูล</p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #172a40; font-size: 14px;">${esc(prod.title)}</strong>
            <small style="color: #64748b; display: block;">ศิลปิน: ${esc(prod.artistName)} · ${esc(prod.categoryLabel)}</small>
          </div>
          <b style="font-size: 18px; color: #172a40;">${money(prod.price)}</b>
        </div>
      </div>

      <form id="checkoutProductForm">
        ${prod.type === 'physical' ? `
          <label class="modal-field">
            ชื่อผู้รับและเบอร์โทรศัพท์
            <input id="buyerNamePhone" required placeholder="ชื่อและเบอร์โทรศัพท์" />
          </label>
          <label class="modal-field">
            ที่อยู่จัดส่งพัสดุ
            <textarea id="buyerAddress" rows="2" required placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"></textarea>
          </label>
        ` : `
          <label class="modal-field">
            อีเมลสำหรับติดต่อเรื่องสินค้า
            <input type="email" id="buyerEmail" required placeholder="you@example.com" />
          </label>
        `}
        <p style="background:#fff8e8;border:1px solid #f2c47c;border-radius:8px;padding:10px 12px;font-size:12px;color:#72501b;">บันทึกคำขอแล้วไม่ได้แปลว่าชำระเงิน ระบบยังไม่เปิดรับชำระหรือส่งไฟล์อัตโนมัติ</p>
        <button type="submit" class="modal-primary" id="confirmStorePaymentBtn">บันทึกคำขอสั่งซื้อ</button>
      </form>
    `);

    $('#checkoutProductForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const contact = prod.type === 'physical' ? $('#buyerNamePhone').value.trim() : $('#buyerEmail').value.trim();
      const shippingAddress = prod.type === 'physical' ? $('#buyerAddress').value.trim() : null;
      global.SourcewavFeatureData.createStoreOrder(prod, { contact, shippingAddress }).then(order => {
        if (!order) return;
        closeModal();
        toast(`บันทึกคำขอซื้อ ${prod.title} แล้ว · สถานะรอดำเนินการ`);
      }).catch(error => toast(`บันทึกคำขอซื้อไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
    });
  }

  function openArtistStoreOrdersModal() {
    const userId = global.SourcewavAuthUser?.id;
    const orders = state.artistStoreOrders.filter(order => order.buyerId === userId || order.artistId === userId);
    showModal(`
      <h2 id="modalTitle">คำขอสั่งซื้อของฉัน</h2>
      <p>รายการและข้อมูลติดต่อถูกอ่านจากฐานข้อมูลตามสิทธิ์ของผู้ซื้อและศิลปิน</p>
      <div style="display:flex;flex-direction:column;gap:10px;max-height:55vh;overflow:auto;">
        ${orders.length ? orders.map(order => `
          <article style="border:1px solid #dbe5ee;border-radius:10px;padding:12px;background:#fff;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
              <strong>${esc(order.productTitle)}</strong><span style="font-size:12px;color:#9a6700;">รอดำเนินการ</span>
            </div>
            <p style="font-size:12px;margin:6px 0;">${money(order.price)} · ${order.type === 'digital' ? 'สินค้าดิจิทัล' : 'สินค้าจัดส่ง'}</p>
            ${order.artistId === userId ? `<p style="font-size:12px;margin:4px 0;">ผู้ซื้อ: ${esc(order.buyerName || 'ผู้ใช้ Sourcewav')} · ติดต่อ: ${esc(order.buyerContact || '-')}</p>${order.shippingAddress ? `<p style="font-size:12px;margin:4px 0;">ที่อยู่: ${esc(order.shippingAddress)}</p>` : ''}` : '<p style="font-size:12px;margin:4px 0;">คำขอของคุณจะยังไม่ถือว่าชำระเงินหรือได้รับสินค้า</p>'}
            <small style="color:#64748b;">${new Date(order.createdAt).toLocaleString('th-TH')}</small>
          </article>
        `).join('') : '<p class="platform-empty">ยังไม่มีคำขอสั่งซื้อในบัญชีนี้</p>'}
      </div>
    `);
  }

  Object.assign(F, { renderArtistStore, openAddProductModal, openBuyProductModal, openArtistStoreOrdersModal });
  F.store = { bindStatic: () => {
    $$('.store-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('.store-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        activeStoreCategory = chip.dataset.storeFilter || 'all';
        renderArtistStore();
      });
    });
    $('#addProductBtn')?.addEventListener('click', openAddProductModal);
    $('#artistStoreOrdersBtn')?.addEventListener('click', openArtistStoreOrdersModal);
  } };
})(window);
