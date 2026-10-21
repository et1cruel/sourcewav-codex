/* Feature 8: Artist Store — ร้านขายของศิลปิน */
(function (global) {
  'use strict';
  const Core = global.SourcewavFeaturesCore;
  const { $, $$, esc, money, toast, showModal, closeModal, state, saveFeaturesState } = Core;
  const F = global.SourcewavFeatures || (global.SourcewavFeatures = {});

  /* --------------------------------------------------------------------------
     FEATURE 8: ARTIST STORE
  --------------------------------------------------------------------------- */
  let activeStoreCategory = 'all';

  function renderArtistStore() {
    const host = $('#artistStoreGrid');
    if (!host) return;

    const filtered = state.artistStoreProducts.filter(p => activeStoreCategory === 'all' || p.category === activeStoreCategory);

    if (!filtered.length) {
      host.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
        <p>ยังไม่มีสินค้าในหมวดหมู่นี้</p>
        <button class="booking-primary-btn" id="emptyAddStoreBtn" style="margin-top: 10px;">＋ ลงขายสินค้าชิ้นแรก</button>
      </div>`;
      $('#emptyAddStoreBtn')?.addEventListener('click', openAddProductModal);
      return;
    }

    host.innerHTML = filtered.map(prod => {
      const typeBadge = prod.type === 'digital'
        ? '<span class="badge-digital">💾 ดิจิทัลดาวน์โหลด</span>'
        : '<span class="badge-physical">📦 จัดส่งสินค้าจริง</span>';

      const stockLabel = prod.type === 'digital' ? 'ดาวน์โหลดไม่จำกัด' : `เหลือ ${prod.stock} ชิ้น`;

      return `
        <article class="store-product-card" data-product-id="${esc(prod.id)}">
          <div class="product-image-wrap">
            <img src="${esc(prod.imageUrl)}" alt="${esc(prod.title)}" loading="lazy" />
            <div class="product-tag-floating">
              ${typeBadge}
            </div>
            ${prod.category === 'beats' ? `
              <button class="product-demo-btn" data-play-beat-demo="${esc(prod.id)}">
                ▶ ตัวอย่างบีท
              </button>
            ` : ''}
          </div>

          <div class="product-info">
            <div>
              <span class="product-category-sub">${esc(prod.categoryLabel)}</span>
              <h4>${esc(prod.title)}</h4>
              <p>${esc(prod.description)}</p>
            </div>

            <div>
              <div class="product-price-row">
                <b>${money(prod.price)}</b>
                <small>${esc(stockLabel)}</small>
              </div>
              <button class="buy-product-btn" data-buy-product="${esc(prod.id)}">
                สั่งซื้อสินค้า (PromptPay)
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function openAddProductModal() {
    const profile = window.SourcewavStore?.getState().profile || {};
    const artistName = profile.displayName || profile.name || 'มินตรา';

    showModal(`
      <h2 id="modalTitle">ลงขายสินค้าใน Artist Store</h2>
      <p>ขายเสื้อ เทป ซีดี Beat, Sample Pack หรือสินค้าดิจิทัลจากโปรไฟล์ของคุณ ไม่ต้องเปิดเว็บร้านค้าเอง</p>

      <form id="addProductForm">
        <label class="modal-field">
          ชื่อสินค้า / ชิ้นงาน
          <input id="prodTitle" required placeholder="เช่น OVERSIZE TEE 'NIGHT RIDE' หรือ BOOM BAP BEAT PACK" />
        </label>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <label class="modal-field">
            หมวดหมู่สินค้า
            <select id="prodCategory">
              <option value="merch">เสื้อผ้า & Merch</option>
              <option value="tape_cd">เทปคาสเซ็ท / ซีดี</option>
              <option value="beats" selected>Beat & Sample Pack (ดิจิทัล)</option>
              <option value="art">Artwork & สิ่งพิมพ์</option>
            </select>
          </label>

          <label class="modal-field">
            ประเภทสินค้า
            <select id="prodType">
              <option value="digital" selected>ดิจิทัลดาวน์โหลด (Instant Download)</option>
              <option value="physical">สินค้าจริง (ต้องจัดส่งทางพัสดุ)</option>
            </select>
          </label>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <label class="modal-field">
            ราคาขาย (บาท)
            <input id="prodPrice" type="number" min="50" step="10" value="650" required />
          </label>

          <label class="modal-field">
            จำนวนสต็อก
            <input id="prodStock" placeholder="เว้นว่างถ้าเป็นดิจิทัลไม่จำกัด" />
          </label>
        </div>

        <label class="modal-field">
          ลิงก์รูปภาพสินค้า
          <input id="prodImage" value="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=600&q=80" required />
        </label>

        <label class="modal-field">
          คำอธิบายสินค้า & สิทธิ์การใช้งาน
          <textarea id="prodDesc" rows="3" required placeholder="ระบุขนาด สไตล์ รายละเอียดไฟล์ หรือลิขสิทธิ์เชิงพาณิชย์..."></textarea>
        </label>

        <!-- Platform Fee Calculation Preview (รายได้: ค่าธรรมเนียมจากยอดขาย 5%) -->
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin: 14px 0;">
          <div style="font-size: 11px; font-weight: 700; color: #1e293b; text-transform: uppercase; margin-bottom: 4px;">
            รายได้สุทธิของศิลปิน (หักค่าธรรมเนียมแพลตฟอร์ม 5%)
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
            <span>ราคาขาย:</span>
            <b id="prodCalcPrice">฿650</b>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px; color: #b45309;">
            <span>ค่าธรรมเนียม Sourcewav (5%):</span>
            <b id="prodCalcFee">฿33</b>
          </div>
          <div style="border-top: 1px solid #cbd5e1; padding-top: 4px; display: flex; justify-content: space-between; font-size: 13px; color: #15803d; font-weight: 700;">
            <span>ศิลปินรับสุทธิ (95%):</span>
            <b id="prodCalcPayout">฿617</b>
          </div>
        </div>

        <button type="submit" class="modal-primary">เปิดขายสินค้าใน Artist Store</button>
      </form>
    `);

    const priceInput = $('#prodPrice');
    const calcPrice = $('#prodCalcPrice');
    const calcFee = $('#prodCalcFee');
    const calcPayout = $('#prodCalcPayout');

    if (priceInput) {
      priceInput.addEventListener('input', () => {
        const p = Math.max(0, Number(priceInput.value) || 0);
        const fee = Math.round(p * 0.05);
        const payout = p - fee;
        if (calcPrice) calcPrice.textContent = money(p);
        if (calcFee) calcFee.textContent = money(fee);
        if (calcPayout) calcPayout.textContent = money(payout);
      });
    }

    $('#addProductForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const categoryMap = {
        merch: 'เสื้อผ้า & Merch',
        tape_cd: 'เทปคาสเซ็ท / ซีดี',
        beats: 'Beat & Sample Pack (ดิจิทัล)',
        art: 'Artwork & สิ่งพิมพ์'
      };

      const category = $('#prodCategory').value;
      const type = $('#prodType').value;
      const price = Number($('#prodPrice').value) || 0;
      const stock = type === 'digital' ? null : (Number($('#prodStock').value) || 20);

      const newProduct = {
        id: `prod-${Date.now().toString(36)}`,
        artistName: artistName,
        artistHandle: profile.handle || 'artist.wav',
        title: $('#prodTitle').value.trim(),
        category: category,
        categoryLabel: categoryMap[category] || 'สินค้า',
        type: type,
        price: price,
        stock: stock,
        imageUrl: $('#prodImage').value.trim(),
        description: $('#prodDesc').value.trim(),
        salesCount: 0,
        platformFeePercent: 5
      };

      state.artistStoreProducts.unshift(newProduct);
      saveFeaturesState();
      renderArtistStore();
      closeModal();
      toast('ลงขายสินค้าใน Artist Store เรียบร้อยแล้ว!');
    });
  }

  function openBuyProductModal(productId) {
    const prod = state.artistStoreProducts.find(p => p.id === productId);
    if (!prod) return;

    showModal(`
      <h2 id="modalTitle">สั่งซื้อ · ${esc(prod.title)}</h2>
      <p style="margin-bottom: 14px;">ชำระเงินผ่าน PromptPay เงินเข้าศิลปินโดยตรง (หักค่าธรรมเนียมระบบ 5%)</p>

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
            <input id="buyerNamePhone" required placeholder="เช่น นายมินตรา 081-xxx-xxxx" />
          </label>
          <label class="modal-field">
            ที่อยู่จัดส่งพัสดุ
            <textarea id="buyerAddress" rows="2" required placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"></textarea>
          </label>
        ` : `
          <label class="modal-field">
            อีเมลสำหรับรับไฟล์ดิจิทัล & ลิงก์สำรอง
            <input type="email" id="buyerEmail" required placeholder="you@example.com" value="user@sourcewav.bkk" />
          </label>
          <div style="background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 8px; padding: 10px 12px; font-size: 11px; color: #0369a1; margin-bottom: 12px;">
            💾 <b>Instant Unlock:</b> หลังจากชำระผ่าน PromptPay คุณสามารถดาวน์โหลดไฟล์ Beat + WAV Stems + ใบอนุญาตได้ทันที
          </div>
        `}

        <div style="text-align: center; margin: 16px 0;">
          <div class="qr-box" style="margin: 0 auto 10px;">
            <svg viewBox="0 0 21 21" shape-rendering="crispEdges" aria-label="QR PromptPay" style="width: 140px; height: 140px;">
              <rect width="21" height="21" fill="white"/>
              <path fill="#171916" d="M0 0h7v7H0zm1 1v5h5V1zm1 1h3v3H2zM14 0h7v7h-7zm1 1v5h5V1zm1 1h3v3h-3zM0 14h7v7H0zm1 1v5h5v-5zm1 1h3v3H2zM9 0h2v2H9zm0 4h2v2H9zm2 2h2v2h-2zm-3 2h2v2H8zm4 0h2v3h-2zm-4 3h3v2H8zm5 1h2v2h-2zm-4 2h2v2H9zm3 2h2v2h-2zm3-6h2v2h-2zm2 2h2v2h-2zm-1 3h2v2h-2zm2 3h3v2h-3zm-7 0h2v2h-2z"/>
            </svg>
          </div>
          <span style="font-size: 12px; color: #64748b;">สแกนผ่านแอปธนาคาร PromptPay เพื่อชำระ <b>${money(prod.price)}</b></span>
        </div>

        <button type="submit" class="modal-primary" id="confirmStorePaymentBtn">ฉันชำระเงินแล้ว (ยืนยันรายการ)</button>
      </form>
    `);

    $('#checkoutProductForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const fee = Math.round(prod.price * 0.05);
      const artistPayout = prod.price - fee;

      const newOrder = {
        id: `ord-${Date.now().toString(36)}`,
        productId: prod.id,
        productTitle: prod.title,
        artistName: prod.artistName,
        price: prod.price,
        platformFee: fee,
        artistEarnings: artistPayout,
        type: prod.type,
        status: 'paid',
        createdAt: new Date().toISOString()
      };

      state.artistStoreOrders.unshift(newOrder);
      if (prod.stock !== null && prod.stock > 0) {
        prod.stock -= 1;
      }
      prod.salesCount = (prod.salesCount || 0) + 1;
      saveFeaturesState();
      renderArtistStore();

      if (prod.type === 'digital') {
        showModal(`
          <div class="download-unlocked-box">
            <h3>🎉 ชำระเงินสำเร็จแล้ว!</h3>
            <p style="font-size: 13px; color: #166534; margin: 0 0 14px;">
              ระบบปลดล็อกไฟล์ <b>${esc(prod.title)}</b> ให้คุณดาวน์โหลดได้ทันที
            </p>
            <div style="background: #ffffff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 14px; text-align: left; font-size: 12px; color: #374151;">
              <div>📦 <b>ไฟล์ในชุด:</b> WAV Master (24-bit/48kHz) + แยกแทร็ก Stems + PDF Commercial License</div>
              <div>🔑 <b>Order Token:</b> <code>SW-${newOrder.id}</code></div>
            </div>
            <button class="instant-download-btn" id="instantDownloadFileBtn">
              📥 ดาวน์โหลดไฟล์ ZIP ทันที (180 MB)
            </button>
          </div>
          <button class="outline-btn" style="width: 100%; margin-top: 10px;" onclick="document.querySelector('#modalClose').click();">ปิดหน้าต่าง</button>
        `);

        $('#instantDownloadFileBtn')?.addEventListener('click', () => {
          const fakeZipContent = `SOURCEWAV DIGITAL ASSET\nProduct: ${prod.title}\nArtist: ${prod.artistName}\nLicense: Commercial Music Production License\nOrder Token: SW-${newOrder.id}\nThank you for supporting independent Thai hip-hop artists!`;
          const blob = new Blob([fakeZipContent], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${prod.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_stems_bundle.zip`;
          a.click();
          URL.revokeObjectURL(url);
          toast('เริ่มดาวน์โหลดไฟล์เสียงเรียบร้อย!');
        });
      } else {
        closeModal();
        toast('สั่งซื้อเรียบร้อย! ระบบส่งคำสั่งซื้อและข้อมูลจัดส่งให้ศิลปินแล้ว');
      }
    });
  }

  Object.assign(F, { renderArtistStore, openAddProductModal, openBuyProductModal });
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
  } };
})(window);
