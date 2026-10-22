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

test('slip image MIME type must match its actual bytes', () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(detectSlipImage(png, 'image/png')?.mime, 'image/png');
  assert.equal(detectSlipImage(png, 'image/jpeg'), null);
  assert.equal(detectSlipImage(new Uint8Array([1, 2, 3]), 'image/png'), null);
});
