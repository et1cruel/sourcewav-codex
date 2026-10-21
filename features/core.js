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

  /* ------------------------------------------------------------------
     DEFAULT DEMO DATA
  ------------------------------------------------------------------ */
  /* --------------------------------------------------------------------------
     LOCAL STATE INITIALIZATION & SYNC
  ---------  ------------------------------------------------------------------ */
  const defaultBookingCards = [
    {
      id: 'bk-kura',
      artistName: 'DJ KURA',
      handle: 'dj.kura',
      role: 'dj',
      roleLabel: 'DJ / Open-Format',
      rate: 4500,
      rateUnit: 'ต่อเซ็ต (2 ชม.)',
      availability: 'ว่างรับงานสุดสัปดาห์นี้',
      availableStatus: 'ready',
      city: 'กรุงเทพฯ & ปริมณฑล',
      bio: 'เปิดเพลง Trap, Hip-Hop, Jersey Club, และ 90s Boom Bap ประสบการณ์เวทีอันเดอร์กราวด์ 6 ปี',
      portfolioTitle: 'KURA CLUB MIX VOL.4',
      isPro: true,
      gigsCompleted: 18,
      avatarChar: 'K'
    },
    {
      id: 'bk-zodiac',
      artistName: 'MC ZODIAC',
      handle: 'zodiac.mc',
      role: 'rapper',
      roleLabel: 'Rapper / MC',
      rate: 6000,
      rateUnit: 'ต่องาน (45 นาที)',
      availability: 'ว่างรับงานด่วน',
      availableStatus: 'ready',
      city: 'กรุงเทพฯ · รับงานทั่วประเทศ',
      bio: 'แรปเปอร์สาย Freestyle & Hype MC คุมเวทีเดือด ไรม์คม พร้อม Feature เพลงและขึ้นโชว์สด',
      portfolioTitle: 'UNDERGROUND CYPHER 2026 VERSE',
      isPro: true,
      gigsCompleted: 22,
      avatarChar: 'Z'
    },
    {
      id: 'bk-chopper',
      artistName: '808_CHOPPER',
      handle: 'chopper.beats',
      role: 'producer',
      roleLabel: 'Producer / Beatmaker',
      rate: 5000,
      rateUnit: 'ต่อ 1 บีท (พร้อม Mix/Master)',
      availability: 'คิวว่างเริ่มสัปดาห์หน้า',
      availableStatus: 'ready',
      city: 'ขอนแก่น · รับงานออนไลน์',
      bio: 'โปรดิวซ์บีท Trap, Drill, และ Melodic Hip-Hop อุปกรณ์ระดับสตูดิโอ มีผลงานร่วมกับศิลปินอินดี้ 30+ แทร็ก',
      portfolioTitle: 'NIGHT RIDE INSTRUMENTAL DEMO',
      isPro: false,
      gigsCompleted: 31,
      avatarChar: '8'
    },
    {
      id: 'bk-frame',
      artistName: 'FRAME.RAW',
      handle: 'frame.raw',
      role: 'photographer',
      roleLabel: 'Photographer / Video',
      rate: 4000,
      rateUnit: 'ต่องาน (4 ชม.)',
      availability: 'ว่างรับงาน ส.-อา. นี้',
      availableStatus: 'ready',
      city: 'กรุงเทพฯ',
      bio: 'ช่างภาพคอนเสิร์ต & วิดีโอสั้นสำหรับ Reels/TikTok สไตล์ฟิล์มเกรน ดิบ แสงนีออน ส่งภาพด่วนใน 24 ชม.',
      portfolioTitle: 'LIVE STAGE PHOTOSET @ AVVE',
      isPro: true,
      gigsCompleted: 25,
      avatarChar: 'F'
    },
    {
      id: 'bk-neonglitch',
      artistName: 'NEON.GLITCH',
      handle: 'neon.vj',
      role: 'vj',
      roleLabel: 'VJ / Visual Artist',
      rate: 5500,
      rateUnit: 'ต่องาน (Live Mapping)',
      availability: 'คิวว่าง 28 ต.ค. เป็นต้นไป',
      availableStatus: 'busy',
      city: 'เชียงใหม่ / กรุงเทพฯ',
      bio: 'VJ ฉายกราฟิกสดตามจังหวะเพลง ระบบ Audio-Reactive Visuals รองรับ Resolume & TouchDesigner',
      portfolioTitle: 'REACTIVE VISUAL REEL 2026',
      isPro: false,
      gigsCompleted: 14,
      avatarChar: 'N'
    },
    {
      id: 'bk-soundcraft',
      artistName: 'SOUNDCRAFT BKK',
      handle: 'soundcraft.live',
      role: 'crew',
      roleLabel: 'Sound Engineer & ทีมจัดงาน',
      rate: 7500,
      rateUnit: 'ต่องาน (PA + Sound Tech)',
      availability: 'ว่างรับงานทุกวันศุกร์-เสาร์',
      availableStatus: 'ready',
      city: 'กรุงเทพฯ & ปริมณฑล',
      bio: 'ทีมซาวด์เอ็นจิเนียร์ คุมมิกเซอร์สด เซ็ตไมค์ ดูแลระบบเสียง Livehouse และคอนเสิร์ตฮิปฮอป',
      portfolioTitle: 'CYPHER STAGE SOUND SPEC',
      isPro: true,
      gigsCompleted: 40,
      avatarChar: 'S'
    }
  ];

  const defaultBookingOffers = [
    {
      id: 'off-101',
      cardId: 'bk-kura',
      artistName: 'DJ KURA',
      clientName: 'AVVE Space',
      clientContact: 'organizer@avve.bkk',
      eventTitle: 'Neon Beats Friday Night',
      eventDate: '24 ต.ค. 2026 · 21:00-23:00',
      venueLocation: 'AVVE · วัฒนา กรุงเทพฯ',
      roleNeeded: 'DJ เซ็ต 2 ชั่วโมง',
      offeredBudget: 5000,
      commissionRate: 0, // Pro member 0%
      commissionAmount: 0,
      artistPayout: 5000,
      details: 'เปิดวอร์มอัปเซ็ตฮิปฮอป 1 ชม. และแทรป 1 ชม.',
      status: 'accepted',
      createdAt: '2026-10-21T14:30:00Z'
    }
  ];

  const defaultDropAlerts = [
    {
      id: 'drop-promo-01',
      type: 'event',
      title: 'HIPHOP NATION BKK FEST 2026',
      creatorName: 'Hiphop Nation Thailand',
      creatorHandle: 'hiphopnation.th',
      timestamp: 'เมื่อสักครู่',
      badgeLabel: 'งานใหญ่',
      isPromoted: true,
      promoTag: 'SPONSORED',
      detailText: 'เทศกาลฮิปฮอปอันเดอร์กราวด์ที่ใหญ่ที่สุดในกรุงเทพฯ เปิดขายบัตรรอบ Early Bird ลดพิเศษ 30% เฉพาะ 500 ใบแรก ที่ Warehouse 30',
      actionLabel: 'ดูรายละเอียดบัตร ↗',
      actionType: 'event',
      actionTarget: 'local-matter',
      read: false
    },
    {
      id: 'drop-music-01',
      type: 'music',
      title: 'เพลงใหม่: Night Ride (Rough Mix 03)',
      creatorName: 'TAWAN',
      creatorHandle: 'tawan.wav',
      timestamp: '2 ชั่วโมงที่แล้ว',
      badgeLabel: 'เพลงใหม่',
      isPromoted: false,
      detailText: 'ตะวัน ปล่อยเดโม 808 สดๆ ให้ฟังก่อนใครบน Sourcewav สตรีมมิ่ง ฟังและร่วมฟีดแบ็กได้ทันที',
      actionLabel: 'เปิดฟังในเครื่องเล่น ♫',
      actionType: 'music',
      actionTarget: 'streamAudio',
      read: false
    },
    {
      id: 'drop-ticket-01',
      type: 'ticket',
      title: 'บัตรรอบใหม่: BANGKOK UNDERGROUND CYPHER VOL.4',
      creatorName: 'Sourcewav Events',
      creatorHandle: 'sourcewav.org',
      timestamp: '5 ชั่วโมงที่แล้ว',
      badgeLabel: 'บัตรรอบใหม่',
      isPromoted: false,
      detailText: 'เปิดขายบัตร Tier ทั่วไป ฿250 ประตูเปิด 18:00 น. ซื้อผ่าน PromptPay ได้ทันที',
      actionLabel: 'ซื้อบัตรเข้างาน 🎟️',
      actionType: 'ticket',
      actionTarget: 'ticketPicker',
      read: false
    },
    {
      id: 'drop-venue-01',
      type: 'venue',
      title: 'AVVE จัดงานดนตรีสดคืนวันศุกร์นี้',
      creatorName: 'AVVE Event Space',
      creatorHandle: 'avve.bkk',
      timestamp: 'เมื่อวานนี้',
      badgeLabel: 'สถานที่โปรด',
      isPromoted: false,
      detailText: 'สถานที่ที่คุณติดตามประกาศไลน์อัป DJ 4 คน และเครื่องดื่มพิเศษสำหรับคอมมูนิตี้ฮิปฮอป',
      actionLabel: 'ดูแผนที่สถานที่ ⌁',
      actionType: 'venue',
      actionTarget: 'avve',
      read: true
    }
  ];

  const defaultEventCommand = {
    eventId: 'ev-cypher-4',
    eventTitle: 'BANGKOK UNDERGROUND CYPHER VOL.4',
    eventDate: 'เสาร์ที่ 24 ตุลาคม 2026 · 18:00 - 01:00 น.',
    venueName: 'AVVE · 5-Storey Event Space (วัฒนา กรุงเทพฯ)',
    ticketCapacity: 400,
    ticketsSold: 365,
    ticketPriceAverage: 250,
    grossTicketRevenue: 91250,
    checkedInCount: 320,
    isOrganizerPro: true,
    expenses: [
      { id: 'exp-1', category: 'venue', title: 'ค่าเช่าสถานที่ AVVE 5 ชั้น (รวมระบบแอร์)', amount: 28000, paid: true },
      { id: 'exp-2', category: 'artist', title: 'ค่าตัวศิลปิน & MC โชว์สด (4 วง)', amount: 24000, paid: true },
      { id: 'exp-3', category: 'sound_lights', title: 'เช่าเครื่องเสียง PA + มิกเซอร์ + ไมค์ลอย', amount: 12500, paid: true },
      { id: 'exp-4', category: 'crew', title: 'ค่าตอบแทนทีมงานสแกนบัตร & Stage Manager (5 คน)', amount: 6500, paid: true },
      { id: 'exp-5', category: 'marketing', title: 'โปรโมต Drop & ยิงแอดประชาสัมพันธ์งาน', amount: 3500, paid: true }
    ],
    crewList: [
      { id: 'cr-1', name: 'กิตติศักดิ์ (อาร์ต)', handle: 'art.sm', role: 'Stage Manager (ผู้จัดการเวที)', phone: '081-456-7890', status: 'on-duty' },
      { id: 'cr-2', name: 'มินตรา (มิน)', handle: 'min.wav', role: 'Door & Ticket Check-in (ตรวจบัตรเข้างาน)', phone: '089-112-3344', status: 'on-duty' },
      { id: 'cr-3', name: 'ธนวัฒน์ (ปอนด์)', handle: 'pond.sound', role: 'Front of House Sound Tech (คุมเสียง)', phone: '086-778-9900', status: 'on-duty' },
      { id: 'cr-4', name: 'วรัญญา (แพร)', handle: 'prae.vj', role: 'Lighting & Visual Operator (ไฟ & จอภาพ)', phone: '092-334-5566', status: 'on-duty' },
      { id: 'cr-5', name: 'ชานนท์ (นนท์)', handle: 'non.safe', role: 'Security & Crowd Control (ดูแลความปลอดภัย)', phone: '084-556-7788', status: 'pending' }
    ],
    postEventSummary: {
      peakHour: '21:30 - 22:45 น. (คนเข้าพร้อมกันสูงสุด 180 คน)',
      doorRatePercent: 88,
      grossRevenue: 91250,
      totalExpenses: 74500,
      netProfit: 16750,
      profitMarginPercent: 18.3,
      notes: 'ระบบสแกน QR ทำงานราบรื่น ไม่มีคิวสะสมหน้าประตู ยอดเครื่องดื่มเพิ่มขึ้น 22% จากรอบก่อน'
    }
  };

  const defaultArtistStoreProducts = [
    {
      id: 'prod-tee-01',
      artistName: 'SOURCEWAV OFFICIAL',
      artistHandle: 'sourcewav.co',
      title: 'SOURCEWAV OVERSIZE TEE (VINTAGE BLACK)',
      category: 'merch',
      categoryLabel: 'เสื้อผ้า & Merch',
      type: 'physical',
      price: 690,
      stock: 24,
      imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
      description: 'เสื้อยืด Oversize คอตตอนแท้ 100% สกรีนลายกราฟิตี้ Sourcewav BKK Underground ทรงสวย ใส่สบาย',
      salesCount: 46,
      platformFeePercent: 5
    },
    {
      id: 'prod-tape-01',
      artistName: 'UNDERGROUND CYPHER',
      artistHandle: 'cypher.bkk',
      title: 'UNDERGROUND TAPES VOL.1 (LIMITED CASSETTE)',
      category: 'tape_cd',
      categoryLabel: 'เทปคาสเซ็ท / ซีดี',
      type: 'physical',
      price: 450,
      stock: 8,
      imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
      description: 'ม้วนเทปคาสเซ็ทรวมแทร็กฮิปฮอปไทยอันเดอร์กราวด์ 10 เพลง ผลิตจำกัด 100 ม้วนทั่วประเทศ มีเลขกำกับทุกม้วน',
      salesCount: 92,
      platformFeePercent: 5
    },
    {
      id: 'prod-beat-01',
      artistName: '808_CHOPPER',
      artistHandle: 'chopper.beats',
      title: 'MIDNIGHT 808s — BEAT & SAMPLE PACK',
      category: 'beats',
      categoryLabel: 'Beat & Sample Pack (ดิจิทัล)',
      type: 'digital',
      price: 850,
      stock: null, // Unlimited digital
      imageUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=600&q=80',
      description: 'ชุดบีท Trap & Drill 10 แทร็กเต็ม พร้อมไฟล์ WAV Master แยก Stems ทุกชิ้น และสิทธิ์อนุญาตใช้งานเชิงพาณิชย์ 100%',
      digitalAssetInfo: 'WAV 24-bit + Stems ZIP (180 MB) · ลิขสิทธิ์ไม่จำกัดสตรีม',
      salesCount: 38,
      platformFeePercent: 5
    },
    {
      id: 'prod-kit-01',
      artistName: 'TAWAN',
      artistHandle: 'tawan.wav',
      title: 'BOOM BAP GOLD CRATE 90s — DRUM KIT',
      category: 'beats',
      categoryLabel: 'Beat & Sample Pack (ดิจิทัล)',
      type: 'digital',
      price: 390,
      stock: null,
      imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
      description: 'เสียงกลองวินเทจ แสนร์อุ่นๆ คิกหนา และลูปสแครตช์แผ่นเสียง สกัดจากเทปคาสเซ็ท 150+ ไฟล์ พร้อมใช้ใน DAW ทันที',
      digitalAssetInfo: 'One-shots & Loops (85 MB) · 24-bit WAV',
      salesCount: 64,
      platformFeePercent: 5
    },
    {
      id: 'prod-poster-01',
      artistName: 'ภีม พิมพ์นิยม',
      artistHandle: 'peem.print',
      title: 'BKK UNDERGROUND CYPHER SCREENPRINT (A2)',
      category: 'art',
      categoryLabel: 'Artwork & สิ่งพิมพ์',
      type: 'physical',
      price: 550,
      stock: 15,
      imageUrl: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=600&q=80',
      description: 'ภาพพิมพ์ซิลค์สกรีนมือ 4 สี บนกระดาษคอตตอนนำเข้า 300 แกรม ขนาด A2 พร้อมลายเซ็นศิลปินผู้สร้างสรรค์',
      salesCount: 25,
      platformFeePercent: 5
    }
  ];

  /* ------------------------------------------------------------------
     STATE — backed by SourcewavStore (per-account, Supabase-synced)
  ------------------------------------------------------------------ */
  const STORE_KEY = 'sourcewav.features5to8.v1';
  const STORE_FIELDS = [
    'bookingCards', 'bookingOffers', 'dropAlerts', 'followedVenues',
    'followedArtists', 'eventCommand', 'artistStoreProducts', 'artistStoreOrders'
  ];

  const state = {};

  const seedDefaults = () => ({
    bookingCards: defaultBookingCards,
    bookingOffers: defaultBookingOffers,
    dropAlerts: defaultDropAlerts,
    followedVenues: ['avve'],
    followedArtists: [],
    eventCommand: defaultEventCommand,
    artistStoreProducts: defaultArtistStoreProducts,
    artistStoreOrders: []
  });

  const normalizeFeatureState = source => {
    const s = source && typeof source === 'object' ? source : {};
    const d = seedDefaults();
    return {
      bookingCards: Array.isArray(s.bookingCards) && s.bookingCards.length ? s.bookingCards : d.bookingCards,
      bookingOffers: Array.isArray(s.bookingOffers) && s.bookingOffers.length ? s.bookingOffers : d.bookingOffers,
      dropAlerts: Array.isArray(s.dropAlerts) && s.dropAlerts.length ? s.dropAlerts : d.dropAlerts,
      followedVenues: Array.isArray(s.followedVenues) && s.followedVenues.length ? s.followedVenues : d.followedVenues,
      followedArtists: Array.isArray(s.followedArtists) ? s.followedArtists : [],
      eventCommand: s.eventCommand && typeof s.eventCommand === 'object' && Object.keys(s.eventCommand).length ? s.eventCommand : d.eventCommand,
      artistStoreProducts: Array.isArray(s.artistStoreProducts) && s.artistStoreProducts.length ? s.artistStoreProducts : d.artistStoreProducts,
      artistStoreOrders: Array.isArray(s.artistStoreOrders) ? s.artistStoreOrders : []
    };
  };

  const hasFeatureData = source => {
    if (!source || typeof source !== 'object') return false;
    return ['bookingCards', 'bookingOffers', 'dropAlerts', 'followedVenues', 'artistStoreProducts', 'artistStoreOrders']
      .some(key => Array.isArray(source[key]) && source[key].length > 0);
  };

  const adoptState = next => {
    const normalized = normalizeFeatureState(next);
    STORE_FIELDS.forEach(key => { state[key] = normalized[key]; });
  };

  const readLegacy = () => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  };

  const persistToStore = () => {
    if (!global.SourcewavStore) return;
    global.SourcewavStore.update(next => {
      STORE_FIELDS.forEach(key => { next[key] = state[key]; });
    });
  };

  function loadFeaturesState() {
    const stored = global.SourcewavStore ? global.SourcewavStore.getState() : {};
    const legacy = readLegacy();
    let seed = false;
    if (hasFeatureData(stored)) adoptState(stored);
    else if (hasFeatureData(legacy)) { adoptState(legacy); seed = true; }
    else { adoptState(seedDefaults()); seed = true; }
    try { localStorage.removeItem(STORE_KEY); } catch (_) {}
    if (seed) persistToStore();
    return state;
  }

  let selfWrite = false;
  loadFeaturesState();

  function saveFeaturesState() {
    updateNotificationBadge();
    selfWrite = true;
    persistToStore();
    selfWrite = false;
  }

  global.addEventListener('sourcewav:store', () => {
    if (selfWrite || !global.SourcewavStore) return;
    adoptState(global.SourcewavStore.getState());
    updateNotificationBadge();
    const api = global.SourcewavFeatures;
    if (api && typeof api.renderAll === 'function') api.renderAll();
  });

  function updateNotificationBadge() {
    const unreadCount = state.dropAlerts.filter(a => !a.read).length;
    const btn = $('#notificationBtn');
    if (btn) {
      const dot = $('i', btn);
      if (dot) {
        dot.classList.toggle('badge-active', unreadCount > 0);
        dot.title = unreadCount > 0 ? `${unreadCount} แจ้งเตือนใหม่` : '';
      }
    }
    const leftRailDropCount = $('#leftRailDropCount');
    if (leftRailDropCount) {
      leftRailDropCount.textContent = unreadCount || '0';
    }
  }

  const core = { $, $$, esc, money, toast, showModal, closeModal, state, saveFeaturesState, updateNotificationBadge, STORE_FIELDS };
  global.SourcewavFeaturesCore = core;
})(window);
