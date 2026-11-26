# RMWeather

แผนที่ติดตามฝน น้ำ CCTV และลมในประเทศไทย

หน้าเริ่มต้นใช้ **One Data Positron + RainViewer + ลมเส้นฟ้า** โดยแถบสภาพอากาศและแถบเล่นภาพซ่อนไว้ก่อน เปิดจากชั้นข้อมูลและปุ่ม **ภาพและเวลา** ได้ คอมพิวเตอร์เปิด MAP LAYERS ทางซ้าย ส่วนมือถือเริ่มด้วยแผนที่และไม่เปิดป๊อปอัปอัตโนมัติ แต่ละชุดข้อมูลเปิดซ้อนกันได้ แผงควบคุมย่อ/ขยายได้และแยกจากสถานะชั้นข้อมูล

ปุ่มแผนที่ฐานอยู่ด้านล่างขวา Windy ใช้กล่องตัวเลือกเล็กทางซ้ายและมีปุ่มกลับแผนที่หลัก ตำแหน่งที่เบราว์เซอร์อนุญาตจะแสดงหมุดสีน้ำเงินพร้อมใช้เป็นจุดเริ่มต้น Windy ดูรายละเอียด [การจัดหน้าจอคอมพิวเตอร์และมือถือ](docs/compact-workspace.md)

แผนที่อากาศ Windy เลือกได้ 3 มุมมอง: แผนที่เต็ม, แผนที่พร้อมพยากรณ์รายจุด และตารางพยากรณ์อย่างเดียว มีตัวเลือกตำแหน่งฉัน / กลางแผนที่หลัก / หาดใหญ่ พร้อมแสดงพิกัดและความแม่นยำของอุปกรณ์ ดู [การใช้ Windy widgets](docs/windy-widgets.md)

เว็บไซต์: https://rachane16.github.io/RMWeather/

## เปิดในเครื่อง

ใช้ Python 3.12 ขึ้นไป และ Node สำหรับตรวจ syntax โดยไม่ต้องติดตั้ง npm packages

```sh
python -m pip install certifi
python scripts/sync_data.py
python -m http.server 8766 --bind 127.0.0.1
```

เปิด http://127.0.0.1:8766/ ต้องดึงข้อมูลก่อนเพื่อให้หมวดสถานีและกล้องมีข้อมูลจริง

## ตรวจสอบ

```sh
node --check assets/app.js
node --check assets/map-engine.js
node --check assets/weather-tools.js
node --check assets/windy-embed.js
node --check assets/display.js
node --test tests/*.test.js
python -m unittest discover -s tests
```

## การเผยแพร่และข้อมูล

GitHub Pages ใช้ GitHub Actions workflow `.github/workflows/pages.yml` ต้องตั้ง Settings → Pages → Source เป็น GitHub Actions

เมื่อ push main หรือถึงรอบรอบประมาณทุก 5 นาที (นาที 2, 7, 12 … 57) workflow จะทดสอบ ดึงข้อมูลจาก public API ของ One Data และ RODDSS แล้วสร้าง Pages artifact ใหม่ เวลารัน schedule อาจช้าตามคิว GitHub ไม่มี API key และไม่มี credentials ใน frontend

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

กล้อง Windy ใช้ API v3 กรองประเทศ TH และแบ่งหน้าเพื่อแสดงกล้องทั่วประเทศไทย เก็บ key ใน Actions secret `WINDY_WEBCAMS_API_KEY` กล้องที่มีรหัสจังหวัด TH.68 จะรวมในเลเยอร์กล้อง CCTV สงขลาโดยไม่วาดหมุดซ้ำเมื่อเปิดเลเยอร์ Windy ประเทศไทยด้วย ใช้ลิงก์ player ที่มี attribution และไม่ส่งออก key หรือ URL ภาพชั่วคราว

เครดิตข้อมูล: One Data / PSU, RODDSS / PSU, RID, TMD, HatyaiClimate และหน่วยงานเจ้าของกล้อง, NOAA GFS, Open-Meteo, RainViewer ให้ตรวจเงื่อนไขของแต่ละผู้ให้บริการก่อนนำไปใช้เชิงพาณิชย์

ผลสำรวจต้นทางรอบแรก: [docs/data-source-audit.md](docs/data-source-audit.md)

หน้าเว็บตรวจ snapshot ใหม่ทุก 1 นาทีขณะเปิดใช้งาน ภาพกล้องที่เปิดขนาดใหญ่โหลดใหม่ทุก 1 นาที เวลาตรวจวัดยังอ้างอิง metadata ล่าสุดจากต้นทาง GitHub Actions อาจล่าช้า และ scheduled workflows ของ public repository อาจถูกปิดหลังไม่มี repository activity 60 วัน จึงไม่รับประกันการอัปเดตทุก 5 นาทีตลอดไปโดยไม่มีการดูแล

รายละเอียดการแก้ภาพฝน ภูมิประเทศ และการแสดงผลรอบล่าสุด: [docs/display-fixes.md](docs/display-fixes.md)

UI ใช้ Sarabun 4 น้ำหนักจากไฟล์ที่เจ้าของให้ พร้อมหมุดกล้อง/ระดับน้ำ/อากาศแบบแยกประเภท เส้นลมสีขาวขอบเข้ม และตัวปรับความชัดในเครื่องมือแผนที่

TMD RadarGIS เพิ่มเป็นแหล่งภาพเสริมในหมวดภาพเรดาร์ โดยคง RainViewer และลมเคลื่อนไหวความชัด 3 เป็นค่าเริ่มต้น ดู [ข้อมูล การเก็บภาพ และป๊อปอัป ThaiWater](docs/radargis-hydro.md)
