create extension if not exists pgtap with schema extensions;

begin;
select extensions.plan(25);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('11111111-1111-4111-8111-111111111111','authenticated','authenticated','ticket-organizer@example.test','',now(),'{}','{"username":"ticket_test_org","display_name":"Ticket Test Organizer"}',now(),now()),
  ('11111111-1111-4111-8111-111111111112','authenticated','authenticated','ticket-buyer-one@example.test','',now(),'{}','{"username":"ticket_test_buyer1","display_name":"Ticket Test Buyer One"}',now(),now()),
  ('11111111-1111-4111-8111-111111111113','authenticated','authenticated','ticket-buyer-two@example.test','',now(),'{}','{"username":"ticket_test_buyer2","display_name":"Ticket Test Buyer Two"}',now(),now());

insert into public.user_roles(user_id,role)
values ('11111111-1111-4111-8111-111111111111','organizer');

insert into public.events(
  id,organizer_id,title,description,category,starts_at,ends_at,status,currency,
  venue_name,venue_address,refund_policy
) values (
  '22222222-2222-4222-8222-222222222221','11111111-1111-4111-8111-111111111111',
  'Ticket Flow Test Event','pgTAP fixture','music',now()+interval '1 day',now()+interval '1 day 3 hours',
  'published','THB','Test Hall','Test Address','คืนเงินได้เมื่อผู้จัดยกเลิกงาน ติดต่อผู้จัดผ่านแชท'
);

insert into public.event_payment_methods(
  event_id,organizer_id,qr_storage_key,bank_name,beneficiary_name,account_last4,
  slipok_branch_id,slipok_api_key_ciphertext
) values (
  '22222222-2222-4222-8222-222222222221','11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111/qr.jpg','Test Bank','Ticket Test Organizer','1234','12345','test-ciphertext'
);

insert into public.ticket_types(id,event_id,name,price_minor,currency,quantity_total)
values
  ('33333333-3333-4333-8333-333333333331','22222222-2222-4222-8222-222222222221','Last Seat',35000,'THB',1),
  ('33333333-3333-4333-8333-333333333332','22222222-2222-4222-8222-222222222221','Second Tier',35000,'THB',1);

create temporary table ticket_test_state (name text primary key, id uuid not null) on commit drop;

insert into ticket_test_state(name,id)
select 'order_one',order_id from public.reserve_manual_ticket_order(
  '11111111-1111-4111-8111-111111111112','33333333-3333-4333-8333-333333333331',1,
  '44444444-4444-4444-8444-444444444441'
);

select extensions.is(
  (select status from public.orders where id=(select id from ticket_test_state where name='order_one')),
  'awaiting_payment'::text,
  'reservation persists one order before transfer'
);
select extensions.is(
  (select total_minor from public.orders where id=(select id from ticket_test_state where name='order_one')),
  35000::bigint,
  'server snapshots the exact ticket amount'
);
select extensions.is(
  (select quantity_reserved from public.ticket_types where id='33333333-3333-4333-8333-333333333331'),
  1,
  'reservation atomically holds the last ticket'
);
select extensions.is(
  (select event_title_snapshot from public.orders where id=(select id from ticket_test_state where name='order_one')),
  'Ticket Flow Test Event'::text,
  'reservation snapshots the event title'
);
select extensions.is(
  (select event_starts_at_snapshot from public.orders where id=(select id from ticket_test_state where name='order_one')),
  (select starts_at from public.events where id='22222222-2222-4222-8222-222222222221'),
  'reservation snapshots the event start time'
);
select extensions.is(
  (select event_venue_name_snapshot from public.orders where id=(select id from ticket_test_state where name='order_one')),
  'Test Hall'::text,
  'reservation snapshots the venue name'
);
select extensions.is(
  (select event_venue_address_snapshot from public.orders where id=(select id from ticket_test_state where name='order_one')),
  'Test Address'::text,
  'reservation snapshots the venue address'
);

select extensions.is(
  (select order_id from public.reserve_manual_ticket_order(
    '11111111-1111-4111-8111-111111111112','33333333-3333-4333-8333-333333333331',1,
    '44444444-4444-4444-8444-444444444441'
  )),
  (select id from ticket_test_state where name='order_one'),
  'repeating an idempotency key returns the same order'
);
select extensions.is(
  (select quantity_reserved from public.ticket_types where id='33333333-3333-4333-8333-333333333331'),
  1,
  'idempotent retry does not reserve inventory twice'
);
select extensions.throws_ok(
  $$select * from public.reserve_manual_ticket_order(
    '11111111-1111-4111-8111-111111111113','33333333-3333-4333-8333-333333333331',1,
    '44444444-4444-4444-8444-444444444442'
  )$$,
  'P0001',
  'Not enough tickets remaining',
  'a second buyer cannot reserve the last ticket'
);

update public.events set title='Changed Event Name',starts_at=starts_at+interval '1 day',venue_name='Changed Hall',venue_address='Changed Address',refund_policy='Updated policy must not alter an existing order' where id='22222222-2222-4222-8222-222222222221';
select extensions.is(
  (select event_title_snapshot from public.orders where id=(select id from ticket_test_state where name='order_one')),
  'Ticket Flow Test Event'::text,
  'later event edits do not change the order title'
);
select extensions.is(
  (select event_venue_name_snapshot from public.orders where id=(select id from ticket_test_state where name='order_one')),
  'Test Hall'::text,
  'later event edits do not change the order venue'
);
update public.event_payment_methods set bank_name='Changed Bank' where event_id='22222222-2222-4222-8222-222222222221';
select extensions.is(
  (select refund_policy_snapshot from public.orders where id=(select id from ticket_test_state where name='order_one')),
  'คืนเงินได้เมื่อผู้จัดยกเลิกงาน ติดต่อผู้จัดผ่านแชท'::text,
  'refund policy remains snapshotted on the order'
);
select extensions.is(
  (select bank_name from public.reserve_manual_ticket_order(
    '11111111-1111-4111-8111-111111111112','33333333-3333-4333-8333-333333333331',1,
    '44444444-4444-4444-8444-444444444441'
  )),
  'Test Bank'::text,
  'recipient shown by an idempotent retry remains the original recipient'
);

update public.orders set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes'
where id=(select id from ticket_test_state where name='order_one');
select public.release_ticket_order((select id from ticket_test_state where name='order_one'),'expired');
select public.release_ticket_order((select id from ticket_test_state where name='order_one'),'expired');
select extensions.is(
  (select quantity_reserved from public.ticket_types where id='33333333-3333-4333-8333-333333333331'),
  0,
  'expiry releases inventory exactly once'
);
select extensions.is(
  (select status from public.payments where order_id=(select id from ticket_test_state where name='order_one')),
  'expired'::text,
  'expired order also expires its pending payment'
);

insert into ticket_test_state(name,id)
select 'attempt_one',public.claim_slipok_ticket_verification(
  (select id from ticket_test_state where name='order_one'),'11111111-1111-4111-8111-111111111112'
)::uuid;
select public.finish_slipok_ticket_verification_with_slip(
  (select id from ticket_test_state where name='attempt_one'),'verified',200,'',35000,true,
  'TEST-TRANSFER-001',(select created_at+interval '10 minutes' from public.orders where id=(select id from ticket_test_state where name='order_one')),
  '11111111-1111-4111-8111-111111111112/'||(select id::text from ticket_test_state where name='order_one')||'/verified.jpg'
);
select extensions.is(
  public.record_slipok_ticket_submission(
    (select id from ticket_test_state where name='order_one'),'11111111-1111-4111-8111-111111111112',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111112/'||(select id::text from ticket_test_state where name='order_one')||'/verified.jpg',
    'verified',200,'SlipOK verified',35000,'TEST-TRANSFER-001',
    (select created_at+interval '10 minutes' from public.orders where id=(select id from ticket_test_state where name='order_one')),
    '{"success":true,"receiverVerified":true}'::jsonb
  ),
  'review_required'::text,
  'a timely transfer submitted after expiry is preserved for review instead of lost'
);
insert into ticket_test_state(name,id)
select 'submission_one',id from public.ticket_payment_submissions where order_id=(select id from ticket_test_state where name='order_one');
select extensions.is(
  (select status from public.orders where id=(select id from ticket_test_state where name='order_one')),
  'disputed'::text,
  'verified late transfer cannot auto-issue or disappear'
);

select extensions.is(
  public.review_slipok_ticket_payment(
    (select id from ticket_test_state where name='submission_one'),
    '11111111-1111-4111-8111-111111111111','approved','ตรวจยอดเงินจริงแล้ว',
    jsonb_build_array(jsonb_build_object(
      'id','55555555-5555-4555-8555-555555555551',
      'order_item_id',(select id from public.order_items where order_id=(select id from ticket_test_state where name='order_one')),
      'ticket_number',1,'qr_code_hash','test-qr-hash-1'
    ))
  ),
  'approved'::text,
  'organizer can approve verified payment after inventory review'
);
select extensions.is(
  (select quantity_sold from public.ticket_types where id='33333333-3333-4333-8333-333333333331'),
  1,
  'manual approval moves inventory from reserved to sold once'
);
select extensions.is(
  public.review_slipok_ticket_payment(
    (select id from ticket_test_state where name='submission_one'),
    '11111111-1111-4111-8111-111111111111','approved','retry', '[]'::jsonb
  ),
  'already_paid'::text,
  'repeating organizer approval does not issue extra tickets'
);
select extensions.is(
  (select count(*)::integer from public.tickets where order_item_id=(select id from public.order_items where order_id=(select id from ticket_test_state where name='order_one'))),
  1,
  'repeated approval leaves ticket count unchanged'
);

insert into ticket_test_state(name,id)
select 'order_two',order_id from public.reserve_manual_ticket_order(
  '11111111-1111-4111-8111-111111111113','33333333-3333-4333-8333-333333333332',1,
  '44444444-4444-4444-8444-444444444443'
);
select extensions.throws_ok(
  $$select public.record_slipok_ticket_submission(
    (select id from ticket_test_state where name='order_two'),
    '11111111-1111-4111-8111-111111111113','11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111113/'||(select id::text from ticket_test_state where name='order_two')||'/duplicate.jpg',
    'verified',200,'SlipOK duplicate',35000,'TEST-TRANSFER-001',now(),
    '{"success":true,"receiverVerified":true}'::jsonb
  )$$,
  '23505',
  null,
  'one verified transaction reference cannot pay a second order'
);
select extensions.is(
  (select status from public.orders where id=(select id from ticket_test_state where name='order_two')),
  'awaiting_payment'::text,
  'duplicate transaction attempt does not change the second order state'
);
select extensions.is(
  (select count(*)::integer from public.ticket_payment_submissions where order_id=(select id from ticket_test_state where name='order_two')),
  0,
  'duplicate transaction attempt does not create an issuable submission'
);

select * from extensions.finish();
rollback;
