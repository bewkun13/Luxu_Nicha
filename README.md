# Luxu_Nicha — บัญชีร้าน US → ไทย

แอปมือถือไฟล์เดียว (`index.html`) เก็บข้อมูลบน **Firebase Firestore** ล็อกอินด้วย Google
- เจ้าของร้าน (`OWNER_EMAIL`): เห็นต้นทุน กำไร ล็อต ตั้งราคา
- คนขาย (อีเมลที่อยู่ใน collection `sellers`): เห็นสินค้า+ราคาขาย สร้างออเดอร์ แนบสลิป ดูค่าคอมตัวเอง — **อ่านต้นทุนไม่ได้จริงๆ** (บังคับด้วย firestore.rules)

## ตั้งค่า (ทำครั้งเดียว)
1. https://console.firebase.google.com → Add project
2. Build → **Authentication** → Get started → เปิด **Google** (Sign-in method)
   - Authentication → Settings → Authorized domains → เพิ่มโดเมน Vercel ของคุณ (เช่น `luxunicha.vercel.app`)
3. Build → **Firestore Database** → Create database (production mode)
4. Firestore → **Rules** → วางเนื้อหา `firestore.rules` (แก้ `PASTE_OWNER_GMAIL@gmail.com` เป็นอีเมลเจ้าของ) → Publish
5. Project settings → Your apps → Web (`</>`) → คัดลอก config ไปใส่ `firebase-config.js` และใส่ `OWNER_EMAIL`
6. เพิ่มคนขาย: เข้าแอปด้วยบัญชีเจ้าของ → แท็บ “สรุป” → การ์ด “คนขายที่เข้าใช้ได้” → “+ เพิ่มคนขาย” (ใส่ Gmail ของคนขาย)
7. Deploy บน Vercel (static ไม่ต้อง build)

## หมายเหตุ
- รูปสินค้าเก็บเป็นภาพย่อใน Firestore (collection `photos`) ไม่ต้องใช้ Firebase Storage
- ลืม PIN: ลบฟิลด์ `pin` ที่ `ownerSettings/main` ใน Firebase Console
- ข้อมูลเดิมใน claude.ai artifact **ไม่ย้ายมาอัตโนมัติ**
- โค้ดส่วน Firebase (`firebase-adapter.js`) ยังไม่เคยทดสอบกับ Firebase จริง ทดสอบแล้วเฉพาะตัวแอปกับ mock
