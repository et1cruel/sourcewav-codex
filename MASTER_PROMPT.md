# Master Prompt: Sourcewav

คัดลอก prompt ด้านล่างไปใช้กับ AI coding agent เพื่อพัฒนาผลิตภัณฑ์นี้ต่อได้

---

## บทบาท

คุณคือทีมผลิตภัณฑ์อาวุโสที่รวม Product Manager, UX/UI Designer, Full‑Stack Engineer, Security Engineer และ QA เข้าด้วยกัน ทำงานร่วมกับผู้ก่อตั้งที่ต้องการสร้างแพลตฟอร์มชุมชนสำหรับคนทำเพลงแรป/ฮิปฮอปและคนทำงานศิลปะอิสระในประเทศไทย

## เป้าหมายผลิตภัณฑ์

สร้าง **Sourcewav** พื้นที่ออนไลน์ที่พาคนทำเพลงและศิลปะอิสระมาเจอกัน เพื่อสนทนา แบ่งปันผลงาน สร้างเครือข่าย ประกาศกิจกรรม ค้นหาสถานที่จัดงาน ซื้อขายบัตร และซื้อขายหรือแลกเปลี่ยนงานศิลปะ โดยผู้ใช้ควรเริ่มจากการดูสิ่งที่เกิดขึ้นในชุมชน แล้วไปต่อสู่การร่วมงานหรือพบกันในชีวิตจริงได้ง่าย

กลุ่มผู้ใช้หลัก:
- แรปเปอร์, MC, โปรดิวเซอร์, DJ, beatmaker, sound engineer และผู้จัดงาน
- นักวาด, กราฟิกดีไซเนอร์, ช่างภาพ, ศิลปินภาพพิมพ์, visual artist และนักสร้างสรรค์อิสระ
- ผู้ฟังและผู้ชมที่ต้องการค้นพบเพลง งานศิลปะ และกิจกรรมในพื้นที่ของตน
- ผู้ดูแลชุมชนและผู้จัดงานที่ต้องประกาศงาน ดูแลผู้ร่วมงาน และจัดการข้อพิพาท

## หลักการผลิตภัณฑ์

1. ออกแบบจากมือถือก่อน แต่ให้ประสบการณ์เดสก์ท็อปเหมาะกับการค้นพบและทำงานหลายอย่าง
2. ใช้ภาษาไทยที่เป็นธรรมชาติ เข้าใจง่าย รองรับชื่อ/เนื้อหาไทยและอังกฤษ
3. เปิดให้ผู้ใช้เลือกเปิดเผยตัวตนเท่าที่ต้องการ มีการควบคุมความเป็นส่วนตัวและการติดต่อ
4. แยกเนื้อหาชุมชน อีเวนต์ ตลาดงาน และการชำระเงินให้เข้าใจง่าย แต่เชื่อมถึงกันได้
5. สถานะงาน ราคา จำนวนบัตร และสถานะการชำระเงินต้องมาจากข้อมูลจริง ห้ามสร้างสถานะสำเร็จจากหน้าบ้าน
6. ค่อยๆ ส่งมอบเป็น MVP ที่ใช้ได้จริง ตรวจสอบได้ และต่อยอดได้ ห้ามแสดงปุ่มหรือข้อมูลสำคัญที่ไม่มีการทำงานรองรับ

## แนวทางแบรนด์และ UI

- บุคลิก: อิสระ กล้าทดลอง เป็นมิตรกับคนทำของจริง มีความเป็นกรุงเทพฯ/ไทยร่วมสมัย โดยไม่ทำให้ดูเหมือนเว็บองค์กรหรือเว็บขายตั๋วสำเร็จรูป
- ทิศทางภาพ: ใช้พื้นหลังเย็นสบายตา `#F1F5F9`, หมึกน้ำเงินเข้ม `#1D2B40` และพื้นผิวขาวเป็นหลัก จากนั้นกำหนดสีประจำหมวดแบบเย็นและแยกกันชัดเจน: คอมมูนิตี้น้ำเงิน `#426FAE`, อีเวนต์เขียวอมฟ้า `#397E83`, ตลาดงานศิลปะม่วงหม่น `#74639B`, แผนที่มิ้นต์/เทอร์ควอยซ์ และโปรไฟล์ศิลปินฟ้าอมเขียว `#4D7890` ห้ามใช้สี accent เดียวกันทุกส่วน และห้ามใช้สีอ่อนเป็นสีตัวอักษรบนพื้นขาว
- ใช้ตัวอักษรไทยที่อ่านง่าย และตัว display ที่มีจังหวะชัดสำหรับชื่อวง/งาน
- ใช้ภาพตัวอย่างจริงหรือ artwork ที่มีสิทธิ์ใช้งาน ไม่ใช้ placeholder เทาแบบทั่วไป
- องค์ประกอบที่ควรมี: คอนทราสต์อ่านชัด, keyboard focus, label สำหรับ screen reader, alt text, รองรับ reduced motion, loading/empty/error states และ responsive layout
- อย่าใช้ UI แบบ dashboard SaaS ทั่วไป ใช้ภาษาภาพและเนื้อหาที่รู้สึกมาจากวัฒนธรรมแรป/ศิลปะอิสระ
- ให้แต่ละหมวดมี visual signature ของตัวเองผ่านสี ป้าย สัญลักษณ์ และภาพประกอบที่เหมาะกับเนื้อหา ขณะเดียวกันใช้ระบบระยะห่าง ตัวอักษร และคอนโทรลที่สม่ำเสมอ
- ใช้สีพื้นอ่อนแบบ tinted เป็นตัวช่วยแยกหมวด ส่วนตัวอักษรหลักต้องมี contrast สูง; ตรวจทั้งสีปกติ hover active disabled และ focus
- จุดจำของหน้าแรกควรมาจาก artwork/เวที/คลื่นเสียงที่เฉพาะกับ Sourcewav ไม่ใช่เพิ่ม gradient หรือเงาให้ทุกการ์ด

## ขอบเขต MVP

### 1. บัญชีและโปรไฟล์
- สมัคร/เข้าสู่ระบบด้วยอีเมลหรือช่องทางที่เลือก พร้อมยืนยันตัวตนและกู้คืนบัญชี
- โปรไฟล์มีชื่อที่แสดง, username, รูป, bio, จังหวัด, บทบาท/ทักษะ, ลิงก์ผลงาน, ความสนใจ และสถานะเปิดรับงาน
- สร้าง portfolio เป็นชุดผลงาน: เพลง/เสียง, ภาพ, วิดีโอ, งานออกแบบ, เครดิตผู้ร่วมงาน และรายละเอียดผลงาน
- ตั้งค่าการมองเห็นโปรไฟล์และช่องทางติดต่อได้
- ติดตาม/เลิกติดตาม บล็อก และรายงานบัญชี

### 2. Community feed และห้องสนทนา
- สร้างโพสต์ข้อความพร้อมภาพ/เสียง/วิดีโอ ลิงก์ เครดิต และแท็ก
- หมวดหมู่: เพลง, ศิลปะ, หาคนร่วมงาน, ประกาศ และพูดคุย
- กดถูกใจ แสดงความคิดเห็น บันทึก แชร์ และรายงานโพสต์
- ค้นหาและกรองเนื้อหา พร้อมฟีดติดตามและฟีดแนะนำที่อธิบายหลักการได้
- ห้องคุยตามหัวข้อ พร้อมผู้ดูแล กติกา การปักหมุด และเครื่องมือ mute/block/report
- ป้องกัน spam, upload ที่เป็นอันตราย, abuse และการเผยแพร่ข้อมูลส่วนบุคคลโดยไม่ยินยอม

### 3. อีเวนต์และแผนที่ประเทศไทย
- ผู้จัดสร้างงานพร้อมชื่อ, ประเภท, คำอธิบาย, วันเวลา/เขตเวลา, รูปปก, ราคา, จำนวนบัตร, สถานที่, พิกัด, การเดินทาง, อายุผู้เข้าร่วม และช่องทางติดต่อ
- สถานะชัดเจน: กำลังจะจัด, กำลังจัดอยู่, จบแล้ว, ยกเลิก และเลื่อน
- แผนที่ประเทศไทยแสดงพื้นที่จัดงาน/สถานที่ พร้อม marker, clustering, รายการงาน, filter ตามเมือง/จังหวัด/ประเภท/วัน/ราคา และค้นหาใกล้ฉันเมื่อได้รับอนุญาต location
- รองรับ venue ที่เกิดซ้ำได้ และให้ผู้ใช้เสนอ/แก้ไขข้อมูลสถานที่โดยมี moderation
- ผู้ใช้บันทึกงาน, แชร์งาน, ดูรายละเอียด, ติดต่อผู้จัด และรายงานข้อมูลผิดได้
- ข้อมูลตัวอย่างต้องระบุว่าเป็นข้อมูลตัวอย่าง ห้ามอ้างจำนวนงานจริงหากยังไม่มีข้อมูลจริง

### 4. บัตรและการชำระเงิน
- เลือกประเภท/จำนวนบัตร ตรวจยอดและค่าธรรมเนียม แสดงเงื่อนไขก่อนจ่าย
- ใช้ payment gateway ที่รองรับประเทศไทยและ PromptPay/Thai QR ตามข้อกำหนดปัจจุบัน เลือกผู้ให้บริการหลังเปรียบเทียบราคาและความสามารถ
- QR ต้องสร้างจากผู้ให้บริการฝั่ง server สำหรับ payment intent ที่มีอายุและยอดที่แน่นอน ห้ามสร้าง QR คงที่หรือเชื่อถือภาพหน้าจอ/ปุ่ม “ฉันจ่ายแล้ว”
- ยืนยันผลด้วย signed webhook ที่ตรวจลายเซ็น, idempotency, จำนวนเงิน, currency และ reference ฝั่ง server
- สร้างบัตรดิจิทัลพร้อม QR/token ที่คาดเดาไม่ได้ หลังยืนยันชำระเท่านั้น; check-in ต้องตรวจ token ฝั่ง server และกันการใช้ซ้ำ
- จัดการ pending, success, failed, expired, refunded, cancelled และ dispute พร้อมประวัติธุรกรรม/audit log
- ป้องกัน oversell ด้วย inventory reservation/transaction ที่ atomic และกำหนดเวลาหมดอายุการจอง
- ไม่เก็บเลขบัตรหรือข้อมูลชำระเงินอ่อนไหวเอง ให้ gateway จัดการ; ทำ refund ตามนโยบายและสิทธิ์ผู้จัด
- แสดงค่าธรรมเนียม เงื่อนไขยกเลิก/คืนเงิน และช่องทางช่วยเหลือก่อนชำระ

### 5. ตลาดงานศิลปะและบริการสร้างสรรค์
- ลงขายงานต้นฉบับ/สำเนา/ไฟล์ดิจิทัล/commission/บริการ พร้อมราคา สถานะ สต็อก วิธีส่งมอบ สิทธิ์ใช้งาน และเครดิต
- ซื้อ, จอง, เสนอแลกเปลี่ยน หรือส่งคำขอ commission ตามประเภทประกาศ
- แยกการขายสินค้าจริงและดิจิทัล ระบุการจัดส่ง/ดาวน์โหลดและเงื่อนไขคืนสินค้า
- ระบบชำระเงิน/จ่ายเงินให้ผู้ขายต้องใช้ marketplace payout ที่ผ่านการตรวจสอบ KYC ตามข้อกำหนดของผู้ให้บริการ
- มีระบบรายงานละเมิดลิขสิทธิ์/ผลงานปลอม, takedown workflow, moderation, dispute และหลักฐานการส่งมอบ
- ให้ผู้สร้างตั้งค่าการอนุญาตใช้ผลงานและระบุว่าไฟล์แสดงตัวอย่างมี watermark ได้

### 6. แชทและการทำงานร่วมกัน
- แชท 1:1 และ (ระยะถัดไป) กลุ่ม โดยเริ่มสนทนาได้จากโปรไฟล์/โพสต์/งาน/ประกาศ
- ส่งข้อความและแนบไฟล์ที่อนุญาต พร้อมสถานะอ่าน/ยังไม่อ่านและแจ้งเตือนที่ผู้ใช้ควบคุมได้
- มี block/report, rate limit, ปิดรับข้อความจากคนที่ไม่รู้จัก และระบบ moderation เมื่อมีการรายงาน
- ผู้ใช้ลบ/เก็บ/ส่งออกข้อมูลตามนโยบาย และกำหนดอายุการเก็บรักษาให้ชัด

### 7. การแจ้งเตือนและการดูแลชุมชน
- แจ้งเตือนการตอบกลับ, mention, แชทใหม่, สถานะบัตร, งานที่บันทึก และประกาศจากผู้ดูแล
- ตั้งค่าแยกในเว็บ/อีเมล/Push ตามที่รองรับ
- Admin dashboard สำหรับรายงาน, การกลั่นกรอง, ผู้ใช้, อีเวนต์, listing, refund/dispute และ audit trail
- มี community guidelines, terms, privacy notice, cookie/consent ที่จำเป็น และช่องทางติดต่อทีมงาน

## ข้อมูลและสถาปัตยกรรม

ก่อนลงมือ ให้ตรวจ repository, runtime, conventions และ deployment ที่มีอยู่ แล้วสรุปแผนสั้นๆ จากนั้นพัฒนาโดยคงรูปแบบเดิมของโปรเจกต์ หากไม่มี stack ให้เสนอ stack ที่เหมาะกับทีมและการดูแลระยะยาว

โมเดลข้อมูลหลักอย่างน้อย:
- `users`, `profiles`, `skills`, `follows`, `blocks`
- `posts`, `post_media`, `comments`, `reactions`, `saved_items`, `rooms`, `room_members`
- `venues`, `events`, `event_categories`, `ticket_types`, `orders`, `tickets`, `check_ins`, `payments`, `refunds`
- `listings`, `listing_media`, `conversations`, `conversation_members`, `messages`
- `notifications`, `reports`, `moderation_actions`, `audit_logs`

กำหนด foreign keys, unique constraints, indexes, timestamps, soft deletion ที่เหมาะสม, สกุลเงินและเขตเวลาอย่างชัดเจน ใช้ migrations ที่ย้อนกลับ/ตรวจสอบได้ เก็บ secrets ใน environment/server secret manager เท่านั้น

ข้อมูลส่วนบุคคลและไฟล์ผู้ใช้ต้องมีสิทธิ์เข้าถึงที่ตรวจสอบฝั่ง server, validation, file size/type limits, malware scanning ตามความเหมาะสม, signed URLs สำหรับไฟล์ส่วนตัว และนโยบาย retention/deletion/export ที่สอดคล้องกับกฎหมายคุ้มครองข้อมูลส่วนบุคคลของไทย

## ความปลอดภัยและความน่าเชื่อถือ

- ใช้ authentication/session ที่ปลอดภัย, CSRF protection ตามรูปแบบ auth, rate limits, input validation, output encoding, authorization per resource และ secure headers
- ห้ามพึ่ง client-side role/price/ownership; ตรวจสิทธิ์และยอดเงินทุกครั้งที่ server
- ป้องกัน IDOR, XSS, injection, CSRF, credential stuffing, brute force, spam, upload abuse และ webhook replay
- ใช้ idempotency สำหรับ order/payment/refund/check-in และ audit log สำหรับการเปลี่ยนแปลงสำคัญ
- จำกัดข้อมูลที่แสดงต่อสาธารณะและไม่บันทึก secrets/payment credentials ลง log
- มีระบบรายงาน, moderation queue, appeal/contact path และกระบวนการรับมือ account compromise
- ระบุข้อจำกัดด้านกฎหมาย/ผู้ให้บริการที่ต้องให้ผู้เชี่ยวชาญตรวจ ก่อนเปิดรับเงินจริงหรือ marketplace payout

## แนวทางส่งมอบงาน

1. ตรวจของเดิมก่อนแก้ และรักษาข้อมูล/การตั้งค่าที่มีอยู่
2. เขียนแผนหน้าจอและ data flow ที่สั้นและชัดก่อนเริ่ม feature ใหญ่
3. ทำ MVP ตามลำดับ: โปรไฟล์/ฟีด → อีเวนต์/สถานที่/แผนที่ → listing/portfolio → แชท → checkout/ticketing → moderation/admin
4. แยก component, domain logic, API และ persistence ตาม stack ของ repo; หลีกเลี่ยงไฟล์เดียวที่รวมทุกอย่าง
5. ใส่ loading, empty, error, success และ validation states ให้ครบ พร้อม responsive และ accessibility
6. ใช้ mock data เฉพาะตอนที่ระบุชัดว่าเป็นตัวอย่าง และออกแบบ adapter ให้แทนด้วย API จริงได้
7. ทดสอบเฉพาะตามคำขอหรือเกณฑ์ของโปรเจกต์ที่มีอยู่; ถ้ารันตรวจสอบ ให้รายงานคำสั่งและผลจริงโดยไม่แต่งผล
8. เมื่อจบ ให้สรุปไฟล์ที่เปลี่ยน, วิธีเปิด/ใช้งาน, สิ่งที่ทำงานได้จริง, สิ่งที่ยังเป็น mock, การตั้งค่าที่ต้องมี และความเสี่ยง/งานต่อที่จำเป็น

## เกณฑ์ยอมรับ

- ผู้ใช้ใหม่เข้าใจได้ทันทีว่า Sourcewav ช่วยให้ทำอะไร และหาทางไป community, events, map, portfolio/market และ chat ได้
- ผู้ใช้ค้นหาและดูงานตามพื้นที่/เวลาได้ โดยสถานะ “กำลังจัดอยู่” อิงเวลาและ timezone ของงาน
- มีเส้นทางโพสต์และโปรไฟล์ที่ใช้งานได้ รวมถึงการแสดงผลงานที่ให้เครดิตผู้สร้าง
- การจอง/ชำระเงินไม่แสดงว่าจ่ายสำเร็จจนกว่าจะยืนยันจาก server/webhook จริง
- QR บัตรเข้าร่วมมีการตรวจสอบและป้องกันนำมาใช้ซ้ำ
- ผู้ขายและผู้ซื้อเห็นเงื่อนไขและสถานะรายการตรงกัน มีช่องทางช่วยเหลือเมื่อมีปัญหา
- ผู้ใช้บล็อก/รายงานได้ และทีมงานจัดการรายงานผ่านกระบวนการที่ตรวจสอบย้อนหลังได้
- UI รองรับมือถือ คีย์บอร์ด และข้อความภาษาไทยที่ยาวกว่าตัวอย่าง
- ไม่มีปุ่มสำคัญที่กดแล้วไม่เกิดผลหรือไม่มีสถานะตอบกลับ

## ข้อกำหนดสำหรับงานนี้

เริ่มจากทำเว็บ prototype ที่เปิดดูได้ทันทีใน workspace ปัจจุบัน โดยเน้นหน้าแรก responsive สำหรับคอมมูนิตี้, ฟีดโพสต์, อีเวนต์, แผนที่ตัวอย่างประเทศไทย, ตลาดงานศิลปะ และแชท จากนั้นทำหน้าจอจำลองซื้อบัตร/QR ให้เห็น flow ชัดเจนและระบุว่าเป็น mock ไม่รับเงินจริง สุดท้ายเตรียมเอกสารสรุปว่าต้องเพิ่ม backend, database, map provider, messaging และ payment gateway อะไรบ้างก่อนเปิดใช้จริง

---

## Execution Brief: พัฒนาต่อจาก workspace นี้

ใช้ส่วนนี้เป็นคำสั่งทำงานจริงสำหรับ AI coding agent ที่เปิด workspace ปัจจุบันอยู่ ห้ามจบแค่แผนหรือคำแนะนำ

### สิ่งที่มีอยู่แล้ว

- เว็บเป็น static prototype ใช้ `index.html`, `styles.css`, `app.js` และ Leaflet ผ่าน CDN
- มีหน้า community feed, event cards, แผนที่ interactive ของกรุงเทพฯ, market cards, people list, modal, chat panel และตัวอย่าง checkout
- แผนที่ใช้ OpenStreetMap และมีหมุด Blueprint Livehouse, BACC และ Bangkok CityCity Gallery; ข้อมูลตัวอย่างบนหน้าเว็บยังไม่ใช่ฐานข้อมูลอีเวนต์สด
- ยังไม่มี server, authentication, package manager, API, database, payment gateway หรือ file storage ที่ deploy แล้ว
- ทำงานในไฟล์เดิมโดยตรวจโครงสร้างก่อน ห้ามสมมติว่ามี framework หรือ backend ที่ยังไม่ได้ติดตั้ง

### เป้าหมายของรอบพัฒนา

ทำให้ Sourcewav ดูเป็นแพลตฟอร์มวัฒนธรรมเพลงและศิลปะอิสระที่จำได้ทันที และให้ prototype ตอบสนองต่อการกระทำของผู้ใช้จริงได้ โดยยังเปิดหน้าเว็บจาก workspace ได้ง่าย

### Art direction ที่ต้องรักษา

- ภาพรวมเย็น สบายตา มีพื้นหลังฟ้าเทาหม่นและตัวอักษรน้ำเงินเข้ม
- แต่ละหมวดมีสีจำของตัวเอง: community = cobalt blue, events = deep teal, art market = muted violet, map = mint/teal, artist profiles = blue-green
- ใช้สีหมวดกับปุ่มหลัก ป้ายสถานะ และพื้นหลัง tint ของพื้นที่นั้นเท่านั้น; สีพื้นผิวหลักยังเป็นขาว/ฟ้าเทาอ่อน
- คงภาพงาน โปสเตอร์ waveform และภาษาจากวัฒนธรรมแรป/ศิลปะอิสระไว้ หลีกเลี่ยงหน้าตา SaaS dashboard, การ์ดซ้ำรูปแบบเดียวทุกอย่าง, neon เดียวทั้งเว็บ และของตกแต่งที่ไม่มีหน้าที่
- หน้าแรกต้องมีจุดเด่นชัดหนึ่งจุด (hero/artwork หรือ featured event) และมีลำดับชั้นชัด: สิ่งที่กำลังเกิดขึ้น → ฟีด → สถานที่/ตลาด/คน
- ใช้ type scale อ่านไทยได้จริง ตัวเนื้อหาไม่เล็กเกินไป และ metadata ต้องยังอ่านได้ใน viewport 375px

### ฟังก์ชันที่ต้องทำให้ใช้งานได้ใน prototype

1. **Community**: สร้างโพสต์ใหม่พร้อมหัวข้อ/ข้อความ/หมวดหมู่, แสดงโพสต์ที่สร้างในฟีดทันที, filter หมวด, like/unlike, save/unsave และ comment โดยทุก action มีสถานะที่สอดคล้องกับผลที่เกิดขึ้น
2. **Profile/Creators**: แก้ชื่อแสดง, บทบาท, bio และจังหวัด; ติดตาม/เลิกติดตาม creator; แสดงสถานะที่บันทึกไว้หลัง reload
3. **Events**: เปิดรายละเอียด, บันทึก event ที่สนใจ และแสดงสถานะ saved; ข้อมูลบนการ์ดระบุให้ชัดว่าเป็น demo content จนกว่าจะมี backend/feed จริง
4. **Map**: คง Leaflet/OpenStreetMap, filter หมวด, sync marker กับ venue list, กด marker เพื่อดูรายละเอียด/เส้นทาง และรองรับ modal ขยาย
5. **Art market**: ให้เพิ่ม listing ตัวอย่างได้พร้อมชื่อ ประเภท ราคา และผู้สร้าง; รายการต้องอยู่หลัง reload
6. **Chat**: เปิด thread, ส่งข้อความ mock, เก็บประวัติ local และ restore หลัง reload; ระบุว่าไม่ใช่ real-time/backend messaging
7. **Music streaming**: ผู้สร้างอัปโหลดไฟล์เสียงที่ชนิด/ขนาดผ่านการตรวจสอบ ระบุชื่อเพลง ศิลปิน และแนวเพลง; แสดงรายการเพลงและเครื่องเล่นที่เล่น/พัก/เลื่อนตำแหน่ง/ปรับเสียงได้ รองรับ HTTP byte ranges เพื่อให้ลาก seek ได้จริง แสดงสถานะว่าง/กำลังโหลด/ผิดพลาด และห้ามเล่นอัตโนมัติหลังอัปโหลด
8. **Persistence prototype**: ทำ storage adapter ที่มี versioned schema, validation ขั้นพื้นฐาน, อ่าน/เขียนอย่างปลอดภัยเมื่อ localStorage ใช้ไม่ได้ และ migration ระหว่างเวอร์ชัน; ห้ามเก็บ secrets หรือข้อมูลชำระเงินจริงไว้ใน browser
9. **Payment**: คง checkout ให้เห็นเส้นทาง UX แต่ทุกหน้าต้องบอกชัดว่าไม่มีการชำระเงินจริงและ QR เป็น mock; ห้ามให้ปุ่ม demo แสดงข้อความว่าจ่ายเงินสำเร็จหรือออกบัตรจริง

### Database และ backend deliverables

- เพิ่ม `database/schema.sql` เป็น PostgreSQL initial schema สำหรับ users/profiles, follows/blocks, posts/media/comments/reactions/saved items, venues/events/ticket types/orders/tickets/payments/refunds/check-ins, listings/media, conversations/members/messages, notifications, reports, moderation actions และ audit logs
- เพิ่ม PK/FK, unique/check constraints, indexes, `created_at`/`updated_at`, currency/timezone และสถานะที่จำกัดค่าได้; ใช้ UUID, timestamps เป็น UTC และ event timezone เป็น `Asia/Bangkok`
- หากใช้ Supabase ให้ออกแบบให้ auth user อ้าง `auth.users`, เปิด RLS และเขียน policies สำหรับข้อมูลของตน; ห้ามเปิด service-role key ให้ browser
- เพิ่ม `database/README.md` อธิบาย ERD แบบข้อความ, วิธี apply migration, seed/demo data, RLS/authorization, backup, export/delete data และวิธีเชื่อม persistence adapter ในอนาคต
- Frontend localStorage เป็น demo adapter เท่านั้น; อย่าเรียกมันว่า production database หรือ sync ข้ามอุปกรณ์
- Payment ต้องมี server-created payment intent, provider-signed webhook, idempotency, inventory reservation และ ticket verification ก่อนเปิดเงินจริง; ถ้าไม่มี credentials/backend ให้ทำเฉพาะ schema/UX/docs
- เพลงและไฟล์เสียงต้องเก็บใน private object storage เมื่อขึ้น production; เก็บ metadata/visibility/owner/license/moderation state ในฐานข้อมูล, ตรวจ MIME และ file signature ฝั่ง server, จำกัดขนาด, สแกนไฟล์, รองรับ resumable uploads ตามความจำเป็น และส่งเสียงผ่าน CDN/range requests โดยตรวจสิทธิ์ก่อนออก signed URL สำหรับเพลง private
- เพิ่ม `audio_tracks`, `audio_track_likes`, `audio_track_plays` และ `audio_track_reports` พร้อม owner, title, artist, genre, duration, storage key, MIME, size, visibility, publication/moderation status, license declaration และ indexes; ห้ามเก็บไฟล์ไบนารีขนาดใหญ่ในแถวฐานข้อมูล

### API/domain boundaries สำหรับการต่อยอด

ออกแบบ interfaces/domain services ที่แทน local adapter ด้วย API ได้โดยไม่ผูก component กับ `localStorage` โดยตรง: `AuthService`, `FeedService`, `ProfileService`, `EventService`, `TicketService`, `ListingService`, `ChatService`, `MapVenueService`, `NotificationService`

กำหนด REST/typed API contracts ขั้นต้นในเอกสารสำหรับ:
- `GET/POST /api/posts`, `GET/POST /api/posts/:id/comments`, `PUT/DELETE /api/posts/:id/reaction`
- `GET/PUT /api/profile/me`, `POST/DELETE /api/profiles/:id/follow`
- `GET/POST /api/events`, `POST /api/events/:id/bookmarks`, `POST /api/orders`, `GET /api/orders/:id`
- `GET/POST /api/listings`, `GET /api/conversations`, `GET/POST /api/conversations/:id/messages`
- `GET/POST /api/tracks`, `GET /api/tracks/:id/audio` (รองรับ `Range`), `PUT/DELETE /api/tracks/:id`, `POST /api/tracks/:id/likes`
- `GET /api/venues?country=TH&city=Bangkok&category=...`

ทุก mutation ต้องตรวจ authentication, authorization, validation, rate limit และ idempotency ตามประเภทคำขอที่ server; UI ต้องจัดการ loading, empty, error, retry และ success state

### ความปลอดภัยและความซื่อตรงของข้อมูล

- Escape user content ก่อนแสดง, จำกัดความยาวข้อความ/ชื่อ/ราคา และอย่า inject HTML ที่ผู้ใช้ส่งมา
- ห้ามเชื่อราคา, สต็อก, owner, payment status หรือ role จาก browser; server เป็นผู้ตัดสินเมื่อทำ backend
- แยก demo seed ออกจากข้อมูลที่ผู้ใช้สร้าง และให้ผู้ใช้ reset เฉพาะ demo data ได้โดยไม่ลบ production data
- ห้ามส่งคำว่า paid, verified หรือ ticket issued เมื่อยังไม่มี provider/webhook ยืนยัน
- ระบุอย่างเปิดเผยว่าฟีเจอร์ใดเก็บแค่ใน browser, ฟีเจอร์ใดเป็น mock และอะไรต้องใช้บริการภายนอก
- อย่าร้องขอ geolocation, notification, camera หรือ microphone permission โดยไม่จำเป็นและไม่บอกเหตุผลก่อน

### วิธีทำงาน

1. ตรวจไฟล์และวิธีรันเว็บปัจจุบันก่อน
2. ทำ design pass ระบุสี/typography/layout ต่อหมวดโดยยึดข้อมูลข้างต้น แล้วลงมือแก้จริง
3. ทำ persistence adapter ก่อนผูก action เพื่อไม่ให้แต่ละปุ่มเขียน storage ซ้ำซ้อน
4. เพิ่ม schema และ backend handoff docs แยกจาก frontend prototype
5. ปรับ responsive/accessibility: semantic controls, keyboard focus, accessible labels, reduced motion, contrast และข้อความไทย
6. เปิดหน้าเว็บใน browser ตรวจภาพจริง และกด flow หลักอย่างน้อยโพสต์, like/save, follow, event bookmark, listing และ chat; แก้สิ่งที่เห็นว่าพัง
7. ไม่ติดตั้ง dependency หรือเชื่อมบริการที่มีค่าใช้จ่ายโดยไม่มีเหตุจำเป็น
8. สรุปสิ่งที่ทำจริง, วิธีเปิดเว็บ, ที่เก็บข้อมูลของ demo, ไฟล์ schema/docs และข้อจำกัดที่ต้องทำก่อน production

### เกณฑ์จบงาน

- เว็บมีเอกลักษณ์และหมวดต่างๆ แยกกันได้ทางสายตาโดยยังอ่านสบาย
- โพสต์/interaction/profile/follow/bookmark/listing/chat ใน prototype ทำงานและคงอยู่หลัง reload
- local storage ไม่ถูกอ้างเป็นฐานข้อมูล production; มี PostgreSQL schema และแนวทาง backend ที่ตรวจสอบต่อได้
- checkout ไม่สื่อว่ารับเงินจริงหรือออกบัตรจริง
- ไม่มีปุ่มหลักที่เงียบเมื่อกด และหน้าแสดง empty/error/success ที่เข้าใจได้
- หน้าใช้งานได้ทั้งมือถือและเดสก์ท็อปและผ่านการดูใน browser จริง
