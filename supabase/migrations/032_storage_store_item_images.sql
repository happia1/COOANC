-- 마켓 상품 이미지용 Storage 버킷 + 정책
-- 경로: {auth.uid()}/{uuid}.확장자 — 본인 폴더에만 업로드, 읽기는 공개(자녀 마켓 썸네일)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store_item_images',
  'store_item_images',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "store_item_images_public_read" on storage.objects;
create policy "store_item_images_public_read"
  on storage.objects for select
  using (bucket_id = 'store_item_images');

drop policy if exists "store_item_images_authenticated_upload" on storage.objects;
create policy "store_item_images_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'store_item_images'
    and split_part(name, '/', 1) = auth.uid()::text
  );

notify pgrst, 'reload schema';
