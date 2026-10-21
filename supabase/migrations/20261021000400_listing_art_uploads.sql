-- Public portfolio previews with owner-scoped uploads and deletions.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sourcewav-listings','sourcewav-listings',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy sourcewav_listing_images_read on storage.objects for select to anon,authenticated
  using (bucket_id='sourcewav-listings');
create policy sourcewav_listing_images_insert_owner on storage.objects for insert to authenticated
  with check (bucket_id='sourcewav-listings' and (storage.foldername(name))[1]=auth.uid()::text);
create policy sourcewav_listing_images_delete_owner on storage.objects for delete to authenticated
  using (bucket_id='sourcewav-listings' and (storage.foldername(name))[1]=auth.uid()::text);
create policy listings_delete_self on public.listings for delete to authenticated using (seller_id=auth.uid());
commit;
