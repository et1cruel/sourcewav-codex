import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detectSlipImage, evaluateSlipOk, attemptStatusForHttp } from '../supabase/functions/_shared/slipok-validation.mjs';

const verifiedResult = () => ({
  responseOk: true,
  responseStatus: 200,
  expectedAmountMinor: 125000,
  expectedAccountLast4: '1234',
  result: {
    success: true,
    code: 200,
    data: {
      success: true,
      amount: 1250,
      transTimestamp: '2026-08-01T04:00:00.000Z',
      countryCode: 'TH',
      transRef: 'SW-TRANSFER-01',
      receiver: { account: { value: 'xxx-x-xx1234-x' } },
    },
  },
});

test('1. valid SlipOK result with matching seller account verifies', () => {
  assert.equal(evaluateSlipOk(verifiedResult()).verified, true);
});

test('2. provider rejection does not verify a fake slip', () => {
  const result = verifiedResult();
  result.result.success = false;
  result.result.data.success = false;
  assert.equal(evaluateSlipOk(result).verified, false);
});

test('3. mismatched amount is rejected in minor units', () => {
  const result = verifiedResult();
  result.result.data.amount = 1249.99;
  const checked = evaluateSlipOk(result);
  assert.equal(checked.verified, false);
  assert.equal(checked.failureReason, 'amount_mismatch');
});

test('4. mismatched seller account is rejected when account digits are exposed', () => {
  const result = verifiedResult();
  result.result.data.receiver.account.value = 'xxx-x-xx9876-x';
  assert.equal(evaluateSlipOk(result).failureReason, 'receiver_mismatch');
});

test('5. successful verification carries a transaction reference for same-order idempotency', async () => {
  const checked = evaluateSlipOk(verifiedResult());
  assert.equal(checked.verified, true);
  assert.equal(checked.transRef, 'SW-TRANSFER-01');
  const sql = await readFile(new URL('../supabase/migrations/20261021000000_initial_sourcewav_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /provider_reference\s+text\s+unique/i);
});

test('6. a database unique reference rejects cross-order slip reuse', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261021000700_slipok_ticket_payments.sql', import.meta.url), 'utf8');
  assert.match(sql, /trans_ref\s+text\s+unique/i);
});

test('7. concurrent issuance is guarded by an atomic order lock', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261021000700_slipok_ticket_payments.sql', import.meta.url), 'utf8');
  assert.match(sql, /issue_slipok_ticket_order[\s\S]*?from public\.orders where id=v_submission\.order_id for update/i);
  assert.match(sql, /provider_reference=v_submission\.trans_ref/i);
});

test('8. provider timeout and service failure are durable non-paid attempt states', async () => {
  assert.equal(attemptStatusForHttp(503), 'error');
  const sql = await readFile(new URL('../supabase/migrations/20261022000500_slipok_audit_expiry.sql', import.meta.url), 'utf8');
  assert.match(sql, /'processing','verified','rejected','error','timeout','quota_exhausted'/);
});

test('9. provider quota exhaustion maps to an audit failure', () => {
  assert.equal(attemptStatusForHttp(429), 'quota_exhausted');
});

test('10. verified late payment is kept for manual review without automatic issue', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261022000500_slipok_audit_expiry.sql', import.meta.url), 'utf8');
  assert.match(sql, /if v_expired and p_slip_status='verified'[\s\S]*?status='disputed'[\s\S]*?return 'review_required'/i);
});

test('11. server order amount controls verification regardless of browser input', () => {
  const result = verifiedResult();
  result.expectedAmountMinor = 1;
  assert.equal(evaluateSlipOk(result).failureReason, 'amount_mismatch');
});

test('12. ticket reads are scoped to the authenticated owner', async () => {
  const source = await readFile(new URL('../supabase/functions/my-tickets/index.ts', import.meta.url), 'utf8');
  assert.match(source, /\.eq\('owner_id', user\.id\)/);
});

test('13. order snapshots keep the organizer and payment recipient stable', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261023000700_ticket_order_snapshots_and_recovery.sql', import.meta.url), 'utf8');
  assert.match(sql, /organizer_name_snapshot/);
  assert.match(sql, /payment_qr_storage_key_snapshot/);
  assert.match(sql, /slipok_api_key_ciphertext_snapshot/);
  assert.match(sql, /revoke all on public\.orders from anon, authenticated/i);
});

test('14. cross-order duplicate references are held for review without an issuable verified submission', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261023000700_ticket_order_snapshots_and_recovery.sql', import.meta.url), 'utf8');
  assert.match(sql, /failure_reason='duplicate_transaction_reference'/);
  assert.match(sql, /'เลขอ้างอิงธุรกรรมนี้ถูกใช้กับคำสั่งซื้ออื่นแล้ว'[\s\S]*?null,v_attempt\.transfer_timestamp,jsonb_build_object\('success',false,'failureReason','duplicate_transaction_reference'/);
  assert.match(sql, /v_submission\.slipok_status<>'verified' or v_submission\.trans_ref is null/i);
});

test('15. organizer review requires verified payment facts and locks ticket stock before issuance', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261023000700_ticket_order_snapshots_and_recovery.sql', import.meta.url), 'utf8');
  assert.match(sql, /v_submission\.slipok_status<>'verified' or v_submission\.trans_ref is null/i);
  assert.match(sql, /from public\.ticket_types where id=v_item\.ticket_type_id for update/i);
  assert.match(sql, /Inventory unavailable; keep payment in review/);
});

test('16. SlipOK transaction timestamp is required and retained for late-slip review', async () => {
  const result = verifiedResult();
  const checked = evaluateSlipOk(result);
  assert.equal(checked.verified, true);
  assert.equal(checked.transferAt, '2026-08-01T04:00:00.000Z');
  delete result.result.data.transTimestamp;
  assert.equal(evaluateSlipOk(result).failureReason, 'transfer_timestamp_missing');
  const sql = await readFile(new URL('../supabase/migrations/20261023000700_ticket_order_snapshots_and_recovery.sql', import.meta.url), 'utf8');
  assert.match(sql, /transfer_timestamp/);
  assert.match(sql, /p_transfer_at[\s\S]*?v_order\.created_at[\s\S]*?v_order\.expires_at/);
});

test('17. organizer retry uses only a stored private slip and requires event ownership', async () => {
  const source = await readFile(new URL('../supabase/functions/admin-retry-ticket-verification/index.ts', import.meta.url), 'utf8');
  const queue = await readFile(new URL('../features/command-center.js', import.meta.url), 'utf8');
  assert.match(source, /authenticatedUser\(request\)/);
  assert.match(source, /event\?\.organizer_id !== user\.id/);
  assert.match(source, /provider_timeout[\s\S]*provider_unavailable/);
  assert.match(source, /download\(previous\.slip_storage_key\)/);
  assert.match(source, /verification-\$\{crypto\.randomUUID\(\)\}/);
  assert.match(source, /upload\(retrySlipKey, bytes/);
  assert.match(source, /claim_slipok_ticket_verification/);
  assert.match(source, /log', 'true'/);
  assert.match(source, /record_slipok_ticket_submission/);
  assert.match(queue, /admin-retry-ticket-verification/);
  assert.match(queue, /data-retry-verification/);
});

test('18. invalid SlipOK credentials can retry with a rotated key only on the original branch', async () => {
  const source = await readFile(new URL('../supabase/functions/admin-retry-ticket-verification/index.ts', import.meta.url), 'utf8');
  const queue = await readFile(new URL('../features/command-center.js', import.meta.url), 'utf8');
  assert.match(source, /provider_timeout', 'provider_unavailable', 'invalid_slipok_credentials/);
  assert.match(source, /from\('event_payment_methods'\)[\s\S]*?slipok_branch_id,slipok_api_key_ciphertext/);
  assert.match(source, /currentMethod\?\.organizer_id !== order\.organizer_id_snapshot/);
  assert.match(source, /currentMethod\?\.slipok_branch_id !== order\.slipok_branch_id_snapshot/);
  assert.match(source, /apiKeyCiphertext = currentMethod\.slipok_api_key_ciphertext/);
  assert.match(queue, /provider_timeout', 'provider_unavailable', 'invalid_slipok_credentials/);
});

test('19. credential failures do not consume the order SlipOK verification quota', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261023000700_ticket_order_snapshots_and_recovery.sql', import.meta.url), 'utf8');
  assert.match(sql, /p_provider_code in \(1001,1002\) or p_failure_reason='invalid_slipok_credentials'/);
});

test('20. buyers can contact the snapshotted event organizer with the order reference', async () => {
  const api = await readFile(new URL('../supabase/functions/my-orders/index.ts', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../platform-ui.js', import.meta.url), 'utf8');
  assert.match(api, /organizerId: row\.organizer_id_snapshot/);
  assert.match(ui, /data-order-contact="\$\{esc\(order\.organizerId\)\}"/);
  assert.match(ui, /data-order-ref="SW-\$\{orderRef\}"/);
  assert.match(ui, /ขอติดต่อเรื่องคำสั่งซื้อ \$\{orderRef\}/);
  assert.match(ui, /การปฏิเสธรายการไม่ได้ยืนยันว่าคืนเงินแล้ว/);
});

test('21. event refund terms are validated, snapshotted on the order, and shown to buyers', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261023000700_ticket_order_snapshots_and_recovery.sql', import.meta.url), 'utf8');
  const createEvent = await readFile(new URL('../supabase/functions/create-event/index.ts', import.meta.url), 'utf8');
  const createOrder = await readFile(new URL('../supabase/functions/create-manual-ticket-order/index.ts', import.meta.url), 'utf8');
  const orders = await readFile(new URL('../supabase/functions/my-orders/index.ts', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../platform-ui.js', import.meta.url), 'utf8');
  assert.match(migration, /refund_policy_snapshot/);
  assert.match(migration, /v_event\.refund_policy/);
  assert.match(createEvent, /refundPolicy\.length < 10[\s\S]*refund_policy: refundPolicy/);
  assert.match(createOrder, /refundPolicy: order\.refund_policy/);
  assert.match(orders, /refund_policy_snapshot/);
  assert.match(ui, /newEventRefundPolicy/);
  assert.match(ui, /payment-refund-policy/);
  assert.match(ui, /my-order-policy/);
});

test('22. organizer review decisions and notes are visible to the buyer', async () => {
  const api = await readFile(new URL('../supabase/functions/my-orders/index.ts', import.meta.url), 'utf8');
  const review = await readFile(new URL('../supabase/functions/admin-review-ticket-payment/index.ts', import.meta.url), 'utf8');
  const queue = await readFile(new URL('../features/command-center.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../platform-ui.js', import.meta.url), 'utf8');
  assert.match(api, /ticket_payment_reviews\(decision,note,reviewer_role,created_at\)/);
  assert.match(api, /latestReview: latestReview \?/);
  assert.match(ui, /ผู้จัดปฏิเสธการอนุมัติรายการ/);
  assert.match(ui, /หมายเหตุจากผู้จัด/);
  assert.match(ui, /การปฏิเสธไม่ได้ยืนยันว่าคืนเงินแล้ว/);
  assert.match(ui, /data-order-contact=.*data-order-ref=/);
  assert.match(review, /note\.length < 3/);
  assert.match(queue, /note\.length < 3/);
});

test('23. Supabase pgTAP suite covers reservation, expiry, recovery, and global reference uniqueness', async () => {
  const sql = await readFile(new URL('../supabase/tests/ticketing-flow.test.sql', import.meta.url), 'utf8');
  assert.match(sql, /extensions\.plan\(25\)/);
  assert.match(sql, /repeating an idempotency key returns the same order/);
  assert.match(sql, /a second buyer cannot reserve the last ticket/);
  assert.match(sql, /expiry releases inventory exactly once/);
  assert.match(sql, /timely transfer submitted after expiry is preserved for review/);
  assert.match(sql, /repeating organizer approval does not issue extra tickets/);
  assert.match(sql, /one verified transaction reference cannot pay a second order/);
  assert.match(sql, /later event edits do not change the order title/);
  assert.match(sql, /reservation snapshots the event start time/);
  assert.match(sql, /rollback;/i);
});

test('24. buyers see the event name, date, and venue from an immutable order snapshot', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261023000700_ticket_order_snapshots_and_recovery.sql', import.meta.url), 'utf8');
  const createOrder = await readFile(new URL('../supabase/functions/create-manual-ticket-order/index.ts', import.meta.url), 'utf8');
  const myOrders = await readFile(new URL('../supabase/functions/my-orders/index.ts', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../platform-ui.js', import.meta.url), 'utf8');
  assert.match(migration, /event_title_snapshot/);
  assert.match(migration, /event_starts_at_snapshot/);
  assert.match(migration, /event_venue_name_snapshot/);
  assert.match(migration, /event_venue_address_snapshot/);
  assert.match(createOrder, /startsAt: order\.event_starts_at/);
  assert.match(createOrder, /venueName: order\.venue_name/);
  assert.match(myOrders, /row\.event_starts_at_snapshot \|\| event\?\.starts_at/);
  assert.match(myOrders, /row\.event_venue_address_snapshot \|\| event\?\.venue_address/);
  assert.match(ui, /payment-event-meta/);
  assert.match(ui, /class="my-order-venue"/);
});

test('25. reopening orders preserves event details and shows outage guidance without another transfer', async () => {
  const ui = await readFile(new URL('../platform-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /startsAt: order\.startsAt, endsAt: order\.endsAt, venueName: order\.venueName, venueAddress: order\.venueAddress/);
  assert.match(ui, /verificationStatus: order\.verificationStatus/);
  assert.match(ui, /verificationIssue: order\.verificationIssue/);
  assert.match(ui, /function verificationFollowUp\(order\)/);
  assert.match(ui, /ระบบเก็บรายการไว้แล้ว[^'`]*ไม่ต้องโอนเงินซ้ำ/);
  assert.match(ui, /qrColumn\.hidden = true/);
  assert.match(ui, /const waitForOrganizer = \['invalid_slipok_credentials', 'quota_exhausted'\]/);
  assert.match(ui, /const contact = followUp && order\.organizerId/);
  assert.match(ui, /ติดต่อผู้จัดพร้อมเลขคำสั่งซื้อ/);
  assert.match(ui, /order\.eventStatus === 'published'[\s\S]*startNewTicketOrder/);
  assert.match(ui, /class="payment-event-meta"/);
});

test('26. organizer payment and retry queues show the order event snapshot', async () => {
  const api = await readFile(new URL('../supabase/functions/admin-list-ticket-payments/index.ts', import.meta.url), 'utf8');
  const queue = await readFile(new URL('../features/command-center.js', import.meta.url), 'utf8');
  assert.match(api, /event_title_snapshot,event_starts_at_snapshot,event_venue_name_snapshot,event_venue_address_snapshot/);
  assert.match(api, /row\.orders\.event_title_snapshot \|\| row\.events\.title/);
  assert.match(api, /row\.orders\.event_starts_at_snapshot \|\| row\.events\.starts_at/);
  assert.match(api, /row\.orders\.event_venue_name_snapshot \|\| row\.events\.venue_name/);
  assert.match(queue, /attempt\.venueName \|\| 'ยังไม่ระบุสถานที่'[\s\S]*when\(attempt\.eventStartsAt\)/);
});

test('slip image MIME type must match its actual bytes', () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(detectSlipImage(png, 'image/png')?.mime, 'image/png');
  assert.equal(detectSlipImage(png, 'image/jpeg'), null);
  assert.equal(detectSlipImage(new Uint8Array([1, 2, 3]), 'image/png'), null);
});
