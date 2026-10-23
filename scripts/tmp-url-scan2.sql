select 'event_expenses.receipt_url' as location, id::text as row_id, receipt_url as value
from event_expenses where receipt_url like '%supabase.co/storage%'
union all
select 'drop_alerts.action_url', id::text, action_url from drop_alerts where action_url like '%supabase.co/storage%';

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (data_type in ('jsonb', 'json', 'ARRAY') or column_name like '%url%')
order by table_name, column_name;
