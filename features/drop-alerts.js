/* Feature 6: Follow & Drop Alert — ติดตามศิลปิน/สถานที่และแจ้งเตือนงานใหม่ */
(function (global) {
  'use strict';
  const Core = global.SourcewavFeaturesCore;
  const { $, $$, esc, toast, showModal, closeModal, state } = Core;
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
            <p style="margin: 0; color: #64748b; font-size: 12px;">ประกาศและรายการอัปเดตจากฐานข้อมูล Sourcewav</p>
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

        <!-- Drop creation; paid sponsorship is unavailable until payment is configured. -->
        <div class="boost-cta-box">
          <div>
            <strong>แชร์ข่าวงานหรือเพลงใหม่</strong>
            <p>บันทึกประกาศลงฐานข้อมูลและแสดงใน Drop Alerts โดยไม่ติดป้ายโฆษณา</p>
          </div>
          <button class="boost-launch-btn" id="openBoostDropModalBtn">
            ＋ สร้าง Drop
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
      global.SourcewavFeatureData.markAllDropsRead().then(ok => {
        if (!ok) return;
        const list = $('#dropFeedList');
        if (list) list.innerHTML = renderDropItemsHTML();
        bindDropActionClicks();
        Core.updateNotificationBadge();
        toast('บันทึกสถานะอ่านทั้งหมดลงฐานข้อมูลแล้ว');
      }).catch(error => toast(`บันทึกไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
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

        if (/^https:\/\//i.test(target)) {
          window.open(target, '_blank', 'noopener,noreferrer');
          return;
        }

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
      <h2 id="modalTitle">สร้าง Drop Alert</h2>
      <p style="margin-bottom: 16px;">ประกาศนี้จะบันทึกลงฐานข้อมูลและแสดงเป็นโพสต์ทั่วไป การโปรโมตแบบชำระเงินยังไม่เปิดใช้</p>

      <form id="boostDropForm">
        <label class="modal-field">
          หัวข้อประกาศ
          <input id="boostTitle" required maxlength="200" placeholder="ชื่องาน เพลงใหม่ หรือข่าวจากคุณ" />
        </label>

        <label class="modal-field">ประเภทประกาศ
          <select id="boostType"><option value="event">อีเวนต์</option><option value="music">เพลงใหม่</option><option value="ticket">บัตร</option><option value="announcement">ประกาศทั่วไป</option></select>
        </label>

        <label class="modal-field">
          รายละเอียด
          <textarea id="boostDetails" rows="3" maxlength="3000" required placeholder="บอกวันเวลา สถานที่ หรือรายละเอียดที่ต้องการแชร์"></textarea>
        </label>

        <label class="modal-field">ลิงก์รายละเอียด (ไม่บังคับ)
          <input id="boostActionUrl" type="url" placeholder="https://…" />
        </label>
        <button type="submit" class="modal-primary" id="submitBoostBtn">บันทึก Drop ลงฐานข้อมูล</button>
      </form>
    `);

    $('#boostDropForm')?.addEventListener('submit', e => {
      e.preventDefault();
      global.SourcewavFeatureData.createDrop({
        type: $('#boostType').value, title: $('#boostTitle').value.trim(),
        details: $('#boostDetails').value.trim(), actionLabel: 'ดูรายละเอียด',
        actionUrl: $('#boostActionUrl').value.trim()
      }).then(drop => {
        if (!drop) return;
        closeModal();
        renderDropPreview();
        toast('บันทึก Drop ลงฐานข้อมูลแล้ว');
      }).catch(error => toast(`บันทึกไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
    });
  }

  function toggleFollowVenue(venueId, venueName) {
    return global.SourcewavFeatureData.toggleFollowVenue(venueId).then(following => {
      if (following !== null) toast(following ? `เริ่มติดตาม ${venueName} แล้ว` : `เลิกติดตาม ${venueName} แล้ว`);
      return following;
    });
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
  function toggleFollowArtist(artistId, artistName) {
    return global.SourcewavFeatureData.toggleFollowArtist(artistId).then(following => {
      if (following === null) return null;
      toast(following ? `เริ่มติดตาม ${artistName} แล้ว` : `เลิกติดตาม ${artistName} แล้ว`);
      F.renderBookingBoard?.();
      return following;
    });
  }

  const isFollowingArtist = id => (Array.isArray(state.followedArtists) ? state.followedArtists : []).includes(id);

  function bindStatic() {
    $('#notificationBtn')?.addEventListener('click', e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      renderDropAlertsCenter();
    });
    $('#openDropCenterBtn')?.addEventListener('click', renderDropAlertsCenter);
  }

  Object.assign(F, { renderDropAlertsCenter, renderDropPreview, toggleFollowVenue, toggleFollowArtist, isFollowingArtist, openBoostDropModal });
  F.drops = { bindStatic };
})(window);
