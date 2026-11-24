# RMWeather: ตรวจแหล่งข้อมูล One Data

ตรวจวันที่ 24 พฤศจิกายน 2026 (Asia/Bangkok) ผ่านหน้าเว็บ โค้ด JavaScript สาธารณะ และ HTTP GET โดยไม่ล็อกอิน ไม่เรียก API แก้ไขข้อมูล

## ข้อสรุป

ใช้ Repo https://github.com/Rachane16/RMWeather ต่อได้ บัญชี GitHub ที่เชื่อมต่อมีสิทธิ์ push/admin และหน้า https://rachane16.github.io/RMWeather/ เปิดได้จริง ไม่จำเป็นต้องสร้าง Repo ใหม่

โค้ดเป็น index.html หน้าเดียว ใช้ Leaflet 1.9.4, Open-Meteo, RainViewer และ ThaiWater/HII เหมาะกับการเพิ่มเลเยอร์ข้อมูล จุดที่ต้องเพิ่มคือบริการดึงและแคชข้อมูล เพราะ GitHub Pages รัน backend ไม่ได้

## ผลทดสอบแหล่งข้อมูล

Base URL: https://onedata-surv.dida.psu.ac.th

| ข้อมูล | GET path ที่ทดสอบ | ผล ณ เวลาตรวจ |
| --- | --- | --- |
| กล้อง | `/api/v1/data/cameras` | HTTP 200, 87 รายการ; online 84, degraded 2, offline 1 |
| ภาพย้อนหลัง | `/api/v1/data/cameras-24hr?camera_slug=hatyainai` | HTTP 200, 27 รายการในตัวอย่างกล้องเดียว |
| ระดับน้ำล่าสุด | `/api/v1/data/rid/stations/latest` | HTTP 200, 31 สถานี |
| แนวโน้มระดับน้ำ | `/api/v1/data/rid/stations/trend` | HTTP 200, 30 รายการ |
| ระดับน้ำย้อนหลัง | `/api/v1/data/rid/water-level?station_code=STN03&hours=24` | HTTP 200, 95 จุดข้อมูลในตัวอย่างสถานีเดียว |
| สถานีอากาศ | `/api/v1/data/tmd/observation` | HTTP 200, 4 สถานี |
| สนามลม | `/api/v1/data/wind` | HTTP 200, GFS 0.25°, U/V 2 records |
| เรดาร์ตรวจวัด | `/api/v1/data/tmd/weather-map?kind=observ&limit=100&image=url` | HTTP 200, 5 เฟรม |
| ภาพพยากรณ์ SWIRLS | `/api/v1/data/tmd/weather-map?kind=swirls&limit=100&image=url` | HTTP 200, 12 เฟรม |

จำนวนทั้งหมดเป็น snapshot ระหว่างตรวจ ไม่ใช่จำนวนที่รับประกันว่าจะมีเสมอ และจำนวนรายการไม่ใช่จำนวนที่สดหรือใช้ได้ทั้งหมด

### CCTV

มี camera_slug, ชื่อ, พิกัดใน location, สถานะ, last_captured_at, source_img_url, source_page_url และข้อมูลหน่วยงานสนับสนุน จึงทำหมุดพร้อม popup ภาพล่าสุด ลิงก์ต้นทาง และภาพย้อนหลังได้

ทดสอบภาพ https://hatyaicityclimate.org/floodphoto/last/hatyainai.jpg ได้ HTTP 200 image/jpeg และภาพผ่าน One Data ได้ HTTP 200 image/jpeg เช่นกัน ข้อมูลที่ตรวจเป็นภาพนิ่งอัปเดต ไม่พบหลักฐานยืนยัน HLS/RTSP หรือวิดีโอสด

image_url ของ API บางรายการขึ้นต้น `/api/data/...` แต่โค้ด client ของ One Data แปลงเป็น `/api/v1/data/...` ต้อง resolve กับโดเมนต้นทาง ห้ามนำ relative URL ไปต่อกับโดเมน RMWeather เอง

### ระดับน้ำ

มีรหัสสถานี พิกัด observed_at, level, level_percent, q, ระดับตลิ่ง และบางสถานีมี alert_yellow/alert_red; หลาย field เป็น null ต้องรักษาค่าไม่ทราบ ไม่แปลงเป็นศูนย์

เวลาตรวจวัดใน 31 สถานีมีตั้งแต่ 2026-09-17T10:15:00Z ถึง 2026-11-24T08:45:00Z จึงห้ามนับทุกสถานีเป็นข้อมูลสด พบเกณฑ์เหลืองหรือแดงเพียง 4 สถานี ห้ามตีความสถานีที่ไม่มีเกณฑ์ว่าอยู่ในภาวะปกติ ควรตรวจ datum/หน่วยและเกณฑ์ของแต่ละสถานีก่อนเทียบกับ ThaiWater หรือสร้างการแจ้งเตือน

### ลม

สนามลมเป็นพยากรณ์ NOAA GFS ที่ความสูง 10 เมตร ไม่ใช่การตรวจวัดสถานี กริด 37 × 65 จุด, lat 5–21, lon 97–106, spacing 0.25°; U/V หน่วย m/s ใช้กับ Leaflet velocity layer ได้

payload ตัวอย่างมี refTime 2026-11-24T00:00:00+00:00, forecastHour 9, validTime 2026-11-24T09:00:00+00:00 และ stale=false ขณะที่ header ภายใน records ระบุ forecastTime=0 ควรใช้ validTime ระดับ payload เป็นเวลาที่แสดงและตรวจความสอดคล้องก่อนพัฒนา มี URL ต้นทาง NOAA NOMADS ใน field source ด้วย

สถานี TMD 4 แห่งมี t, rh, p, wd, ws, rain3, rain24, vis และ observed_at แต่ต้องยืนยันหน่วย ws กับต้นทางก่อนแปลงเป็น km/h หรือรวมกับ Open-Meteo

### เรดาร์

แต่ละเฟรมมี base_time, frame_time, image_url, is_now และ bounds จึงซ้อนด้วย L.imageOverlay และทำ slider ได้ ขอบเขตตัวอย่างประมาณ lat 5.2–12.5, lon 96.1553–103.0 ครอบคลุมภาคใต้ ไม่ใช่ภาพครอบคลุมประเทศไทยทั้งหมด

เฟรม observ ล่าสุดที่ตรวจคือ 2026-11-24T03:00:00Z (10:00 น. ไทย) และ SWIRLS ล่าสุดคือ 2026-11-24T06:15:00Z (13:15 น. ไทย) ขณะตรวจช่วงหลัง 16:00 น. ไทย จึงมีความล่าช้าหลายชั่วโมง แม้ observ หนึ่งเฟรมมี is_now=true ก็ไม่ควรแสดงว่าเป็นภาพสดจาก flag เพียงอย่างเดียว ไม่ได้ทดสอบดาวน์โหลดภาพเรดาร์ทุกเฟรม

## CORS และสิทธิ์การใช้ข้อมูล

ทดสอบ JSON endpoints ข้างต้นพร้อม Origin: https://rachane16.github.io แล้ว HTTP 200 แต่ไม่พบ Access-Control-Allow-Origin ใน response จึงคาดว่า fetch ข้ามโดเมนโดยตรงจาก RMWeather จะถูก browser บล็อก การเปิด URL ได้จาก Python ไม่ได้ยืนยันว่า browser fetch ข้ามโดเมนได้

ไม่พบเอกสาร API สาธารณะ ข้อตกลงการนำไปใช้ซ้ำ หรือ SLA ที่ยืนยันระหว่างการตรวจนี้ การอ่านได้โดยไม่ล็อกอินไม่ใช่หลักฐานอนุญาตให้เผยแพร่ซ้ำ ควรตรวจเงื่อนไขกับ One Data/HatyaiClimate/RID/TMD ก่อนเปิดการดึงต่อเนื่องในระบบจริง และแสดงเครดิตพร้อมลิงก์ต้นทาง

## ข้อเสนอสำหรับ RMWeather

1. เก็บ frontend Leaflet เดิม เพิ่มเลเยอร์ CCTV, RID, TMD observations, GFS wind และ TMD radar ภาคใต้
2. เพิ่ม backend/Worker endpoint แบบ allowlist สำหรับชุดข้อมูลที่อนุญาต ใช้ cache และ timeout พร้อมเก็บ last success ไม่ทำ proxy ที่รับ URL อิสระ
3. เริ่ม TTL โดยประมาณ: น้ำ/กล้อง metadata 3–5 นาที, ภาพเฉพาะกล้องที่เปิดดูประมาณ 1 นาที, เรดาร์ 5–10 นาที, สนามลม 30–60 นาที แล้วปรับตามข้อกำหนดผู้ให้บริการ
4. แสดง source, observed/valid time, fetched time และสถานะข้อมูลเก่าแยกกัน รองรับ null และข้อผิดพลาดรายแหล่ง
5. คงแหล่งเดิมที่ครอบคลุมพื้นที่อื่นไว้ ข้อมูลน้ำ/กล้องชุดนี้เน้นสงขลาและพื้นที่ใกล้เคียง ส่วนสนามลมเป็นกริดกว้างกว่า
6. เริ่มพัฒนาจากกล้องและระดับน้ำก่อน แล้วเพิ่มลมและเรดาร์หลังยืนยันเวลา/หน่วย/สิทธิ์การใช้

## จุดที่พบในเว็บปัจจุบัน

- หน้าเว็บจริงโหลด ThaiWater สำเร็จระหว่างตรวจ: 809 สถานีระดับน้ำและ 5,023 สถานีฝน เป็นผลที่เว็บแสดง ไม่ได้ตรวจความสดทุกรายการ
- ตัวเลือกเรดาร์ TMD ปัจจุบันสร้าง SVG placeholder แล้วเปิดเว็บต้นทางเมื่อคลิก ยังไม่ได้แสดงภาพเรดาร์สถานีจริง
- การโหลดอากาศบน desktop ผูกกับ GPS; ระหว่างตรวจค้างที่กำลังหาตำแหน่ง ควรโหลดเมืองเริ่มต้นก่อนแล้วให้ผู้ใช้เลือก GPS
- แหล่งข้อมูลใหม่ต้อง escape ข้อความภายนอกก่อนใส่ popup/HTML และตรวจ URL ภาพ/ลิงก์

รอบนี้ตรวจความเป็นไปได้และเตรียม checkout ที่ D:\LAB Emission\RMWeather เท่านั้น ยังไม่แก้หน้าเว็บที่เผยแพร่หรือ push ขึ้น GitHub
