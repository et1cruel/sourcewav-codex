-- Store up to four event poster URLs while keeping cover_url as the primary image for older clients.
alter table public.events
  add column poster_urls text[] not null default '{}'::text[];

update public.events
set poster_urls = array[cover_url]
where cover_url is not null and cardinality(poster_urls) = 0;

alter table public.events
  add constraint events_poster_urls_max_four
  check (cardinality(poster_urls) <= 4);

-- Rollback: drop the constraint and poster_urls column; cover_url retains the primary poster.
