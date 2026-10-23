# ย้ายรูป/เพลง: Cloudflare R2 (หลัก) + AWS S3 (สำรอง) — เสร็จแล้ว

สถาปัตยกรรม **dual-write dual-presign**: ทุกไฟล์ใหม่ถูกอัปโหลดคู่ R2 + S3 พร้อมกัน (ทั้งสองฝั่งต้องสำเร็จ ไม่งั้นอัปโหลดล้มให้ลองใหม่)
อ่านจาก R2 (`r2.dev` public URL) เป็นค่าหลัก — ถ้าใช้เกิน 10GB หรือ r2.dev มีข้อจำกัด สลับ read base กลับ CloudFront ได้ทันทีโดยไม่ต้องย้ายไฟล์

- R2 (หลัก): bucket `sourcewav-media` (APAC) · public `https://pub-667ffd230d2844b3b68665deae178321.r2.dev` · endpoint S3 API `https://1d5ebb68ef9656083d7641f3e81db008.r2.cloudflarestorage.com` · region `auto` · CORS mirror AWS
- AWS S3 (สำรอง): bucket `sourcewav-media-090597374942` (ap-southeast-2, private, SSE-S3) · CloudFront `https://dqt44cz8e0acj.cloudfront.net` · IAM `sourcewav-media-writer` (สิทธิ์ Object บน bucket เดียว)
- สลิปโอนเงิน (`sourcewav-ticket-slips`): ยังอยู่ Supabase Storage เท่านั้น (ไม่แตะ `platform-ui.js:468,511`)
- ไฟล์เดิมใน Supabase ไม่ลบ (เก็บไว้ rollback)

## Checklist (ทำครบแล้ว 2026-10-23)
- [x] A1. สร้าง S3 bucket + CloudFront OAC (Sydney, private, SSE-S3, CORS+ETag)
- [x] A2. สร้าง IAM user สิทธิ์ Object บน bucket เดียว + access key
- [x] B1. Supabase Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_PUBLIC_URL`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `MEDIA_PUBLIC_URL`
- [x] B2. Edge Function `s3-sign` = dual-presign (PUT/DELETE คู่ R2 path-style + S3 virtual-host) ตรวจชนิด/ขนาด/ key เป็นของ user + ข้อความไทยเดิมทุกจุด
- [x] B3. deploy s3-sign (verify_jwt=false ตามเดิม)
- [x] C1. helper อัปโหลดใน `supabase-client.js`: `window.SourcewavS3` ยิงคู่ `signed.uploads.r2` + `signed.uploads.s3` ด้วย Promise.allSettled — ทั้งคู่ต้องสำเร็จ
- [x] C2. เปลี่ยนจุดอัปโหลดทุกจุดแล้ว (streaming-app 17 จุด, account-ui, platform-ui, artist-store, booking-board — เหลือ `.storage.from(` แค่ 2 บรรทัดสลิป)
- [x] C3. อ่านจาก `MEDIA_PUBLIC_URL` (r2.dev) — ทั้ง client และ Edge Functions create-event / my-orders / create-manual-ticket-order
- [x] D1. ย้ายไฟล์เดิม 23 ไฟล์ (~45MB, ไม่รวมสลิป) ขึ้น R2 + S3 แล้ว (function `migrate-media` ย้ายเสร็จ failed:0 → ลบทิ้งแล้ว)
- [x] D2. rewrite URL ใน DB (`profiles.avatar_url`, `user_states.state.avatarUrl`, `events.cover_url`, `events.poster_urls`) → r2.dev เหลือ 0 ทุกคอลัมน์
- [x] E1. build pages + deploy + preflight + tests 27/27
- [x] E2. verify จริง: r2.dev GET 200 + size/content-type ตรงทุกไฟล์ตัวอย่าง · S3 HeadObject ตรง · เว็บ deploy แล้วใช้ r2.dev + dual upload
- [x] E3. ไฟล์เดิมใน Supabase ไม่ลบ (rollback)

## วิธีสลับ read base เมื่อต้องการ
แก้จุดเดียว: ค่า `MEDIA_PUBLIC_URL` ใน `supabase-client.js` (ฝั่งอ่าน) — และ/หรือ secret `MEDIA_PUBLIC_URL` ใน Supabase (ฝั่ง Edge Functions) แล้ว deploy ใหม่ ไม่ต้องย้ายไฟล์ เพราะทุกไฟล์มีสำเนาครบสองที่แล้ว

## ข้อจำกัดที่ทราบ
- `r2.dev` public URL เป็น managed domain สำหรับ dev — มี rate limit และไม่เหมาะ production ระยะยาว ถ้าจะใช้จริงระยะยาวเพิ่ม custom domain บน R2 (Dashboard → bucket → Settings → Domains) แล้วแก้ `MEDIA_PUBLIC_URL`
- AWS key ห้ามอยู่ฝั่งเบราว์เซอร์ — ทุกการเซ็นชื่ออยู่ใน `s3-sign` เท่านั้น
