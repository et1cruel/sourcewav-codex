(() => {
  const translations = {
    'Sourcewav — พื้นที่ของคนทำเพลงและศิลปะ': 'Sourcewav — A space for music and art creators',
    'Sourcewav · ชุมชนดนตรีและศิลปะอิสระของไทย': 'Sourcewav · Thailand’s independent music and art community',
    'พื้นที่ของคนทำเพลงแรปและศิลปะอิสระในไทย — คุยกัน ดูงาน ซื้อบัตร และปล่อยของ': 'An independent space for music and art in Thailand — connect, discover, book tickets, and share your work.',
    'Sourcewav หน้าแรก': 'Sourcewav home',
    'คอมมูนิตี้': 'Community', 'ฟีดวงใน': 'Community feed', 'Booking Board': 'Booking Board',
    'อีเวนต์': 'Events', 'ตลาดงาน': 'Creative Market', 'ตลาดงานศิลปะ': 'Creative Market',
    'Artist Store': 'Artist Store', 'ร้านขายของศิลปิน': 'Artist Store',
    'บัตรของฉัน': 'My tickets', 'สแกนเข้างาน': 'Check in', 'ปล่อยเพลง': 'Release music',
    'เครื่องมือของคุณ': 'Your tools', 'ฟังเพลง': 'Listen', 'รับงาน': 'Find work',
    'Drop Alerts': 'Drop Alerts', 'อีเวนต์ใกล้ฉัน': 'Events near me', 'หลังบ้านผู้จัด': 'Organizer hub',
    'Pro': 'Pro', 'คนที่น่ารู้จัก': 'People to discover', 'ห้องคุยที่กำลังคึกคัก': 'Active rooms',
    'สร้างห้องคุย': 'Create a room', 'เกี่ยวกับ Sourcewav': 'About Sourcewav',
    'แนวทางชุมชน': 'Community guidelines', 'พื้นที่อิสระของเรา': 'An independent space for us',
    'พื้นที่ของคนทำเพลงและศิลปะ': 'A space for music and art creators',
    'หาเพื่อนทำเพลง': 'Find your people in music', 'แล้วไปเจอกันหน้าเวที': 'Then meet up at the show',
    'ปล่อยเดโม หาเพื่อนร่วมงาน และตามอีเวนต์': 'Share demos, find collaborators, and follow events',
    'ฮิปฮอปกับศิลปะอิสระทั่วไทย': 'Hip-hop and independent art across Thailand',
    'เสียงใหม่จากกรุงเทพ': 'New sounds from Bangkok', 'เสียงจากคนทำเพลง': 'Sounds from creators',
    'ฟังเพลง · ค้นพบ': 'LISTEN · DISCOVER', 'เดโมใหม่ เพลงใหม่ เปิดฟังตรงจากคนทำ': 'New demos and tracks, straight from the artists',
    'เครื่องเล่นเพลง': 'Music player', 'เลือกเพลงในคลัง': 'Choose a track', 'ยังไม่มีเพลงในคลัง': 'No tracks yet',
    'ปล่อยเพลงแรกของคุณให้ชุมชนได้ฟัง': 'Share your first track with the community', 'เพลงล่าสุด': 'Latest tracks',
    'อัปโหลดไฟล์แรก แล้วให้เสียงของคุณเริ่มเดินทาง': 'Upload your first track and let your sound travel',
    'อัปโหลดเพลงแรก': 'Upload your first track', 'อิสระจากคนทำเพลง': 'Independent music',
    'เสียงจากวงใน': 'From the community', 'ฟีดคอมมูนิตี้': 'Community feed',
    'เขียนโพสต์': 'Write a post', 'มีอะไรอยากเล่าให้วงในฟังไหม?': 'What would you like to share with the community?',
    'โพสต์': 'Post', 'ทั้งหมด': 'All', 'เพลง': 'Music', 'ศิลปะ': 'Art', 'พูดคุย': 'Talk',
    'มาใหม่ที่สุด': 'Newest', 'กำลังโหลดโพสต์จากชุมชน…': 'Loading community posts…',
    'งานใหม่': 'New work', 'ถูกใจ': 'Like', 'ความคิดเห็น': 'Comments', 'แชร์': 'Share',
    'เก็บไว้': 'Save', 'เก็บไว้แล้ว': 'Saved', 'ติดตาม': 'Follow', 'กำลังติดตาม': 'Following',
    'BOOKING BOARD · ร่วมงาน & รับจ้าง': 'BOOKING BOARD · COLLABORATE & HIRE',
    'หาคนร่วมงานและรับจ้าง': 'Find collaborators and hire talent',
    'ร้านหา DJ, Rapper, Producer, Photographer, VJ หรือทีมจัดงานได้ในที่เดียว ฝั่งศิลปินใส่ราคา ตัวอย่างผลงาน วันว่าง และรับข้อเสนอจ้างงานได้ทันที': 'Find DJs, rappers, producers, photographers, VJs, and event crews in one place. Creators can list rates, work samples, availability, and receive booking requests.',
    'ข้อเสนอจ้างงาน': 'Booking requests', 'ลงทะเบียนรับงาน': 'List your services',
    'Rapper / MC': 'Rapper / MC', 'Producer / Beatmaker': 'Producer / Beatmaker',
    'Photographer / Video': 'Photographer / Video', 'VJ / Visuals': 'VJ / Visuals',
    'ทีมงาน / Sound': 'Crew / Sound', 'คำขอสั่งซื้อ': 'Order requests',
    'ร้านขายของและผลงานศิลปิน': 'Artist goods and creative work',
    'ลงสินค้าและเก็บคำขอสั่งซื้อไว้ในฐานข้อมูล การรับชำระเงินและส่งไฟล์อัตโนมัติยังไม่เปิดใช้': 'List products and keep order requests in the database. Payments and automatic digital delivery are not available yet.',
    'เพิ่มสินค้าในร้าน': 'Add a product', 'เสื้อผ้า & Merch': 'Clothing & merch', 'เทป / ซีดี': 'Tape / CD',
    'Beat & Sample Pack (ดิจิทัล)': 'Beats & sample packs (digital)', 'Artwork & สิ่งพิมพ์': 'Artwork & print',
    'FOLLOW & DROP ALERT': 'FOLLOW & DROP ALERT', 'ติดตาม & งานใหม่': 'Follow & new releases',
    'ดูทั้งหมด': 'View all', 'ติดตามศิลปินหรือสถานที่ แล้วได้รับแจ้งเมื่อมีเพลงใหม่ งานใหม่ หรือบัตรรอบใหม่': 'Follow artists or venues and get updates about new music, releases, and ticket rounds.',
    'EVENT COMMAND CENTER': 'EVENT COMMAND CENTER', 'เปิด Command Center ↗': 'Open Command Center ↗',
    'SOURCEWAV TICKETS · LIVE EVENTS': 'SOURCEWAV TICKETS · LIVE EVENTS', 'ซื้อบัตรอีเวนต์': 'Event tickets',
    'ขายบัตรงาน': 'Sell tickets', 'MUSIC · ART · COMMUNITY': 'MUSIC · ART · COMMUNITY',
    'เจอกันหน้าเวที': 'Meet you at the show',
    'เลือกบัตรจากงานที่กำลังเปิดขาย หรือสร้างอีเวนต์พร้อมตั้งราคาและจำนวนบัตร': 'Choose tickets for an event on sale, or create an event and set ticket prices and quantities.',
    'สำหรับคนไปงาน': 'For attendees', 'สำหรับผู้จัดงาน': 'For organizers', 'กำลังโหลดอีเวนต์…': 'Loading events…',
    'แผนที่สถานที่เคยจัดงาน': 'Past event venues', 'กรุงเทพฯ + ปริมณฑล': 'Bangkok + vicinity',
    'กรุงเทพฯ · ปริมณฑล': 'Bangkok · vicinity', 'ดนตรี': 'Music', 'โหลดแผนที่ไม่ได้ ตรวจสอบการเชื่อมต่อ แล้วลองใหม่': 'Could not load the map. Check your connection and try again.',
    'ลองใหม่': 'Try again', 'แผนที่โดย': 'Map by', 'สถานที่เคยจัดงาน · 5 แห่ง': 'Past event venues · 5 places',
    'ขยายแผนที่ ↗': 'Expand map ↗',
    'ข้อมูลสถานที่จากแหล่งสาธารณะและลิงก์บัญชีของสถานที่ · ยังไม่แสดงอีเวนต์ที่ไม่มีแหล่งยืนยัน': 'Venue details are from public sources and venue accounts. Unverified events are not shown.',
    'ซื้อ ขาย แลกเปลี่ยน': 'BUY · SELL · TRADE', 'ลงผลงาน': 'List your work',
    'ลงประกาศผลงานและทักผู้ขายเพื่อคุยรายละเอียดการซื้อขาย': 'List your work and message sellers to discuss a purchase.',
    'เจอคนใหม่ๆ': 'Meet new people', 'แชท': 'Chat', 'ปิด': 'Close',
    'เข้าสู่ระบบ': 'Log in', 'สมัครสมาชิก': 'Create account', 'สมัคร': 'Sign up', 'เข้าสู่ระบบก่อนใช้ฟีเจอร์นี้': 'Log in to use this feature',
    'ชื่อที่แสดง': 'Display name', 'ชื่อผู้ใช้': 'Username', 'บทบาทในวงการ': 'Your role', 'เมือง': 'City',
    'จังหวัด': 'Province', 'แนะนำตัว': 'About you', 'บันทึกโปรไฟล์': 'Save profile', 'ยกเลิก': 'Cancel',
    'รูปโปรไฟล์': 'Profile photo', 'อัปโหลดรูปไม่สำเร็จ': 'Could not upload photo',
    'กลับมาเจอกันอีก': 'Welcome back', 'เข้าร่วมคอมมูนิตี้': 'Join the community',
    'ตั้งรหัสผ่านใหม่': 'Reset your password', 'สร้างโปรไฟล์': 'Create profile',
    'ลืมรหัสผ่าน?': 'Forgot password?', 'บันทึกรหัสผ่านใหม่': 'Save new password',
    'มีบัญชีอยู่แล้ว?': 'Already have an account?', 'ยังไม่มีบัญชี?': 'New to Sourcewav?',
    'โพสต์ลงฟีด': 'Publish post', 'ข้อความ': 'Message', 'หัวข้อ (ไม่บังคับ)': 'Title (optional)',
    'หมวดหมู่': 'Category', 'ตั้งชื่อให้โพสต์ของคุณ': 'Give your post a title',
    'เล่าให้คนในวงการฟัง...': 'Tell the community about it…', 'ไม่พบสถานที่ในหมวดนี้': 'No venues in this category',
    'เปิดเส้นทาง': 'Get directions', 'ดูแผนที่สถานที่จัดงาน': 'Event venue map',
    'เลือกรายชื่อเพื่อดูเส้นทาง': 'Choose a venue to view directions',
    'ชื่อเพลง': 'Track title', 'ศิลปิน / โปรดิวเซอร์': 'Artist / producer', 'แนวเพลง': 'Genre',
    'วางไฟล์เพลงตรงนี้': 'Drop your track here', 'หรือคลิกเพื่อเลือกจากเครื่อง': 'or click to browse your device',
    'เลือกไฟล์': 'Choose file', 'ปล่อยเพลงเข้าสู่วง': 'Release to the community',
    'ไฟล์ใหญ่เกินกำหนด': 'File is too large', 'ไฟล์พร้อมอัปโหลด': 'File ready to upload',
    'เลือกไฟล์เสียงก่อนอัปโหลด': 'Choose an audio file before uploading', 'กำลังอัปโหลด…': 'Uploading…',
    'อัปโหลดไม่สำเร็จ': 'Upload failed', 'ลองอัปโหลดอีกครั้ง': 'Try uploading again',
    'อัปโหลดเพลงแล้ว กดเล่นเพื่อฟังได้เลย': 'Track uploaded. Press play to listen.',
    'กำลังเล่น': 'Playing', 'หยุดชั่วคราว': 'Paused', 'หยุดเพลง': 'Stop track', 'เล่นเพลง': 'Play track',
    'แสดง': 'Show', 'ซ่อน': 'Hide', 'เปิดเสียง': 'Unmute', 'ปิดเสียง': 'Mute',
    'ออกจากระบบ': 'Log out', 'ออกจากระบบแล้ว': 'Logged out', 'บันทึกไว้แล้ว': 'Saved',
    'เซิร์ฟเวอร์ไม่เชื่อมต่อ ข้อมูลนี้เก็บชั่วคราวในเบราว์เซอร์': 'Server unavailable. This data is saved temporarily in your browser.',
    'บัญชีของคุณใช้ Supabase Auth และรหัสผ่านจะไม่ถูกเก็บใน Sourcewav': 'Your account uses Supabase Auth. Sourcewav does not store your password.',
    'เช่น คืนที่เมืองยังไม่หลับ': 'e.g. The city never sleeps', 'ชื่อที่ใช้ปล่อยเพลง': 'Artist name',
    'ฮิปฮอป': 'Hip-hop', 'แรป': 'Rap', 'บูมแบป': 'Boom bap', 'แทรป': 'Trap', 'อาร์แอนด์บี': 'R&B',
    'อิเล็กทรอนิก': 'Electronic', 'อื่นๆ': 'Other', 'เลือกทั้งหมด': 'Select all',
    'ฟังเพลงใหม่ ๆ และเจอคนทำของน่าสนใจ': 'Discover new music and meet creative people',
    'ตั้งค่าการแจ้งเตือน': 'Notification settings', 'ยืนยัน': 'Confirm', 'ส่ง': 'Send', 'ค้นหา': 'Search',
    'ยังไม่มีเพลงในคลัง': 'No tracks in the library yet', 'ยังไม่มีอีเวนต์': 'No events yet',
    'เชื่อมต่อคลังเพลงไม่ได้': 'Could not connect to the music library',
    'ตรวจสอบว่า Sourcewav server กำลังทำงาน แล้วโหลดหน้าใหม่': 'Check that the Sourcewav server is running, then reload the page.',
    'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร': 'Password must be at least 8 characters',
    'กรุณากรอกรหัสผ่าน': 'Please enter your password', 'ข้อมูลไม่ถูกต้อง': 'The information is invalid',
    'ไฟล์นี้เล่นไม่ได้ในเบราว์เซอร์': 'This file cannot be played in your browser',
    'ดูสถานที่นี้บนแผนที่': 'View this venue on the map', 'แผนที่สถานที่จัดงาน': 'Event venue map',
    'เปิดเส้นทาง ↗': 'Get directions ↗', 'เจ้าของบัญชี': 'Account owner',
    'นักฟังเพลง': 'Music fan', 'ศิลปิน / นักวาด': 'Artist / illustrator', 'คนทำงานเบื้องหลัง': 'Crew member',
    'แชร์ให้คอมมูนิตี้': 'Share with the community', 'เดโม ไอเดีย หรือกำลังหาใครมาร่วมทำอะไรอยู่?': 'A demo, an idea, or looking for a collaborator?',
    'เล่าให้คนอื่นรู้จักคุณ': 'Tell people a little about yourself', 'โปรไฟล์ของฉัน': 'My profile',
    'โปรไฟล์ที่จัดเก็บใน Sourcewav': 'Your profile on Sourcewav', 'แก้ไขโปรไฟล์': 'Edit profile',
    'ลงผลงานในตลาด': 'List work in the market', 'เพิ่มผลงานพร้อมราคาและรายละเอียด': 'Add work with pricing and details',
    'ชื่อผลงาน': 'Listing title', 'ประเภท': 'Type', 'รายละเอียด': 'Details', 'ราคา (บาท)': 'Price (THB)',
    'เว้นว่างถ้าให้สอบถามราคา': 'Leave blank if price is on request', 'บันทึกลงตลาด': 'Save listing',
    'ประกาศนี้จะจัดเก็บในฐานข้อมูล Sourcewav': 'This listing will be saved in the Sourcewav database',
    'เริ่มบทสนทนาด้วยข้อความสั้น ๆ ได้เลย': 'Start the conversation with a short message',
    'พิมพ์ข้อความ...': 'Write a message…', 'ส่งข้อความ': 'Send message', 'ส่งความคิดเห็น': 'Send comment',
    'ข้อความจะถูกเก็บไว้ในฐานข้อมูลของเว็บนี้': 'Messages are stored in this website’s database',
    'เขียนความคิดเห็น': 'Write a comment', 'พิมพ์ความคิดเห็น...': 'Write a comment…',
    'แสดงความคิดเห็นอย่างสร้างสรรค์...': 'Keep your comment constructive…',
    'ความคิดเห็นนี้เก็บไว้ในเบราว์เซอร์เครื่องนี้': 'This comment is saved in this browser',
    'ค้นหา Sourcewav': 'Search Sourcewav', 'ค้นหาเพื่อน งาน อีเวนต์ และบทสนทนา': 'Find people, work, events, and conversations',
    'คำค้น': 'Search term', 'ลองค้นหา “cypher กรุงเทพ”': 'Try “Bangkok cypher”',
    'ค้นหา': 'Search', 'เปิดห้องคุยใหม่': 'Create a new room',
    'ชวนคนที่สนใจเรื่องเดียวกันมาคุยกัน': 'Bring people with shared interests together',
    'ชื่อห้อง': 'Room name', 'ชื่อห้องของคุณ': 'Your room name', 'คุยเรื่องอะไร': 'What is this room about?',
    'บอกให้คนอื่นรู้ว่าห้องนี้คุยเรื่องอะไร': 'Tell people what this room is about', 'สร้างห้องคุย': 'Create room',
    'ซื้อบัตรเข้างาน': 'Buy event tickets', 'ยืนยันรายละเอียดก่อนชำระเงิน': 'Review your order before payment',
    'บัตรเข้างาน 1 ใบ': '1 event ticket', 'ยอดชำระ': 'Total due',
    'อีเมลสำหรับรับบัตร': 'Email for ticket delivery', 'ชำระผ่าน QR PromptPay': 'Pay with PromptPay QR',
    'ระบบตัวอย่าง: ยังไม่มีการตัดเงินจริง': 'Demo only: no real payment is collected',
    'ตลาดนัดของคนทำงานภาพ เสียง และสิ่งพิมพ์อิสระ': 'A market for independent visual, audio, and print creators',
    'วันที่': 'Date', 'วันและเวลา': 'Date and time', 'สถานที่': 'Venue', 'ค่าเข้า': 'Admission',
    'ค่าเข้าชม': 'Admission', 'ฟรี': 'Free', 'บันทึกไว้ว่าจะไป': 'Save as attending',
    'สแกนเพื่อชำระเงิน': 'Scan to pay', 'สแกน QR ด้วยแอปธนาคารเพื่อซื้อบัตร (ตัวอย่าง)': 'Scan with your banking app to buy tickets (demo)',
    'ผู้รับเงิน': 'Recipient', 'ตัวอย่าง': 'Demo',
    'นี้เป็นภาพตัวอย่าง ยังไม่สามารถใช้ชำระเงินจริงได้ เมื่อพัฒนาระบบจริงจะเชื่อม PromptPay และระบบตรวจสอบพร้อมยืนยันรายการอัตโนมัติ': 'This is a demo image and cannot be used for real payment. Live payments will use PromptPay with automatic verification.',
    'ฉันชำระแล้ว': 'I have paid', 'รับรายการแล้ว — บัตรตัวอย่างถูกบันทึกในบัญชี': 'Order received — demo tickets were added to your account',
    'เปิดรายละเอียดงานไม่ได้': 'Could not open event details', 'บัตรหมดหรือยังไม่เปิดขาย': 'Tickets are sold out or not on sale yet',
    'ชำระตรงเข้าบัญชีผู้จัด SlipOK ตรวจผู้รับ ยอดเงิน และสลิปซ้ำให้อัตโนมัติ บัตรออกทันทีเมื่อผ่าน': 'Pay directly to the organizer. SlipOK automatically checks the recipient, amount, and duplicate slips. Tickets are issued after verification.',
    'ดู QR และชำระเงิน': 'View QR and pay', 'ชำระด้วย PromptPay ผ่าน Omise · ระบบออกบัตรหลัง webhook ยืนยันยอดเท่านั้น': 'Pay with PromptPay via Omise. Tickets are issued only after payment is confirmed.',
    'สร้าง QR เพื่อชำระ': 'Create payment QR', 'เลือกบัตร': 'Choose tickets', 'ประเภทบัตร': 'Ticket type',
    'จำนวน': 'Quantity', 'ยอดรวม': 'Order total', 'กำลังสร้างรายการ…': 'Creating your order…',
    'ชำระเงินและส่งสลิปตรวจสอบ': 'Pay and submit your slip for verification', 'รับชำระเงินของผู้จัดงาน': 'Pay the event organizer',
    'ยอดที่ต้องโอน': 'Amount to transfer', 'ธนาคาร': 'Bank', 'ชื่อผู้รับ': 'Account name',
    'เลขบัญชีลงท้าย': 'Account ending in', 'หมดเวลาจองบัตร': 'Ticket reservation expires',
    'แนบสลิปโอนเงิน': 'Attach payment slip', 'ตรวจบัญชีผู้รับ ยอดเงิน และสลิปซ้ำ · JPG, PNG, JFIF หรือ WebP ไม่เกิน 5 MB': 'Checks recipient, amount, and duplicate slips · JPG, PNG, JFIF, or WebP up to 5 MB',
    'ตรวจสลิปด้วย SlipOK': 'Verify slip with SlipOK', 'เมื่อ SlipOK ยืนยันว่าผู้รับและยอดเงินถูกต้อง ระบบจะออกบัตรให้ทันที': 'Tickets are issued as soon as SlipOK verifies the recipient and amount.',
    'เวลาจองหมดแล้ว กรุณาเลือกบัตรใหม่': 'Your reservation expired. Please choose tickets again.',
    'ตรวจผ่าน · บัตรของคุณพร้อมใช้งาน': 'Verified · Your tickets are ready', 'เลือกไฟล์สลิปก่อนส่งตรวจ': 'Choose a payment slip to verify',
    'เลือกรูป JPG, PNG, JFIF หรือ WebP ไม่เกิน 5 MB': 'Choose a JPG, PNG, JFIF, or WebP image up to 5 MB',
    'กำลังตรวจสลิป…': 'Verifying slip…', 'ตรวจผู้รับและยอดผ่าน · ออกบัตรอัตโนมัติแล้ว': 'Recipient and amount verified · Tickets issued',
    'ตรวจผ่าน · กำลังออกบัตร': 'Verified · Issuing tickets',
    'กดปุ่มด้านล่างเพื่อลองออกบัตรอีกครั้งได้ โดยไม่ต้องส่งสลิปใหม่': 'Use the button below to retry ticket issuance without resubmitting your slip.',
    'ลองออกบัตรอีกครั้ง': 'Retry ticket issuance', 'กำลังออกบัตร…': 'Issuing tickets…',
    'บัตรของคุณพร้อมใช้งานแล้ว': 'Your tickets are ready', 'ยังออกบัตรไม่ได้ กรุณาลองอีกครั้ง': 'Could not issue tickets. Please try again.',
    'ยังยืนยันสลิปไม่ได้': 'Could not verify the slip', 'ตรวจสอบยอดหรือ QR ไม่ผ่าน': 'Amount or QR verification failed',
    'ตรวจสอบยอดและเลือกสลิปต้นฉบับให้ถูกต้อง แล้วส่งใหม่': 'Check the amount, choose the original slip, and try again.',
    'ตรวจสลิปอีกครั้ง': 'Verify slip again', 'ลองตรวจอีกครั้ง': 'Try verification again',
    'สแกน PromptPay เพื่อชำระ': 'Scan PromptPay to pay', 'จาก Omise สำหรับรายการ': 'via Omise for order',
    'หมดอายุ': 'Expires', 'บัตรจะเข้าบัญชีหลัง Omise ส่ง webhook ยืนยันการชำระ ระบบกำลังตรวจสอบอัตโนมัติ': 'Tickets will appear in your account after Omise confirms payment. We are checking automatically.',
    'ตรวจสถานะ': 'Check status', 'หมดเวลา': 'Expired', 'ชำระแล้ว — บัตรของคุณอยู่ใน “บัตรของฉัน”': 'Paid — your tickets are in “My tickets”',
    'พร้อมเข้างาน': 'Ready for entry', 'ใช้สิทธิ์แล้ว': 'Used', 'ยกเลิก': 'Cancelled',
    'ยังไม่มีบัตรที่ซื้อ': 'You have no tickets yet', 'สแกนบัตรเข้างาน': 'Scan event tickets',
    'เฉพาะ Organizer ของงานหรือผู้ดูแลระบบ': 'Only the event organizer or an administrator can do this',
    'กดเปิดกล้องเพื่อเริ่มสแกน': 'Open the camera to start scanning', 'เปิดกล้อง': 'Open camera',
    'ปิดกล้อง': 'Close camera', 'หรือวางรหัส QR': 'Or paste a QR code', 'รหัสบัตร': 'Ticket code',
    'ตรวจบัตร': 'Verify ticket', 'กำลังตรวจสอบ…': 'Verifying…', 'ยืนยันแล้ว': 'Verified',
    'บัตรนี้ถูกใช้ไปแล้ว': 'This ticket has already been used', 'ไม่พบบัตรหรือ QR ไม่ถูกต้อง': 'Ticket not found or QR code is invalid',
    'เบราว์เซอร์นี้ไม่รองรับการอ่าน QR จากกล้อง กรุณาใช้ช่องวางรหัสด้านล่าง': 'This browser cannot scan QR codes with the camera. Paste the code below instead.',
    'เปิดกล้องไม่ได้': 'Could not open camera', 'เปิดขายบัตรงานของคุณ': 'Sell tickets to your event',
    'เพิ่มข้อมูลงาน ตั้งราคาและจำนวนบัตร แล้วให้ผู้ชมเลือกซื้อจากหน้าอีเวนต์': 'Add event details, set ticket prices and quantities, and let attendees buy from the Events page.',
    'รายละเอียดอีเวนต์': 'Event details', 'ชื่องาน': 'Event name', 'ชื่ออีเวนต์': 'Event name',
    'ชื่อสถานที่': 'Venue name', 'เช่น Warehouse 30': 'e.g. Warehouse 30', 'วันเริ่มงาน': 'Start date',
    'วันจบงาน': 'End date', 'ที่อยู่': 'Address', 'ที่อยู่สถานที่จัดงาน': 'Event venue address',
    'บอกผู้ชมว่าในงานมีอะไรบ้าง': 'Tell attendees what to expect', 'ตั้งค่าบัตร': 'Ticket setup',
    'ชื่อประเภทบัตร': 'Ticket tier name', 'บัตรทั่วไป': 'General admission', 'จำนวนบัตร': 'Ticket quantity',
    'ขายได้เฉพาะบัญชี Organizer ที่ผ่านการยืนยัน · ผู้จัดรับเงินตรง · SlipOK ตรวจสลิปแล้วออกบัตร': 'Only verified organizer accounts can sell tickets · Direct payment to organizers · SlipOK verifies slips before issuing tickets',
    'สถานะบัตร': 'Ticket status', 'ยังไม่เปิดขาย': 'Not on sale yet', 'การชำระเงิน': 'Payment',
    'ยังไม่ได้เชื่อมผู้ให้บริการ': 'No payment provider connected',
    'การแจ้งเตือนนี้จะบันทึกไว้ใน Sourcewav เท่านั้น ยังไม่มีการรับเงินหรือออกบัตร': 'This alert is saved in Sourcewav only. No payment is collected and no ticket is issued.',
    'รับงาน': 'Find work', 'เสนอราคา': 'Send an offer', 'ทักผู้ขาย': 'Contact seller',
    'ยังไม่มีผลงานในตลาด ลงงานแรกของคุณได้เลย': 'No marketplace listings yet. Add the first one.',
    'ยังไม่มีโพสต์ในหมวดนี้ — เริ่มบทสนทนาแรกได้เลย': 'No posts in this category yet — start the conversation.',
    'โหลดฟีดไม่ได้': 'Could not load feed', 'โหลดตลาดไม่ได้': 'Could not load marketplace', 'โหลดอีเวนต์ไม่ได้': 'Could not load events',
    'ฐานข้อมูลเชื่อมต่อแล้ว': 'Database connected', 'ออฟไลน์ · เก็บชั่วคราว': 'Offline · saved temporarily',
    'กำลังเชื่อมฐานข้อมูล': 'Connecting to database', 'กำลังใช้ข้อมูลสำรองในเบราว์เซอร์': 'Using browser storage',
    'บัญชีเชื่อมต่อ Supabase แล้ว; โพสต์ แชท ตลาด และบัตรใช้บริการแยกตามระบบ': 'Supabase connected. Posts, chat, marketplace, and tickets use separate services.',
    'บัญชีและโปรไฟล์เชื่อมต่อกับ Supabase แล้ว': 'Account and profile connected to Supabase',
    'เชื่อมต่อฐานข้อมูล Supabase แล้ว · เข้าสู่ระบบเพื่อบันทึกโปรไฟล์ของคุณ': 'Connected to Supabase · Log in to save your profile',
    'กำลังเชื่อมต่อฐานข้อมูล Supabase': 'Connecting to Supabase', 'แก้ไขโปรไฟล์': 'Edit profile',
    'บ้านของคอมมูนิตี้': 'Your community home', 'ผลงาน': 'Listings', 'กำลังติดตาม': 'Following',
    'พื้นที่ผลงานและร้านค้าของคุณ': 'Your creative space and store', 'ปล่อยเพลงแรก': 'Release your first track',
    'ร้านค้าศิลปิน': 'Artist Store', 'การ์ดรับงาน Booking': 'Booking card', 'จัดการบัญชี': 'Manage account',
    'สร้างบัญชี': 'Create account', 'ชื่อที่ใช้ในคอมมูนิตี้': 'Community display name',
    'โพสต์ใหม่อยู่บนฟีดแล้ว': 'Your post is now in the feed', 'บันทึกโปรไฟล์แล้ว': 'Profile saved',
    'เพิ่มผลงานในตลาดแล้ว': 'Listing added to the marketplace', 'เพิ่มความคิดเห็นแล้ว': 'Comment added',
    'บันทึกข้อความแล้ว': 'Message saved', 'บันทึกงานนี้ไว้ในรายการของคุณแล้ว': 'Event saved to your list',
    'งานนี้อยู่ในรายการติดตามแล้ว': 'You are following this event', 'เลิกติดตามแล้ว': 'Unfollowed',
    'เริ่มติดตามแล้ว': 'Following', 'บันทึกงานนี้ไว้': 'Save this event', 'ติดตามงานนี้': 'Follow this event',
    'ต้นแบบนี้ยังไม่รับชำระเงินจริง จึงยังไม่ออกบัตร': 'This prototype does not accept real payments or issue tickets.',
    'โพสต์ให้วงในเห็น': 'Share with the community', 'นี่คือพื้นที่สนทนาส่วนตัวกับ': 'This is your private conversation with',
    'ผลงานของฉัน': 'My work', 'ยังไม่มีผลงานที่เผยแพร่ ลองแชร์เพลงหรือภาพแรกของคุณในฟีด': 'No published work yet. Share your first track or image in the feed.',
    'สอบถามราคา': 'Price on request', 'ลงโดยคุณ': 'Listed by you', 'ผลงานจากสมาชิก Sourcewav': 'Work from a Sourcewav member',
    'คุณ:': 'You:', 'ค้นหาเพื่อน งาน อีเวนต์ และบทสนทนา': 'Find people, work, events, and conversations',
    'ชำระเงินไม่สำเร็จ': 'Payment failed', 'ชำระเงินสำเร็จ': 'Payment successful',
    'เปิดรายละเอียดงานไม่ได้': 'Could not open event details', 'กรุณากรอกข้อมูลให้ครบถ้วน': 'Please complete all required fields',
    'ไม่สามารถเล่นไฟล์เสียงนี้ได้': 'Could not play this audio file', 'ออกจากระบบไม่สำเร็จ ลองอีกครั้ง': 'Could not log out. Please try again.',
    'ยังเชื่อมต่อ Supabase ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่': 'Could not connect to Supabase. Check your connection and try again.',
    'ยืนยันบัญชีก่อนเข้าสู่ระบบ': 'Verify your account before logging in', 'ส่งลิงก์ยืนยันไปที่อีเมลแล้ว ยืนยันบัญชีก่อนเข้าสู่ระบบ': 'A verification link was sent to your email. Verify your account before logging in.',
    'อีเมลหรือรหัสผ่านไม่ถูกต้อง': 'Email or password is incorrect', 'ดำเนินการไม่สำเร็จ ตรวจสอบข้อมูลแล้วลองอีกครั้ง': 'Action failed. Check your details and try again.',
    'อีเมล': 'Email', 'รหัสผ่าน': 'Password', 'ยืนยันรหัสผ่าน': 'Confirm password',
    'สร้างพื้นที่ของคุณ แล้วเริ่มรู้จักคนทำเพลงและศิลปะในวงการ': 'Create your space and meet people in music and art.',
    'เข้าสู่พื้นที่ของคุณ แล้วไปต่อจากที่ค้างไว้': 'Log in and pick up where you left off.',
    'เลือกรหัสผ่านใหม่เพื่อกลับเข้าสู่ Sourcewav': 'Choose a new password to return to Sourcewav.',
    'ฉันยอมรับ': 'I agree to the', 'และต้องการเข้าร่วม Sourcewav': 'and want to join Sourcewav',
    'กรอกอีเมลก่อนขอลิงก์ตั้งรหัสผ่านใหม่': 'Enter your email to request a password reset link',
    'ส่งลิงก์ไม่สำเร็จ ตรวจสอบอีเมลแล้วลองอีกครั้ง': 'Could not send link. Check the email address and try again.',
    'ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว': 'Password reset link sent to your email',
    'รหัสผ่านทั้งสองช่องไม่ตรงกัน': 'The passwords do not match',
    'กรุณายอมรับแนวทางชุมชนก่อนสร้างโปรไฟล์': 'Please accept the community guidelines before creating your profile',
    'ชื่อผู้ใช้นี้ถูกใช้แล้ว หรือรูปแบบไม่ถูกต้อง': 'This username is taken or the format is invalid',
    'สร้างบัญชี Sourcewav แล้ว': 'Sourcewav account created', 'เข้าสู่ระบบแล้ว': 'Logged in',
    'ตั้งรหัสผ่านใหม่แล้ว': 'Password updated', 'บันทึกโปรไฟล์ใน Supabase แล้ว': 'Profile saved to Supabase',
    'บันทึกโปรไฟล์ไว้ในเบราว์เซอร์แล้ว': 'Profile saved in this browser', 'เข้าสู่ระบบก่อนเพื่ออัปโหลดรูปโปรไฟล์': 'Log in to upload a profile photo',
    'เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB': 'Choose a JPG, PNG, or WebP image up to 5 MB',
    'ตัวอย่างรูปโปรไฟล์ที่เลือก': 'Selected profile photo preview', 'ใช้ตัวอักษรอังกฤษ ตัวเลข หรือขีดล่าง 3–30 ตัว': 'Use 3–30 English letters, numbers, or underscores',
    'บอกสั้น ๆ ว่าคุณกำลังทำอะไร หรืออยากเจอใคร': 'Briefly share what you are working on or who you want to meet',
    'ไม่เกิน 160 ตัวอักษร': 'Up to 160 characters', 'ทำโปรไฟล์ให้เป็นคุณ': 'Make your profile yours',
    'บอกคนในวงการว่าคุณเป็นใคร และอยากทำอะไรต่อไป': 'Tell the community who you are and what you want to do next',
    'JPG, PNG หรือ WebP · สูงสุด 5 MB': 'JPG, PNG, or WebP · up to 5 MB',
    'เข้าสู่ระบบก่อนเพื่ออัปโหลดรูปโปรไฟล์': 'Log in to upload a profile photo',
    'โพสต์นี้ถูกใจแล้ว': 'You liked this post', 'นำการถูกใจออกแล้ว': 'Like removed',
    'นำโพสต์ออกจากรายการที่บันทึกแล้ว': 'Post removed from saved items', 'บันทึกโพสต์ไว้แล้ว': 'Post saved',
    'คุยกันใต้โพสต์': 'Join the conversation', 'ยังไม่มีความคิดเห็น เริ่มคุยได้เลย': 'No comments yet. Start the conversation.',
    'แสดงความคิดเห็นอย่างสร้างสรรค์…': 'Keep your comment constructive…', 'โพสต์ใหม่อยู่บนฟีดแล้ว': 'Your post is now in the feed',
    'พิมพ์ข้อความก่อนโพสต์': 'Write something before posting', 'ใส่ชื่อที่แสดงก่อนบันทึก': 'Enter a display name before saving',
    'ใส่ชื่อผลงานก่อนบันทึก': 'Enter a listing title before saving', 'ตรวจสอบราคาก่อนบันทึก': 'Check the price before saving',
    'พิมพ์ความคิดเห็นก่อนส่ง': 'Write a comment before sending', 'พิมพ์ข้อความก่อนส่ง': 'Write a message before sending',
    'แชทส่วนตัวระหว่างสมาชิก': 'Private member-to-member chat', 'พิมพ์ข้อความ…': 'Write a message…',
    'ห้องคุยที่กำลังคึกคัก': 'Active rooms', 'เริ่มบทสนทนา': 'Start a conversation',
    'บันทึกการตอบรับลงฐานข้อมูลแล้ว': 'Response saved to the database', 'บันทึกการปฏิเสธลงฐานข้อมูลแล้ว': 'Decline saved to the database',
    'ตอบรับไม่สำเร็จ': 'Could not accept request', 'ปฏิเสธไม่สำเร็จ': 'Could not decline request',
    'ติดตามไม่สำเร็จ': 'Could not follow', 'ตรวจสอบการเชื่อมต่อฐานข้อมูล': 'Check your database connection',
    'บันทึกไม่สำเร็จ': 'Could not save', 'บันทึกการ์ดลงฐานข้อมูลและแสดงบน Booking Board แล้ว': 'Booking card saved and listed on Booking Board',
    'ส่งข้อเสนอในฐานข้อมูลแล้ว': 'Booking request saved to the database',
    'ยอมรับแล้ว · จัดการชำระเงินกันนอกระบบ': 'Accepted · Arrange payment outside the platform',
    'ธุรกรรมปิดสมบูรณ์แล้ว': 'Transaction completed', 'ชำระแล้ว': 'Paid', 'รอ Omise ยืนยันการชำระ': 'Waiting for Omise payment confirmation',
    'ตอบรับไม่สำเร็จ': 'Could not accept request', 'ส่งข้อความแล้ว (ตัวอย่าง)': 'Message sent (demo)',
    'เปิดหน้าแก้ไขโปรไฟล์ (ตัวอย่าง)': 'Profile editor opened (demo)', 'กำลังค้นหา...': 'Searching…',
    'คัดลอกลิงก์โพสต์แล้ว': 'Post link copied', 'เริ่มติดตามแล้ว': 'Now following', 'เลิกติดตามแล้ว': 'Unfollowed',
    'ลองอีกครั้ง': 'Try again', 'ดำเนินการไม่สำเร็จ': 'Action failed', 'อัปโหลดไม่สำเร็จ': 'Upload failed',
    'ไม่พบโพสต์': 'Post not found', 'กรุณาลองใหม่': 'Please try again',
    'บัญชีรับเงินสำหรับบัตร': 'Ticket payout account', 'ธนาคาร / PromptPay': 'Bank / PromptPay', 'เช่น กสิกรไทย / PromptPay': 'e.g. Kasikornbank / PromptPay',
    'ชื่อบัญชีผู้รับเงิน': 'Beneficiary account name', 'ชื่อที่ตรงกับบัญชี': 'Name exactly as shown on the account',
    'เลขบัญชี 4 ตัวท้าย': 'Last 4 digits of account', 'ไม่บังคับ': 'Optional', 'รับเงิน': 'Receive payments',
    'อัปโหลด QR จากบัญชีที่ลงทะเบียนเป็นผู้รับกับ SlipOK': 'Upload a QR code from the account registered with SlipOK',
    'ของบัญชีผู้รับ': 'of the recipient account', 'ของ Branch นี้': 'for this branch',
    'ระบบจะส่ง API Key ไปเข้ารหัสที่เซิร์ฟเวอร์ ไม่เก็บไว้ในหน้าเว็บ กรอก Branch ID และ API Key ที่ SlipOK ออกให้สำหรับบัญชีเดียวกับ QR รับเงิน': 'The API key is sent securely to the server and is never stored in the page. Enter the SlipOK Branch ID and API key for the same account as your payment QR.',
    'เผยแพร่งานและเปิดขายบัตร': 'Publish event and start ticket sales', 'กำลังเผยแพร่…': 'Publishing…',
    'ใส่ชื่องานอย่างน้อย 4 ตัวอักษร': 'Enter an event name with at least 4 characters',
    'เลือกวันเริ่มงานในอนาคต': 'Choose a future start date', 'วันจบงานต้องอยู่หลังวันเริ่มงาน': 'End date must be after the start date',
    'กรอกชื่อและที่อยู่สถานที่จัดงาน': 'Enter the venue name and address', 'กรอกราคาและจำนวนบัตรให้ถูกต้อง': 'Enter a valid ticket price and quantity',
    'ราคาบัตรต้องอยู่ระหว่าง ฿20 ถึง ฿150,000': 'Ticket price must be between ฿20 and ฿150,000',
    'จำนวนบัตรต้องอยู่ระหว่าง 1 ถึง 10,000 ใบ': 'Ticket quantity must be between 1 and 10,000',
    'กรอกธนาคารและชื่อบัญชี และเลขท้าย 4 หลักถ้าต้องการแสดง': 'Enter the bank and account name. Add the last 4 digits if you want to show them.',
    'กรอก SlipOK Branch ID เป็นตัวเลข': 'Enter a numeric SlipOK Branch ID', 'กรอก SlipOK API Key ของบัญชีผู้รับ': 'Enter the SlipOK API key for the receiving account',
    'อัปโหลด QR Code เป็น JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB': 'Upload a QR code as JPG, PNG, or WebP up to 5 MB',
    'อัปโหลด QR รับเงินไม่สำเร็จ': 'Could not upload payment QR', 'สร้างอีเวนต์และ Tier บัตรแล้ว': 'Event and ticket tier created',
    'ใส่ชื่อผลงานก่อนบันทึก': 'Enter a listing title before saving', 'ภาพต้องเป็น JPG, PNG หรือ WebP และขนาดไม่เกิน 5 MB': 'Image must be JPG, PNG, or WebP up to 5 MB',
    'ภาพผลงาน': 'Work image', 'รายละเอียด': 'Details', 'ขนาด สไตล์ เงื่อนไข หรือสิ่งที่อยากแลก': 'Size, style, terms, or what you would trade for',
    'เว้นว่างถ้าสอบถามราคา': 'Leave blank if price is on request', 'ลงผลงาน': 'Publish listing', 'ลงผลงานในตลาดแล้ว': 'Listing published',
    'ปิดแชท': 'Close chat', 'ค้นหาชื่อหรือ @username...': 'Search name or @username…',
    'กำลังโหลดแชท…': 'Loading chats…', 'ค้นหาสมาชิกไม่ได้': 'Could not search members', 'ไม่พบสมาชิก': 'No members found',
    'เข้าสู่ระบบเพื่อดูข้อความ': 'Log in to view messages', 'ยังไม่มีแชท ค้นหาชื่อสมาชิกด้านบนเพื่อเริ่มคุย': 'No chats yet. Search for a member above to start a conversation.',
    'บทสนทนา': 'Conversation', 'เริ่มบทสนทนา': 'Start a conversation', 'ส่ง': 'Send',
    'ลงทะเบียนการ์ดของคุณ': 'Create your booking card', 'ยังไม่มีการ์ดศิลปินในหมวดนี้': 'No artist cards in this category yet',
    'ลงทะเบียนรับงาน / สร้างการ์ด Booking': 'Register for work / Create booking card',
    'เพิ่มโปรไฟล์ของคุณบน Booking Board เพื่อรับงานแสดง DJ, แรป, ทำบีท หรืองานโปรดักชัน': 'Create your Booking Board profile for DJ, rap, beatmaking, or production gigs.',
    'ชื่อที่ใช้รับงาน': 'Professional name', 'ใช้ชื่อและ Username จากโปรไฟล์ที่เข้าสู่ระบบ': 'Using the name and username from your signed-in profile',
    'บทบาทหลัก': 'Main role', 'เปิดเพลง': 'Music performance', 'ทีมจัดงาน': 'Event crew', 'พื้นที่รับงาน': 'Service area',
    'กรุงเทพฯ & ปริมณฑล': 'Bangkok & vicinity', 'เช่น กรุงเทพฯ, ขอนแก่น': 'e.g. Bangkok, Khon Kaen',
    'ราคาเรทเริ่มต้น (บาท)': 'Starting rate (THB)', 'หน่วยเรทราคา': 'Rate unit', 'ต่อเซ็ต (2 ชม.)': 'per set (2 hours)',
    'เช่น ต่องาน, ต่อบีท': 'e.g. per event, per beat', 'สถานะวันว่าง & คิวงาน': 'Availability & schedule',
    'เช่น ว่างทุกศุกร์-เสาร์, คิวว่างเดือน พ.ย.': 'e.g. available Fridays and Saturdays, open in November',
    'คำอธิบายสไตล์ & ประสบการณ์ (Bio)': 'Style & experience', 'เล่าแนวเพลง อุปกรณ์ ประสบการณ์เวที หรือจุดเด่นของคุณ...': 'Tell us about your genre, equipment, stage experience, or strengths…',
    'ตัวอย่างผลงาน / ลิงก์เดโม': 'Work samples / demo links', 'เช่น ลิงก์ SoundCloud, YouTube, หรือชื่อมิกซ์เทป': 'e.g. SoundCloud or YouTube link, or mixtape title',
    'บันทึกและขึ้นแสดงบน Booking Board': 'Save and list on Booking Board', 'บันทึกการ์ดลงฐานข้อมูลและแสดงบน Booking Board แล้ว': 'Booking card saved and listed on Booking Board',
    'ส่งข้อเสนอจ้างงาน ↗': 'Send a booking request ↗', 'ส่งข้อความคุย': 'Message to discuss',
    'ส่งข้อเสนอจ้างงาน': 'Send booking request', 'ส่งรายละเอียดและงบประมาณให้ศิลปินตอบรับ ข้อเสนอนี้ยังไม่ใช่การชำระเงินหรือสัญญาออนไลน์': 'Send the details and budget for the artist to review. This is not a payment or an online contract.',
    'ชื่องาน / กิจกรรม': 'Job / event name', 'เช่น Friday Night Live at AVVE': 'e.g. Friday Night Live at AVVE',
    'วันและเวลาของงาน': 'Event date and time', 'สถานที่จัดงาน': 'Event venue', 'ผู้ติดต่อ / ชื่อร้าน': 'Contact / business name',
    'ชื่อคุณ หรือชื่อสถานที่': 'Your name or venue name', 'เบอร์ติดต่อ / อีเมล': 'Phone / email', 'เบอร์โทรศัพท์หรืออีเมล': 'Phone number or email',
    'งบประมาณที่เสนอจ้าง (บาท)': 'Proposed budget (THB)', 'ประมาณการงบประมาณ': 'Estimated budget',
    'รายละเอียดงาน & สิ่งที่เตรียมไว้ให้': 'Job details & what you provide', 'ระบบเสียงพร้อม, ขอเซ็ตเพลงแนวฮิปฮอป 90s, มิกเซอร์ Pioneer พร้อม': 'Sound system ready, 90s hip-hop set, Pioneer mixer provided',
    'ส่งข้อเสนอจ้างงานทันที ↗': 'Send booking request ↗', 'ข้อเสนอจ้างงานและสัญญา (Booking Inbox)': 'Booking requests & agreements (Booking Inbox)',
    'ดูข้อเสนอที่ส่งและได้รับ การยอมรับยังไม่ใช่การชำระเงินหรือการออกใบเสร็จ': 'Review sent and received requests. Acceptance does not mean payment or receipt issuance.',
    'รอตอบรับ': 'Awaiting response', 'รับงานแล้ว': 'Accepted', 'งานเสร็จแล้ว': 'Completed', 'ปฏิเสธ': 'Decline',
    'ยอมรับข้อเสนอ': 'Accept request', 'รอศิลปินตอบรับ': 'Waiting for artist response',
    'ยอมรับแล้ว · จัดการชำระเงินกันนอกระบบ': 'Accepted · Arrange payment outside the platform', 'ธุรกรรมปิดสมบูรณ์แล้ว': 'Transaction completed',
    'ยังไม่มีข้อเสนอจ้างงาน': 'No booking requests yet', 'ข้อความ': 'Messages', 'แชทส่วนตัวระหว่างสมาชิก': 'Private member-to-member chat',
    'กำลังโหลดแชท…': 'Loading chats…', 'ค้นหาสมาชิกไม่ได้': 'Could not search members', 'สมาชิก': 'Member',
    'ติดตามศิลปิน/สถานที่และแจ้งเตือนงานใหม่': 'Follow artists and venues for new releases',
    'ประกาศและรายการอัปเดตจากฐานข้อมูล Sourcewav': 'Announcements and updates from Sourcewav',
    'อ่านทั้งหมดแล้ว': 'Mark all as read', 'เพลงใหม่': 'New music', 'บัตร & งาน': 'Tickets & events',
    'สถานที่โปรด': 'Favorite venues', 'ได้รับการโปรโมต': 'Promoted', 'แชร์ข่าวงานหรือเพลงใหม่': 'Share an event or new release',
    'บันทึกประกาศลงฐานข้อมูลและแสดงใน Drop Alerts โดยไม่ติดป้ายโฆษณา': 'Save this announcement to the database and show it in Drop Alerts without an ad label.',
    'สร้าง Drop': 'Create Drop', 'ไม่มีการแจ้งเตือนในหมวดนี้': 'No alerts in this category',
    'ส่งข้อเสนอไม่สำเร็จ': 'Could not send booking request', 'บันทึกไม่สำเร็จ': 'Could not save', 'ลงผลงานไม่ได้': 'Could not publish listing',
    'โพสต์เผยแพร่แล้ว': 'Post published', 'โพสต์ไม่ได้': 'Could not publish post', 'เปิดแชทไม่ได้': 'Could not open chat',
    'อัปโหลดภาพไม่ได้': 'Could not upload image', 'เชื่อมภาพกับผลงานไม่ได้': 'Could not attach image to listing',
    'ข้อความจะถูกเก็บไว้ในฐานข้อมูลของเว็บนี้': 'Messages are stored in this website’s database',
    'ฐานข้อมูลเชื่อมต่อแล้ว': 'Database connected', 'เชื่อมต่อบริการไม่สำเร็จ': 'Could not connect to the service'
  };

  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  const excluded = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT']);
  let currentLanguage = 'th';

  function translateValue(value) {
    const exact = translations[value.trim()];
    if (exact) return value.replace(value.trim(), exact);
    let match = value.match(/^(\s*)(\d+) เพลง(\s*)$/);
    if (match) return `${match[1]}${match[2]} tracks${match[3]}`;
    match = value.match(/^(\s*)(\d+) ผลงาน(\s*)$/);
    if (match) return `${match[1]}${match[2]} listings${match[3]}`;
    match = value.match(/^(\s*)(\d+) ความคิดเห็น(\s*)$/);
    if (match) return `${match[1]}${match[2]} comments${match[3]}`;
    match = value.match(/^(\s*)เหลือ ([\d,]+) ใบ(\s*)$/);
    if (match) return `${match[1]}${match[2]} tickets remaining${match[3]}`;
    match = value.match(/^(\s*)เริ่ม (฿[\d,]+)(\s*)$/);
    if (match) return `${match[1]}From ${match[2]}${match[3]}`;
    match = value.match(/^(\s*)ปิดขาย(\s*)$/);
    if (match) return `${match[1]}Sales closed${match[2]}`;
    match = value.match(/^(\s*)พบ ([\d,]+) รายการที่ตรงกับ “(.+)”(\s*)$/);
    if (match) return `${match[1]}Found ${match[2]} results for “${match[3]}”${match[4]}`;
    match = value.match(/^(\s*)ยังไม่พบ “(.+)”(\s*)$/);
    if (match) return `${match[1]}No results for “${match[2]}”${match[3]}`;
    match = value.match(/^(\s*)ดู (.+) บนแผนที่(\s*)$/);
    if (match) return `${match[1]}View ${match[2]} on the map${match[3]}`;
    match = value.match(/^(\s*)เปิดเส้นทางไป (.+) ใน Google Maps(\s*)$/);
    if (match) return `${match[1]}Get directions to ${match[2]} on Google Maps${match[3]}`;
    match = value.match(/^(\s*)ส่งข้อเสนอจ้างงาน · (.+)(\s*)$/);
    if (match) return `${match[1]}Send booking request · ${match[2]}${match[3]}`;
    match = value.match(/^(\s*)โหลดฟีดไม่ได้: (.+)(\s*)$/);
    if (match) return `${match[1]}Could not load feed: ${match[2]}${match[3]}`;
    match = value.match(/^(\s*)โหลดตลาดไม่ได้: (.+)(\s*)$/);
    if (match) return `${match[1]}Could not load marketplace: ${match[2]}${match[3]}`;
    match = value.match(/^(\s*)โหลดอีเวนต์ไม่ได้: (.+)(\s*)$/);
    if (match) return `${match[1]}Could not load events: ${match[2]}${match[3]}`;
    match = value.match(/^(\s*)ส่งข้อเสนอไม่สำเร็จ: (.+)(\s*)$/);
    if (match) return `${match[1]}Could not send booking request: ${match[2]}${match[3]}`;
    match = value.match(/^(\s*)บันทึกไม่สำเร็จ: (.+)(\s*)$/);
    if (match) return `${match[1]}Could not save: ${match[2]}${match[3]}`;
    match = value.match(/^(\s*)เปิดกล้องไม่ได้: (.+)(\s*)$/);
    if (match) return `${match[1]}Could not open camera: ${match[2]}${match[3]}`;
    match = value.match(/^(\s*)อัปโหลดรูปไม่สำเร็จ: (.+)(\s*)$/);
    if (match) return `${match[1]}Could not upload photo: ${match[2]}${match[3]}`;
    return value;
  }

  function translateText(node) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const source = originalText.get(node);
    const option = node.parentElement?.closest('option');
    if (option && currentLanguage === 'en' && !option.hasAttribute('value')) option.value = source.trim();
    const nextValue = currentLanguage === 'en' ? translateValue(source) : source;
    if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
  }

  function translateAttributes(element) {
    for (const name of ['aria-label', 'placeholder', 'title', 'alt', 'content']) {
      if (!element.hasAttribute(name)) continue;
      let saved = originalAttributes.get(element);
      if (!saved) originalAttributes.set(element, saved = new Map());
      if (!saved.has(name)) saved.set(name, element.getAttribute(name));
      const source = saved.get(name);
      const nextValue = currentLanguage === 'en' ? translateValue(source) : source;
      if (element.getAttribute(name) !== nextValue) element.setAttribute(name, nextValue);
    }
  }

  function visit(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement && !excluded.has(root.parentElement.tagName)) translateText(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (excluded.has(root.tagName)) return;
      translateAttributes(root);
    }
    root.childNodes.forEach(visit);
  }

  function setLanguage(language) {
    currentLanguage = language === 'en' ? 'en' : 'th';
    document.documentElement.lang = currentLanguage;
    document.documentElement.dataset.language = currentLanguage;
    try { localStorage.setItem('sourcewav-language', currentLanguage); } catch {}
    visit(document);
    const button = document.getElementById('languageToggle');
    if (button) {
      button.textContent = currentLanguage === 'en' ? 'ไทย' : 'EN';
      button.setAttribute('aria-label', currentLanguage === 'en' ? 'Switch to Thai' : 'Switch to English');
      button.title = currentLanguage === 'en' ? 'Switch to Thai' : 'Switch to English';
      button.setAttribute('aria-pressed', String(currentLanguage === 'en'));
    }
  }

  function install() {
    const actions = document.querySelector('.top-actions');
    if (actions && !document.getElementById('languageToggle')) {
      const button = document.createElement('button');
      button.className = 'language-toggle';
      button.id = 'languageToggle';
      button.type = 'button';
      button.textContent = 'EN';
      button.setAttribute('aria-label', 'Switch to English');
      button.title = 'Switch to English';
      button.addEventListener('click', () => setLanguage(currentLanguage === 'th' ? 'en' : 'th'));
      actions.prepend(button);
    }
    let saved = 'th';
    try { saved = localStorage.getItem('sourcewav-language') || 'th'; } catch {}
    setLanguage(saved);
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') translateText(record.target);
        if (record.type === 'attributes' && record.target.id !== 'languageToggle') {
          const element = record.target;
          const name = record.attributeName;
          const value = element.getAttribute(name);
          let saved = originalAttributes.get(element);
          if (!saved) originalAttributes.set(element, saved = new Map());
          if (currentLanguage === 'th' || /[\u0E00-\u0E7F]/.test(value || '')) saved.set(name, value);
          translateAttributes(element);
        }
        record.addedNodes?.forEach(visit);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'placeholder', 'title', 'alt', 'content'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
