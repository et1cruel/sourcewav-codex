# ย้ายรูป/เพลง: Cloudflare R2 (หลัก) + AWS S3 (สำรอง) — เสร็จแล้ว

## แก้ไฟล์เพลงตกค้าง 2026-10-24

พบเพลงใหม่ 5 เพลงที่ฐานข้อมูลชี้ storage key ถูกต้อง แต่ไฟล์ยังอยู่ใน Supabase Storage เดิมและไม่อยู่ใน R2 ทำให้หน้าเพลงตอบ 404 หลังเปลี่ยน read base จึงคัดลอกเฉพาะไฟล์ที่ขาด (เสียง 5 ไฟล์ ปก 5 ไฟล์ แบนเนอร์ 1 ไฟล์) เข้า R2 ด้วย key เดิม โดยเก็บต้นฉบับไว้ ตรวจไฟล์ที่หน้าเพลงใช้อ่านได้ด้วย `node scripts/check-track-media.mjs` ซึ่งตรวจ HTTP, content type และขนาดไฟล์เสียงเทียบฐานข้อมูล การซ่อมครั้งนี้เติมไฟล์ใน R2; ไม่ได้ตรวจหรือเติมสำเนา S3 ของไฟล์ชุดนี้

สถาปัตยกรรม **dual-write dual-presign**: ทุกไฟล์ใหม่ถูกอัปโหลดคู่ R2 + S3 พร้อมกัน (ทั้งสองฝั่งต้องสำเร็จ ไม่งั้นอัปโหลดล้มให้ลองใหม่)
หน้าเว็บอ่านจาก R2 ผ่าน Pages Function ที่ `https://sourcewav-community.pages.dev/media/` ซึ่งรองรับ HTTP Range; `r2.dev` ยังเปิดไว้เป็นทางเดิม แต่ไม่ได้ใช้เป็น read base ของหน้าเว็บ

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
- [x] C3. เว็บอ่านจาก `MEDIA_PUBLIC_URL` ใน `supabase-client.js` ผ่าน Pages Function; Edge Functions สำหรับอีเวนต์/บัตรยังใช้ค่า secret `MEDIA_PUBLIC_URL` เดิม
- [x] D1. ย้ายไฟล์เดิม 23 ไฟล์ (~45MB, ไม่รวมสลิป) ขึ้น R2 + S3 แล้ว (function `migrate-media` ย้ายเสร็จ failed:0 → ลบทิ้งแล้ว)
- [x] D2. rewrite URL ใน DB (`profiles.avatar_url`, `user_states.state.avatarUrl`, `events.cover_url`, `events.poster_urls`) → r2.dev เหลือ 0 ทุกคอลัมน์
- [x] E1. build pages + deploy + preflight + tests 27/27
- [x] E2. verify จริง: r2.dev GET 200 + size/content-type ตรงทุกไฟล์ตัวอย่าง · S3 HeadObject ตรง · เว็บ deploy แล้วใช้ r2.dev + dual upload
- [x] E3. ไฟล์เดิมใน Supabase ไม่ลบ (rollback)

## วิธีสลับ read base เมื่อต้องการ
เปลี่ยน read base ของเว็บที่ `MEDIA_PUBLIC_URL` ใน `supabase-client.js`; ทาง Pages Function ต้องมี R2 binding `MEDIA` ตาม `wrangler.jsonc` และ `_routes.json` ต้องครอบเฉพาะ `/media/*`

## ข้อจำกัดที่ทราบ
- Pages Function มีโควตาคำขอแบบ Workers; เมื่อปริมาณการฟังสูงขึ้นควรเพิ่ม custom domain บน R2 เพื่อใช้ CDN โดยตรงแทน Pages Function
- AWS key ห้ามอยู่ฝั่งเบราว์เซอร์ — ทุกการเซ็นชื่ออยู่ใน `s3-sign` เท่านั้น
