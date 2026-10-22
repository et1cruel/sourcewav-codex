/* Feature 5: Booking Board — ระบบหาคนร่วมงานและรับจ้าง */
(function (global) {
  'use strict';
  const Core = global.SourcewavFeaturesCore;
  const { $, $$, esc, money, toast, showModal, closeModal, state } = Core;
  const F = global.SourcewavFeatures || (global.SourcewavFeatures = {});

  /* --------------------------------------------------------------------------
     FEATURE 5: BOOKING BOARD
  --------------------------------------------------------------------------- */
  let activeBookingRole = 'all';

  function renderBookingBoard() {
    const host = $('#bookingCardsGrid');
    if (!host) return;

    const filtered = state.bookingCards.filter(card => activeBookingRole === 'all' || card.role === activeBookingRole);

    if (!filtered.length) {
      host.innerHTML = `<div class="booking-empty">
        <div class="booking-empty-art" aria-hidden="true"><svg viewBox="0 0 160 140" role="presentation"><defs><linearGradient id="bookingGlass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c9f9ff" stop-opacity=".95"/><stop offset=".48" stop-color="#4ab6dd" stop-opacity=".56"/><stop offset="1" stop-color="#164c79" stop-opacity=".78"/></linearGradient><linearGradient id="bookingPage" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#183d5d"/><stop offset="1" stop-color="#0a2036"/></linearGradient><filter id="bookingGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs><ellipse cx="82" cy="124" rx="49" ry="8" fill="#28c8ec" opacity=".25" filter="url(#bookingGlow)"/><g transform="rotate(-7 80 70)"><rect x="33" y="28" width="94" height="83" rx="12" fill="#061728" stroke="#38b8df" stroke-width="3"/><rect x="38" y="33" width="84" height="73" rx="9" fill="url(#bookingGlass)" stroke="#a7eff8" stroke-width="1.5"/><path d="M39 51h82" stroke="#b9f4fc" stroke-width="2"/><path d="M55 26v14M104 26v14" stroke="#d8fbff" stroke-width="7" stroke-linecap="round"/><path d="M55 26v14M104 26v14" stroke="#1a759d" stroke-width="2" stroke-linecap="round"/><rect x="48" y="61" width="14" height="12" rx="2" fill="#82e8f2"/><rect x="70" y="61" width="14" height="12" rx="2" fill="#275a7d" stroke="#92eaf4"/><rect x="92" y="61" width="14" height="12" rx="2" fill="#275a7d" stroke="#92eaf4"/><rect x="48" y="81" width="14" height="12" rx="2" fill="#275a7d" stroke="#92eaf4"/><rect x="70" y="81" width="14" height="12" rx="2" fill="#a4ed81"/><rect x="92" y="81" width="14" height="12" rx="2" fill="#275a7d" stroke="#92eaf4"/><path d="M54 65h3M76 65h3M98 65h3M54 85h3M76 85h3M98 85h3" stroke="#e0ffff" stroke-width="2"/></g><path d="m128 31 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#d9ff75"/><circle cx="27" cy="67" r="2" fill="#72edff"/><circle cx="137" cy="90" r="2" fill="#b9f487"/></svg></div>
        <span class="booking-empty-kicker">YOUR NEXT COLLAB STARTS HERE</span>
        <h3>ยังไม่มีงานจองในหมวดหมู่นี้</h3>
        <p>ลองเลือกหมวดอื่น หรือเปิดรับงานเพื่อให้คนในวงการค้นพบคุณ</p>
        <button class="booking-primary-btn" id="emptyJoinBookingBtn" type="button"><span aria-hidden="true">＋</span> เปิดรับงานใหม่</button>
      </div>`;
      $('#emptyJoinBookingBtn')?.addEventListener('click', openJoinBookingModal);
      return;
    }

    host.innerHTML = filtered.map(card => {
      const availLabel = card.availableStatus === 'ready' ? `🟢 ${card.availability}` : `🟡 ${card.availability}`;
      const availClass = card.availableStatus === 'ready' ? 'ready' : 'busy';

      return `
        <article class="booking-card" data-card-id="${esc(card.id)}">
          <div>
            <div class="booking-card-top">
              <div class="booking-avatar">${esc(card.avatarChar || card.artistName.charAt(0))}</div>
              <div class="booking-meta">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <strong>${esc(card.artistName)}</strong>
                  ${card.isPro ? '<span class="badge-pro"><span>⚡</span> PRO</span>' : ''}
                  <button class="booking-follow-btn ${(F.isFollowingArtist?.(card.artistId)) ? 'following' : ''}" data-follow-artist="${esc(card.artistId)}" data-artist-name="${esc(card.artistName)}" type="button">
                    ${(F.isFollowingArtist?.(card.artistId)) ? '✓ ติดตามแล้ว' : '＋ ติดตาม'}
                  </button>
                </div>
                <small>@${esc(card.handle)} · ${esc(card.city)}</small>
                <span class="booking-role-tag ${esc(card.role)}">${esc(card.roleLabel)}</span>
              </div>
            </div>

            <div class="booking-avail-pill ${availClass}">
              <i></i> ${esc(availLabel)}
            </div>

            <div class="booking-rate-box">
              <div>
                <b>${money(card.rate)}</b>
                <span>${esc(card.rateUnit)}</span>
              </div>
              <small style="color: #059669; font-weight: 600;">✓ ปิดสำเร็จ ${card.gigsCompleted} งาน</small>
            </div>

            <p style="font-size: 11px; color: #4b5563; line-height: 1.6; margin: 0 0 10px;">
              ${esc(card.bio)}
            </p>

            <div class="booking-portfolio-snippet">
              <strong>ตัวอย่างผลงาน:</strong> ${esc(card.portfolioTitle)}
            </div>
          </div>

          <div class="booking-card-foot">
            <button class="hire-btn" data-hire-artist="${esc(card.id)}" data-artist-name="${esc(card.artistName)}" data-rate="${card.rate}">
              ส่งข้อเสนอจ้างงาน ↗
            </button>
            <button class="booking-chat-btn" data-chat-artist="${esc(card.artistId)}" data-artist-name="${esc(card.artistName)}" title="ส่งข้อความคุย">
              ✉
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Update pending offers counter on button
    const pendingCount = state.bookingOffers.filter(o => o.status === 'pending').length;
    const inboxBadge = $('#bookingInboxCount');
    if (inboxBadge) {
      inboxBadge.textContent = pendingCount || state.bookingOffers.length;
    }
  }

  function openJoinBookingModal() {
    const profile = window.SourcewavStore?.getState().profile || {};
    const defaultName = profile.displayName || profile.name || '';

    showModal(`
      <h2 id="modalTitle">ลงทะเบียนรับงาน / สร้างการ์ด Booking</h2>
      <p>เพิ่มโปรไฟล์ของคุณบน Booking Board เพื่อรับงาน DJ, แรป, ทำบีท ถ่ายและตัดต่อวิดีโอ สักลาย หรืองานโปรดักชัน</p>

      <form id="joinBookingForm">
        <label class="modal-field">
          ชื่อที่ใช้รับงาน
          <input id="newArtistName" required value="${esc(defaultName)}" />
          <small>ใช้ชื่อและ Username จากโปรไฟล์ที่เข้าสู่ระบบ</small>
        </label>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <label class="modal-field">
            บทบาทหลัก
            <select id="newArtistRole">
              <option value="dj">DJ / เปิดเพลง</option>
              <option value="rapper">Rapper / MC</option>
              <option value="producer">Producer / Beatmaker</option>
              <option value="photographer">Photographer / Video</option>
              <option value="editor">Editor / ตัดต่อวิดีโอ</option>
              <option value="tattooist">Tattooist / ช่างสัก</option>
              <option value="vj">VJ / Visual Artist</option>
              <option value="crew">Sound Engineer / ทีมจัดงาน</option>
            </select>
          </label>
          <label class="modal-field">
            พื้นที่รับงาน
            <input id="newArtistCity" value="กรุงเทพฯ & ปริมณฑล" placeholder="เช่น กรุงเทพฯ, ขอนแก่น" required />
          </label>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <label class="modal-field">
            ราคาเรทเริ่มต้น (บาท)
            <input id="newArtistRate" type="number" min="500" step="100" value="4500" required />
          </label>
          <label class="modal-field">
            หน่วยเรทราคา
            <input id="newArtistRateUnit" value="ต่อเซ็ต (2 ชม.)" placeholder="เช่น ต่องาน, ต่อบีท" required />
          </label>
        </div>

        <label class="modal-field">
          สถานะวันว่าง & คิวงาน
          <input id="newArtistAvailability" placeholder="เช่น ว่างทุกศุกร์-เสาร์, คิวว่างเดือน พ.ย." required />
        </label>

        <label class="modal-field">
          คำอธิบายสไตล์ & ประสบการณ์ (Bio)
          <textarea id="newArtistBio" rows="3" required placeholder="เล่าแนวเพลง อุปกรณ์ ประสบการณ์เวที หรือจุดเด่นของคุณ..."></textarea>
        </label>

        <label class="modal-field">
          ตัวอย่างผลงาน / ลิงก์เดโม
          <input id="newArtistPortfolio" placeholder="เช่น ลิงก์ SoundCloud, YouTube, หรือชื่อมิกซ์เทป" />
        </label>

        <button type="submit" class="modal-primary" id="saveBookingCardBtn">บันทึกและขึ้นแสดงบน Booking Board</button>
      </form>
    `);

    $('#joinBookingForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const roleMap = {
        dj: 'DJ / เปิดเพลง',
        rapper: 'Rapper / MC',
        producer: 'Producer / Beatmaker',
        photographer: 'Photographer / Video',
        editor: 'Editor / ตัดต่อวิดีโอ',
        tattooist: 'Tattooist / ช่างสัก',
        vj: 'VJ / Visual Artist',
        crew: 'Sound Engineer / ทีมจัดงาน'
      };

      const role = $('#newArtistRole').value;
      const newCard = {
        artistName: $('#newArtistName').value.trim(),
        role: role,
        roleLabel: roleMap[role] || 'ศิลปิน',
        rate: Number($('#newArtistRate').value || 4000),
        rateUnit: $('#newArtistRateUnit').value.trim(),
        availability: $('#newArtistAvailability').value.trim(),
        availableStatus: 'ready',
        city: $('#newArtistCity').value.trim(),
        bio: $('#newArtistBio').value.trim(),
        portfolioTitle: $('#newArtistPortfolio').value.trim(),
        avatarChar: $('#newArtistName').value.trim().charAt(0).toUpperCase()
      };

      global.SourcewavFeatureData.createBookingCard(newCard).then(() => {
        renderBookingBoard();
        closeModal();
        toast('บันทึกการ์ดลงฐานข้อมูลและแสดงบน Booking Board แล้ว');
      }).catch(error => toast(`บันทึกไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
    });
  }

  function openHireModal(cardId) {
    const card = state.bookingCards.find(c => c.id === cardId);
    if (!card) return;

    const commissionRate = card.isPro ? 0 : 0.10;
    const baseBudget = card.rate || 5000;
    const initialCommission = Math.round(baseBudget * commissionRate);
    const initialPayout = baseBudget - initialCommission;

    showModal(`
      <h2 id="modalTitle">ส่งข้อเสนอจ้างงาน · ${esc(card.artistName)}</h2>
      <p style="margin-bottom: 14px;">ส่งรายละเอียดและงบประมาณให้ศิลปินตอบรับ ข้อเสนอนี้ยังไม่ใช่การชำระเงินหรือสัญญาออนไลน์</p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #172a40; font-size: 14px;">${esc(card.artistName)}</strong>
            <small style="color: #64748b; display: block;">${esc(card.roleLabel)} · ${esc(card.city)}</small>
          </div>
          <div style="text-align: right;">
            <b style="font-size: 15px; color: #172a40;">${money(card.rate)}</b>
            <span style="font-size: 10px; color: #64748b; display: block;">${esc(card.rateUnit)}</span>
          </div>
        </div>
      </div>

      <form id="hireOfferForm">
        <label class="modal-field">
          ชื่องาน / กิจกรรม
            <input id="offerEventTitle" required placeholder="เช่น Friday Night Live at AVVE" />
        </label>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <label class="modal-field">
            วันและเวลาของงาน
            <input id="offerEventDate" required placeholder="เช่น 24 ต.ค. 2026 · 21:00-23:00" />
          </label>
          <label class="modal-field">
            สถานที่จัดงาน
            <input id="offerVenueLocation" required placeholder="เช่น AVVE ซอยปรีดี 1 กรุงเทพฯ" />
          </label>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <label class="modal-field">
            ผู้ติดต่อ / ชื่อร้าน
            <input id="offerClientName" required placeholder="ชื่อคุณ หรือชื่อสถานที่" />
          </label>
          <label class="modal-field">
            เบอร์ติดต่อ / อีเมล
            <input id="offerClientContact" required placeholder="เบอร์โทรศัพท์หรืออีเมล" />
          </label>
        </div>

        <label class="modal-field">
          งบประมาณที่เสนอจ้าง (บาท)
          <input id="offerBudget" type="number" min="500" step="100" value="${card.rate}" required />
        </label>

        <!-- Real-time Commission Breakdown -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px; margin: 12px 0;">
          <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 6px;">
            ประมาณการงบประมาณ
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span>งบประมาณจ้างงาน:</span>
            <b id="calcBudget">${money(baseBudget)}</b>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; color: ${card.isPro ? '#059669' : '#b45309'};">
            <span>ค่าธรรมเนียมโดยประมาณ (${card.isPro ? 'Pro 0%' : '10%'}):</span>
            <b id="calcCommission">${money(initialCommission)}</b>
          </div>
          <div style="border-top: 1px solid #bbf7d0; padding-top: 6px; display: flex; justify-content: space-between; font-size: 13px; color: #166534; font-weight: 700;">
            <span>ยอดหลังหักโดยประมาณ:</span>
            <b id="calcPayout">${money(initialPayout)}</b>
          </div>
          <small style="display: block; color: #78716c; margin-top: 4px; font-size: 10px;">ระบบยังไม่รับชำระเงินและยังไม่หักค่าธรรมเนียมจริง</small>
        </div>

        <label class="modal-field">
          รายละเอียดงาน & สิ่งที่เตรียมไว้ให้
          <textarea id="offerDetails" rows="2" placeholder="เช่น ระบบเสียงพร้อม, ขอเซ็ตเพลงแนวฮิปฮอป 90s, มิกเซอร์ Pioneer พร้อม"></textarea>
        </label>

        <button type="submit" class="modal-primary" id="sendOfferBtn">ส่งข้อเสนอจ้างงานทันที ↗</button>
      </form>
    `);

    // Dynamic budget calculation
    const budgetInput = $('#offerBudget');
    const calcBudget = $('#calcBudget');
    const calcCommission = $('#calcCommission');
    const calcPayout = $('#calcPayout');

    if (budgetInput) {
      budgetInput.addEventListener('input', () => {
        const val = Math.max(0, Number(budgetInput.value) || 0);
        const comm = Math.round(val * commissionRate);
        const payout = val - comm;
        if (calcBudget) calcBudget.textContent = money(val);
        if (calcCommission) calcCommission.textContent = money(comm);
        if (calcPayout) calcPayout.textContent = money(payout);
      });
    }

    $('#hireOfferForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const budget = Math.max(0, Number(budgetInput.value) || 0);
      const comm = Math.round(budget * commissionRate);
      const payout = budget - comm;

      const newOffer = {
        clientName: $('#offerClientName').value.trim(),
        clientContact: $('#offerClientContact').value.trim(),
        eventTitle: $('#offerEventTitle').value.trim(),
        eventDate: $('#offerEventDate').value.trim(),
        venueLocation: $('#offerVenueLocation').value.trim(),
        roleNeeded: card.roleLabel,
        budget,
        details: $('#offerDetails').value.trim(),
      };

      global.SourcewavFeatureData.createBookingOffer(card, newOffer).then(() => {
        renderBookingBoard();
        closeModal();
        toast(`บันทึกข้อเสนอในฐานข้อมูลแล้ว ส่งให้ ${card.artistName} เรียบร้อย`);
      }).catch(error => toast(`ส่งข้อเสนอไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
    });
  }

  function openBookingInboxModal() {
    showModal(`
      <h2 id="modalTitle">ข้อเสนอจ้างงานและสัญญา (Booking Inbox)</h2>
      <p style="margin-bottom: 16px;">ดูข้อเสนอที่ส่งและได้รับ การยอมรับยังไม่ใช่การชำระเงินหรือการออกใบเสร็จ</p>

      <div style="display: flex; flex-direction: column; gap: 12px; max-height: 480px; overflow-y: auto;">
        ${state.bookingOffers.length ? state.bookingOffers.map(offer => {
          const statusBadges = {
            pending: '<span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 700;">รอตอบรับ</span>',
            accepted: '<span style="background: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 700;">รับงานแล้ว</span>',
            closed: '<span style="background: #e0f2fe; color: #075985; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 700;">งานเสร็จแล้ว</span>',
            declined: '<span style="background: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 700;">ปฏิเสธ</span>'
          };

          return `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div>
                  <strong style="font-size: 14px; color: #172a40;">${esc(offer.eventTitle)}</strong>
                  <small style="color: #64748b; display: block;">ผู้ว่าจ้าง: ${esc(offer.clientName)} (${esc(offer.clientContact)})</small>
                </div>
                ${statusBadges[offer.status] || ''}
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; color: #475569; margin: 8px 0; background: #f8fafc; padding: 8px 10px; border-radius: 6px;">
                <div>📅 <b>วันเวลา:</b> ${esc(offer.eventDate)}</div>
                <div>📍 <b>สถานที่:</b> ${esc(offer.venueLocation)}</div>
                <div>⚡ <b>ศิลปิน:</b> ${esc(offer.artistName)} (${esc(offer.roleNeeded)})</div>
                <div>💰 <b>งบเสนอ:</b> ${money(offer.offeredBudget)}</div>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #15803d; font-weight: 600; margin-bottom: 10px;">
                <span>หักคอมมิชชัน (${offer.commissionRate * 100}%): ${money(offer.commissionAmount)}</span>
                <span>ศิลปินรับสุทธิ: ${money(offer.artistPayout)}</span>
              </div>

              <div style="display: flex; gap: 8px; justify-content: flex-end;">
                ${offer.status === 'pending' && offer.artistId === global.SourcewavAuthUser?.id ? `
                  <button class="outline-btn" data-decline-offer="${esc(offer.id)}" style="font-size: 11px; padding: 5px 10px; color: #b91c1c;">ปฏิเสธ</button>
                  <button class="modal-primary" data-accept-offer="${esc(offer.id)}" style="font-size: 11px; padding: 5px 12px;">ยอมรับข้อเสนอ</button>
                ` : offer.status === 'pending' ? `
                  <span style="font-size: 11px; color: #64748b;">รอศิลปินตอบรับ</span>
                ` : offer.status === 'accepted' ? `
                  <span style="font-size: 11px; color: #64748b;">ยอมรับแล้ว · จัดการชำระเงินกันนอกระบบ</span>
                ` : `
                  <span style="font-size: 11px; color: #64748b;">ธุรกรรมปิดสมบูรณ์แล้ว</span>
                `}
              </div>
            </div>
          `;
        }).join('') : '<p class="platform-empty">ยังไม่มีข้อเสนอจ้างงาน</p>'}
      </div>
    `);
  }

  function bindStatic() {
    $$('.booking-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('.booking-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        activeBookingRole = chip.dataset.bookingFilter || 'all';
        renderBookingBoard();
      });
    });
    $('#joinBookingBtn')?.addEventListener('click', openJoinBookingModal);
    $('#bookingInboxBtn')?.addEventListener('click', openBookingInboxModal);
  }
  Object.assign(F, { renderBookingBoard, openJoinBookingModal, openHireModal, openBookingInboxModal });
  F.booking = { bindStatic };
})(window);
