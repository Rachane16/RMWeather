# RMWeather

แผนที่ติดตามฝน น้ำ CCTV และลมในประเทศไทย

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
python -m unittest discover -s tests
```

## การเผยแพร่และข้อมูล

GitHub Pages ใช้ GitHub Actions workflow `.github/workflows/pages.yml` ต้องตั้ง Settings → Pages → Source เป็น GitHub Actions

เมื่อ push main หรือถึงรอบนาที 7, 27, 47 ของแต่ละชั่วโมง workflow จะทดสอบ ดึงข้อมูลจาก public API ของ One Data แล้วสร้าง Pages artifact ใหม่ เวลารัน schedule อาจช้าตามคิว GitHub ไม่มี API key และไม่มี credentials ใน frontend

- `index.html`, `assets/style.css`, `assets/app.js`: UI และแผนที่ Leaflet
- `scripts/sync_data.py`: ดึงข้อมูลสาธารณะเฉพาะรายการที่กำหนด ตัด field ผู้ดูแล/ตัวระบุผู้ใช้ออก
- `data/live/`: ไฟล์ที่สร้างระหว่าง build และถูก gitignore ไม่สร้างประวัติ Git จากภาพแต่ละรอบ
- ภาพเรดาร์: ใช้ PNG bytes จาก API เดิมและบันทึกใน artifact เพราะ URL mode ที่ตรวจพบตอบ 404
- กล้อง: โหลดภาพเมื่อเปิดรายการหรือรายละเอียด ใช้ภาพนิ่งจากแหล่งต้นทาง ไม่อ้างว่าเป็นวิดีโอสด
- ข้อมูลแต่ละรายการระบุเวลาตรวจวัด/พยากรณ์ แยกจากเวลาโหลด snapshot และแสดงข้อมูลเก่า
- ถ้าทุกแหล่งล้มเหลว workflow จะไม่เผยแพร่ snapshot ว่าง; ถ้าล้มเหลวบางแหล่ง UI จะแสดงตามข้อมูลที่โหลดได้
- `legacy.html`: สำเนาเว็บเดิมสำหรับย้อนดูฟังก์ชันและรูปแบบก่อนปรับปรุง

พื้นแผนที่: OpenStreetMap, Esri World Imagery, Esri World Topo Map, OpenTopoMap และ OpenFreeMap Positron (พื้นเดียวกับตัวเลือก Positron ของ One Data)

เครดิตข้อมูล: One Data / PSU, RID, TMD, HatyaiClimate และหน่วยงานเจ้าของกล้อง, NOAA GFS, Open-Meteo, RainViewer ให้ตรวจเงื่อนไขของแต่ละผู้ให้บริการก่อนนำไปใช้เชิงพาณิชย์

ผลสำรวจต้นทางรอบแรก: [docs/data-source-audit.md](docs/data-source-audit.md)
