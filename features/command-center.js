/* Feature 7: Event Command Center — หลังบ้านผู้จัดงาน */
(function (global) {
  'use strict';
  const Core = global.SourcewavFeaturesCore;
  const { $, $$, esc, money, toast, showModal, closeModal, state, saveFeaturesState } = Core;
  const F = global.SourcewavFeatures || (global.SourcewavFeatures = {});

  /* --------------------------------------------------------------------------
     FEATURE 7: EVENT COMMAND CENTER (หลังบ้านผู้จัดงาน)
  --------------------------------------------------------------------------- */
  function openCommandCenterModal() {
    const data = state.eventCommand;
    const totalExpenses = data.expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const netProfit = data.grossTicketRevenue - totalExpenses;
    const profitMargin = ((netProfit / (data.grossTicketRevenue || 1)) * 100).toFixed(1);
    const checkinRate = Math.round((data.checkedInCount / (data.ticketsSold || 1)) * 100);

    showModal(`
      <div class="command-center-modal">
        <div class="command-center-head">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge-pro"><span>⚡</span> ORGANIZER PRO</span>
              <span style="background: #dcfce7; color: #15803d; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px;">🟢 งานกำลังดำเนินการ</span>
            </div>
            <h2 id="modalTitle" style="margin: 4px 0 2px; font-size: 22px;">Event Command Center</h2>
            <p style="margin: 0; color: #64748b; font-size: 12px;">รวมยอดขายบัตร คนเข้างาน รายจ่าย กำไรโดยประมาณ ทีมงาน และสรุปผลหลังจบงานไว้หน้าเดียว</p>
          </div>

          <div class="command-event-selector">
            <select id="commandEventSelect">
              <option value="ev-cypher-4">${esc(data.eventTitle)}</option>
              <option value="ev-sample-2">LOCAL MATTER: ART MARKET 2026</option>
            </select>
          </div>
        </div>

        <!-- 4 Major Executive KPIs -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">
              <span>🎟️ ยอดขายบัตร</span>
              <small>${data.ticketsSold} / ${data.ticketCapacity} ใบ</small>
            </div>
            <div class="kpi-value">${money(data.grossTicketRevenue)}</div>
            <div class="kpi-sub">เฉลี่ย ฿${data.ticketPriceAverage} / ใบ (ขายได้ ${Math.round((data.ticketsSold / data.ticketCapacity) * 100)}%)</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">
              <span>🚪 จำนวนคนเข้างาน</span>
              <small>${checkinRate}% เช็คอิน</small>
            </div>
            <div class="kpi-value">${data.checkedInCount} <span style="font-size: 13px; font-weight: 500; color: #64748b;">/ ${data.ticketsSold} คน</span></div>
            <div class="checkin-progress-bar">
              <div style="width: ${checkinRate}%;"></div>
            </div>
          </div>

          <div class="kpi-card expense">
            <div class="kpi-label">
              <span>💸 ยอดค่าใช้จ่าย</span>
              <small>${data.expenses.length} รายการ</small>
            </div>
            <div class="kpi-value">${money(totalExpenses)}</div>
            <div class="kpi-sub">สถานที่, ศิลปิน, เครื่องเสียง, ทีมงาน</div>
          </div>

          <div class="kpi-card profit">
            <div class="kpi-label">
              <span>📈 กำไรโดยประมาณ</span>
              <small>Margin ${profitMargin}%</small>
            </div>
            <div class="kpi-value">${money(netProfit)}</div>
            <div class="kpi-sub">รายรับสุทธิหลังหักค่าใช้จ่ายทั้งหมด</div>
          </div>
        </div>

        <!-- 2 Columns: Expenses & Crew -->
        <div class="command-columns">
          <!-- Expenses Column -->
          <div class="command-panel-box">
            <div class="command-panel-head">
              <h3>รายการค่าใช้จ่ายจริง (${money(totalExpenses)})</h3>
              <button class="command-mini-btn" id="openAddExpenseModalBtn">＋ บันทึกค่าใช้จ่าย</button>
            </div>
            <div style="overflow-x: auto;">
              <table class="expense-table">
                <thead>
                  <tr>
                    <th>หมวดหมู่</th>
                    <th>รายการ</th>
                    <th style="text-align: right;">จำนวนเงิน</th>
                    <th style="text-align: center;">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.expenses.map(e => `
                    <tr>
                      <td><span style="font-size: 10px; font-weight: 700; color: #475569; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${esc(e.category)}</span></td>
                      <td>${esc(e.title)}</td>
                      <td style="text-align: right; font-weight: 700;">${money(e.amount)}</td>
                      <td style="text-align: center;">
                        <span style="font-size: 10px; color: #166534; background: #dcfce7; padding: 2px 6px; border-radius: 999px;">จ่ายแล้ว</span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Crew Roster Column -->
          <div class="command-panel-box">
            <div class="command-panel-head">
              <h3>รายชื่อทีมงาน (${data.crewList.length} คน)</h3>
              <button class="command-mini-btn" id="openAddCrewModalBtn">＋ เพิ่มทีมงาน</button>
            </div>
            <div class="crew-list">
              ${data.crewList.map(c => `
                <div class="crew-row">
                  <div class="crew-info">
                    <strong>${esc(c.name)}</strong>
                    <small>${esc(c.role)} · 📞 ${esc(c.phone)}</small>
                  </div>
                  <span class="crew-status-badge ${esc(c.status)}">
                    ${c.status === 'on-duty' ? '● ประจำจุด' : '○ รอเข้ากะ'}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Post Event Retrospective Summary -->
        <div class="summary-retro-box">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3>สรุปผลหลังจบงาน (Post-Event Report)</h3>
            <button class="command-mini-btn" id="exportReportBtn" style="background: #172a40; color: #d7fa48; border: 0;">
              📥 ส่งออกรายงานสรุปผล
            </button>
          </div>
          <div class="summary-retro-grid">
            <div class="summary-stat-cell">
              <span>ช่วงเวลาที่คนเข้างานแน่นที่สุด (Peak)</span>
              <b>${esc(data.postEventSummary.peakHour)}</b>
            </div>
            <div class="summary-stat-cell">
              <span>อัตราส่วนคนเข้าจริงต่อบัตรที่ขาย</span>
              <b>${checkinRate}% (${data.checkedInCount} คน)</b>
            </div>
            <div class="summary-stat-cell">
              <span>ผลกำไรสุทธิสุทธิประจำงาน</span>
              <b style="color: #15803d;">+${money(netProfit)} (Margin ${profitMargin}%)</b>
            </div>
          </div>
          <p style="font-size: 12px; color: #475569; margin: 0; line-height: 1.6; background: #f8fafc; padding: 10px 14px; border-radius: 8px;">
            <b>บันทึกการจัดงาน:</b> ${esc(data.postEventSummary.notes)}
          </p>
        </div>

        <!-- Organizer Pro Package CTA -->
        <div class="pro-tier-banner">
          <div>
            <h4>Sourcewav Organizer Pro Package (สำหรับผู้จัดที่จัดงานเป็นประจำ)</h4>
            <p>จัดงานได้ไม่จำกัด, Export บัญชีและภาษี, สแกนบัตรไม่จำกัดจุด, 0% Platform processing fee</p>
          </div>
          <button class="boost-launch-btn" id="upgradeOrganizerProBtn" style="background: #72ded0; color: #10243a;">
            สมัครแพ็กเกจ ฿990 / เดือน
          </button>
        </div>
      </div>
    `, 'command-center-modal');

    $('#openAddExpenseModalBtn')?.addEventListener('click', openAddExpenseModal);
    $('#openAddCrewModalBtn')?.addEventListener('click', openAddCrewModal);
    $('#exportReportBtn')?.addEventListener('click', () => {
      const summaryText = `SOURCEWAV POST-EVENT REPORT\n========================\nEvent: ${data.eventTitle}\nDate: ${data.eventDate}\nGross Ticket Sales: ${money(data.grossTicketRevenue)}\nTotal Expenses: ${money(totalExpenses)}\nNet Profit: ${money(netProfit)} (${profitMargin}% Margin)\nTickets Sold: ${data.ticketsSold}/${data.ticketCapacity}\nDoor Check-in: ${data.checkedInCount} (${checkinRate}%)\nPeak Hour: ${data.postEventSummary.peakHour}\nReport Generated on: ${new Date().toLocaleString('th-TH')}`;
      
      const blob = new Blob([summaryText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event-report-${data.eventId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast('ดาวน์โหลดรายงานสรุปผลงานแล้ว!');
    });

    $('#upgradeOrganizerProBtn')?.addEventListener('click', () => {
      closeModal();
      showModal(`
        <h2 id="modalTitle">สมัครสมาชิก Organizer Pro Package</h2>
        <p>ยกระดับระบบหลังบ้านผู้จัดงานเต็มรูปแบบ ประหยัดค่าธรรมเนียม และออกรายงานภาษีอัตโนมัติ</p>

        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <div style="font-size: 18px; font-weight: 700; color: #172a40; margin-bottom: 8px;">฿990 / เดือน <small style="font-size: 11px; color: #64748b;">(หรือ ฿2,490 / 3 เดือน)</small></div>
          <ul style="font-size: 12px; color: #475569; line-height: 1.8; margin: 0; padding-left: 20px;">
            <li>จัดอีเวนต์ไม่จำกัดจำนวนงานต่อเดือน</li>
            <li>ทีมงานสแกนบัตรหน้าประตูไม่จำกัดจุดพร้อมกัน</li>
            <li>ค่าธรรมเนียม Platform fee 0% จากยอดขายบัตร</li>
            <li>ระบบ Export รายรับรายจ่าย และส่งข้อมูลเข้าระบบบัญชี</li>
            <li>ป้ายรับรอง Verified Organizer เพิ่มความน่าเชื่อถือ</li>
          </ul>
        </div>

        <button class="modal-primary" id="confirmOrganizerProPay">ยืนยันสมัครแพ็กเกจ Pro</button>
      `);

      $('#confirmOrganizerProPay')?.addEventListener('click', () => {
        closeModal();
        toast('ยินดีต้อนรับสู่ Organizer Pro! ระบบปลดล็อกฟีเจอร์ระดับ Pro ให้บัญชีของคุณแล้ว');
      });
    });
  }

  function openAddExpenseModal() {
    showModal(`
      <h2 id="modalTitle">บันทึกค่าใช้จ่ายใหม่</h2>
      <p>เพิ่มรายการค่าใช้จ่ายของงานเพื่อคำนวณกำไรสุทธิแบบเรียลไทม์</p>

      <form id="addExpenseForm">
        <label class="modal-field">
          ชื่อรายการค่าใช้จ่าย
          <input id="expTitle" required placeholder="เช่น ค่ารถตู้รับส่งศิลปิน, ค่าสายไมค์สำรอง" />
        </label>

        <label class="modal-field">
          หมวดหมู่
          <select id="expCategory">
            <option value="venue">สถานที่ (Venue)</option>
            <option value="artist">ศิลปิน & โชว์ (Artist)</option>
            <option value="sound_lights">เครื่องเสียง & ไฟ (Sound & Lights)</option>
            <option value="crew">ทีมงาน & Staff (Crew)</option>
            <option value="marketing">ประชาสัมพันธ์ & การตลาด (Marketing)</option>
            <option value="other">อื่นๆ</option>
          </select>
        </label>

        <label class="modal-field">
          จำนวนเงิน (บาท)
          <input id="expAmount" type="number" min="1" step="10" required placeholder="เช่น 3500" />
        </label>

        <button type="submit" class="modal-primary">บันทึกค่าใช้จ่าย</button>
      </form>
    `);

    $('#addExpenseForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const title = $('#expTitle').value.trim();
      const category = $('#expCategory').value;
      const amount = Number($('#expAmount').value) || 0;

      state.eventCommand.expenses.push({
        id: `exp-${Date.now().toString(36)}`,
        category,
        title,
        amount,
        paid: true
      });

      saveFeaturesState();
      closeModal();
      openCommandCenterModal();
      toast('เพิ่มรายการค่าใช้จ่ายและอัปเดตกำไรเรียบร้อยแล้ว');
    });
  }

  function openAddCrewModal() {
    showModal(`
      <h2 id="modalTitle">เพิ่มรายชื่อทีมงาน</h2>
      <p>มอบหมายหน้าที่และข้อมูลติดต่อสำหรับทีมงานในวันจัดงาน</p>

      <form id="addCrewForm">
        <label class="modal-field">
          ชื่อทีมงาน
          <input id="crewName" required placeholder="เช่น นที (บาส)" />
        </label>

        <label class="modal-field">
          ตำแหน่งหน้าที่
          <input id="crewRole" required placeholder="เช่น ดูแลห้องพักศิลปิน, สแกนบัตรประตู 2" />
        </label>

        <label class="modal-field">
          เบอร์โทรศัพท์ติดต่อ
          <input id="crewPhone" required placeholder="08x-xxx-xxxx" />
        </label>

        <button type="submit" class="modal-primary">เพิ่มรายชื่อทีมงาน</button>
      </form>
    `);

    $('#addCrewForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#crewName').value.trim();
      const role = $('#crewRole').value.trim();
      const phone = $('#crewPhone').value.trim();

      state.eventCommand.crewList.push({
        id: `cr-${Date.now().toString(36)}`,
        name,
        handle: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        role,
        phone,
        status: 'on-duty'
      });

      saveFeaturesState();
      closeModal();
      openCommandCenterModal();
      toast('เพิ่มทีมงานในระบบเรียบร้อย');
    });
  }

  /* --- Right column preview block --- */
  function renderCommandPreview() {
    const host = $('#commandPreviewBody');
    if (!host) return;
    const data = state.eventCommand || {};
    const expenses = Array.isArray(data.expenses) ? data.expenses : [];
    const totalExpenses = expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const revenue = Number(data.grossTicketRevenue) || 0;
    const profit = revenue - totalExpenses;
    host.innerHTML = `
      <div class="command-mini-card">
        <strong>${esc(data.title || 'อีเวนต์ของคุณ')}</strong>
        <small>${esc(data.venue || 'ยังไม่ระบุสถานที่')} · ${esc(data.dateLabel || 'ยังไม่ระบุวันที่')}</small>
        <div class="command-mini-stats">
          <div><b>${money(revenue)}</b><span>ยอดขายบัตร</span></div>
          <div><b>${money(totalExpenses)}</b><span>รายจ่าย</span></div>
          <div><b>${money(profit)}</b><span>กำไรสุทธิ</span></div>
        </div>
      </div>
    `;
  }

  function bindStatic() {
    $('#commandCenterBtn')?.addEventListener('click', e => {
      e.preventDefault();
      openCommandCenterModal();
    });
  }

  Object.assign(F, { openCommandCenterModal, renderCommandPreview, openAddExpenseModal, openAddCrewModal });
  F.command = { bindStatic };
})(window);
