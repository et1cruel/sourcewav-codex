select 'profiles.avatar_url' as location, user_id::text as row_id, avatar_url as value
from profiles where avatar_url like '%supabase.co/storage%'
union all
select 'events.cover_url', id::text, cover_url from events where cover_url like '%supabase.co/storage%'
union all
select 'events.poster_urls', id::text, poster_urls::text from events where poster_urls::text like '%supabase.co/storage%'
union all
select 'user_states.state', user_id::text, state::text from user_states where state::text like '%supabase.co/storage%'
union all
select 'artist_products.image_url', id::text, image_url from artist_products where image_url like '%supabase.co/storage%'
union all
select 'artist_products.preview_audio_url', id::text, preview_audio_url from artist_products where preview_audio_url like '%supabase.co/storage%'
union all
select 'booking_cards.portfolio_image_url', id::text, portfolio_image_url from booking_cards where portfolio_image_url like '%supabase.co/storage%'
union all
select 'booking_cards.portfolio_audio_url', id::text, portfolio_audio_url from booking_cards where portfolio_audio_url like '%supabase.co/storage%';
