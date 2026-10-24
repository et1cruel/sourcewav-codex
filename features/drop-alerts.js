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
    const unread = state.dropAlerts.filter(a => !a.read).length + state.likeNotifications.filter(a => !a.read).length;

    showModal(`
      <div class="drop-center-modal">
        <div class="drop-center-heading">
          <div class="drop-center-title">
            <span class="drop-center-icon" aria-hidden="true">♧</span>
            <div><h2 id="modalTitle">การแจ้งเตือน</h2><p>คนที่ชอบเพลงของคุณ และข่าวจากคอมมูนิตี้</p></div>
          </div>
          ${unread ? '<button type="button" id="markAllDropsReadBtn" class="drop-mark-read">อ่านทั้งหมดแล้ว</button>' : ''}
        </div>

        <div class="drop-tabs" role="group" aria-label="กรองการแจ้งเตือน">
          <button type="button" class="drop-tab-btn ${activeDropTab === 'all' ? 'active' : ''}" data-drop-tab="all" aria-pressed="${activeDropTab === 'all'}">ทั้งหมด <b>${state.dropAlerts.length + state.likeNotifications.length}</b></button>
          <button type="button" class="drop-tab-btn ${activeDropTab === 'likes' ? 'active' : ''}" data-drop-tab="likes" aria-pressed="${activeDropTab === 'likes'}"><span aria-hidden="true">♥</span> ไลก์เพลง</button>
          <button type="button" class="drop-tab-btn ${activeDropTab === 'music' ? 'active' : ''}" data-drop-tab="music" aria-pressed="${activeDropTab === 'music'}"><span aria-hidden="true">♫</span> เพลงใหม่</button>
          <button type="button" class="drop-tab-btn ${activeDropTab === 'ticket' ? 'active' : ''}" data-drop-tab="ticket" aria-pressed="${activeDropTab === 'ticket'}"><span aria-hidden="true">▣</span> บัตรและงาน</button>
          <button type="button" class="drop-tab-btn ${activeDropTab === 'venue' ? 'active' : ''}" data-drop-tab="venue" aria-pressed="${activeDropTab === 'venue'}"><span aria-hidden="true">⌖</span> สถานที่</button>
          <button type="button" class="drop-tab-btn ${activeDropTab === 'sponsored' ? 'active' : ''}" data-drop-tab="sponsored" aria-pressed="${activeDropTab === 'sponsored'}"><span aria-hidden="true">✦</span> โปรโมต</button>
        </div>

        <div class="drop-feed-list" id="dropFeedList" aria-live="polite" aria-relevant="additions text">
          ${renderDropItemsHTML()}
        </div>

        <!-- Drop creation; paid sponsorship is unavailable until payment is configured. -->
        <div class="boost-cta-box">
          <div>
            <strong>มีข่าวใหม่อยากแชร์ไหม?</strong>
            <p>สร้างประกาศเพลงหรืองานให้คนในคอมมูนิตี้เห็น</p>
          </div>
          <button type="button" class="boost-launch-btn" id="openBoostDropModalBtn">
            <span aria-hidden="true">＋</span> สร้างประกาศ
          </button>
        </div>
      </div>
    `, 'drop-center-modal');

    bindDropCenterEvents();
  }

  function renderDropItemsHTML() {
    const items = [
      ...state.dropAlerts.map(item => ({ ...item, itemKind: 'drop' })),
      ...state.likeNotifications.map(item => ({ ...item, itemKind: 'like' }))
    ].filter(a => {
      if (activeDropTab === 'all') return true;
      if (activeDropTab === 'likes') return a.itemKind === 'like';
      if (a.itemKind === 'like') return false;
      if (activeDropTab === 'sponsored') return a.isPromoted;
      if (activeDropTab === 'ticket') return ['ticket', 'event'].includes(a.type);
      return a.type === activeDropTab;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!items.length) {
      const isAll = activeDropTab === 'all';
      return `<div class="drop-empty"><span class="drop-empty-icon" aria-hidden="true">${isAll ? '♧' : '⌕'}</span><h3>${isAll ? 'ยังไม่มีการแจ้งเตือน' : 'ยังไม่มีรายการในหมวดนี้'}</h3><p>${isAll ? 'เมื่อมีคนกดไลก์เพลงของคุณ หรือมีข่าวใหม่ รายการจะปรากฏที่นี่' : 'ลองเลือกหมวดอื่นเพื่อดูข่าวเพิ่มเติม'}</p></div>`;
    }

    return items.map(drop => {
      if (drop.itemKind === 'like') return `
        <article class="drop-card song-like-alert ${drop.read ? '' : 'unread'}" data-like-notification-id="${esc(drop.id)}">
          <div class="drop-icon song-like-icon" aria-hidden="true">♥</div>
          <div class="drop-content">
            <div class="drop-topline"><span class="drop-creator"><b>${esc(drop.actorName)}</b>${drop.actorHandle ? ` · @${esc(drop.actorHandle)}` : ''}</span><span class="drop-time">${esc(new Date(drop.createdAt).toLocaleString('th-TH'))}</span></div>
            <h4>กดไลก์เพลงของคุณ</h4>
            <p>${esc(drop.trackTitle)}</p>
            ${drop.trackId ? `<a class="drop-action-btn" data-like-track-id="${esc(drop.trackId)}" data-like-notification-id="${esc(drop.id)}" href="?track=${encodeURIComponent(drop.trackId)}#music">ฟังเพลง ↗</a>` : ''}
          </div>
        </article>`;
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
        $$('.drop-tab-btn').forEach(b => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', String(active));
        });
        const list = $('#dropFeedList');
        if (list) list.innerHTML = renderDropItemsHTML();
        bindDropActionClicks();
      });
    });

    $('#markAllDropsReadBtn')?.addEventListener('click', async () => {
      try {
        const ids = state.likeNotifications.filter(item => !item.read).map(item => item.id);
        await global.SourcewavFeatureData.markLikeNotificationsRead(ids);
        await global.SourcewavFeatureData.markAllDropsRead();
        Core.updateNotificationBadge();
        renderDropAlertsCenter();
        toast('อ่านการแจ้งเตือนทั้งหมดแล้ว');
      } catch (error) { toast(`บันทึกไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`); }
    });

    $('#openBoostDropModalBtn')?.addEventListener('click', openBoostDropModal);

    bindDropActionClicks();
  }

  function bindDropActionClicks() {
    $$('[data-like-notification-id][data-like-track-id]').forEach(link => {
      link.addEventListener('click', async e => {
        e.preventDefault();
        try { await global.SourcewavFeatureData.markLikeNotificationsRead([link.dataset.likeNotificationId]); }
        catch (error) { console.error('Mark song like notification read failed:', error.message); }
        location.assign(link.href);
      });
    });
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
      <div class="drop-create-heading"><span class="composer-heading-icon" aria-hidden="true">✦</span><div><h2 id="modalTitle">สร้างประกาศ</h2><p>แชร์ข่าวเพลงหรืองานให้คนในคอมมูนิตี้</p></div></div>
      <p class="drop-create-note">ประกาศนี้จะแสดงใน Drop Alerts และไม่มีค่าใช้จ่าย</p>

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
    `, 'drop-create-modal');

    $('#boostDropForm')?.addEventListener('submit', e => {
      e.preventDefault();
      global.SourcewavFeatureData.createDrop({
        type: $('#boostType').value, title: $('#boostTitle').value.trim(),
        details: $('#boostDetails').value.trim(), actionLabel: 'ดูรายละเอียด',
        actionUrl: $('#boostActionUrl').value.trim()
      }).then(drop => {
        if (!drop) return;
        renderDropPreview();
        activeDropTab = 'all';
        renderDropAlertsCenter();
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
    $('#notificationBtn')?.addEventListener('click', async e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      try { await global.SourcewavFeatureData.refreshLikeNotifications(); }
      catch (error) { console.error('Song like notifications failed to load:', error.message); }
      renderDropAlertsCenter();
    });
    $('#openDropCenterBtn')?.addEventListener('click', async () => {
      try { await global.SourcewavFeatureData.refreshLikeNotifications(); }
      catch (error) { console.error('Song like notifications failed to load:', error.message); }
      renderDropAlertsCenter();
    });
  }

  Object.assign(F, { renderDropAlertsCenter, renderDropPreview, toggleFollowVenue, toggleFollowArtist, isFollowingArtist, openBoostDropModal });
  F.drops = { bindStatic };
})(window);
