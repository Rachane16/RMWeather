# RMWeather

แก้ไขเฉพาะเว็บไซต์คอมพิวเตอร์: เมนูหมวดด้านบนเปิดรายละเอียดรายหมวดในแถบซ้าย ส่วนแกลเลอรี MAP LAYERS กลับมาตรึงเมื่อใช้เครื่องมืออื่น พฤติกรรมมือถือและ Android คงเดิม การเผยแพร่ที่ระบุ `[desktop-only]` ในชื่อ PR และ commit จะข้าม Android workflow เพื่อไม่สร้าง APK/Release ใหม่

รุ่น 1.4 คืนโลโก้เดิมบนเว็บไซต์และ Android เรียงเมนูหลักใหม่ ลดความกว้างหน้าต่างควบคุม และจัดปุ่มแถบขวาให้อยู่ในแนวเดียวกัน MAP LAYERS บนคอมพิวเตอร์คงเปิดเมื่อแตะแผนที่ และกลับมาเป็นแกลเลอรีเมื่อใช้เครื่องมือฝั่งขวา ส่วนมือถือยังปิดเมื่อแตะนอกหน้าต่างได้ ลมบนมือถือใช้ระดับ 2 พร้อมรอยเส้นสั้นลง ส่วนคอมพิวเตอร์ใช้ระดับ 3 หมวดภาพเรดาร์ใช้คำบรรยายระดับสีต้นทางแทนตัวเลข และซ่อนแถบรายชื่อชั้นข้อมูลด้านล่าง

รุ่น 1.3: เปิดด้วย One Data Positron และแถบเวลา RainViewer เสมอ รวมแผนที่ฐานไว้ในเครื่องมือแผนที่ จุดสถานีมีพื้นที่รับการแตะเพิ่มและเลือกสถานีใกล้ที่สุดเพียงจุดเดียว บนมือถือใช้กริดชั้นข้อมูล 3 คอลัมน์และเลือกโมเดลแล้วปิดหน้าต่างควบคุมอัตโนมัติ ปุ่มแบบจำลองใกล้ชั้นข้อมูลเปิด ECMWF IFS HRES เป็นค่าเริ่มต้นและกดซ้ำเพื่อปิดข้อมูลได้ โลโก้ใหม่ใช้ไฟล์ `rmweather-*-2026.png`; ไฟล์โลโก้เดิมยังเก็บไว้โดยไม่ถูกแก้ไข

SWIRLS แสดง Legend ลำดับสีต้นทางแบบไม่ระบุค่าตัวเลข เนื่องจาก public API ส่ง PNG และ bounds โดยไม่มี metadata เทียบสีเป็น dBZ จึงไม่ใช้สเกลของโมเดลหรือ RainViewer แทน หน้าต่างค่าฝนรายจุดของโมเดลแสดงชื่อ วันที่ ช่วงเวลา อัตราฝนเฉลี่ย 3 ชั่วโมง และฝนสะสม 3 ชั่วโมง

Android 1.3 คง package และกุญแจลงนามเดิม แอปตรวจรุ่นใหม่จาก GitHub Release และเปิดไฟล์ APK ให้อัปเดตทับได้หลังผู้ใช้ยืนยันการติดตั้ง ไม่ต้องถอนแอปก่อน เวลาในส่วนที่ RMWeather สร้างใช้ Asia/Bangkok; เวลาภายใน iframe Windy ยังคงควบคุมโดยผู้ให้บริการ

แผนที่ติดตามฝน น้ำ CCTV และลมในประเทศไทย

หน้าเริ่มต้นใช้ **One Data Positron + RainViewer + ลมเส้นฟ้า** โดยแถบสภาพอากาศและแถบเล่นภาพซ่อนไว้ก่อน เปิดจากชั้นข้อมูลและปุ่ม **ภาพและเวลา** ได้ คอมพิวเตอร์เปิด MAP LAYERS ทางซ้าย ส่วนมือถือเริ่มด้วยแผนที่และไม่เปิดป๊อปอัปอัตโนมัติ แต่ละชุดข้อมูลเปิดซ้อนกันได้ แผงควบคุมย่อ/ขยายได้และแยกจากสถานะชั้นข้อมูล

ปุ่มแผนที่ฐานอยู่ด้านล่างขวา Windy ใช้กล่องตัวเลือกเล็กทางซ้ายและมีปุ่มกลับแผนที่หลัก ตำแหน่งที่เบราว์เซอร์อนุญาตจะแสดงหมุดสีน้ำเงินพร้อมใช้เป็นจุดเริ่มต้น Windy ดูรายละเอียด [การจัดหน้าจอคอมพิวเตอร์และมือถือ](docs/compact-workspace.md)

แผนที่อากาศ Windy ใช้แผนที่เต็ม พร้อมสวิตช์เปิด–ปิดตารางพยากรณ์รายจุด มีตัวเลือกตำแหน่งฉัน / กลางแผนที่หลัก / หาดใหญ่ พร้อมแสดงพิกัดและความแม่นยำของอุปกรณ์ ดู [การใช้ Windy widgets](docs/windy-widgets.md)

เปิดตาราง Windy บนแผนที่หลักได้โดยตรงด้วยปุ่ม **การพยากรณ์ล่วงหน้า** ข้างปุ่ม **ภาพและเวลา** ตารางเริ่มปิดอยู่ กดเปิด–ปิดและเลือกจุดพยากรณ์ได้ โดยไม่ต้องเปิดหมวดแผนที่อากาศ

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

RainViewer uses locally recoloured, unsmoothed Universal Blue rain tiles with the TMD RadarGIS reflectivity classes (10.5–66.5+ dBZ). The map and legend share the same table; source attribution remains RainViewer. Web and Android WebView receive the same update. CLPP radar/nowcast and province rainfall layers, controls and collection have been retired.
