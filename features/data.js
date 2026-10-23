/* Supabase repository for live features 5–8. */
(function (global) {
  'use strict';
  const Core = global.SourcewavFeaturesCore;
  const state = Core.state;
  const CATEGORY_LABELS = {
    merch: 'เสื้อผ้า & Merch', tape_cd: 'เทปคาสเซ็ท / ซีดี',
    beats: 'Beat & Sample Pack (ดิจิทัล)', art: 'Artwork & สิ่งพิมพ์', other: 'สินค้าอื่นๆ'
  };
  const ROLE_LABELS = {
    dj: 'DJ / เปิดเพลง', rapper: 'Rapper / MC', producer: 'Producer / Beatmaker',
    photographer: 'Photographer / Video', editor: 'Editor / ตัดต่อวิดีโอ', tattooist: 'Tattooist / ช่างสัก',
    vj: 'VJ / Visual Artist', crew: 'Sound Engineer / ทีมจัดงาน', organizer: 'Organizer / ผู้จัดงาน', other: 'ศิลปิน'
  };
  let db = null;
  let user = null;
  let status = 'connecting';
  let organizerEvents = [];

  const fail = (error, context) => {
    console.error(`Sourcewav ${context}:`, error?.message || error);
    throw error;
  };
  const checked = (result, context) => {
    if (result.error) fail(result.error, context);
    return result.data;
  };
  const profileName = (profiles, id, fallback = '') => profiles.get(id)?.display_name || fallback;
  const profileHandle = (profiles, id) => profiles.get(id)?.username || '';
  const fromCard = (row, profiles) => ({
    id: row.id, artistId: row.artist_id, artistName: row.stage_name,
    handle: profileHandle(profiles, row.artist_id), role: row.role, roleLabel: row.role_label,
    avatarUrl: profiles.get(row.artist_id)?.avatar_url || '',
    rate: Number(row.rate_minor) / 100, rateUnit: row.rate_unit,
    availability: row.availability_note, availableStatus: row.is_immediate ? 'ready' : 'busy',
    city: row.city, bio: row.bio, portfolioTitle: row.portfolio_sample,
    portfolioImageUrl: row.portfolio_image_url || '',
    portfolioAudioUrl: row.portfolio_audio_url || '',
    isPro: Boolean(row.is_pro), gigsCompleted: Number(row.gigs_completed || 0),
    avatarChar: row.stage_name?.charAt(0) || 'S'
  });
  const fromOffer = row => ({
    id: row.id, cardId: row.card_id, clientId: row.client_id,
    artistName: '', clientName: row.client_name, clientContact: row.client_contact,
    eventTitle: row.event_title, eventDate: row.event_date, venueLocation: row.venue_location,
    roleNeeded: row.role_needed, offeredBudget: Number(row.offered_budget_minor) / 100,
    commissionRate: Number(row.commission_rate), commissionAmount: Number(row.commission_minor) / 100,
    artistPayout: Number(row.artist_payout_minor) / 100, details: row.details,
    status: row.status, createdAt: row.created_at
  });
  const fromDrop = (row, read, profiles) => ({
    id: row.id, creatorId: row.creator_id, type: row.drop_type, title: row.title,
    creatorName: profileName(profiles, row.creator_id, 'Sourcewav'),
    creatorHandle: profileHandle(profiles, row.creator_id),
    details: row.detail_text, detailText: row.detail_text, actionLabel: row.action_label,
    actionUrl: row.action_url, actionType: row.drop_type, actionTarget: row.action_url,
    timestamp: new Date(row.created_at).toLocaleString('th-TH'), createdAt: row.created_at,
    isPromoted: Boolean(row.is_promoted), promoTag: row.is_promoted ? 'SPONSORED' : '',
    badgeLabel: row.is_promoted ? 'สปอนเซอร์' : '', read
  });
  const fromProduct = (row, profiles) => ({
    id: row.id, artistId: row.artist_id,
    artistName: profileName(profiles, row.artist_id, 'ศิลปิน'),
    artistHandle: profileHandle(profiles, row.artist_id), title: row.title,
    category: row.category, categoryLabel: CATEGORY_LABELS[row.category] || 'สินค้า',
    type: row.product_type, price: Number(row.price_minor) / 100, stock: row.stock,
    imageUrl: row.image_url, previewAudioUrl: row.preview_audio_url,
    digitalAssetKey: row.digital_asset_key, description: row.description,
    salesCount: Number(row.sales_count || 0), platformFeePercent: Number(row.platform_fee_percent)
  });
  const fromStoreOrder = (row, productMap, profiles) => {
    const product = productMap.get(row.product_id);
    return {
      id: row.id, productId: row.product_id, productTitle: product?.title || 'สินค้า',
      artistName: product?.artistName || 'ศิลปิน', artistId: product?.artistId || '', buyerId: row.buyer_id,
      price: Number(row.price_minor) / 100,
      platformFee: Number(row.platform_fee_minor) / 100,
      artistEarnings: Number(row.artist_payout_minor) / 100,
      type: row.product_type, status: row.status, buyerContact: row.buyer_contact,
      shippingAddress: row.shipping_address, createdAt: row.created_at,
      buyerName: profileName(profiles, row.buyer_id, '')
    };
  };

  function setNotice(message) {
    let notice = document.getElementById('featureDatabaseStatus');
    const host = document.querySelector('#bookingCardsGrid')?.closest('section');
    if (!host) return;
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'featureDatabaseStatus';
      notice.setAttribute('role', 'status');
      notice.style.cssText = 'margin:12px 0;padding:12px 16px;border:1px solid #f2c47c;border-radius:10px;background:#fff8e8;color:#72501b;font-size:13px;line-height:1.5';
      host.prepend(notice);
    }
    notice.textContent = message;
    notice.hidden = !message;
  }

  async function currentUser() {
    if (!db) {
      Core.toast('ยังเชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่เมื่อออนไลน์');
      return null;
    }
    const result = await db.auth.getUser();
    if (result.error) fail(result.error, 'auth.getUser');
    user = result.data.user;
    if (!user) {
      Core.toast('เข้าสู่ระบบก่อนใช้งาน');
      document.querySelector('#profileBtn')?.click();
      return null;
    }
    return user;
  }

  async function loadOrganizerEvent(eventId) {
    if (!db || !user || !eventId) {
      state.eventCommand = { eventId: '', eventTitle: '', title: '', expenses: [], crewList: [], ticketsSold: 0, ticketCapacity: 0, grossTicketRevenue: 0, checkedInCount: 0, ticketPriceAverage: 0, postEventSummary: { peakHour: 'ยังไม่มีข้อมูล', notes: 'ยังไม่มีบันทึกสรุปผล' } };
      return state.eventCommand;
    }
    const [expensesResult, crewResult, summaryResult, metricsResult] = await Promise.all([
      db.from('event_expenses').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
      db.from('event_crew').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
      db.from('event_summaries').select('*').eq('event_id', eventId).maybeSingle(),
      db.rpc('get_organizer_event_metrics', { p_event_id: eventId })
    ]);
    const expenses = checked(expensesResult, 'load event expenses') || [];
    const crew = checked(crewResult, 'load event crew') || [];
    const summary = checked(summaryResult, 'load event summary');
    const metric = checked(metricsResult, 'load event metrics')?.[0] || {};
    const event = organizerEvents.find(item => item.id === eventId);
    const ticketsSold = Number(metric.tickets_sold || 0);
    const eventCommand = {
      eventId, eventTitle: event?.title || '', title: event?.title || '',
      eventDate: event?.starts_at ? new Date(event.starts_at).toLocaleString('th-TH') : '',
      dateLabel: event?.starts_at ? new Date(event.starts_at).toLocaleDateString('th-TH') : '',
      venue: event?.venue_name || event?.venue_address || 'ยังไม่ระบุสถานที่',
      eventStatus: event?.status || '',
      ticketsSold, ticketCapacity: Number(metric.ticket_capacity || 0),
      grossTicketRevenue: Number(metric.gross_ticket_revenue_minor || 0) / 100,
      ticketPriceAverage: Math.round(Number(metric.average_ticket_price_minor || 0) / 100),
      checkedInCount: Number(metric.checked_in_count || 0),
      expenses: expenses.map(row => ({
        id: row.id, category: row.category, title: row.title,
        amount: Number(row.amount_minor) / 100, paid: Boolean(row.is_paid), createdAt: row.created_at
      })),
      crewList: crew.map(row => ({
        id: row.id, name: row.name, role: row.role, phone: row.phone,
        status: row.duty_status
      })),
      postEventSummary: {
        peakHour: summary?.peak_hour_note || 'ยังไม่มีข้อมูล',
        notes: summary?.retrospective_notes || 'ยังไม่มีบันทึกสรุปผล'
      }
    };
    state.eventCommand = eventCommand;
    return eventCommand;
  }

  async function load() {
    const ready = global.SourcewavSupabaseReady;
    if (ready) await ready;
    db = global.SourcewavSupabase || null;
    if (!db) {
      status = 'offline';
      setNotice('ยังเชื่อมต่อฐานข้อมูลไม่ได้ ข้อมูล Booking, Drop, Command Center และ Artist Store จะไม่แสดงจนกว่าจะเชื่อมต่อ Supabase');
      return state;
    }
    const auth = await db.auth.getUser();
    if (auth.error) fail(auth.error, 'load auth state');
    user = auth.data?.user || null;
    const [cardsResult, dropsResult, productsResult] = await Promise.all([
      db.from('booking_cards').select('*').order('created_at', { ascending: false }),
      db.from('drop_alerts').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('artist_products').select('*').order('created_at', { ascending: false })
    ]);
    const publicError = cardsResult.error || dropsResult.error || productsResult.error;
    if (publicError) {
      status = 'schema-required';
      setNotice('ฐานข้อมูลฟีเจอร์ยังตั้งค่าไม่ครบ จึงปิดการบันทึกเพื่อไม่ให้ข้อมูลอยู่แค่ในเครื่อง กรุณาติดตั้ง migration supabase/migrations/20261021000600_live_features.sql');
      console.error('Sourcewav live feature tables are unavailable:', publicError.message);
      return state;
    }
    const cardRows = cardsResult.data || [];
    const dropRows = dropsResult.data || [];
    const productRows = productsResult.data || [];
    const userId = user?.id;
    let offerRows = [], venueRows = [], venueKeyRows = [], followRows = [], readRows = [], eventRows = [], storeOrderRows = [];
    if (userId) {
      const privateResults = await Promise.all([
        db.from('booking_offers').select('*').order('created_at', { ascending: false }),
        db.from('venue_follows').select('venue_id').eq('user_id', userId),
        db.from('user_venue_follows').select('venue_key').eq('user_id', userId),
        db.from('follows').select('followed_id').eq('follower_id', userId),
        db.from('user_drop_reads').select('drop_id').eq('user_id', userId),
        db.from('events').select('id,title,starts_at,ends_at,status,venue_name,venue_address').eq('organizer_id', userId).is('deleted_at', null).order('starts_at', { ascending: false }),
        db.from('artist_store_orders').select('*').order('created_at', { ascending: false })
      ]);
      const privateError = privateResults.find(result => result.error)?.error;
      if (privateError) {
        status = 'schema-required';
        setNotice('ตารางบางส่วนหรือสิทธิ์อ่านข้อมูลยังไม่พร้อม กรุณาติดตั้ง migration supabase/migrations/20261021000600_live_features.sql');
        console.error('Sourcewav private feature data is unavailable:', privateError.message);
        return state;
      }
      [offerRows, venueRows, venueKeyRows, followRows, readRows, eventRows, storeOrderRows] = privateResults.map(result => result.data || []);
    }
    organizerEvents = eventRows;
    const ids = [...new Set([
      ...(userId ? [userId] : []), ...cardRows.map(row => row.artist_id),
      ...dropRows.map(row => row.creator_id), ...productRows.map(row => row.artist_id),
      ...offerRows.map(row => row.client_id), ...storeOrderRows.map(row => row.buyer_id)
    ])];
    const profileResult = ids.length
      ? await db.from('profiles').select('user_id,username,display_name,avatar_url').in('user_id', ids)
      : { data: [], error: null };
    if (profileResult.error) {
      status = 'offline';
      setNotice('อ่านข้อมูลโปรไฟล์จากฐานข้อมูลไม่สำเร็จ ลองโหลดหน้าใหม่อีกครั้ง');
      console.error('Sourcewav feature profiles are unavailable:', profileResult.error.message);
      return state;
    }
    const profiles = new Map((profileResult.data || []).map(row => [row.user_id, row]));
    const readSet = new Set(readRows.map(row => row.drop_id));
    const productMap = new Map(productRows.map(row => [row.id, fromProduct(row, profiles)]));
    state.bookingCards = cardRows.map(row => fromCard(row, profiles));
    state.bookingOffers = offerRows.map(row => {
      const offer = fromOffer(row);
      const card = state.bookingCards.find(item => item.id === offer.cardId);
      offer.artistName = card?.artistName || '';
      offer.artistId = card?.artistId || '';
      return offer;
    });
    state.dropAlerts = dropRows.map(row => fromDrop(row, readSet.has(row.id), profiles));
    state.followedVenues = [...venueRows.map(row => row.venue_id), ...venueKeyRows.map(row => row.venue_key)];
    state.followedArtists = followRows.map(row => row.followed_id);
    state.artistStoreProducts = [...productMap.values()];
    state.artistStoreOrders = storeOrderRows.map(row => fromStoreOrder(row, productMap, profiles));
    state.eventCommand = { eventId: '', eventTitle: '', title: '', expenses: [], crewList: [], ticketsSold: 0, ticketCapacity: 0, grossTicketRevenue: 0, checkedInCount: 0, ticketPriceAverage: 0, postEventSummary: { peakHour: 'ยังไม่มีข้อมูล', notes: 'ยังไม่มีบันทึกสรุปผล' } };
    if (organizerEvents.length) {
      try {
        await loadOrganizerEvent(organizerEvents[0].id);
      } catch (error) {
        status = 'schema-required';
        setNotice('ข้อมูลส่วน Command Center ยังไม่พร้อม กรุณาติดตั้ง migration supabase/migrations/20261021000600_live_features.sql');
        console.error('Sourcewav Command Center data is unavailable:', error.message);
        return state;
      }
    }
    status = 'online';
    setNotice('');
    Core.updateNotificationBadge();
    global.SourcewavMap?.refreshVenueFollows();
    return state;
  }

  async function createBookingCard(input) {
    const owner = await currentUser();
    if (!owner) return null;
    const payload = {
      artist_id: owner.id, stage_name: input.artistName, role: input.role,
      role_label: input.roleLabel || ROLE_LABELS[input.role] || 'ศิลปิน',
      rate_minor: Math.round(Number(input.rate) * 100), rate_unit: input.rateUnit,
      city: input.city, availability_note: input.availability,
      is_immediate: input.availableStatus === 'ready', bio: input.bio,
      portfolio_sample: input.portfolioTitle, portfolio_image_url: input.portfolioImageUrl || '',
      portfolio_audio_url: input.portfolioAudioUrl || ''
    };
    const existing = checked(await db.from('booking_cards').select('id').eq('artist_id', owner.id).eq('role', input.role).maybeSingle(), 'check existing booking card');
    const result = existing
      ? await db.from('booking_cards').update({
        stage_name: payload.stage_name, role_label: payload.role_label,
        rate_minor: payload.rate_minor, rate_unit: payload.rate_unit, city: payload.city,
        availability_note: payload.availability_note, is_immediate: payload.is_immediate,
        bio: payload.bio, portfolio_sample: payload.portfolio_sample,
        portfolio_image_url: payload.portfolio_image_url,
        portfolio_audio_url: payload.portfolio_audio_url
      }).eq('id', existing.id).select('*').single()
      : await db.from('booking_cards').insert(payload).select('*').single();
    const row = checked(result, 'save booking card');
    const profile = await db.from('profiles').select('user_id,username,display_name').eq('user_id', owner.id).maybeSingle();
    if (profile.error) fail(profile.error, 'load booking profile');
    const card = fromCard(row, new Map(profile.data ? [[owner.id, profile.data]] : []));
    state.bookingCards = [card, ...state.bookingCards.filter(item => item.id !== card.id)];
    return card;
  }

  async function createBookingOffer(card, input) {
    const owner = await currentUser();
    if (!owner) return null;
    const result = await db.rpc('create_booking_offer', {
      p_card_id: card.id, p_event_title: input.eventTitle,
      p_event_date: input.eventDate, p_venue_location: input.venueLocation,
      p_client_name: input.clientName, p_client_contact: input.clientContact,
      p_offered_budget_minor: Math.round(Number(input.budget) * 100), p_details: input.details || ''
    });
    const id = checked(result, 'create booking offer');
    const row = checked(await db.from('booking_offers').select('*').eq('id', id).single(), 'load created booking offer');
    const offer = fromOffer(row);
    offer.artistId = card.artistId;
    offer.artistName = card.artistName;
    state.bookingOffers.unshift(offer);
    return offer;
  }

  async function respondBookingOffer(id, response) {
    const owner = await currentUser();
    if (!owner) return false;
    const result = await db.rpc('respond_booking_offer', { p_offer_id: id, p_status: response });
    checked(result, 'respond to booking offer');
    const offer = state.bookingOffers.find(item => item.id === id);
    if (offer) offer.status = response;
    return true;
  }

  async function toggleFollowArtist(artistId) {
    const owner = await currentUser();
    if (!owner) return null;
    if (owner.id === artistId) { Core.toast('ติดตามบัญชีตัวเองไม่ได้'); return null; }
    const isFollowing = state.followedArtists.includes(artistId);
    if (isFollowing) {
      checked(await db.from('follows').delete().eq('follower_id', owner.id).eq('followed_id', artistId), 'unfollow artist');
      state.followedArtists = state.followedArtists.filter(id => id !== artistId);
    } else {
      checked(await db.from('follows').insert({ follower_id: owner.id, followed_id: artistId }), 'follow artist');
      state.followedArtists.push(artistId);
    }
    return !isFollowing;
  }

  async function toggleFollowVenue(venueId) {
    const owner = await currentUser();
    if (!owner) return null;
    const isFollowing = state.followedVenues.includes(venueId);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(venueId);
    const table = isUuid ? 'venue_follows' : 'user_venue_follows';
    const idColumn = isUuid ? 'venue_id' : 'venue_key';
    const payload = isUuid ? { user_id: owner.id, venue_id: venueId } : { user_id: owner.id, venue_key: venueId };
    if (isFollowing) {
      checked(await db.from(table).delete().eq('user_id', owner.id).eq(idColumn, venueId), 'unfollow venue');
      state.followedVenues = state.followedVenues.filter(id => id !== venueId);
    } else {
      checked(await db.from(table).insert(payload), 'follow venue');
      state.followedVenues.push(venueId);
    }
    return !isFollowing;
  }

  async function createDrop(input) {
    const owner = await currentUser();
    if (!owner) return null;
    const row = checked(await db.from('drop_alerts').insert({
      creator_id: owner.id, drop_type: input.type || 'announcement',
      title: input.title, detail_text: input.details,
      action_label: input.actionLabel || 'ดูรายละเอียด', action_url: input.actionUrl || ''
    }).select('*').single(), 'create drop alert');
    const profile = await db.from('profiles').select('user_id,username,display_name').eq('user_id', owner.id).maybeSingle();
    if (profile.error) fail(profile.error, 'load drop creator');
    const drop = fromDrop(row, false, new Map(profile.data ? [[owner.id, profile.data]] : []));
    state.dropAlerts.unshift(drop);
    return drop;
  }

  async function markAllDropsRead() {
    const owner = await currentUser();
    if (!owner) return false;
    const rows = state.dropAlerts.map(drop => ({ user_id: owner.id, drop_id: drop.id }));
    if (rows.length) checked(await db.from('user_drop_reads').upsert(rows, { onConflict: 'user_id,drop_id', ignoreDuplicates: true }), 'mark drops read');
    state.dropAlerts.forEach(drop => { drop.read = true; });
    return true;
  }

  async function createProduct(input) {
    const owner = await currentUser();
    if (!owner) return null;
    const row = checked(await db.from('artist_products').insert({
      artist_id: owner.id, title: input.title, category: input.category,
      product_type: input.type, price_minor: Math.round(Number(input.price) * 100),
      stock: input.stock, image_url: input.imageUrl, description: input.description,
      preview_audio_url: input.previewAudioUrl || null,
      is_active: true
    }).select('*').single(), 'create artist product');
    const profile = await db.from('profiles').select('user_id,username,display_name').eq('user_id', owner.id).maybeSingle();
    if (profile.error) fail(profile.error, 'load product artist');
    const product = fromProduct(row, new Map(profile.data ? [[owner.id, profile.data]] : []));
    state.artistStoreProducts.unshift(product);
    return product;
  }

  async function updateProduct(id, input) {
    const owner = await currentUser();
    if (!owner) return null;
    const row = checked(await db.from('artist_products').update({
      title: input.title, category: input.category,
      product_type: input.type, price_minor: Math.round(Number(input.price) * 100),
      stock: input.stock, image_url: input.imageUrl, description: input.description,
      preview_audio_url: input.previewAudioUrl || null
    }).eq('id', id).eq('artist_id', owner.id).select('*').single(), 'update artist product');
    const profile = await db.from('profiles').select('user_id,username,display_name').eq('user_id', owner.id).maybeSingle();
    if (profile.error) fail(profile.error, 'load product artist');
    const product = fromProduct(row, new Map(profile.data ? [[owner.id, profile.data]] : []));
    const index = state.artistStoreProducts.findIndex(item => item.id === id);
    if (index >= 0) state.artistStoreProducts.splice(index, 1, product);
    else state.artistStoreProducts.unshift(product);
    return product;
  }

  async function createStoreOrder(product, input) {
    const owner = await currentUser();
    if (!owner) return null;
    const result = await db.rpc('create_artist_store_order', {
      p_product_id: product.id,
      p_buyer_contact: input.contact || '', p_shipping_address: input.shippingAddress || null
    });
    const id = checked(result, 'create artist store order');
    const row = checked(await db.from('artist_store_orders').select('*').eq('id', id).single(), 'load created artist store order');
    const order = fromStoreOrder(row, new Map([[product.id, product]]), new Map());
    state.artistStoreOrders.unshift(order);
    return order;
  }

  async function addExpense(input) {
    const owner = await currentUser();
    if (!owner) return null;
    const eventId = state.eventCommand?.eventId;
    if (!eventId) { Core.toast('เลือกอีเวนต์ของคุณก่อน'); return null; }
    checked(await db.from('event_expenses').insert({
      event_id: eventId, created_by: owner.id, category: input.category,
      title: input.title, amount_minor: Math.round(Number(input.amount) * 100)
    }), 'save event expense');
    await loadOrganizerEvent(eventId);
    return state.eventCommand;
  }

  async function setExpensePaid(expenseId, paid) {
    const owner = await currentUser();
    if (!owner) return null;
    const eventId = state.eventCommand?.eventId;
    if (!eventId) return null;
    checked(await db.from('event_expenses').update({ is_paid: Boolean(paid) }).eq('id', expenseId).eq('event_id', eventId), 'update expense payment status');
    await loadOrganizerEvent(eventId);
    return state.eventCommand;
  }

  async function addCrew(input) {
    const owner = await currentUser();
    if (!owner) return null;
    const eventId = state.eventCommand?.eventId;
    if (!eventId) { Core.toast('เลือกอีเวนต์ของคุณก่อน'); return null; }
    checked(await db.from('event_crew').insert({
      event_id: eventId, name: input.name, role: input.role,
      phone: input.phone, duty_status: 'pending'
    }), 'save event crew');
    await loadOrganizerEvent(eventId);
    return state.eventCommand;
  }

  async function updateCrewStatus(crewId, dutyStatus) {
    const owner = await currentUser();
    if (!owner) return null;
    if (!['pending', 'on-duty', 'completed'].includes(dutyStatus)) throw new Error('สถานะทีมงานไม่ถูกต้อง');
    const eventId = state.eventCommand?.eventId;
    if (!eventId) return null;
    checked(await db.from('event_crew').update({ duty_status: dutyStatus }).eq('id', crewId).eq('event_id', eventId), 'update crew duty status');
    await loadOrganizerEvent(eventId);
    return state.eventCommand;
  }

  async function saveEventSummary(input) {
    const owner = await currentUser();
    if (!owner) return null;
    const eventId = state.eventCommand?.eventId;
    if (!eventId) return null;
    checked(await db.from('event_summaries').upsert({
      event_id: eventId, peak_hour_note: input.peakHour,
      retrospective_notes: input.notes, updated_at: new Date().toISOString()
    }, { onConflict: 'event_id' }), 'save event summary');
    await loadOrganizerEvent(eventId);
    return state.eventCommand;
  }

  async function selectEvent(eventId) {
    const owner = await currentUser();
    if (!owner) return null;
    if (!organizerEvents.some(event => event.id === eventId)) throw new Error('อีเวนต์นี้ไม่อยู่ในบัญชีผู้จัดของคุณ');
    return loadOrganizerEvent(eventId);
  }

  global.SourcewavFeatureData = {
    get status() { return status; }, get events() { return organizerEvents.slice(); },
    load, createBookingCard, createBookingOffer, respondBookingOffer,
    toggleFollowArtist, toggleFollowVenue, createDrop, markAllDropsRead,
    createProduct, updateProduct, createStoreOrder, addExpense, setExpensePaid, addCrew,
    updateCrewStatus, saveEventSummary, selectEvent
  };
})(window);
