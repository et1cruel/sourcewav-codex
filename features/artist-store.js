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
        ? '<span class="badge-digital">💾 สินค้าดิจิทัล</span>'
        : '<span class="badge-physical">📦 จัดส่งสินค้าจริง</span>';

      const stockLabel = prod.type === 'digital' ? 'เปิดรับคำขอซื้อ' : `เหลือ ${prod.stock} ชิ้น`;

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
              ${prod.artistId === global.SourcewavAuthUser?.id
                ? '<span class="platform-empty">สินค้าของคุณ</span>'
                : prod.stock === 0
                  ? '<button class="buy-product-btn" type="button" disabled>สินค้าหมด</button>'
                  : `<button class="buy-product-btn" data-buy-product="${esc(prod.id)}">ส่งคำขอสั่งซื้อ</button>`}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function openAddProductModal() {
    showModal(`
      <h2 id="modalTitle">ลงขายสินค้าใน Artist Store</h2>
      <p>บันทึกสินค้าไว้ในฐานข้อมูลและเปิดให้ผู้ใช้ส่งคำขอสั่งซื้อ</p>

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
            จำนวนสต็อก (สินค้าจริง)
            <input id="prodStock" type="number" min="0" step="1" placeholder="ระบุจำนวนสินค้าจริง" />
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

        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin: 14px 0;">
          <div style="font-size: 11px; font-weight: 700; color: #1e293b; text-transform: uppercase; margin-bottom: 4px;">
            สถานะการขาย
          </div>
          <p style="font-size:12px;margin:0;color:#475569;">คำสั่งซื้อจะอยู่สถานะรอดำเนินการ ระบบยังไม่รับเงินและยังไม่ส่งไฟล์ดิจิทัลอัตโนมัติ</p>
        </div>

        <button type="submit" class="modal-primary">เปิดขายสินค้าใน Artist Store</button>
      </form>
    `);

    $('#addProductForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const category = $('#prodCategory').value;
      const type = $('#prodType').value;
      const price = Number($('#prodPrice').value) || 0;
      const stockInput = $('#prodStock').value.trim();
      if (type === 'physical' && (!stockInput || !Number.isInteger(Number(stockInput)))) {
        toast('ระบุจำนวนสต็อกสินค้าจริงเป็นจำนวนเต็ม');
        return;
      }

      const newProduct = {
        title: $('#prodTitle').value.trim(),
        category: category,
        type: type,
        price: price,
        stock: type === 'digital' ? null : Number(stockInput),
        imageUrl: $('#prodImage').value.trim(),
        description: $('#prodDesc').value.trim()
      };

      global.SourcewavFeatureData.createProduct(newProduct).then(product => {
        if (!product) return;
        renderArtistStore();
        closeModal();
        toast('บันทึกสินค้าในฐานข้อมูลและเปิดขายแล้ว');
      }).catch(error => toast(`บันทึกสินค้าไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
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
