# RMWeather

แผนที่ติดตามฝน น้ำ CCTV และลมในประเทศไทย

หน้าเริ่มต้นใช้ **ELEMNT Natural Terrain** และแสดงพยากรณ์ฝน **SWIRLS** ลม และแถบสภาพอากาศ โดยเปิด **MAP LAYERS** ทางซ้ายไว้ สามารถปิดและเปิดใหม่ได้ การ์ดขนาดกระชับรองรับค้นหา เปิด/ปิด และดูรายละเอียดกล้อง/สถานี เมนูหมวดด้านบนรวมแผนที่อากาศ Windy และพยากรณ์ 7 วันจาก Open-Meteo/TMD ที่เลือกเปิด–ปิดได้ ข้อมูลเดิมทั้งหมดรวมถึง ThaiWater ยังอยู่ ภาพฝนและข้อมูลน้ำเลือกแหล่งแสดงได้ครั้งละหนึ่งชุดต่อหมวด

เว็บไซต์: https://rachane16.github.io/RMWeather/

## เปิดในเครื่อง

ใช้ Python 3.12 ขึ้นไป และ Node สำหรับตรวจ syntax โดยไม่ต้องติดตั้ง npm packages

```sh
python scripts/sync_data.py
python -m http.server 8766 --bind 127.0.0.1
```

เปิด http://127.0.0.1:8766/ ต้องดึงข้อมูลก่อนเพื่อให้หมวดสถานีและกล้องมีข้อมูลจริง

## ตรวจสอบ

```sh
node --check assets/app.js
node --check assets/map-engine.js
node --check assets/weather-tools.js
node --test tests/*.test.js
python -m unittest discover -s tests
```

## การเผยแพร่และข้อมูล

GitHub Pages ใช้ GitHub Actions workflow `.github/workflows/pages.yml` ต้องตั้ง Settings → Pages → Source เป็น GitHub Actions

เมื่อ push main หรือถึงรอบรอบประมาณทุก 5 นาที (นาที 2, 7, 12 … 57) workflow จะทดสอบ ดึงข้อมูลจาก public API ของ One Data แล้วสร้าง Pages artifact ใหม่ เวลารัน schedule อาจช้าตามคิว GitHub ไม่มี API key และไม่มี credentials ใน frontend

- `index.html`, `assets/style.css`, `assets/app.js`: UI และข้อมูลหลัก
- `assets/map-engine.js`, `assets/terrain.css`, `assets/styles/natural.json`: แผนที่หลัก MapLibre GL JS, PMTiles, หมุด GeoJSON, ภาพฝน, สนามลม และมุมมอง 2D/3D
- `assets/weather-tools.js`: Windy Embed และพยากรณ์ 7 วันแบบเลือกเปิด–ปิด
- `assets/layers.css`, `assets/layers.js`: แกลเลอรี Layer ฝั่งซ้าย การเลือกแหล่งข้อมูล และแถบสภาพอากาศ
- `scripts/sync_data.py`: ดึงข้อมูลสาธารณะเฉพาะรายการที่กำหนด ตัด field ผู้ดูแล/ตัวระบุผู้ใช้ออก
- `data/live/`: ไฟล์ที่สร้างระหว่าง build และถูก gitignore ไม่สร้างประวัติ Git จากภาพแต่ละรอบ
- ภาพเรดาร์: ใช้ PNG bytes จาก API เดิมและบันทึกใน artifact เพราะ URL mode ที่ตรวจพบตอบ 404
- กล้อง: โหลดภาพเมื่อเปิดรายการหรือรายละเอียด ใช้ภาพนิ่งจากแหล่งต้นทาง ไม่อ้างว่าเป็นวิดีโอสด
- ข้อมูลแต่ละรายการระบุเวลาตรวจวัด/พยากรณ์ แยกจากเวลาโหลด snapshot และแสดงข้อมูลเก่า
- ถ้าทุกแหล่งล้มเหลว workflow จะไม่เผยแพร่ snapshot ว่าง; ถ้าล้มเหลวบางแหล่ง UI จะแสดงตามข้อมูลที่โหลดได้
- `legacy.html`: สำเนาเว็บเดิมสำหรับย้อนดูฟังก์ชันและรูปแบบก่อนปรับปรุง

พื้นแผนที่: ELEMNT Natural Terrain (OSM/Protomaps, เงาภูเขา Mapterhorn และภาพใต้ทะเล GEBCO), OpenStreetMap, Esri World Imagery, Esri World Topo Map, OpenTopoMap และ OpenFreeMap Positron สลับพื้นแผนที่โดยรักษาตำแหน่ง ซูม และมุมมอง ชื่อไทยตามข้อมูล OSM อ่านรายละเอียดและข้อจำกัดที่ [docs/natural-terrain.md](docs/natural-terrain.md)

กล้อง Windy ยังรอ Webcams API key ของเจ้าของเว็บ แผนฟรีต้องสมัครก่อน ไม่ใส่รหัสลับใน repository หรือ frontend

เครดิตข้อมูล: One Data / PSU, RID, TMD, HatyaiClimate และหน่วยงานเจ้าของกล้อง, NOAA GFS, Open-Meteo, RainViewer ให้ตรวจเงื่อนไขของแต่ละผู้ให้บริการก่อนนำไปใช้เชิงพาณิชย์

ผลสำรวจต้นทางรอบแรก: [docs/data-source-audit.md](docs/data-source-audit.md)

หน้าเว็บตรวจ snapshot ใหม่ทุก 1 นาทีขณะเปิดใช้งาน ภาพกล้องที่เปิดขนาดใหญ่โหลดใหม่ทุก 1 นาที เวลาตรวจวัดยังอ้างอิง metadata ล่าสุดจากต้นทาง GitHub Actions อาจล่าช้า และ scheduled workflows ของ public repository อาจถูกปิดหลังไม่มี repository activity 60 วัน จึงไม่รับประกันการอัปเดตทุก 5 นาทีตลอดไปโดยไม่มีการดูแล
