const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const backdrop=$('#modalBackdrop'), content=$('#modalContent'), toastEl=$('#toast');let toastTimer;
const mainNav=$('.main-nav'),navLinks=$$('.nav-link'),navIndicator=$('.nav-indicator');
function setActiveNav(link){if(!link)return;navLinks.forEach(item=>item.classList.toggle('active',item===link));if(navIndicator){navIndicator.style.width=`${link.offsetWidth}px`;navIndicator.style.transform=`translateX(${link.offsetLeft}px)`}}
navLinks.forEach(link=>link.addEventListener('click',()=>setActiveNav(link)));
const initialNav=navLinks.find(link=>link.hash===window.location.hash)||navLinks.find(link=>link.classList.contains('active'));
setActiveNav(initialNav);window.addEventListener('resize',()=>setActiveNav(navLinks.find(link=>link.classList.contains('active'))));
const rail=$('.left-rail'),railItems=$$('.left-rail .rail-item');
let railIndicator;
function setActiveRail(link){
  if(!link||!rail)return;
  railItems.forEach(item=>{const active=item===link;item.classList.toggle('active',active);item.setAttribute('aria-current',active?'page':'false')});
  if(!railIndicator){railIndicator=document.createElement('span');railIndicator.className='rail-active-indicator';railIndicator.setAttribute('aria-hidden','true');rail.append(railIndicator)}
  railIndicator.style.height=`${link.offsetHeight}px`;
  railIndicator.style.transform=`translateY(${link.offsetTop}px)`;
}
railItems.forEach(link=>link.addEventListener('click',()=>setActiveRail(link)));
function syncRailToHash(){const match=railItems.find(link=>link.hash===window.location.hash)||railItems.find(link=>link.classList.contains('active'));if(match)setActiveRail(match)}
syncRailToHash();window.addEventListener('hashchange',syncRailToHash);window.addEventListener('resize',()=>setActiveRail(railItems.find(link=>link.classList.contains('active'))));
/* --------------------------------------------------------------------------
   แผนที่สถานที่จัดงาน — Leaflet + OpenStreetMap
   ข้อมูลชื่อ ที่อยู่ และพิกัดตรวจสอบจากเว็บไซต์ทางการ/OpenStreetMap
   ณ วันที่ 21 ตุลาคม 2026
   เพิ่มสถานที่ใหม่: เพิ่ม object ใน bangkokVenues ด้านล่าง (id ต้องไม่ซ้ำ)
   เพิ่มอีเวนต์: เพิ่มใน venueEvents เมื่อมีแหล่งยืนยันแล้วเท่านั้น
   ห้ามใช้ status: 'ongoing' หากยังไม่มีการยืนยันจากแหล่งข้อมูล
--------------------------------------------------------------------------- */
const bangkokVenues = [
  {
    id: 'avve',
    name: 'AVVE · 5-Storey Event Space',
    category: 'music',
    categoryLabel: 'ดนตรีสด / Event Space',
    district: 'วัฒนา',
    address: '3/25 Edison Alley (ซอยปรีดีพนมยงค์ 1), แขวงพระโขนงเหนือ 10110',
    lat: 13.7144532,
    lng: 100.5940104,
    url: 'https://www.instagram.com/avvebaravve/',
    linkLabel: 'Instagram',
    photoUrl: 'https://bangkok-nights.s3.amazonaws.com/venues/avve/gallery/1772960798706-1.jpg',
    photoSource: 'Bangkok Nights',
    photoPage: 'https://bangkok-nights.com/venue/avve'
  },
  {
    id: 'poison-door',
    name: 'POISON DOOR',
    category: 'music',
    categoryLabel: 'ดนตรีสด / Alternative',
    district: 'สะพานสูง',
    address: 'SRP Garden, 55 ซอยกรุงเทพกรีฑา 32 แขวงทับช้าง 10700',
    lat: 13.7347202,
    lng: 100.692403,
    url: 'https://www.instagram.com/poison.door/',
    linkLabel: 'Instagram',
    status: 'closed',
    photoUrl: 'https://p16-lemon8-cross-sign.tiktokcdn.com/tos-alisg-v-a3e477-sg/ok5QOKgafEE2DhD3AB20AJC28iBUieAwoHAIYx~tplv-tej9nj120t-wap-logo:QHBpcGVyX3BpcGU=:1080:0.webp?lk3s=66c60501&source=wap_large_logo_image&x-expires=1793296800&x-signature=qJoMLf4Imt678MwkpVfgXgzT86s%3D',
    photoSource: 'Piper BLack · Lemon8',
    photoPage: 'https://www.lemon8-app.com/@piper_pipe/7552800730696925712?region=th'
  },
  {
    id: 'attitude-fusion',
    name: 'Attitude.Fusion · 4th Floor',
    category: 'music',
    categoryLabel: 'ดนตรีสด / Rooftop',
    district: 'บางรัก',
    address: '1204 ถนนเจริญกรุง แขวงบางรัก 10500',
    lat: 13.7258039,
    lng: 100.5161133,
    url: 'https://fusionattitude.wixsite.com/attitude-fusion-roof',
    linkLabel: 'เว็บไซต์สถานที่',
    photoUrl: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/29/49/8c/9c/attitude-fusion-3-n-1.jpg?h=500&s=1&w=900',
    photoSource: 'Tripadvisor',
    photoPage: 'https://www.tripadvisor.com/Restaurant_Review-g293916-d25077558-Reviews-Attitude_Fusion_Tapas_Rooftop_Bar-Bangkok.html'
  },
  {
    id: 'redhotmoon',
    name: 'REDHOTMOON LIVEHOUSE · DECOMMUNE',
    category: 'music',
    categoryLabel: 'Livehouse · ดนตรีสด',
    district: 'เมืองปทุมธานี',
    province: 'ปทุมธานี',
    areaLabel: 'อำเภอเมืองปทุมธานี · ปทุมธานี',
    address: '901/8 Ruamsuk 5/6, Ban Mai, Mueang Pathum Thani 12000',
    lat: 13.9589053,
    lng: 100.5677547,
    url: 'https://www.instagram.com/redhotmoonlivehouse/',
    linkLabel: 'Instagram',
    photoUrl: 'https://media.timeout.com/images/106388635/750/422/image.jpg',
    photoSource: 'Time Out',
    photoPage: 'https://www.timeout.com/bangkok/music/redhotmoon-livehouse'
  },
  {
    id: 'gearbox-red-drum',
    name: 'GEAR BOX · THE WAREHOUSE',
    category: 'music',
    categoryLabel: 'คลับ / ดนตรีอิเล็กทรอนิกส์',
    district: 'ตลาดน้อย',
    address: 'ชั้น 3 The Warehouse Bangkok, 867 ถนนเจริญกรุง, ตลาดน้อย 10100',
    lat: 13.7338215,
    lng: 100.5144907,
    url: 'https://www.thewarehousebkk.com/spaces/gear-box',
    linkLabel: 'เว็บไซต์สถานที่',
    photoUrl: 'https://image.nightify.co/raWezVjKFZslSlI8rihl2gRlzNYJnxCtpYMr0g4aL64/rs%3Afill%3A1080%3A1080%3A0/czM6Ly9uaWdodGlmeS1hc3NldHMtcHJvZC9pbWFnZXMvZ2VhcmJveC1zVEtuQnQud2VicA.webp',
    photoSource: 'Nightify',
    photoPage: 'https://nightify.co/venues/gearbox'
  }
];

// อีเวนต์จะถูกเพิ่มที่นี่เมื่อมีแหล่งยืนยันแล้วเท่านั้น
// ตัวอย่างรูปแบบ: { venueId:'blueprint', title:'...', start:'2026-10-24T20:00:00+07:00', end:'...', status:'confirmed', sourceUrl:'https://...' }
const venueEvents = [];

const venueFilters = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'music', label: 'ดนตรี' },
  { id: 'art', label: 'ศิลปะ' }
];

const bangkokMapConfig = {
  center: [13.79, 100.54],
  zoom: 11,
  maxBounds: [[13.55, 100.28], [14.03, 100.83]],
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
};
const emptyMapTile = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

let activeMapFilter = 'all';
let activeVenueId = null;
let bangkokMap = null;
let fullMapInstance = null;
let lastFocusedModalTrigger = null;
let previewMapGeneration = 0;
let fullMapGeneration = 0;
const sourceMaps = [];

const escapeMapHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

const filteredVenues = () => bangkokVenues.filter(venue => activeMapFilter === 'all' || venue.category === activeMapFilter);
const venueCategoryMark = category => category === 'music' ? '♫' : '✳';

function offlineMapMessage() {
  return 'คุณกำลังออฟไลน์อยู่ — แผนที่ต้องเชื่อมต่ออินเทอร์เน็ต ลองเชื่อมต่อแล้วกดลองใหม่';
}

function mapLoadErrorMessage() {
  return navigator.onLine
    ? 'โหลดแผนที่ถนนไม่ได้ ลองใหม่อีกครั้ง หรือเลือกรายชื่อสถานที่ด้านล่างเพื่อเปิดเส้นทาง'
    : `${offlineMapMessage()} รายชื่อสถานที่ยังเปิดดูได้`;
}

function venueIcon(venue) {
  return L.divIcon({
    className: 'sourcewav-marker-shell',
    html: `<span class="sourcewav-marker ${venue.category}" aria-hidden="true">${venueCategoryMark(venue.category)}</span>`,
    iconSize: [30, 34],
    iconAnchor: [15, 31],
    popupAnchor: [0, -29]
  });
}

function venuePopup(venue) {
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`;
  const area = venue.areaLabel || `เขต${venue.district} · ${venue.province || 'กรุงเทพมหานคร'}`;
  const status = venue.status === 'closed' ? '<span class="popup-status closed">ปิดถาวร · ตรวจสอบก่อนเดินทาง</span>' : '';
  const followed = window.SourcewavFeaturesCore?.state.followedVenues?.includes(venue.id);
  return `<article class="map-popup"><span class="popup-category ${venue.category}">${escapeMapHtml(venue.categoryLabel)}</span>${status}<h3>${escapeMapHtml(venue.name)}</h3><p>${escapeMapHtml(venue.address)}<br>${escapeMapHtml(area)}</p><div class="popup-links"><a href="${directions}" target="_blank" rel="noopener noreferrer">เปิดเส้นทาง ↗</a><a href="${escapeMapHtml(venue.url)}" target="_blank" rel="noopener noreferrer">${escapeMapHtml(venue.linkLabel || 'เว็บไซต์ทางการ')} ↗</a></div><button type="button" class="venue-follow-btn" data-follow-venue="${venue.id}" data-venue-name="${escapeMapHtml(venue.name)}" aria-pressed="${Boolean(followed)}" style="margin-top: 8px; width: 100%; background: #172a40; color: #d7fa48; border: 0; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: 600; cursor: pointer;">${followed ? '✓ กำลังติดตาม' : '＋ ติดตามสถานที่นี้ (รับ Drop Alert)'}</button></article>`;
}

function filterButtonsMarkup() {
  return venueFilters.map(filter => `<button class="map-filter ${activeMapFilter === filter.id ? 'active' : ''}" type="button" data-map-filter="${filter.id}" aria-pressed="${activeMapFilter === filter.id}">${filter.label}</button>`).join('');
}

function mapLegendMarkup() {
  return '<div class="map-legend" aria-label="คำอธิบายหมุดบนแผนที่"><span><i class="legend-dot music" aria-hidden="true"></i>ดนตรี</span><span><i class="legend-dot art" aria-hidden="true"></i>ศิลปะ</span></div>';
}

function mapCreditMarkup() {
  return '<p class="map-credit">แผนที่โดย <a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a> · ข้อมูล © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></p>';
}

function mapSourceMarkup() {
  return '<p class="map-source">ข้อมูลสถานที่จากแหล่งสาธารณะและลิงก์บัญชีของสถานที่ · ยังไม่แสดงอีเวนต์ที่ไม่มีแหล่งยืนยัน</p>';
}

function updateMapCounts(count) {
  const mapCount = $('#mapCount');
  if (mapCount) mapCount.textContent = `สถานที่เคยจัดงาน · ${count} แห่ง`;
  const fullMapCount = $('#fullMapCount');
  if (fullMapCount) fullMapCount.textContent = String(count);
}

function renderVenueList(containerId = 'venueList') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const matches = filteredVenues();
  if (activeVenueId && !matches.some(venue => venue.id === activeVenueId)) activeVenueId = null;
  container.innerHTML = matches.length
    ? matches.map(venue => {
      const active = activeVenueId === venue.id;
      const area = venue.areaLabel || `เขต${venue.district} · ${venue.province || 'กรุงเทพมหานคร'}`;
      const closed = venue.status === 'closed' ? ' · ปิดถาวร' : '';
      const directions = `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`;
      return `<article class="venue-row ${active ? 'is-active' : ''}" data-venue-id="${escapeMapHtml(venue.id)}" style="--venue-image:url(&quot;${escapeMapHtml(venue.photoUrl)}&quot;)"><button class="venue-select" type="button" aria-pressed="${active}" aria-label="ดู ${escapeMapHtml(venue.name)} บนแผนที่"><span class="venue-type ${venue.category}" aria-hidden="true">${venueCategoryMark(venue.category)}</span><span class="venue-copy"><strong>${escapeMapHtml(venue.name)}</strong><small>${escapeMapHtml(venue.categoryLabel)} · ${escapeMapHtml(area)}${closed}</small></span><span class="venue-arrow" aria-hidden="true">⌖</span></button><a class="venue-directions" href="${directions}" target="_blank" rel="noopener noreferrer" aria-label="เปิดเส้นทางไป ${escapeMapHtml(venue.name)} ใน Google Maps" title="เปิดเส้นทาง">↗</a><a class="venue-photo-credit" href="${escapeMapHtml(venue.photoPage)}" target="_blank" rel="noopener noreferrer" aria-label="ที่มาภาพ: ${escapeMapHtml(venue.photoSource)}">ภาพ: ${escapeMapHtml(venue.photoSource)}</a></article>`;
    }).join('')
    : '<p class="venue-empty">ไม่พบสถานที่ในหมวดนี้</p>';
  updateMapCounts(matches.length);
}

function toggleMarkerActive(marker, active) {
  const element = marker.getElement();
  if (element) element.classList.toggle('is-active', Boolean(active));
}

function setActiveVenue(venueId) {
  activeVenueId = venueId;
  $$('.venue-row').forEach(row => {
    const active = row.dataset.venueId === venueId;
    row.classList.toggle('is-active', active);
    const select = row.querySelector('.venue-select');
    if (select) select.setAttribute('aria-pressed', String(active));
  });
  sourceMaps.forEach(map => {
    Object.entries(map.venueMarkers || {}).forEach(([id, marker]) => toggleMarkerActive(marker, id === venueId));
  });
}

function renderMapMarkers(map) {
  if (!map || !map.venueLayer) return;
  map.closePopup();
  map.venueLayer.clearLayers();
  map.venueMarkers = {};
  filteredVenues().forEach(venue => {
    const marker = L.marker([venue.lat, venue.lng], {
      icon: venueIcon(venue),
      title: venue.name,
      alt: venue.name,
      keyboard: true,
      riseOnHover: true,
      autoPanOnFocus: true
    }).bindPopup(venuePopup(venue), {
      maxWidth: 300,
      minWidth: 230,
      autoPanPadding: [18, 18],
      className: 'sourcewav-popup'
    });
    marker.on('click', () => setActiveVenue(venue.id));
    marker.on('popupopen', () => setActiveVenue(venue.id));
    marker.on('add', () => {
      const element = marker.getElement();
      if (element) {
        element.setAttribute('aria-label', `${venue.name} — ${venue.categoryLabel} — เปิดรายละเอียด`);
        element.setAttribute('role', 'button');
      }
      toggleMarkerActive(marker, venue.id === activeVenueId);
    });
    marker.bindTooltip(venue.name, {
      direction: 'top',
      offset: [0, -28],
      opacity: 0.95,
      className: 'sourcewav-tooltip'
    });
    marker.addTo(map.venueLayer);
    map.venueMarkers[venue.id] = marker;
  });
}

window.SourcewavMap = {
  refreshVenueFollows() {
    sourceMaps.forEach(map => renderMapMarkers(map));
  }
};

function fitMapToVenues(map) {
  if (!map) return;
  const venues = filteredVenues();
  if (!venues.length) return;
  const bounds = L.latLngBounds(venues.map(venue => [venue.lat, venue.lng]));
  map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12, animate: false });
}

function showMapError(targetId = 'mapError', message = '') {
  const target = document.getElementById(targetId);
  if (!target) return;
  const text = target.querySelector('.map-error-text');
  const retry = target.querySelector('[data-map-retry]');
  if (text) text.textContent = message || mapLoadErrorMessage();
  if (retry) retry.textContent = window.L ? 'ลองใหม่' : 'โหลดหน้าใหม่';
  target.hidden = false;
}

function hideMapError(targetId) {
  const target = document.getElementById(targetId);
  if (target) target.hidden = true;
}

function removeMapFromSources(map) {
  const index = sourceMaps.indexOf(map);
  if (index > -1) sourceMaps.splice(index, 1);
}

function createBangkokMap(elementId, options = {}) {
  if (!window.L) return null;
  const element = document.getElementById(elementId);
  if (!element) return null;
  element.replaceChildren();
  element.classList.remove('map-tiles-unavailable');
  const isFull = Boolean(options.full);
  const errorId = isFull ? 'fullMapError' : 'mapError';
  const map = L.map(elementId, {
    zoomControl: true,
    scrollWheelZoom: false,
    touchZoom: true,
    dragging: true,
    doubleClickZoom: true,
    boxZoom: true,
    keyboard: true,
    minZoom: 10,
    maxZoom: 18,
    maxBounds: bangkokMapConfig.maxBounds,
    maxBoundsViscosity: 0.9
  }).setView(bangkokMapConfig.center, bangkokMapConfig.zoom);
  const tiles = L.tileLayer(bangkokMapConfig.tileUrl, {
    minZoom: 10,
    maxZoom: 19,
    errorTileUrl: emptyMapTile,
    attribution: bangkokMapConfig.attribution
  }).addTo(map);
  if (map.attributionControl) {
    map.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a>');
  }
  const generation = isFull ? ++fullMapGeneration : ++previewMapGeneration;
  const isCurrentMap = () => isFull ? fullMapGeneration === generation : previewMapGeneration === generation;
  map._tilesLoaded = false;
  map._offline = !navigator.onLine;
  let loadedTiles = 0;
  let tileErrors = 0;
  let tileFallbackShown = false;
  const showTileFallback = message => {
    if (!isCurrentMap() || tileFallbackShown) return;
    tileFallbackShown = true;
    tiles.setOpacity(0);
    element.classList.add('map-tiles-unavailable');
    showMapError(errorId, message || 'โหลดแผนที่ถนนไม่ได้ แต่ยังเลือกรายชื่อสถานที่และเปิดเส้นทางได้');
  };
  const errorTimer = setTimeout(() => {
    if (!isCurrentMap() || (loadedTiles && tileErrors < 3)) return;
    showTileFallback(mapLoadErrorMessage());
  }, 8000);
  tiles.on('tileload', () => {
    if (!isCurrentMap()) return;
    loadedTiles += 1;
    map._tilesLoaded = true;
    if (!tileFallbackShown) {
      if (navigator.onLine) hideMapError(errorId);
      else showTileFallback(offlineMapMessage());
    }
  });
  tiles.on('tileerror', () => {
    if (!isCurrentMap()) return;
    tileErrors += 1;
    if (!navigator.onLine) {
      showTileFallback(offlineMapMessage());
      return;
    }
    if (tileErrors >= 3) showTileFallback(mapLoadErrorMessage());
  });
  map.on('remove', () => {
    clearTimeout(errorTimer);
    if (isFull) {
      if (fullMapGeneration === generation) fullMapGeneration += 1;
    } else if (previewMapGeneration === generation) {
      previewMapGeneration += 1;
    }
  });
  map.on('click', () => setActiveVenue(null));
  map.venueLayer = L.layerGroup().addTo(map);
  map.venueMarkers = {};
  renderMapMarkers(map);
  sourceMaps.push(map);
  if (!navigator.onLine) showMapError(errorId, offlineMapMessage());
  if (isFull) {
    requestAnimationFrame(() => {
      map.invalidateSize();
      fitMapToVenues(map);
    });
  }
  return map;
}

function retryMap(targetId) {
  hideMapError(targetId === 'fullBangkokMap' ? 'fullMapError' : 'mapError');
  if (!window.L) {
    window.location.reload();
    return;
  }
  if (targetId === 'bangkokMap') {
    if (bangkokMap) {
      bangkokMap.remove();
      removeMapFromSources(bangkokMap);
      bangkokMap = null;
    }
    bangkokMap = createBangkokMap('bangkokMap');
    if (bangkokMap) requestAnimationFrame(() => bangkokMap.invalidateSize());
    return;
  }
  if (targetId === 'fullBangkokMap' && document.getElementById('fullBangkokMap')) {
    if (fullMapInstance) {
      fullMapInstance.remove();
      removeMapFromSources(fullMapInstance);
      fullMapInstance = null;
    }
    fullMapInstance = createBangkokMap('fullBangkokMap', { full: true });
    if (fullMapInstance) {
      fullMapInstance.invalidateSize();
      fitMapToVenues(fullMapInstance);
    }
  }
}

function applyMapFilter(filter) {
  if (!venueFilters.some(item => item.id === filter)) filter = 'all';
  activeMapFilter = filter;
  $$('.map-filter').forEach(button => {
    const active = button.dataset.mapFilter === filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const matches = filteredVenues();
  if (activeVenueId && !matches.some(venue => venue.id === activeVenueId)) activeVenueId = null;
  sourceMaps.forEach(renderMapMarkers);
  if (bangkokMap) fitMapToVenues(bangkokMap);
  renderVenueList('venueList');
  renderVenueList('fullVenueList');
  if (fullMapInstance) {
    fitMapToVenues(fullMapInstance);
    setTimeout(() => {
      if (!fullMapInstance) return;
      fullMapInstance.invalidateSize();
      fitMapToVenues(fullMapInstance);
    }, 40);
  }
}

function selectVenue(venueId) {
  const venue = bangkokVenues.find(item => item.id === venueId);
  if (!venue) return;
  const modalOpen = backdrop.classList.contains('open');
  const targetMap = modalOpen ? fullMapInstance : bangkokMap;
  if (!targetMap) {
    showMapError(modalOpen ? 'fullMapError' : 'mapError');
    return;
  }
  setActiveVenue(venue.id);
  targetMap.invalidateSize();
  const marker = targetMap.venueMarkers && targetMap.venueMarkers[venue.id];
  if (marker) {
    targetMap.setView([venue.lat, venue.lng], Math.max(targetMap.getZoom(), 15), { animate: true });
    marker.openPopup();
  }
  const mapContainer = targetMap.getContainer();
  if (mapContainer) {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    mapContainer.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }
  const row = [...document.querySelectorAll('.venue-row')].find(item => item.dataset.venueId === venue.id);
  if (row) row.scrollIntoView({ block: 'nearest' });
}

function openFullMap() {
  const visibleCount = filteredVenues().length;
  openModal(`<div class="map-modal-heading"><div><span class="section-kicker">แผนที่สถานที่จัดงาน</span><h2 id="modalTitle">กรุงเทพฯ และปริมณฑล</h2><p>ลากหรือซูมแผนที่ คลิกหมุด หรือเลือกรายชื่อเพื่อดูเส้นทาง</p></div><span class="map-scope">กรุงเทพฯ · ปริมณฑล</span></div><div class="map-controls" role="group" aria-label="กรองประเภทสถานที่">${filterButtonsMarkup()}</div>${mapLegendMarkup()}<div class="map-canvas"><div id="fullBangkokMap" class="bangkok-map map-large" role="application" aria-label="แผนที่แบบโต้ตอบของกรุงเทพมหานครและปริมณฑล"></div><div id="fullMapError" class="map-error" role="alert" hidden><span class="map-error-text">โหลดแผนที่ไม่ได้ ตรวจสอบการเชื่อมต่อ แล้วลองใหม่</span><button class="map-retry" type="button" data-map-retry="fullBangkokMap">ลองใหม่</button></div></div>${mapCreditMarkup()}<div class="map-modal-footer"><span>แสดง <b id="fullMapCount">${visibleCount}</b> สถานที่ในกรุงเทพฯ และปริมณฑล</span><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">รายงานปัญหาแผนที่ ↗</a></div><div class="venue-list venue-list-wide" id="fullVenueList" aria-label="รายชื่อสถานที่บนแผนที่"></div>${mapSourceMarkup()}`, { mapModal: true, trigger: document.getElementById('mapBtn') });
  renderVenueList('fullVenueList');
  if (!window.L) {
    showMapError('fullMapError', 'โหลดไลบรารีแผนที่ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วโหลดหน้าใหม่');
    return;
  }
  if (!navigator.onLine) showMapError('fullMapError', offlineMapMessage());
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!document.getElementById('fullBangkokMap')) return;
    fullMapInstance = createBangkokMap('fullBangkokMap', { full: true });
    if (fullMapInstance) {
      fullMapInstance.invalidateSize();
      fitMapToVenues(fullMapInstance);
      setTimeout(() => {
        if (!fullMapInstance) return;
        fullMapInstance.invalidateSize();
        fitMapToVenues(fullMapInstance);
      }, 140);
    }
  }));
}

if (window.L) {
  bangkokMap = createBangkokMap('bangkokMap');
  renderVenueList();
  requestAnimationFrame(() => {
    if (bangkokMap) {
      bangkokMap.invalidateSize();
      fitMapToVenues(bangkokMap);
    }
  });
  window.addEventListener('load', () => {
    if (bangkokMap) {
      bangkokMap.invalidateSize();
      fitMapToVenues(bangkokMap);
    }
  });
} else {
  renderVenueList();
  showMapError('mapError', 'โหลดไลบรารีแผนที่ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วโหลดหน้าใหม่');
}

window.addEventListener('offline', () => {
  if (!window.L) return;
  if (!bangkokMap || !bangkokMap._tilesLoaded) showMapError('mapError', offlineMapMessage());
  if (fullMapInstance && !fullMapInstance._tilesLoaded) showMapError('fullMapError', offlineMapMessage());
});

window.addEventListener('online', () => {
  if (!window.L) return;
  hideMapError('mapError');
  hideMapError('fullMapError');
  if (!bangkokMap || !bangkokMap._tilesLoaded || bangkokMap._offline) retryMap('bangkokMap');
  if (fullMapInstance && (!fullMapInstance._tilesLoaded || fullMapInstance._offline)) retryMap('fullBangkokMap');
});

$('#mapBtn').addEventListener('click', openFullMap);

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const retry = target.closest('[data-map-retry]');
  if (retry) {
    retryMap(retry.dataset.mapRetry);
    return;
  }
  const filter = target.closest('.map-filter');
  if (filter) {
    applyMapFilter(filter.dataset.mapFilter);
    return;
  }
  const venueButton = target.closest('.venue-select');
  if (venueButton) selectVenue(venueButton.closest('.venue-row')?.dataset.venueId);
});

function toast(message){toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),2500)}
function openModal(html, options = {}) {
  const modal = $('.modal');
  if (modal) modal.classList.toggle('map-modal', Boolean(options.mapModal));
  if (modal) modal.classList.toggle('account-modal', Boolean(options.accountModal));
  lastFocusedModalTrigger = options.trigger instanceof HTMLElement ? options.trigger : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  content.innerHTML = html;
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  const close = $('#modalClose');
  if (close) close.focus();
}

function closeModal() {
  if (!backdrop.classList.contains('open')) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  const modal = $('.modal');
  if (modal) modal.classList.remove('map-modal', 'account-modal');
  if (fullMapInstance) {
    fullMapInstance.remove();
    removeMapFromSources(fullMapInstance);
    fullMapInstance = null;
  }
  const trigger = lastFocusedModalTrigger;
  lastFocusedModalTrigger = null;
  if (trigger && document.contains(trigger)) trigger.focus();
}
$('#modalClose').addEventListener('click',closeModal);backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('#chatPanel').classList.remove('open');$('#chatPanel').dataset.liveBound='';$('#chatPanel').classList.remove('has-active-chat');$('#chatBtn')?.focus()}});
const postModal=()=>openModal(`<h2 id="modalTitle">เขียนโพสต์ใหม่</h2><p>เล่าเรื่องที่อยากให้คนในวงการได้ยิน</p><label class="modal-field">หัวข้อ<input placeholder="โพสต์เรื่องอะไรดี?" /></label><label class="modal-field">เรื่องของคุณ<textarea placeholder="แชร์ไอเดีย เดโม งานที่กำลังหาเพื่อนทำ หรือเรื่องที่อยากคุย..."></textarea></label><label class="modal-field">หมวดหมู่<select><option>เพลง</option><option>ศิลปะ</option><option>พูดคุย</option></select></label><button class="modal-primary" id="publishBtn">โพสต์ให้วงในเห็น</button>`);
$('#writePostBtn').addEventListener('click',postModal);$('#composerInput').addEventListener('click',postModal);$('#composerSend').addEventListener('click',postModal);$('#joinBtn').addEventListener('click',postModal);
$('#searchBtn').addEventListener('click',()=>openModal(`<h2 id="modalTitle">ค้นหา Sourcewav</h2><p>ค้นหาเพื่อน งาน อีเวนต์ และบทสนทนา</p><label class="modal-field">คำค้น<input autofocus placeholder="ลองค้นหา “cypher กรุงเทพ”" /></label><button class="modal-primary" id="searchGo">ค้นหา</button>`));
$('#roomBtn').addEventListener('click',()=>openModal(`<h2 id="modalTitle">เปิดห้องคุยใหม่</h2><p>สร้างห้องสาธารณะสำหรับคุยเรื่องเดียวกัน</p><label class="modal-field">ชื่อห้อง<input id="newRoomName" maxlength="58" placeholder="เช่น แชร์เดโมกัน" /></label><label class="modal-field">คุยเรื่องอะไร<textarea id="newRoomDescription" maxlength="500" placeholder="บอกให้คนอื่นรู้ว่าห้องนี้คุยเรื่องอะไร"></textarea></label><button class="modal-primary" id="createRoomBtn">สร้างห้องคุย</button>`));
$$('.buy-btn').forEach(btn=>btn.addEventListener('click',()=>{const title=btn.dataset.event,price=Number(btn.dataset.price);openModal(`<h2 id="modalTitle">ซื้อบัตรเข้างาน</h2><p>ยืนยันรายละเอียดก่อนชำระเงิน</p><div class="checkout-event"><b>${title}</b><div class="checkout-row"><span>บัตรเข้างาน 1 ใบ</span><span>฿${price.toLocaleString()}</span></div><div class="checkout-row"><strong>ยอดชำระ</strong><strong>฿${price.toLocaleString()}</strong></div></div><label class="modal-field">อีเมลสำหรับรับบัตร<input type="email" placeholder="you@example.com" /></label><button class="modal-primary" id="payBtn" data-price="${price}">ชำระผ่าน QR PromptPay</button><p>ระบบตัวอย่าง: ยังไม่มีการตัดเงินจริง</p>`)}));
$('#eventInfoBtn')?.addEventListener('click',()=>openModal(`<h2 id="modalTitle">LOCAL MATTER: ART MARKET</h2><p>ตลาดนัดของคนทำงานภาพ เสียง และสิ่งพิมพ์อิสระ</p><div class="checkout-event"><div class="checkout-row"><span>วันที่</span><b>26 ตุลาคม · 14:00–21:00</b></div><div class="checkout-row"><span>สถานที่</span><b>Warehouse 30, กรุงเทพฯ</b></div><div class="checkout-row"><span>ค่าเข้าชม</span><b>ฟรี</b></div></div><button class="modal-primary" id="rsvpBtn">บันทึกไว้ว่าจะไป</button>`));
$('#chatClose')?.addEventListener('click',()=>$('#chatPanel').classList.remove('open'));$('#newChatBtn')?.addEventListener('click',()=>toast('ค้นหาชื่อผู้ใช้เพื่อเริ่มแชทใหม่'));
$$('.follow-btn').forEach(btn=>btn.addEventListener('click',()=>{const on=btn.classList.toggle('following');btn.textContent=on?'กำลังติดตาม':'ติดตาม';toast(on?'เริ่มติดตามแล้ว':'เลิกติดตามแล้ว')}));
$$('.like-btn').forEach(btn=>btn.addEventListener('click',()=>{const on=btn.classList.toggle('liked'),b=$('b',btn);b.textContent=Number(b.textContent)+(on?1:-1);btn.firstChild.textContent=on?'♥ ':'♡ '}));$$('.save-btn').forEach(btn=>btn.addEventListener('click',()=>{btn.classList.toggle('liked');toast(btn.classList.contains('liked')?'เก็บโพสต์ไว้แล้ว':'นำออกจากรายการที่เก็บไว้แล้ว')}));$$('.comment-btn').forEach(btn=>btn.addEventListener('click',()=>openModal(`<h2 id="modalTitle">ความคิดเห็น</h2><div class="checkout-event"><b>มุก · MC</b><p>ชอบบรรยากาศของงานนี้มาก รอฟังเดโมเต็มเลย</p><b>ตะวัน · TAWAN</b><p>ขอบคุณครับ เดี๋ยวส่งเวอร์ชันใหม่มาให้ฟังอีกที</p></div><label class="modal-field">เขียนความคิดเห็น<textarea placeholder="พิมพ์ความคิดเห็น..."></textarea></label><button class="modal-primary" id="commentSendBtn">ส่งความคิดเห็น</button>`)));$$('.filter-chip').forEach(btn=>btn.addEventListener('click',()=>{$$('.filter-chip').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');$$('.post-card').forEach(post=>post.hidden=btn.dataset.filter!=='all'&&post.dataset.kind!==btn.dataset.filter)}));$$('.play-button').forEach(btn=>btn.addEventListener('click',()=>{btn.textContent=btn.textContent==='▶'?'Ⅱ':'▶';toast(btn.textContent==='Ⅱ'?'กำลังเล่นตัวอย่างเดโม':'หยุดเล่น')}));
$$('.chat-person').forEach(btn=>btn.addEventListener('click',()=>{const name=$('b',btn).textContent;openModal(`<h2 id="modalTitle">แชทกับ ${name}</h2><div class="checkout-event"><p>นี่คือพื้นที่สนทนาส่วนตัวกับ ${name}</p><p>เริ่มบทสนทนาด้วยข้อความสั้นๆ ได้เลย</p></div><label class="modal-field">ข้อความ<textarea placeholder="พิมพ์ข้อความ..."></textarea></label><button class="modal-primary" id="sendMessageBtn">ส่งข้อความ</button>`)}));$('#profileBtn').addEventListener('click',()=>{});
document.addEventListener('click',e=>{if(e.target.id==='publishBtn'){closeModal();toast('โพสต์ของคุณพร้อมเผยแพร่แล้ว (ตัวอย่าง)')}if(e.target.id==='commentSendBtn'){closeModal();toast('ความคิดเห็นถูกเพิ่มแล้ว (ตัวอย่าง)')}if(e.target.id==='payBtn'){const price=Number(e.target.dataset.price);openModal(`<h2 id="modalTitle">สแกนเพื่อชำระเงิน</h2><p>สแกน QR ด้วยแอปธนาคารเพื่อซื้อบัตร (ตัวอย่าง)</p><div class="checkout-event"><div class="checkout-row"><span>ยอดชำระ</span><b>฿${price.toLocaleString()}</b></div><div class="checkout-row"><span>ผู้รับเงิน</span><b>Sourcewav Events</b></div></div><div class="qr-box"><svg viewBox="0 0 21 21" shape-rendering="crispEdges" aria-label="QR code ตัวอย่าง"><rect width="21" height="21" fill="white"/><path fill="#171916" d="M0 0h7v7H0zm1 1v5h5V1zm1 1h3v3H2zM14 0h7v7h-7zm1 1v5h5V1zm1 1h3v3h-3zM0 14h7v7H0zm1 1v5h5v-5zm1 1h3v3H2zM9 0h2v2H9zm0 4h2v2H9zm2 2h2v2h-2zm-3 2h2v2H8zm4 0h2v3h-2zm-4 3h3v2H8zm5 1h2v2h-2zm-4 2h2v2H9zm3 2h2v2h-2zm3-6h2v2h-2zm2 2h2v2h-2zm-1 3h2v2h-2zm2 3h3v2h-3zm-7 0h2v2h-2z"/></svg></div><div class="payment-note">QR นี้เป็นภาพตัวอย่าง ยังไม่สามารถใช้ชำระเงินจริงได้ เมื่อพัฒนาระบบจริงจะเชื่อม PromptPay/Payment Gateway พร้อมยืนยันรายการอัตโนมัติ</div><button class="modal-primary" id="confirmPayBtn">ฉันชำระแล้ว</button>`)}if(e.target.id==='confirmPayBtn'){closeModal();toast('รับรายการแล้ว — บัตรตัวอย่างถูกบันทึกในบัญชี')}if(e.target.id==='rsvpBtn'){closeModal();toast('บันทึกอีเวนต์ไว้แล้ว')}if(e.target.id==='sendMessageBtn'){closeModal();toast('ส่งข้อความแล้ว (ตัวอย่าง)')}if(e.target.id==='editProfileBtn'){closeModal();toast('เปิดหน้าแก้ไขโปรไฟล์ (ตัวอย่าง)')}});
