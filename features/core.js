/* Sourcewav core helpers + shared feature state (Features 5-8). */
(function (global) {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = n => `฿${Number(n || 0).toLocaleString('th-TH')}`;

  const toast = msg => {
    const el = $('#toast');
    if (el) {
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
    }
  };

  const showModal = (html, customClass = '') => {
    const backdrop = $('#modalBackdrop');
    const modalContent = $('#modalContent');
    const modal = $('.modal');
    if (!backdrop || !modalContent) return;
    if (modal) {
      modal.className = `modal ${customClass}`.trim();
    }
    modalContent.innerHTML = html;
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const closeBtn = $('#modalClose');
    if (closeBtn) closeBtn.focus();
  };

  const closeModal = () => {
    const backdrop = $('#modalBackdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('modal-open');
    const modal = $('.modal');
    if (modal) {
      modal.className = 'modal';
    }
  };

  /* Feature state is loaded from the normalized Supabase feature tables. */
  const state = {};

  const seedDefaults = () => ({
    bookingCards: [], bookingOffers: [], dropAlerts: [], followedVenues: [],
    followedArtists: [], eventCommand: {}, artistStoreProducts: [], artistStoreOrders: []
  });

  const normalizeFeatureState = source => {
    const s = source && typeof source === 'object' ? source : {};
    return {
      bookingCards: Array.isArray(s.bookingCards) ? s.bookingCards : [],
      bookingOffers: Array.isArray(s.bookingOffers) ? s.bookingOffers : [],
      dropAlerts: Array.isArray(s.dropAlerts) ? s.dropAlerts : [],
      followedVenues: Array.isArray(s.followedVenues) ? s.followedVenues : [],
      followedArtists: Array.isArray(s.followedArtists) ? s.followedArtists : [],
      eventCommand: s.eventCommand && typeof s.eventCommand === 'object' ? s.eventCommand : {},
      artistStoreProducts: Array.isArray(s.artistStoreProducts) ? s.artistStoreProducts : [],
      artistStoreOrders: Array.isArray(s.artistStoreOrders) ? s.artistStoreOrders : []
    };
  };

  const adoptState = next => {
    const normalized = normalizeFeatureState(next);
    Object.keys(normalized).forEach(key => { state[key] = normalized[key]; });
  };

  function loadFeaturesState() {
    adoptState(seedDefaults());
    return state;
  }

  loadFeaturesState();

  global.addEventListener('sourcewav:store', () => {
    updateNotificationBadge();
  });

  function updateNotificationBadge() {
    const unreadCount = state.dropAlerts.filter(a => !a.read).length;
    const btn = $('#notificationBtn');
    if (btn) {
      const count = $('.notification-count', btn);
      if (count) count.textContent = String(unreadCount);
      btn.setAttribute('aria-label', unreadCount ? `Drop Alerts · ${unreadCount} รายการใหม่` : 'Drop Alerts');
      const dot = $('i', btn);
      if (dot) {
        dot.classList.toggle('badge-active', unreadCount > 0);
        dot.title = unreadCount > 0 ? `${unreadCount} แจ้งเตือนใหม่` : '';
      }
    }
  }

  const core = {
    $, $$, esc, money, toast, showModal, closeModal, state,
    updateNotificationBadge
  };
  global.SourcewavFeaturesCore = core;
})(window);
