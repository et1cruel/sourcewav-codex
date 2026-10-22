-- Public browsing is available to visitors without requiring a Sourcewav account.
-- Row-level policies still limit results to public, published records.
begin;

grant select on public.events, public.ticket_types to anon;
grant select on public.posts, public.profiles, public.audio_tracks to anon;
grant select on public.listings, public.listing_media to anon;
grant select on public.comments, public.reactions to anon;

commit;
