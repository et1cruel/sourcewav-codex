select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (column_name like '%url%' or column_name like '%image%' or column_name like '%avatar%' or column_name like '%cover%')
  and data_type in ('text', 'character varying', 'jsonb', 'json')
order by table_name, column_name;
