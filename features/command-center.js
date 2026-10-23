/* Feature 7: Event Command Center — organizer data from Supabase. */
(function (global) {
  'use strict';
  const Core = global.SourcewavFeaturesCore;
  const { $, $$, esc, money, toast, showModal } = Core;
  const state = Core.state;
  const F = global.SourcewavFeatures || (global.SourcewavFeatures = {});

  const safeRate = (numerator, denominator) => denominator ? Math.min(100, Math.round(numerator / denominator * 100)) : 0;

  function openCommandCenterModal() {
    const data = state.eventCommand || {};
    const events = global.SourcewavFeatureData.events;
    if (!events.length || !data.eventId) {
      showModal(`
        <div class="command-center-modal">
          <h2 id="modalTitle">Event Command Center</h2>
          <p>ข้อมูลหลังบ้านจะแสดงเฉพาะอีเวนต์ที่เป็นของบัญชีผู้จัดและอ่านจากฐานข้อมูล</p>
          <div class="platform-empty" style="padding:24px;text-align:center;">
            <strong>ยังไม่พบอีเวนต์ของคุณ</strong>
            <p>สร้างอีเวนต์ก่อน แล้วกลับมาเพิ่มรายจ่ายและทีมงานได้ที่นี่</p>
            <button class="modal-primary" id="commandCreateEventBtn" type="button">ไปสร้างอีเวนต์</button>
          </div>
        </div>
      `, 'command-center-modal');
      $('#commandCreateEventBtn')?.addEventListener('click', () => {
        Core.closeModal();
        $('#createEventBtn')?.click();
      });
      return;
    }

    const expenses = Array.isArray(data.expenses) ? data.expenses : [];
    const crewList = Array.isArray(data.crewList) ? data.crewList : [];
    const totalExpenses = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = Number(data.grossTicketRevenue) || 0;
    const net = gross - totalExpenses;
    const margin = gross ? (net / gross * 100).toFixed(1) : '0.0';
    const checkinRate = safeRate(Number(data.checkedInCount) || 0, Number(data.ticketsSold) || 0);
    const salesRate = safeRate(Number(data.ticketsSold) || 0, Number(data.ticketCapacity) || 0);
    const eventStatus = { draft: 'ฉบับร่าง', published: 'เปิดขาย/เผยแพร่', cancelled: 'ยกเลิก', postponed: 'เลื่อน', completed: 'จบแล้ว' }[data.eventStatus] || 'สถานะอีเวนต์';

    showModal(`
      <div class="command-center-modal">
        <div class="command-center-head">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="badge-pro">ผู้จัดงาน</span>
              <span style="background:#e8f4ff;color:#1c5a83;font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;">${esc(eventStatus)}</span>
            </div>
            <h2 id="modalTitle" style="margin:6px 0 2px;font-size:22px;">${esc(data.eventTitle)}</h2>
            <p style="margin:0;color:#64748b;font-size:12px;">ยอดขายและเช็กอินนับจากธุรกรรมที่ยืนยันแล้ว · รายจ่ายและทีมงานบันทึกในฐานข้อมูล</p>
          </div>
          <div class="command-event-selector">
            <select id="commandEventSelect" aria-label="เลือกอีเวนต์">
              ${events.map(event => `<option value="${esc(event.id)}" ${event.id === data.eventId ? 'selected' : ''}>${esc(event.title)}</option>`).join('')}
            </select>
          </div>
        </div>

        <a class="checkin-launch-button" href="/scan" aria-label="เปิดกล้องสแกน QR บัตรเข้างาน">
          <span class="checkin-launch-art"><img src="assets/organizer-checkin-scanner.png" alt="กล้องสแกนล้อมด้วยวงแหวนพลังงานสีเขียว" /></span>
          <span class="checkin-launch-copy">
            <span class="checkin-launch-kicker">จุดเช็กอินหน้างาน</span>
            <strong>สแกน QR เข้างาน</strong>
            <span>เปิดกล้อง ตรวจบัตร และบันทึกการเข้างานทันที</span>
            <span class="checkin-launch-cta">เปิดกล้องสแกนบัตร <span aria-hidden="true">↗</span></span>
          </span>
          <span class="checkin-launch-status"><i aria-hidden="true"></i> พร้อมใช้งาน</span>
        </a>

        <section class="command-payment-queue-callout">
          <div><strong>คิวตรวจการชำระเงิน</strong><small>ตรวจรายการโอนที่ต้องตรวจเพิ่ม พร้อมประวัติการตัดสินใจ</small></div>
          <button type="button" id="openTicketPaymentQueueBtn">เปิดคิวตรวจ</button>
        </section>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label"><span>🎟️ ยอดขายบัตรที่ชำระแล้ว</span><small>${Number(data.ticketsSold) || 0} / ${Number(data.ticketCapacity) || 0} ใบ</small></div>
            <div class="kpi-value">${money(gross)}</div>
            <div class="kpi-sub">เฉลี่ย ${money(data.ticketPriceAverage)} / ใบ · ขายได้ ${salesRate}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span>🚪 เช็กอิน</span><small>${checkinRate}% ของบัตรที่ขายแล้ว</small></div>
            <div class="kpi-value">${Number(data.checkedInCount) || 0} <span style="font-size:13px;font-weight:500;color:#64748b;">/ ${Number(data.ticketsSold) || 0} ใบ</span></div>
            <div class="checkin-progress-bar"><div style="width:${checkinRate}%;"></div></div>
          </div>
          <div class="kpi-card expense">
            <div class="kpi-label"><span>💸 ค่าใช้จ่าย</span><small>${expenses.length} รายการ</small></div>
            <div class="kpi-value">${money(totalExpenses)}</div>
            <div class="kpi-sub">รวมรายการที่ผู้จัดบันทึกไว้</div>
          </div>
          <div class="kpi-card profit">
            <div class="kpi-label"><span>📈 คงเหลือโดยประมาณ</span><small>Margin ${margin}%</small></div>
            <div class="kpi-value">${money(net)}</div>
            <div class="kpi-sub">ยอดขายที่ยืนยันแล้ว ลบรายจ่ายที่บันทึกไว้</div>
          </div>
        </div>

        <div class="command-columns">
          <div class="command-panel-box">
            <div class="command-panel-head"><h3>รายการค่าใช้จ่าย (${money(totalExpenses)})</h3><button class="command-mini-btn" id="openAddExpenseModalBtn">＋ บันทึกค่าใช้จ่าย</button></div>
            <div style="overflow-x:auto;">
              <table class="expense-table"><thead><tr><th>หมวดหมู่</th><th>รายการ</th><th style="text-align:right;">จำนวนเงิน</th><th style="text-align:center;">สถานะ</th></tr></thead>
                <tbody>${expenses.length ? expenses.map(item => `
                  <tr>
                    <td><span style="font-size:10px;font-weight:700;color:#475569;background:#e2e8f0;padding:2px 6px;border-radius:4px;">${esc(item.category)}</span></td>
                    <td>${esc(item.title)}</td><td style="text-align:right;font-weight:700;">${money(item.amount)}</td>
                    <td style="text-align:center;">
                      <span style="font-size:10px;color:${item.paid ? '#166534' : '#92400e'};background:${item.paid ? '#dcfce7' : '#fef3c7'};padding:2px 6px;border-radius:999px;">${item.paid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย'}</span>
                      <button type="button" class="command-mini-btn" data-expense-paid="${esc(item.id)}" data-next-paid="${!item.paid}" style="display:block;margin:5px auto 0;padding:3px 7px;">${item.paid ? 'เปลี่ยนเป็นยังไม่จ่าย' : 'บันทึกว่าจ่ายแล้ว'}</button>
                    </td>
                  </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:16px;">ยังไม่มีรายการค่าใช้จ่าย</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
          <div class="command-panel-box">
            <div class="command-panel-head"><h3>ทีมงาน (${crewList.length} คน)</h3><button class="command-mini-btn" id="openAddCrewModalBtn">＋ เพิ่มทีมงาน</button></div>
            <div class="crew-list">${crewList.length ? crewList.map(person => `
              <div class="crew-row"><div class="crew-info"><strong>${esc(person.name)}</strong><small>${esc(person.role)} · ☎ ${esc(person.phone)}</small></div>
                <select data-crew-duty="${esc(person.id)}" aria-label="สถานะเวร ${esc(person.name)}" class="crew-status-badge ${esc(person.status)}">
                  <option value="pending" ${person.status === 'pending' ? 'selected' : ''}>รอเข้ากะ</option>
                  <option value="on-duty" ${person.status === 'on-duty' ? 'selected' : ''}>ประจำจุด</option>
                  <option value="completed" ${person.status === 'completed' ? 'selected' : ''}>เสร็จแล้ว</option>
                </select>
              </div>`).join('') : '<p class="platform-empty">ยังไม่มีรายชื่อทีมงาน</p>'}</div>
          </div>
        </div>

        <div class="summary-retro-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3>สรุปอีเวนต์</h3><div style="display:flex;gap:8px;"><button class="command-mini-btn" id="editEventSummaryBtn">แก้ไขสรุป</button><button class="command-mini-btn" id="exportReportBtn" style="background:#172a40;color:#d7fa48;border:0;">📥 ดาวน์โหลดรายงาน</button></div>
          </div>
          <div class="summary-retro-grid">
            <div class="summary-stat-cell"><span>ช่วงเวลาที่คนเข้างานแน่นที่สุด</span><b>${esc(data.postEventSummary?.peakHour || 'ยังไม่มีข้อมูล')}</b></div>
            <div class="summary-stat-cell"><span>อัตราเช็กอิน</span><b>${checkinRate}% (${Number(data.checkedInCount) || 0} คน)</b></div>
            <div class="summary-stat-cell"><span>คงเหลือโดยประมาณ</span><b style="color:${net >= 0 ? '#15803d' : '#b91c1c'};">${money(net)} (Margin ${margin}%)</b></div>
          </div>
          <p style="font-size:12px;color:#475569;margin:0;line-height:1.6;background:#f8fafc;padding:10px 14px;border-radius:8px;"><b>บันทึก:</b> ${esc(data.postEventSummary?.notes || 'ยังไม่มีบันทึกสรุปผล')}</p>
          <small style="display:block;margin-top:8px;color:#64748b;">ยอดคงเหลือไม่รวมค่าใช้จ่ายที่ยังไม่ได้บันทึก ภาษี หรือค่าธรรมเนียมภายนอก</small>
        </div>
      </div>
    `, 'command-center-modal');

    $('#commandEventSelect')?.addEventListener('change', event => {
      global.SourcewavFeatureData.selectEvent(event.target.value)
        .then(() => openCommandCenterModal())
        .catch(error => toast(`เปลี่ยนอีเวนต์ไม่สำเร็จ: ${error.message || 'ตรวจสอบข้อมูล'}`));
    });
    $('#openTicketPaymentQueueBtn')?.addEventListener('click', () => openTicketPaymentQueue(data.eventId));
    $('#openAddExpenseModalBtn')?.addEventListener('click', openAddExpenseModal);
    $('#openAddCrewModalBtn')?.addEventListener('click', openAddCrewModal);
    $('#editEventSummaryBtn')?.addEventListener('click', openEditEventSummaryModal);
    $$('[data-expense-paid]').forEach(button => button.addEventListener('click', () => {
      global.SourcewavFeatureData.setExpensePaid(button.dataset.expensePaid, button.dataset.nextPaid === 'true')
        .then(result => { if (result) openCommandCenterModal(); })
        .catch(error => toast(`เปลี่ยนสถานะรายจ่ายไม่สำเร็จ: ${error.message || 'ตรวจสอบข้อมูล'}`));
    }));
    $$('[data-crew-duty]').forEach(select => select.addEventListener('change', () => {
      global.SourcewavFeatureData.updateCrewStatus(select.dataset.crewDuty, select.value)
        .then(result => { if (result) openCommandCenterModal(); })
        .catch(error => toast(`อัปเดตสถานะทีมงานไม่สำเร็จ: ${error.message || 'ตรวจสอบข้อมูล'}`));
    }));
    $('#exportReportBtn')?.addEventListener('click', () => {
      const summaryText = [
        'SOURCEWAV EVENT REPORT', `Event: ${data.eventTitle}`, `Date: ${data.eventDate}`,
        `Paid ticket revenue: ${money(gross)}`, `Recorded expenses: ${money(totalExpenses)}`,
        `Estimated remainder: ${money(net)}`, `Tickets sold: ${data.ticketsSold}/${data.ticketCapacity}`,
        `Checked in: ${data.checkedInCount}`, `Peak hour: ${data.postEventSummary?.peakHour || 'No data'}`
      ].join('\n');
      const url = URL.createObjectURL(new Blob([summaryText], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `event-report-${data.eventId}.txt`; link.click();
      URL.revokeObjectURL(url);
    });
  }

  async function openTicketPaymentQueue(eventId) {
    showModal('<section class="ticket-review-queue"><h2 id="modalTitle">คิวตรวจการชำระเงิน</h2><p role="status">กำลังโหลดรายการตรวจสอบ…</p></section>', 'command-center-modal');
    try {
      const client = global.SourcewavSupabase;
      if (!client) throw new Error('ยังเชื่อมต่อฐานข้อมูลไม่ได้');
      const { data: payload, error } = await client.functions.invoke('admin-list-ticket-payments', { body: { eventId } });
      if (error) {
        const details = await error.context?.clone?.().json?.().catch?.(() => null);
        throw new Error(details?.error || error.message || 'โหลดคิวตรวจไม่ได้');
      }
      const rows = (payload?.payments || []).filter(payment => payment.orderStatus === 'disputed');
      const followUpAttempts = (payload?.attempts || []).filter(attempt =>
        ['error', 'timeout', 'quota_exhausted', 'rejected'].includes(attempt.status) && ['awaiting_payment','expired'].includes(attempt.orderStatus));
      const canReview = payment => payment.status === 'verified' && !(payment.reviews || []).some(review => review.decision === 'rejected');
      const transferInWindow = payment => payment.transferAt && payment.orderCreatedAt && payment.expiresAt
        && new Date(payment.transferAt) >= new Date(payment.orderCreatedAt)
        && new Date(payment.transferAt) <= new Date(payment.expiresAt);
      const when = value => value && !Number.isNaN(new Date(value).getTime())
        ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : '—';
      const ref = value => String(value || '').replace(/-/g, '').slice(-8).toUpperCase();
      showModal(`<section class="ticket-review-queue">
        <header><div><span>PAYMENT REVIEW</span><h2 id="modalTitle">คิวตรวจการชำระเงิน</h2><p>อนุมัติหลังตรวจยอดเงินจริงในบัญชีผู้รับแล้วเท่านั้น</p></div><button type="button" id="refreshTicketPaymentQueue">↻ รีเฟรช</button></header>
        <p class="ticket-review-warning">เงินโอนตรงเข้าบัญชีผู้จัด Sourcewav ไม่ได้ถือเงินแทน การปฏิเสธรายการไม่ได้หมายความว่าคืนเงินแล้ว กรุณาติดต่อผู้ซื้อเพื่อแจ้งขั้นตอนคืนเงินด้วยตนเอง</p>
        <div class="ticket-review-list">${rows.length ? rows.map(payment => `<article class="ticket-review-card" data-review-id="${esc(payment.id)}">
          <div class="ticket-review-card-head"><div><span class="ticket-review-state">${!canReview(payment) && payment.reviews?.some(review => review.decision === 'rejected') ? 'ปฏิเสธแล้ว · ติดตามคืนเงิน' : payment.status === 'verified' ? 'ต้องตรวจเพิ่มเติม' : 'ธุรกรรมต้องติดตาม'}</span><h3>${esc(payment.eventTitle)}</h3><p>ออเดอร์ #SW-${ref(payment.orderId)} · ผู้ซื้อ ${esc(ref(payment.buyerId))}</p><p>${(payment.items || []).map(item => `${esc(item.ticket_types?.name || 'บัตร')} × ${Number(item.quantity)}`).join(' · ') || 'ไม่พบรายการบัตร'} · ${esc(payment.venueName || 'ยังไม่ระบุสถานที่')} · ${esc(when(payment.eventStartsAt))}</p></div><strong>${money(payment.expectedAmountMinor / 100)}</strong></div>
          <div class="ticket-review-facts"><span>ยอดที่ต้องจ่าย <b>${money(payment.expectedAmountMinor / 100)}</b></span><span>ยอดจาก SlipOK <b>${money(payment.amountMinor / 100)}</b></span><span>เลขอ้างอิง <b>${esc(payment.transRef || '—')}</b></span><span>เวลาโอนจาก SlipOK <b>${esc(when(payment.transferAt))}</b></span><span>หมดเวลาจอง <b>${esc(when(payment.expiresAt))}</b></span><span>ส่งสลิปเมื่อ <b>${esc(when(payment.submittedAt))}</b></span></div>
          <p class="ticket-review-message">${payment.reviews?.some(review => review.decision === 'rejected') ? 'ผู้จัดบันทึกการปฏิเสธแล้ว · ประสานผู้ซื้อเรื่องการคืนเงินด้วยตนเอง และอย่าแสดงสถานะว่าคืนเงินแล้วจนกว่าจะมีหลักฐาน' : payment.status === 'verified' ? transferInWindow(payment) ? 'SlipOK พบเวลาโอนอยู่ในช่วงเวลาจอง แต่ส่งสลิปหลังหมดเวลา · ตรวจยอดเข้าจริงและยืนยันว่ามีจำนวนบัตรเหลือก่อนอนุมัติ' : 'เวลาโอนจาก SlipOK อยู่นอกช่วงเวลาคำสั่งซื้อ · ตรวจรายการเดินบัญชีและจำนวนบัตรก่อนดำเนินการ' : `เหตุผลเข้าคิว: ${esc(payment.message || 'เลขอ้างอิงธุรกรรมถูกใช้กับคำสั่งซื้ออื่น')} · ต้องตรวจรายการเดินบัญชีและติดต่อผู้ซื้อ รายการนี้ยังอนุมัติออกบัตรจากระบบไม่ได้`}</p>
          ${payment.slipUrl ? `<a class="ticket-review-slip" href="${esc(payment.slipUrl)}" target="_blank" rel="noopener noreferrer">เปิดสลิปที่เก็บแบบส่วนตัว ↗</a>` : '<span class="ticket-review-slip-missing">เปิดสลิปไม่ได้ กรุณาตรวจสิทธิ์และไฟล์</span>'}
          ${payment.reviews?.length ? `<div class="ticket-review-history"><b>ประวัติ</b>${payment.reviews.map(review => `<p>${esc(review.reviewer_role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้จัด')} · ${review.decision === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} · ${esc(when(review.created_at))}${review.note ? ` · ${esc(review.note)}` : ''}</p>`).join('')}</div>` : ''}
          ${canReview(payment) ? `<label class="ticket-review-note">บันทึกเหตุผล / หมายเหตุ<textarea rows="2" maxlength="1000" data-review-note placeholder="ระบุสิ่งที่ตรวจสอบแล้วหรือขั้นตอนคืนเงิน"></textarea></label>
          <label class="ticket-review-confirm"><input type="checkbox" data-review-confirm />ยืนยันว่าตรวจยอดเงินเข้าบัญชีผู้รับจริงแล้ว</label>
          <div class="ticket-review-actions"><button type="button" data-review-decision="rejected">ปฏิเสธและติดตามกับผู้ซื้อ</button><button type="button" data-review-decision="approved">อนุมัติและออกบัตร</button></div>
          <div class="ticket-review-result" role="status" aria-live="polite"></div>` : ''}
        </article>`).join('') : '<div class="ticket-review-empty"><h3>ไม่มีรายการที่ต้องตรวจ</h3><p>คำสั่งซื้อที่ระบบตรวจสอบไม่ได้หรือโอนหลังหมดเวลาจองจะแสดงที่นี่</p></div>'}</div>
        <section class="ticket-review-follow-up"><h3>รายการที่ระบบตรวจไม่จบหรือสลิปไม่ผ่าน</h3><p>ผู้ซื้อยังส่งสลิปใหม่ในคำสั่งซื้อเดิมได้ รายการกลุ่มนี้ยังไม่ยืนยันการรับเงิน จึงไม่มีปุ่มอนุมัติจากภาพสลิป</p>
          <div class="ticket-review-list">${followUpAttempts.length ? followUpAttempts.map(attempt => {
            const state = { error: 'บริการตรวจขัดข้อง', timeout: 'หมดเวลารอผล', quota_exhausted: 'โควต้าตรวจเต็ม', rejected: 'สลิปไม่ผ่าน' }[attempt.status];
            const reason = { provider_timeout: 'บริการตรวจใช้เวลานานเกินไป', provider_unavailable: 'ติดต่อบริการตรวจไม่ได้', quota_exhausted: 'บริการตรวจใช้โควต้าครบแล้ว', invalid_slipok_credentials: 'ข้อมูลเชื่อมต่อ SlipOK ของผู้จัดไม่ถูกต้อง', duplicate_transaction_reference: 'เลขอ้างอิงธุรกรรมถูกใช้แล้ว' }[attempt.failureReason] || attempt.failureReason || 'ตรวจข้อมูลสลิปและติดต่อผู้ซื้อ';
            const canRetry = ['provider_timeout', 'provider_unavailable', 'invalid_slipok_credentials'].includes(attempt.failureReason) && Boolean(attempt.slipUrl);
            return `<article class="ticket-review-card ticket-review-follow-up-card" data-retry-attempt="${esc(attempt.id)}"><div class="ticket-review-card-head"><div><span class="ticket-review-state">${state}</span><h3>${esc(attempt.eventTitle)}</h3><p>ออเดอร์ #SW-${ref(attempt.orderId)} · ผู้ซื้อ ${ref(attempt.buyerId)}</p><p>${esc(attempt.venueName || 'ยังไม่ระบุสถานที่')} · ${esc(when(attempt.eventStartsAt))}</p></div><strong>${money(attempt.expectedAmountMinor / 100)}</strong></div><p class="ticket-review-message">${esc(reason)} · ${esc(when(attempt.createdAt))}</p>${attempt.slipUrl ? `<a class="ticket-review-slip" href="${esc(attempt.slipUrl)}" target="_blank" rel="noopener noreferrer">เปิดสลิปส่วนตัว ↗</a>` : '<span class="ticket-review-slip-missing">ไม่มีไฟล์สลิปในประวัติ</span>'}${canRetry ? '<button type="button" class="ticket-review-retry" data-retry-verification>ตรวจสลิปเดิมซ้ำ</button>' : ''}<div class="ticket-review-result" role="status" aria-live="polite"></div></article>`;
          }).join('') : '<div class="ticket-review-empty"><p>ไม่มีรายการค้างติดตาม</p></div>'}</div>
        </section>
      </section>`, 'command-center-modal');
      const host = document.querySelector('#modalContent .ticket-review-queue');
      host?.querySelector('#refreshTicketPaymentQueue')?.addEventListener('click', () => openTicketPaymentQueue(eventId));
      host?.addEventListener('click', async event => {
        const retryButton = event.target.closest('[data-retry-verification]');
        if (retryButton) {
          const card = retryButton.closest('[data-retry-attempt]');
          const status = card.querySelector('.ticket-review-result');
          retryButton.disabled = true;
          status.textContent = 'กำลังส่งสลิปเดิมให้ SlipOK ตรวจซ้ำ…';
          const { data: result, error } = await global.SourcewavSupabase.functions.invoke('admin-retry-ticket-verification', {
            body: { attemptId: card.dataset.retryAttempt },
          });
          if (error || result?.error) {
            const details = await error?.context?.clone?.().json?.().catch?.(() => null);
            status.textContent = details?.error || result?.error || result?.message || error?.message || 'ตรวจซ้ำไม่สำเร็จ';
            retryButton.disabled = false;
            return;
          }
          status.textContent = result?.message || 'ตรวจซ้ำเสร็จแล้ว';
          if (result?.status === 'paid' || result?.status === 'review_required') {
            window.setTimeout(() => openTicketPaymentQueue(eventId), 1200);
          } else {
            window.setTimeout(() => openTicketPaymentQueue(eventId), 1800);
          }
          return;
        }
        const button = event.target.closest('[data-review-decision]');
        if (!button) return;
        const card = button.closest('[data-review-id]');
        const note = card.querySelector('[data-review-note]').value.trim();
        const confirmed = card.querySelector('[data-review-confirm]').checked;
        const status = card.querySelector('.ticket-review-result');
        const decision = button.dataset.reviewDecision;
        if (note.length < 3) { status.textContent = 'กรอกเหตุผลการตัดสินใจอย่างน้อย 3 ตัวอักษรก่อนบันทึก'; card.querySelector('[data-review-note]').focus(); return; }
        if (decision === 'approved' && !confirmed) { status.textContent = 'ยืนยันว่าตรวจยอดเข้าบัญชีผู้รับจริงก่อนออกบัตร'; card.querySelector('[data-review-confirm]').focus(); return; }
        card.querySelectorAll('[data-review-decision]').forEach(action => { action.disabled = true; });
        status.textContent = 'กำลังบันทึกผลตรวจสอบ…';
        const { data: result, error } = await global.SourcewavSupabase.functions.invoke('admin-review-ticket-payment', {
          body: { submissionId: card.dataset.reviewId, decision, note },
        });
        if (error || result?.error) {
          const details = await error?.context?.clone?.().json?.().catch?.(() => null);
          status.textContent = details?.error || result?.error || error?.message || 'บันทึกผลตรวจสอบไม่ได้';
          card.querySelectorAll('[data-review-decision]').forEach(action => { action.disabled = false; });
          return;
        }
        status.textContent = decision === 'approved' ? 'อนุมัติแล้ว · บัตรออกให้ผู้ซื้อแล้ว' : 'บันทึกการปฏิเสธแล้ว · ประสานผู้ซื้อเรื่องการคืนเงินด้วยตนเอง';
        toast(decision === 'approved' ? 'อนุมัติการชำระเงินและออกบัตรแล้ว' : 'บันทึกผลตรวจแล้ว กรุณาติดตามกับผู้ซื้อ');
      });
    } catch (error) {
      showModal(`<section class="ticket-review-queue"><h2 id="modalTitle">เปิดคิวตรวจไม่ได้</h2><p role="alert">${esc(error.message || 'โหลดรายการตรวจสอบไม่สำเร็จ')}</p><button type="button" id="backToCommandCenter">กลับหลังบ้านผู้จัด</button></section>`, 'command-center-modal');
      $('#backToCommandCenter')?.addEventListener('click', openCommandCenterModal);
    }
  }

  function openEditEventSummaryModal() {
    const summary = state.eventCommand?.postEventSummary || {};
    showModal(`
      <h2 id="modalTitle">บันทึกสรุปอีเวนต์</h2>
      <p>สรุปนี้จะผูกกับอีเวนต์ที่เลือกและบันทึกในฐานข้อมูล</p>
      <form id="eventSummaryForm">
        <label class="modal-field">ช่วงเวลาที่คนเข้างานแน่นที่สุด<input id="summaryPeakHour" maxlength="160" value="${esc(summary.peakHour === 'ยังไม่มีข้อมูล' ? '' : summary.peakHour || '')}" placeholder="เช่น 22:00–23:00" /></label>
        <label class="modal-field">บันทึกหลังจบงาน<textarea id="summaryNotes" maxlength="5000" rows="4" placeholder="สิ่งที่ทำได้ดีและสิ่งที่ควรปรับปรุง">${esc(summary.notes === 'ยังไม่มีบันทึกสรุปผล' ? '' : summary.notes || '')}</textarea></label>
        <button class="modal-primary" type="submit">บันทึกสรุปลงฐานข้อมูล</button>
      </form>
    `);
    $('#eventSummaryForm')?.addEventListener('submit', event => {
      event.preventDefault();
      global.SourcewavFeatureData.saveEventSummary({
        peakHour: $('#summaryPeakHour').value.trim(), notes: $('#summaryNotes').value.trim()
      }).then(result => {
        if (!result) return;
        openCommandCenterModal();
        toast('บันทึกสรุปอีเวนต์ลงฐานข้อมูลแล้ว');
      }).catch(error => toast(`บันทึกสรุปไม่สำเร็จ: ${error.message || 'ตรวจสอบข้อมูล'}`));
    });
  }

  function openAddExpenseModal() {
    showModal(`
      <h2 id="modalTitle">บันทึกค่าใช้จ่าย</h2>
      <p>รายการนี้จะถูกบันทึกในฐานข้อมูลของอีเวนต์ที่เลือก และเริ่มต้นเป็น “ยังไม่จ่าย”</p>
      <form id="addExpenseForm">
        <label class="modal-field">ชื่อรายการ<input id="expTitle" required maxlength="200" placeholder="เช่น ค่าเช่าสถานที่" /></label>
        <label class="modal-field">หมวดหมู่<select id="expCategory"><option value="venue">สถานที่</option><option value="artist">ศิลปิน</option><option value="sound_lights">เครื่องเสียงและไฟ</option><option value="crew">ทีมงาน</option><option value="marketing">การตลาด</option><option value="other">อื่นๆ</option></select></label>
        <label class="modal-field">จำนวนเงิน (บาท)<input id="expAmount" type="number" min="0" step="0.01" required /></label>
        <button type="submit" class="modal-primary">บันทึกลงฐานข้อมูล</button>
      </form>
    `);
    $('#addExpenseForm')?.addEventListener('submit', event => {
      event.preventDefault();
      global.SourcewavFeatureData.addExpense({
        title: $('#expTitle').value.trim(), category: $('#expCategory').value,
        amount: Number($('#expAmount').value)
      }).then(result => {
        if (!result) return;
        openCommandCenterModal();
        toast('บันทึกค่าใช้จ่ายลงฐานข้อมูลแล้ว');
      }).catch(error => toast(`บันทึกไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
    });
  }

  function openAddCrewModal() {
    showModal(`
      <h2 id="modalTitle">เพิ่มทีมงาน</h2>
      <p>บันทึกข้อมูลไว้ในรายชื่อทีมงานของอีเวนต์ที่เลือก</p>
      <form id="addCrewForm">
        <label class="modal-field">ชื่อทีมงาน<input id="crewName" required maxlength="80" /></label>
        <label class="modal-field">หน้าที่<input id="crewRole" required maxlength="80" placeholder="เช่น สแกนบัตรประตู 2" /></label>
        <label class="modal-field">เบอร์ติดต่อ<input id="crewPhone" maxlength="40" placeholder="08x-xxx-xxxx" /></label>
        <button type="submit" class="modal-primary">บันทึกทีมงาน</button>
      </form>
    `);
    $('#addCrewForm')?.addEventListener('submit', event => {
      event.preventDefault();
      global.SourcewavFeatureData.addCrew({
        name: $('#crewName').value.trim(), role: $('#crewRole').value.trim(),
        phone: $('#crewPhone').value.trim()
      }).then(result => {
        if (!result) return;
        openCommandCenterModal();
        toast('บันทึกทีมงานลงฐานข้อมูลแล้ว');
      }).catch(error => toast(`บันทึกไม่สำเร็จ: ${error.message || 'ตรวจสอบการเชื่อมต่อฐานข้อมูล'}`));
    });
  }

  function renderCommandPreview() {
    const host = $('#commandPreviewBody');
    if (!host) return;
    const data = state.eventCommand || {};
    if (!data.eventId) {
      host.innerHTML = '<p class="platform-empty">ยังไม่มีอีเวนต์ของบัญชีผู้จัดให้แสดง</p>';
      return;
    }
    const expenses = Array.isArray(data.expenses) ? data.expenses : [];
    const totalExpenses = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const revenue = Number(data.grossTicketRevenue) || 0;
    host.innerHTML = `
      <div class="command-mini-card">
        <strong>${esc(data.title || 'อีเวนต์ของคุณ')}</strong>
        <small>${esc(data.venue || 'ยังไม่ระบุสถานที่')} · ${esc(data.dateLabel || 'ยังไม่ระบุวันที่')}</small>
        <div class="command-mini-stats">
          <div><b>${money(revenue)}</b><span>ขายบัตรแล้ว</span></div>
          <div><b>${money(totalExpenses)}</b><span>รายจ่ายที่บันทึก</span></div>
          <div><b>${money(revenue - totalExpenses)}</b><span>คงเหลือโดยประมาณ</span></div>
        </div>
      </div>
    `;
  }

  function bindStatic() {
    $('#commandCenterBtn')?.addEventListener('click', event => {
      event.preventDefault();
      openCommandCenterModal();
    });
  }

  Object.assign(F, { openCommandCenterModal, openTicketPaymentQueue, renderCommandPreview, openAddExpenseModal, openAddCrewModal });
  F.command = { bindStatic };
})(window);
