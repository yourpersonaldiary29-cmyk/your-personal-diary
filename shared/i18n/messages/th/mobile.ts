/** th - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'เพิ่มเติม',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'ข้าม - ขอดูก่อน',
  'mobile.guest.skipHint': 'ลองใช้แอปด้วยข้อมูลตัวอย่าง สิ่งที่คุณเขียนจะไม่ถูกบันทึก',
  'mobile.guest.started': 'โหมดทดลองชม: นี่คือข้อมูลตัวอย่าง สิ่งที่คุณเขียนจะไม่ถูกบันทึก',
  'mobile.guest.name': 'ผู้เยี่ยมชม',
  'mobile.guest.banner': 'โหมดทดลองชม - สิ่งที่คุณเขียนจะไม่ถูกบันทึก',
  'mobile.guest.createAccount': 'สร้างบัญชี',
  'mobile.guest.endTour': 'จบการทดลองชม',
  'mobile.guest.ended': 'จบการทดลองชมแล้ว',
  'mobile.guest.unavailable': 'โหมดทดลองชมใช้ไม่ได้ในเวอร์ชันนี้',
  'mobile.guest.settingsTitle': 'โหมดทดลองชม',
  'mobile.guest.settingsText': 'การตั้งค่าบัญชี ความปลอดภัย และการสำรองข้อมูลใช้ไม่ได้ในโหมดทดลองชม โปรดสร้างบัญชีเพื่อใช้งาน',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'บันทึกลงอุปกรณ์',
  'mobile.files.share': 'แชร์',
  'mobile.files.saved': 'บันทึกลงอุปกรณ์แล้ว: {fileName}',
  'mobile.files.shared': 'แชร์แล้ว: {fileName}',
  'mobile.files.openedBackup': 'เปิดไฟล์สำรองข้อมูลแล้ว: {fileName} โปรดตรวจสอบไฟล์ ป้อนรหัสผ่านของไฟล์ แล้วยืนยันเพื่อกู้คืน',
  'mobile.files.readFailed': 'ไม่สามารถอ่านไฟล์ที่เปิดได้',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'การเตือนนิสัย',
  'mobile.reminders.channelDescription': 'การเตือนตามเวลาที่คุณตั้งไว้สำหรับนิสัยของคุณ',
  'mobile.reminders.genericBody': 'ถึงเวลาทำนิสัยอย่างหนึ่งของคุณแล้ว',
  'mobile.reminders.permissionText': 'เพื่อให้เตือนคุณได้แม้ปิดแอปอยู่ โทรศัพท์ต้องอนุญาตการแจ้งเตือนของ Your Personal Diary การเตือนถูกสร้างขึ้นในโทรศัพท์เอง ไม่มีสิ่งใดถูกส่งออกไป',
  'mobile.reminders.allow': 'อนุญาตการแจ้งเตือน',
  'mobile.reminders.granted': 'อนุญาตการแจ้งเตือนแล้ว การเตือนจะมาถึงแม้ปิดแอปอยู่ โดยปกติภายในไม่กี่นาทีหลังเวลาที่ตั้งไว้',
  'mobile.reminders.denied': 'การแจ้งเตือนของแอปนี้ถูกปิดอยู่ จนกว่าคุณจะเปิดในการตั้งค่าโทรศัพท์ (แอป → Your Personal Diary → การแจ้งเตือน) การเตือนจะแสดงเฉพาะตอนที่เปิดแอปอยู่เท่านั้น',
  'mobile.reminders.showNames': 'แสดงชื่อนิสัยในการแจ้งเตือน',
  'mobile.reminders.showNamesHint': 'ปิด: การแจ้งเตือนบอกเพียงว่าถึงเวลาทำนิสัยแล้ว เปิด: แสดงชื่อนิสัยด้วย รวมถึงบนหน้าจอล็อก',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'ล็อกเมื่อฉันออกจากแอป',
  'mobile.security.lockOnLeaveHint': 'ไดอารี่จะล็อกเมื่อสลับไปแอปอื่นหรือหน้าจอดับ รหัสผ่านของคุณใช้เปิดอีกครั้ง',
  'mobile.security.privacyScreen': 'ซ่อนเนื้อหาในแอปล่าสุดและบล็อกการจับภาพหน้าจอ',
  'mobile.security.privacyScreenHint': 'แอปจะแสดงเป็นการ์ดว่างในหน้าจอแอปล่าสุด และไม่สามารถจับภาพหน้าจอของแอปได้',
  'mobile.security.biometric': 'ปลดล็อกด้วยลายนิ้วมือหรือใบหน้า',
  'mobile.security.biometricHint': 'สำหรับหน้าจอล็อกเท่านั้น การเข้าสู่ระบบและการยืนยันการเปลี่ยนแปลงที่สำคัญต้องใช้รหัสผ่านเสมอ',
  'mobile.security.biometricUnavailable': 'โทรศัพท์เครื่องนี้ยังไม่ได้ตั้งค่าการปลดล็อกด้วยลายนิ้วมือหรือใบหน้า',
  'mobile.security.saved': 'บันทึกการตั้งค่าแล้ว',
  'mobile.lock.biometric': 'ปลดล็อกด้วยลายนิ้วมือหรือใบหน้า',
  'mobile.lock.biometricTitle': 'ปลดล็อก Your Personal Diary',
  'mobile.lock.usePassword': 'ใช้รหัสผ่าน',
  'mobile.lock.biometricFailed': 'การปลดล็อกด้วยไบโอเมตริกไม่สำเร็จ โปรดป้อนรหัสผ่าน',
};
export default messages;
