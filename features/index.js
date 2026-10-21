/* Features 5-8 entry: bindings, delegation and public API. */
(function (global) {
  'use strict';
  const Core = global.SourcewavFeaturesCore;
  const { $, $$, toast, state } = Core;
  const F = global.SourcewavFeatures || (global.SourcewavFeatures = {});
  F.data = global.SourcewavFeatureData;
  const {
    renderBookingBoard, openJoinBookingModal, openHireModal, openBookingInboxModal,
    renderDropAlertsCenter, renderDropPreview, toggleFollowVenue, toggleFollowArtist, openBoostDropModal,
    openCommandCenterModal, renderCommandPreview,
    renderArtistStore, openAddProductModal, openBuyProductModal
  } = F;

  async function setupFeaturesUI() {
    await F.data.load().catch(error => console.error('Sourcewav feature data failed to load:', error.message));
    global.addEventListener('sourcewav:auth', () => {
      F.data.load().then(() => F.renderAll()).catch(error => console.error('Sourcewav feature data refresh failed:', error.message));
    });
    F.booking.bindStatic();
    F.drops.bindStatic();
    F.command.bindStatic();
    F.store.bindStatic();

    // Document delegation for dynamically rendered buttons
    document.addEventListener('click', e => {
      const target = e.target.closest('button');
      if (!target) return;

      // Hire artist
      if (target.dataset.hireArtist) {
        e.preventDefault();
        openHireModal(target.dataset.hireArtist);
        return;
      }

      // Chat with artist from Booking Board
      if (target.dataset.chatArtist) {
        e.preventDefault();
        toast(`เปิดแชทกับ @${target.dataset.chatArtist}`);
        $('#chatBtn')?.click();
        return;
      }

      // Buy product in Store
      if (target.dataset.buyProduct) {
        e.preventDefault();
        openBuyProductModal(target.dataset.buyProduct);
        return;
      }

      // Play beat demo snippet
      if (target.dataset.playBeatDemo) {
        e.preventDefault();
        toast('♫ กำลังเล่นตัวอย่าง Beat Preview 30 วินาที...');
        return;
      }

      // Booking Inbox Actions
      if (target.dataset.acceptOffer) {
        e.preventDefault();
        F.data.respondBookingOffer(target.dataset.acceptOffer, 'accepted').then(ok => {
          if (!ok) return;
          openBookingInboxModal();
          toast('บันทึกการตอบรับลงฐานข้อมูลแล้ว');
        }).catch(error => toast(`ตอบรับไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
        return;
      }

      if (target.dataset.declineOffer) {
        e.preventDefault();
        F.data.respondBookingOffer(target.dataset.declineOffer, 'declined').then(ok => {
          if (!ok) return;
          openBookingInboxModal();
          toast('บันทึกการปฏิเสธลงฐานข้อมูลแล้ว');
        }).catch(error => toast(`ปฏิเสธไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
        return;
      }

      // Follow Venue toggle
      if (target.dataset.followVenue) {
        e.preventDefault();
        toggleFollowVenue(target.dataset.followVenue, target.dataset.venueName || 'สถานที่').then(isFollowed => {
          if (isFollowed === null) return;
          target.textContent = isFollowed ? '✓ กำลังติดตาม' : '＋ ติดตามสถานที่';
          target.classList.toggle('following', isFollowed);
        }).catch(error => toast(`ติดตามไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
        return;
      }

      // Follow artist toggle (booking cards)
      if (target.dataset.followArtist) {
        e.preventDefault();
        toggleFollowArtist(target.dataset.followArtist, target.dataset.artistName)
          .catch(error => toast(`ติดตามไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
        return;
      }

      // Boost a drop (promote)
      if (target.dataset.boostDrop !== undefined) {
        e.preventDefault();
        openBoostDropModal();
        return;
      }
    });

    // Render initial views
    renderBookingBoard();
    renderArtistStore();
    renderDropPreview();
    renderCommandPreview();
    Core.updateNotificationBadge();
  }

  F.renderAll = function renderAll() {
    renderBookingBoard();
    renderArtistStore();
    renderDropPreview();
    renderCommandPreview();
    Core.updateNotificationBadge();
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupFeaturesUI);
  } else {
    setupFeaturesUI();
  }

  // Export API
  Object.assign(F, {
    state,
    renderBookingBoard,
    renderDropAlertsCenter,
    openCommandCenterModal,
    renderArtistStore,
    openJoinBookingModal,
    openHireModal,
    openAddProductModal,
    toggleFollowVenue,
    renderAll: F.renderAll
  });
})(window);
