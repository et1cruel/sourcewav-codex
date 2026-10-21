/* Feature 6: Follow & Drop Alert — ติดตามศิลปิน/สถานที่และแจ้งเตือนงานใหม่ */
(function (global) {
  'use strict';
  const Core = global.SourcewavFeaturesCore;
  const { $, $$, esc, money, toast, showModal, closeModal, state, saveFeaturesState } = Core;
  const F = global.SourcewavFeatures || (global.SourcewavFeatures = {});

  /* --------------------------------------------------------------------------
     FEATURE 6: FOLLOW & DROP ALERT
  --------------------------------------------------------------------------- */
  let activeDropTab = 'all';

  function renderDropAlertsCenter() {
    const unread = state.dropAlerts.filter(a => !a.read).length;

    showModal(`
      <div class="drop-center-modal">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
          <div>
            <h2 id="modalTitle" style="margin: 0 0 4px;">Follow & Drop Alert</h2>
            <p style="margin: 0; color: #64748b; font-size: 12px;">แจ้งเตือนเมื่อศิลปินหรือสถานที่ที่คุณติดตามมีเพลงใหม่ งานใหม่ หรือบัตรรอบใหม่</p>
          </div>
          <button id="markAllDropsReadBtn" style="background: none; border: 0; color: #2858ef; font: 600 11px var(--font); cursor: pointer; padding: 4px;">
            อ่านทั้งหมดแล้ว
          </button>
        </div>

        <!-- Filter Tabs -->
        <div class="drop-tabs">
          <button class="drop-tab-btn ${activeDropTab === 'all' ? 'active' : ''}" data-drop-tab="all">ทั้งหมด (${state.dropAlerts.length})</button>
          <button class="drop-tab-btn ${activeDropTab === 'music' ? 'active' : ''}" data-drop-tab="music">🎵 เพลงใหม่</button>
          <button class="drop-tab-btn ${activeDropTab === 'ticket' ? 'active' : ''}" data-drop-tab="ticket">🎟️ บัตร & งาน</button>
          <button class="drop-tab-btn ${activeDropTab === 'venue' ? 'active' : ''}" data-drop-tab="venue">📍 สถานที่โปรด</button>
          <button class="drop-tab-btn ${activeDropTab === 'sponsored' ? 'active' : ''}" data-drop-tab="sponsored">⚡ ได้รับการโปรโมต</button>
        </div>

        <div class="drop-feed-list" id="dropFeedList">
          ${renderDropItemsHTML()}
        </div>

        <!-- Sponsor / Boost CTA for Organizers & Artists -->
        <div class="boost-cta-box">
          <div>
            <strong>ผู้จัดหรือศิลปินอยากให้คนเห็นงานใหม่?</strong>
            <p>โปรโมต Drop งานของคุณ ส่งตรงถึงแฟนเพลงในพื้นที่ ไม่ต้องเริ่มหาคนดูจากศูนย์</p>
          </div>
          <button class="boost-launch-btn" id="openBoostDropModalBtn">
            🚀 โปรโมตงานของคุณ
          </button>
        </div>
      </div>
    `, 'drop-center-modal');

    bindDropCenterEvents();
  }

  function renderDropItemsHTML() {
    const items = state.dropAlerts.filter(a => {
      if (activeDropTab === 'all') return true;
      if (activeDropTab === 'sponsored') return a.isPromoted;
      return a.type === activeDropTab;
    });

    if (!items.length) {
      return '<p class="platform-empty" style="text-align: center; padding: 30px; color: #94a3b8;">ไม่มีการแจ้งเตือนในหมวดนี้</p>';
    }

    return items.map(drop => {
      const iconMap = {
        music: '♫',
        event: '⌁',
        ticket: '🎟️',
        venue: '📍'
      };
      const iconChar = drop.isPromoted ? '⚡' : (iconMap[drop.type] || '♧');
      const iconClass = drop.isPromoted ? 'sponsored' : drop.type;

      return `
        <article class="drop-card ${drop.isPromoted ? 'sponsored-drop' : ''} ${!drop.read ? 'unread' : ''}" data-drop-id="${esc(drop.id)}">
          <div class="drop-icon ${iconClass}">
            ${iconChar}
          </div>
          <div class="drop-content">
            <div class="drop-topline">
              <span class="drop-creator"><b>${esc(drop.creatorName)}</b> · @${esc(drop.creatorHandle)}</span>
              <span class="drop-time">${esc(drop.timestamp)}</span>
            </div>

            ${drop.isPromoted ? `
              <div style="margin: 2px 0 6px;">
                <span class="badge-sponsored">⚡ ได้รับการโปรโมต / SPONSORED</span>
              </div>
            ` : ''}

            <h4>${esc(drop.title)}</h4>
            <p>${esc(drop.detailText)}</p>

            <button class="drop-action-btn" data-drop-action="${esc(drop.actionType)}" data-drop-target="${esc(drop.actionTarget)}">
              ${esc(drop.actionLabel)}
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  function bindDropCenterEvents() {
    $$('.drop-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeDropTab = btn.dataset.dropTab;
        $$('.drop-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        const list = $('#dropFeedList');
        if (list) list.innerHTML = renderDropItemsHTML();
        bindDropActionClicks();
      });
    });

    $('#markAllDropsReadBtn')?.addEventListener('click', () => {
      state.dropAlerts.forEach(a => { a.read = true; });
      saveFeaturesState();
      const list = $('#dropFeedList');
      if (list) list.innerHTML = renderDropItemsHTML();
      bindDropActionClicks();
      toast('ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว');
    });

    $('#openBoostDropModalBtn')?.addEventListener('click', openBoostDropModal);

    bindDropActionClicks();
  }

  function bindDropActionClicks() {
    $$('.drop-action-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const actionType = btn.dataset.dropAction;
        const target = btn.dataset.dropTarget;

        closeModal();

        if (actionType === 'music') {
          const trackRowPlay = document.querySelector('.track-row-play');
          if (trackRowPlay) {
            trackRowPlay.click();
            toast('กำลังเปิดสตรีมมิ่งเพลงใหม่ให้ฟัง...');
          } else {
            location.hash = '#music';
          }
        } else if (actionType === 'ticket' || actionType === 'event') {
          const buyBtn = document.querySelector('.buy-btn');
          if (buyBtn) {
            buyBtn.click();
          } else {
            location.hash = '#events';
          }
        } else if (actionType === 'venue') {
          location.hash = '#map';
          toast('เปิดตำแหน่งสถานที่บนแผนที่');
        }
      });
    });
  }

  function openBoostDropModal() {
    showModal(`
      <h2 id="modalTitle">โปรโมตงานใหม่ (Sponsored Drop)</h2>
      <p style="margin-bottom: 16px;">กระจายข่าวเพลงใหม่ อีเวนต์ หรือบัตรรอบใหม่ สู่ผู้ใช้ Sourcewav ทั่วประเทศ</p>

      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 11px; color: #92400e;">
        ⚠️ <b>ข้อกำหนดความโปร่งใส:</b> งานที่ได้รับการโปรโมตจะแสดงป้ายกำกับ <b>[⚡ ได้รับการโปรโมต / SPONSORED]</b> อย่างชัดเจนเสมอ
      </div>

      <form id="boostDropForm">
        <label class="modal-field">
          ชื่องานหรือเพลงที่ต้องการโปรโมต
          <input id="boostTitle" required placeholder="เช่น HIPHOP NATION BKK FEST 2026" />
        </label>

        <label class="modal-field">
          ชื่อผู้จัด / ศิลปิน
          <input id="boostCreator" required placeholder="เช่น Hiphop Nation Thailand" />
        </label>

        <label class="modal-field">
          ข้อความสั้นดึงดูดแฟนเพลง (150 ตัวอักษร)
          <textarea id="boostDetails" rows="3" required placeholder="บอกจุดเด่น วันเวลา สถานที่ หรือโปรโมชันบัตร..."></textarea>
        </label>

        <label class="modal-field">
          เลือกระดับการโปรโมต (Monetization Packages)
          <select id="boostPackage">
            <option value="500">🚀 Starter Boost (฿500) — ส่งแจ้งเตือนแฟนเพลงในพื้นที่ ~500 คน</option>
            <option value="1500" selected>🔥 High Rotation Boost (฿1,500) — แจ้งเตือน ~2,500 คน + ปักหมุดหน้าฟีด</option>
            <option value="3500">⚡ Headline Spotlight (฿3,500) — เข้าถึงสมาชิกทุกคน + แบนเนอร์พิเศษ</option>
          </select>
        </label>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 14px 0;">
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span>ยอดชำระ:</span>
            <b id="boostPriceTotal">฿1,500</b>
          </div>
          <small style="color: #64748b; font-size: 10px;">ชำระผ่าน PromptPay · เริ่มกระจาย Drop ทันที</small>
        </div>

        <button type="submit" class="modal-primary" id="submitBoostBtn">ยืนยันโปรโมต Drop (ชำระ ฿1,500)</button>
      </form>
    `);

    const pkgSelect = $('#boostPackage');
    const totalEl = $('#boostPriceTotal');
    const submitBtn = $('#submitBoostBtn');

    if (pkgSelect) {
      pkgSelect.addEventListener('change', () => {
        const val = Number(pkgSelect.value);
        if (totalEl) totalEl.textContent = money(val);
        if (submitBtn) submitBtn.textContent = `ยืนยันโปรโมต Drop (ชำระ ${money(val)})`;
      });
    }

    $('#boostDropForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const title = $('#boostTitle').value.trim();
      const creator = $('#boostCreator').value.trim();
      const details = $('#boostDetails').value.trim();

      const newDrop = {
        id: `drop-${Date.now().toString(36)}`,
        type: 'event',
        title: title,
        creatorName: creator,
        creatorHandle: creator.toLowerCase().replace(/[^a-z0-9]/g, ''),
        timestamp: 'เมื่อสักครู่',
        badgeLabel: 'สปอนเซอร์',
        isPromoted: true,
        promoTag: 'SPONSORED',
        detailText: details,
        actionLabel: 'ดูรายละเอียดบัตร ↗',
        actionType: 'event',
        actionTarget: 'local-matter',
        read: false
      };

      state.dropAlerts.unshift(newDrop);
      saveFeaturesState();
      closeModal();
      toast('โปรโมต Drop เรียบร้อยแล้ว! งานจะแสดงป้าย [⚡ SPONSORED] บนหน้าฟีดทันที');
    });
  }

  function toggleFollowVenue(venueId, venueName) {
    const list = state.followedVenues || [];
    const index = list.indexOf(venueId);
    if (index > -1) {
      list.splice(index, 1);
      toast(`เลิกติดตามสถานที่ ${venueName} แล้ว`);
    } else {
      list.push(venueId);
      // Generate instant drop alert for following
      state.dropAlerts.unshift({
        id: `drop-${Date.now().toString(36)}`,
        type: 'venue',
        title: `${venueName} เพิ่มในสถานที่โปรดของคุณแล้ว`,
        creatorName: venueName,
        creatorHandle: venueId,
        timestamp: 'เมื่อสักครู่',
        badgeLabel: 'สถานที่โปรด',
        isPromoted: false,
        detailText: `คุณเริ่มติดตาม ${venueName} เมื่อมีงานใหม่หรืออีเวนต์จะได้รับการแจ้งเตือนทันที`,
        actionLabel: 'ดูสถานที่บนแผนที่ ⌁',
        actionType: 'venue',
        actionTarget: venueId,
        read: false
      });
      toast(`เริ่มติดตามสถานที่ ${venueName} แล้ว! จะได้รับ Drop Alert เมื่อมีงานใหม่`);
    }
    state.followedVenues = list;
    saveFeaturesState();
  }

  /* --- Right column preview (rendered from state) --- */
  function renderDropPreview() {
    const host = $('#dropPreviewList');
    if (!host) return;
    const items = (state.dropAlerts || []).slice(0, 3);
    if (!items.length) {
      host.innerHTML = '<p class="platform-empty">ยังไม่มีการแจ้งเตือนใหม่</p>';
      return;
    }
    const iconMap = { release: '🎵', gig: '🎤', ticket: '🎟️', drop: '🔥', followed: '🔔' };
    host.innerHTML = items.map(drop => {
      const iconChar = drop.isPromoted ? '⚡' : (iconMap[drop.type] || '♧');
      return `
        <div class="drop-card ${drop.isPromoted ? 'sponsored-drop' : ''} ${drop.read ? '' : 'unread'}" style="margin-bottom: 8px;">
          <div class="drop-icon ${drop.isPromoted ? 'sponsored' : esc(drop.type || '')}">${iconChar}</div>
          <div class="drop-content">
            ${drop.isPromoted ? '<span class="badge-sponsored">⚡ ได้รับการโปรโมต / SPONSORED</span>' : ''}
            <h4 style="margin: ${drop.isPromoted ? '4px 0 2px' : '0 0 2px'}; font-size: 13px;">${esc(drop.title)}</h4>
            <p style="font-size: 11px; margin-bottom: 6px;">${esc(drop.details || drop.creator || '')}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  /* --- Follow artist (booking card button) --- */
  function toggleFollowArtist(artistName) {
    const list = Array.isArray(state.followedArtists) ? state.followedArtists : [];
    const index = list.indexOf(artistName);
    if (index >= 0) {
      list.splice(index, 1);
      toast(`เลิกติดตาม ${artistName} แล้ว`);
    } else {
      list.push(artistName);
      state.dropAlerts.unshift({
        id: `drop-${Date.now().toString(36)}`,
        type: 'followed',
        title: `กำลังติดตาม ${artistName}`,
        details: 'คุณจะได้รับแจ้งเมื่อมีเพลงใหม่ งาน หรือบัตรรอบใหม่',
        creator: artistName,
        isPromoted: false,
        read: false,
        createdAt: new Date().toISOString()
      });
      toast(`เริ่มติดตาม ${artistName} — จะแจ้งเตือนเมื่อมีอะไรใหม่`);
    }
    state.followedArtists = list;
    saveFeaturesState();
    renderDropPreview();
    F.renderBookingBoard?.();
  }

  const isFollowingArtist = name => (Array.isArray(state.followedArtists) ? state.followedArtists : []).includes(name);

  function bindStatic() {
    $('#notificationBtn')?.addEventListener('click', e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      renderDropAlertsCenter();
    });
    $('#openDropCenterBtn')?.addEventListener('click', renderDropAlertsCenter);
    $('#leftRailDropBtn')?.addEventListener('click', e => {
      e.preventDefault();
      renderDropAlertsCenter();
    });
  }

  Object.assign(F, { renderDropAlertsCenter, renderDropPreview, toggleFollowVenue, toggleFollowArtist, isFollowingArtist, openBoostDropModal });
  F.drops = { bindStatic };
})(window);
