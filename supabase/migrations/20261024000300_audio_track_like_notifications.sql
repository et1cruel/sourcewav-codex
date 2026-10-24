begin;

create or replace function public.notify_audio_track_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  track_owner uuid;
  track_title text;
begin
  if tg_op = 'DELETE' then
    delete from public.notifications
    where kind = 'audio_track_like'
      and payload->>'track_id' = old.track_id::text
      and payload->>'actor_id' = old.user_id::text;
    return old;
  end if;

  select owner_id, title into track_owner, track_title
  from public.audio_tracks where id = new.track_id;

  if track_owner is not null and track_owner <> new.user_id then
    insert into public.notifications (user_id, kind, payload)
    values (track_owner, 'audio_track_like', jsonb_build_object(
      'actor_id', new.user_id,
      'track_id', new.track_id,
      'track_title', track_title
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists audio_track_like_notification on public.audio_track_likes;
create trigger audio_track_like_notification
after insert or delete on public.audio_track_likes
for each row execute function public.notify_audio_track_like();

revoke all on function public.notify_audio_track_like() from public;
grant select on public.notifications to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

commit;
