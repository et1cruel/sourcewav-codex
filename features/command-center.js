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

  Object.assign(F, { openCommandCenterModal, renderCommandPreview, openAddExpenseModal, openAddCrewModal });
  F.command = { bindStatic };
})(window);
