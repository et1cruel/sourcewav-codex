/* Features 5-8 entry: bindings, delegation and public API. */
(function (global) {
  'use strict';
  const Core = global.SourcewavFeaturesCore;
  const { $, $$, esc, money, toast, state, saveFeaturesState } = Core;
  const F = global.SourcewavFeatures || (global.SourcewavFeatures = {});
  const {
    renderBookingBoard, openJoinBookingModal, openHireModal, openBookingInboxModal,
    renderDropAlertsCenter, renderDropPreview, toggleFollowVenue, toggleFollowArtist, openBoostDropModal,
    openCommandCenterModal, renderCommandPreview,
    renderArtistStore, openAddProductModal, openBuyProductModal
  } = F;

  function setupFeaturesUI() {
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
        const offer = state.bookingOffers.find(o => o.id === target.dataset.acceptOffer);
        if (offer) {
          offer.status = 'accepted';
          saveFeaturesState();
          openBookingInboxModal();
          toast('ยอมรับข้อเสนอจ้างงานแล้ว! เตรียมขึ้นโชว์');
        }
        return;
      }

      if (target.dataset.closeDeal) {
        e.preventDefault();
        const offer = state.bookingOffers.find(o => o.id === target.dataset.closeDeal);
        if (offer) {
          offer.status = 'closed';
          // increase artist completed gigs
          const card = state.bookingCards.find(c => c.id === offer.cardId);
          if (card) card.gigsCompleted = (card.gigsCompleted || 0) + 1;
          saveFeaturesState();
          openBookingInboxModal();
          toast(`ปิดงานสำเร็จ! ออกใบเสร็จคอมมิชชัน ${money(offer.commissionAmount)} เรียบร้อย`);
        }
        return;
      }

      if (target.dataset.declineOffer) {
        e.preventDefault();
        const offer = state.bookingOffers.find(o => o.id === target.dataset.declineOffer);
        if (offer) {
          offer.status = 'declined';
          saveFeaturesState();
          openBookingInboxModal();
          toast('ปฏิเสธข้อเสนอแล้ว');
        }
        return;
      }

      // Follow Venue toggle
      if (target.dataset.followVenue) {
        e.preventDefault();
        toggleFollowVenue(target.dataset.followVenue, target.dataset.venueName || 'สถานที่');
        const isFollowed = state.followedVenues.includes(target.dataset.followVenue);
        target.textContent = isFollowed ? '✓ กำลังติดตาม' : '＋ ติดตามสถานที่';
        target.classList.toggle('following', isFollowed);
        return;
      }

      // Follow artist toggle (booking cards)
      if (target.dataset.followArtist) {
        e.preventDefault();
        toggleFollowArtist(target.dataset.followArtist);
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
