'use strict';
const $ = id => document.getElementById(id);
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc = value => String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = (value, digits=1) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('th-TH',{maximumFractionDigits:digits});
const safeURL = value => { if(!value)return '';try { const u = new URL(value,location.href); return u.protocol === 'https:' || (u.origin===location.origin&&u.protocol==='http:') ? u.href : ''; } catch { return ''; } };
const time = value => { const d = new Date(value); return value && Number.isFinite(d.getTime()) ? d.toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}) : 'ไม่ทราบเวลา'; };
const age = value => value && Number.isFinite(Date.parse(value)) ? (Date.now()-Date.parse(value))/3600000 : Infinity;
const stale = (value, hours=3) => age(value)>hours;
const freshness = (value, hours=3) => `${stale(value,hours)?'ข้อมูลเก่า / ไม่ทราบเวลา · ':''}${time(value)}`;
const places = {hatyai:[7.0084,100.4767,'หาดใหญ่',11],songkhla:[7.19,100.59,'สงขลา',11],bangkok:[13.7563,100.5018,'กรุงเทพฯ',9],chiangmai:[18.7883,98.9853,'เชียงใหม่',9],khonkaen:[16.4419,102.8359,'ขอนแก่น',9],rayong:[12.6814,101.2816,'ระยอง',10]};
const titles = {windycams:'กล้อง Windy · ทั่วประเทศไทย',overview:'ทุกข้อมูล ในแผนที่เดียว',cameras:'มองเห็นสถานการณ์จริง',water:'ติดตามระดับน้ำ',wind:'ทิศทางและความเร็วลม',radar:'มองภาพฝนที่เคลื่อนผ่าน',weather:'อากาศจากสถานีตรวจวัด'};
const intros = {windycams:'กล้องทั่วประเทศไทยจาก Windy Webcams แยก Timelapse ออกจากวิดีโอสด ตรวจสอบเวลาภาพรายกล้อง',cameras:'ค้นหาจุดกล้อง คลิกดูภาพขนาดใหญ่ หรือเลือกดูหลายกล้องพร้อมกัน ภาพนิ่งอัปเดตเป็นระยะ',water:'ระดับน้ำและเวลาตรวจวัดรายสถานี สถานีที่ไม่มีเกณฑ์จะแสดงว่าไม่ทราบเกณฑ์',wind:'สนามลมพยากรณ์ NOAA GFS ที่ความสูง 10 เมตร แยกจากค่าลมตรวจวัดของสถานี',radar:'เรดาร์ TMD RadarGIS ทั่วประเทศ ภาพภาคใต้ SWIRLS RODDSS และ RainViewer',weather:'ข้อมูลตรวจวัดจริงจากสถานี TMD ที่ One Data เผยแพร่ ตรวจสอบเวลารายสถานีก่อนใช้งาน'};
let view='overview', datasets={}, fetched={}, radarFrames=[], radarTimer=null, radarKind='rainviewer', weatherRequest=0, refreshing=false, waterKind='water';
let favoriteSlugs; try { favoriteSlugs = new Set(JSON.parse(localStorage.getItem('rm-favorites')||'[]')); } catch { favoriteSlugs=new Set(); }
const enabled = {windycams:false,cameras:false,water:false,thaiwater:false,rain:false,dam:false,weather:false,wind:true,radar:true};
const rainVisibility={radar:false,nowcast:false,rod:false,radargis:false,rainviewer:true};
const rainCollections={},rainRequests={};
const map = new WeatherMap('map');
const esri = name => `https://server.arcgisonline.com/ArcGIS/rest/services/${name}/MapServer/tile/{z}/{y}/{x}`;
const basemaps = [
 {id:'natural',name:'ELEMNT Natural Terrain',style:'assets/styles/natural.json?v=20261125-display2',art:'natural'},
 {id:'onedata',name:'One Data · Positron',style:'https://tiles.openfreemap.org/styles/positron',art:'positron'},
 {id:'osm',name:'OpenStreetMap',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',credit:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',art:'osm'},
 {id:'imagery',name:'World Imagery · เดิม',url:esri('World_Imagery'),credit:'Tiles © Esri, Maxar, Earthstar Geographics, GIS User Community',art:'imagery'},
 {id:'worldtopo',name:'World Topo Map',url:esri('World_Topo_Map'),credit:'Tiles © Esri, HERE, Garmin, USGS, GIS User Community',art:'topo'},
 {id:'opentopo',name:'OpenTopoMap · เดิม',url:'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',maxzoom:17,credit:'© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)',art:'topo'}
];
const basemapPreferenceKey=matchMedia('(max-width:700px)').matches?'rm-basemap-mobile-v1':'rm-basemap-v3';
let baseRequest=0;
async function setBase(id){
 const request=++baseRequest,base=basemaps.find(b=>b.id===id)||basemaps[0];
 try {
  if(base.style){if(!await map.setBase(base))return;}else map.setRasterBase(base);
  if(request!==baseRequest)return;
  document.querySelectorAll('.basemap-option').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.base===base.id)));
  $('terrain-status').textContent=base.id==='natural'?'ELEMNT · OSM / Protomaps · Mapterhorn DEM · GEBCO':'หมุนและเอียงได้ · 3D ใช้ Mapterhorn DEM';
  try{localStorage.setItem(basemapPreferenceKey,base.id);}catch{}
 }catch{if(request===baseRequest&&id!=='osm'){toast('พื้นแผนที่นี้ยังโหลดไม่ได้ กำลังใช้ OpenStreetMap');setBase('osm');}}
}
$('basemap-grid').innerHTML=basemaps.map(b=>`<button class="basemap-option" data-base="${b.id}" aria-pressed="false"><span class="basemap-preview base-${b.art}" aria-hidden="true"></span><span>${b.name}</span></button>`).join('');
let storedBase;try{storedBase=localStorage.getItem(basemapPreferenceKey);document.documentElement.dataset.theme=localStorage.getItem('rm-theme')||'light';}catch{}
setBase(storedBase||'onedata');
document.querySelectorAll('[data-base]').forEach(b=>b.addEventListener('click',()=>setBase(b.dataset.base)));
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5500);}
function openPanel(){ if(window.workspaceUI){window.workspaceUI.setOpen('sidebar',true);return;} $('sidebar').hidden=false;$('sidebar').classList.add('is-open');$('layers-toggle').setAttribute('aria-expanded','true');document.querySelector('.drawer-scroll').scrollTop=0; }
function setEnabled(name,on){ const wasOn=enabled[name];enabled[name]=on;if(on&&!wasOn&&name==='cameras'){const c=map.getCenter();if(c.lat<6.2||c.lat>8.2||c.lng<99.8||c.lng>101.3)map.flyTo([7.05,100.55],9);}if(on&&!wasOn&&name==='windycams')map.flyTo([13.1,101],5.5);const checkbox=document.querySelector(`[data-layer="${name}"]`);if(checkbox)checkbox.checked=on;
 if(['cameras','water','thaiwater','rain','dam','weather','windycams'].includes(name))map.enablePoints(name,on);
 window.syncLayerMenu?.();
 if(name==='wind')renderWind();if(name==='radar')setRainEnabled(radarKind,on);
 if(['cameras','windycams'].includes(name))renderMarkers();
}
document.querySelectorAll('[data-layer]').forEach(el=>el.addEventListener('change',()=>setEnabled(el.dataset.layer,el.checked)));
function selectView(next){
 view=next;$('view-title').textContent=titles[view];document.querySelectorAll('.nav-item').forEach(b=>{b.classList.toggle('active',(b.dataset.view===view||(view==='windycams'&&b.dataset.view==='cameras')));b.setAttribute('aria-pressed',String((b.dataset.view===view||(view==='windycams'&&b.dataset.view==='cameras'))));});
 $('layer-catalog').hidden=view!=='overview';$('layer-details').hidden=view==='overview';$('category-panel').hidden=view==='overview';$('category-intro').textContent=intros[view]||'';$('search').value='';$('category-tools').innerHTML='';$('search-box').hidden=['wind','radar'].includes(view);
 if(view!=='overview')setEnabled(view==='water'?waterKind:view,true);
 if(view==='cameras')$('category-tools').innerHTML='<div class="tool-row"><select id="camera-filter" class="control-select" aria-label="กรองกล้อง"><option value="all">กล้องทั้งหมด · สงขลา</option><option value="onedata">ภาพสถานการณ์น้ำ</option><option value="windy">Windy · สงขลา</option><option value="online">ออนไลน์และภาพไม่เก่า</option><option value="old">ข้อมูลเก่า / ขัดข้อง</option><option value="favorite">กล้องที่บันทึกไว้</option></select><button id="multiview" class="popup-button">ดูพร้อมกัน 4 กล้อง</button></div>';
 if(view==='water'){$('category-tools').innerHTML='<label class="control-label" for="water-source">ชุดข้อมูลน้ำ</label><select id="water-source" class="control-select"><option value="water">RID · สงขลาและใกล้เคียง</option><option value="thaiwater">ThaiWater · ระดับน้ำทั่วประเทศ</option><option value="rain">ThaiWater · ฝนสะสม 24 ชม.</option><option value="dam">ThaiWater · เขื่อนขนาดใหญ่</option></select>';$('water-source').value=waterKind;$('water-source').addEventListener('change',async e=>{waterKind=e.target.value;setEnabled(waterKind,true);window.syncLayerMenu?.();await loadNational(waterKind);renderMarkers();renderResults();});}
 if(view==='radar'){$('category-tools').innerHTML='<label class="control-label" for="radar-source">แหล่งภาพฝน</label><select id="radar-source" class="control-select"><option value="radargis">TMD RADARGIS</option><option value="radar">TMD · ตรวจวัดภาคใต้</option><option value="nowcast">SWIRLS · พยากรณ์ภาคใต้</option><option value="rainviewer">RainViewer · ภาพรวม</option><option value="rod">RODDSS · TMD Composite</option></select><div class="notice">ภาพสีเป็นผลิตภัณฑ์คนละชนิด โปรดอ่านสเกลจากต้นทางและเวลาในแถบเล่นภาพ</div>';$('radar-source').value=radarKind;$('radar-source').addEventListener('change',e=>{radarKind=e.target.value;setRainEnabled(radarKind,true);window.syncLayerMenu?.();renderResults();});}
 if($('camera-filter'))$('camera-filter').addEventListener('change',renderResults);
 if($('multiview'))$('multiview').addEventListener('click',showMultiview);
 renderResults();document.querySelector('.drawer-scroll').scrollTop=0;openPanel();window.syncLayerMenu?.();
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view)));
$('search').addEventListener('input',renderResults);
function cameraType(row){return row.webcam_id!=null?'windycams':'cameras';}
function songkhlaCamera(row){return row.region_code==='TH.68'||(!row.region_code&&row.region==='สงขลา');}
function cameraOld(c){return cameraType(c)==='windycams'?c.status!=='active'||stale(c.observed_at,1):c.status!=='online'||stale(c.last_captured_at,1);}
function point(type,row){ if(type==='cameras'){ const a=String(row.location||'').split(',').map(Number);return a.length===2&&String(row.location).includes(',')&&a.every(Number.isFinite)?a:null; } const lat=row.latitude??row.lat,lng=row.longitude??row.lon;return lat!=null&&lng!=null&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))?[Number(lat),Number(lng)]:null; }
function idOf(type,row){if(type==='windycams')return row.webcam_id;return type==='cameras'?row.camera_slug:type==='water'?row.station_code:row.wmo;}
function titleOf(type,row){if(type==='windycams')return row.name;return type==='cameras'?row.camera_name_th:type==='water'?row.station_name_th:row.th;}
function observed(type,row){return type==='cameras'?row.last_captured_at:row.observed_at;}
function waterStatus(row){if(stale(row.observed_at))return 'ข้อมูลเก่า / ไม่ทราบเวลา';if(row.level==null)return 'ไม่มีค่าระดับน้ำ';if(row.alert_red!=null&&row.level>=row.alert_red)return 'ถึงเกณฑ์แดงของสถานี';if(row.alert_yellow!=null&&row.level>=row.alert_yellow)return 'ถึงเกณฑ์เหลืองของสถานี';return row.alert_red==null&&row.alert_yellow==null?'ยังไม่ทราบเกณฑ์เตือน':'ต่ำกว่าเกณฑ์เตือนที่ระบุ';}
function imageFor(row){return safeURL(row.image_url)||safeURL(row.source_img_url);}
function renderMarkers(){
 for(const source of ['cameras','water','thaiwater','rain','dam','weather','windycams']){
  const type=['thaiwater','rain','dam'].includes(source)?'water':source;
  const rows=source==='cameras'?[...(datasets.cameras||[]),...(datasets.windycams||[]).filter(songkhlaCamera)]:source==='windycams'?(datasets.windycams||[]).filter(row=>!enabled.cameras||!songkhlaCamera(row)):datasets[source]||[];
  const features=rows.flatMap((row,index)=>{const rowType=source==='cameras'?cameraType(row):type;const p=point(rowType,row);if(!p||Math.abs(p[0])>90||Math.abs(p[1])>180)return [];
   return [{type:'Feature',geometry:{type:'Point',coordinates:[p[1],p[0]]},properties:{index,title:titleOf(rowType,row),old:rowType==='cameras'?cameraOld(row):stale(observed(rowType,row),source==='dam'?48:3)}}];
  });
  map.setPoints(source,features,enabled[source],index=>showDetail(source==='cameras'?cameraType(rows[index]):type,rows[index],source));
 }
}
function filteredCameras(){let rows=[...(datasets.cameras||[]),...(datasets.windycams||[]).filter(songkhlaCamera)];const filter=$('camera-filter')?.value;if(filter==='online')rows=rows.filter(c=>!cameraOld(c));if(filter==='old')rows=rows.filter(cameraOld);if(filter==='favorite')rows=rows.filter(c=>favoriteSlugs.has(c.camera_slug));if(filter==='onedata')rows=rows.filter(c=>cameraType(c)==='cameras');if(filter==='windy')rows=rows.filter(c=>cameraType(c)==='windycams');return rows;}
function renderResults(){
 if(view==='overview')return;const target=$('results');target.innerHTML='';$('result-count').textContent='';if(view==='water'&&nationalLoading[waterKind]){$('result-count').textContent='กำลังโหลดชุดข้อมูล…';target.innerHTML='<div class="empty-state">กำลังเชื่อมต่อ ThaiWater…</div>';return;}
 if(view==='radar'){target.innerHTML=(radarKind==='radargis'?'<label class="radargis-product-field">ผลิตภัณฑ์ TMD RADARGIS<select data-radargis-product aria-label="เลือกผลิตภัณฑ์ RadarGIS"></select></label>':'')+'<div class="wind-card">'+icon('radar')+'<h3>ภาพฝนบนแผนที่</h3><p>เลือกแหล่งภาพ แล้วใช้แถบเวลาเพื่อดูแต่ละเฟรม กดเล่นเพื่อดูการเคลื่อนตัวของกลุ่มฝน</p><a href="https://weather.tmd.go.th/" target="_blank" rel="noopener">เรดาร์สถานีอื่นจาก TMD</a></div>';syncRadarGISControls();return;}
 if(view==='wind'){const w=datasets.wind;target.innerHTML=`<div class="wind-card">${icon('wind')}<p class="eyebrow">NOAA GFS / 10 METERS</p><h3>สนามลม 0.25°</h3><p>เวลาพยากรณ์: ${esc(time(w?.validTime))}<br>รอบแบบจำลอง: ${esc(time(w?.refTime))}<br>หน่วย: เมตรต่อวินาที (m/s)</p><p>ครอบคลุมละติจูด 5–21°N และลองจิจูด 97–106°E</p>${!w?'<div class="notice">ยังไม่มีข้อมูลลมที่โหลดสำเร็จ</div>':w.stale||stale(w.validTime,6)?'<div class="notice">ข้อมูลลมเก่า โปรดตรวจสอบเวลาก่อนใช้งาน</div>':''}<p>เปิดเลเยอร์ลมเพื่อดูอนุภาคเคลื่อนที่บนแผนที่</p></div>`;return;}
 let rows=view==='cameras'?filteredCameras():view==='water'?datasets[waterKind]||[]:(datasets[view]||[]);
 const q=$('search').value.toLocaleLowerCase().trim();rows=rows.filter(r=>[titleOf(view==='cameras'?cameraType(r):view,r),idOf(view==='cameras'?cameraType(r):view,r),r.group_name,r.province_name,r.amphur_name,r.region].join(' ').toLocaleLowerCase().includes(q));
 $('result-count').textContent=`${rows.length.toLocaleString('th-TH')} รายการ${rows.length>150?' · แสดง 150 รายการแรก กรุณาค้นหาเพื่อเจาะจง':''}${view==='windycams'&&window.windyWebcamStatus?.truncated?' · แสดงได้ถึงเพดานแผน API ปัจจุบัน':''}`;
 if(!rows.length){target.innerHTML=view==='windycams'?'<div class="empty-state">'+(window.windyWebcamStatus?.ok?'ยังไม่มีกล้องที่ตรงกับคำค้นหา':'รายการกล้อง Windy ยังโหลดไม่ได้ กรุณาลองโหลดข้อมูลใหม่')+'</div>':'<div class="empty-state">ไม่พบรายการที่ตรงกัน<br>ลองเปลี่ยนคำค้นหาหรือโหลดข้อมูลใหม่</div>';return;}
 rows.slice(0,150).forEach(row=>{const b=document.createElement('button');b.className='result-card';const rowType=view==='cameras'?cameraType(row):view;const image=rowType==='cameras'?imageFor(row):'';let value='';if(view==='water')value=`<span class="result-value">${number(row.level)}<small>${waterKind==='rain'?'มม.':waterKind==='dam'?'%':'ม.'}</small></span>`;if(view==='weather')value=`<span class="result-value">${number(row.t)}°</span>`;
 b.innerHTML=`${image?`<img loading="lazy" src="${esc(image)}" data-fallback="${esc(safeURL(row.source_img_url))}" alt="ภาพ ${esc(titleOf(rowType,row))}">`:''}<span class="result-info"><strong>${esc(titleOf(rowType,row))}</strong><small>${rowType==='windycams'?'Windy · '+esc(row.region||'ประเทศไทย')+' · ':''}${view==='cameras'?(rowType==='windycams'?'Timelapse':cameraOld(row)?'ภาพเก่า / ขัดข้อง':'ออนไลน์')+' · ':''}${esc(freshness(observed(rowType,row),view==='cameras'?1:view==='water'&&waterKind==='dam'?48:3))}</small></span>${value}`;
 b.addEventListener('click',()=>{const p=point(rowType,row);if(p)map.flyTo(p,14,{duration:.6});showDetail(rowType,row);});target.appendChild(b);
 });
 bindImageErrors(target);
}
function bindImageErrors(parent){parent.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{
 const fallback=safeURL(img.dataset.fallback);img.dataset.fallback='';
 if(fallback&&fallback!==img.src){img.src=fallback;return;}
 img.removeAttribute('src');img.alt='ภาพยังไม่พร้อม · ลองโหลดภาพล่าสุดหรือเปิดต้นทาง';img.classList.add('image-unavailable');
}));}
function showDetail(type,row,sourceKind=waterKind){
 const content=$('detail-content');const name=titleOf(type,row);let body='';
 if(type==='windycams'){
  const types=Object.keys(row.players||{});const kind=types.includes('live')?'live':types.includes('day')?'day':types[0];const label=k=>({live:'วิดีโอสด',day:'Timelapse · วันนี้',month:'Timelapse · เดือน',year:'Timelapse · ปี',lifetime:'Timelapse · ทั้งหมด'}[k]||k);
  body=`<p class="eyebrow">WINDY WEBCAMS / ${esc(row.region||'ประเทศไทย')}</p><h2>${esc(name)}</h2><p>${esc(freshness(row.observed_at,1))} · ${esc(row.status)}</p><label class="windy-player-label">การเล่นภาพ <select id="windy-player-kind">${types.map(k=>`<option value="${esc(k)}" ${k===kind?'selected':''}>${label(k)}</option>`).join('')}</select></label><iframe id="windy-camera-player" class="windy-camera-player" title="${esc(name)} · Windy Timelapse" src="${esc(safeURL(row.players[kind]))}" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe><p class="muted">${kind==='live'?'ลิงก์ Live จาก Windy':'ภาพย้อนหลังแบบ Timelapse ไม่ใช่วิดีโอสดต่อเนื่อง'} · เวลาภาพล่าสุดตาม Windy</p><a href="${esc(safeURL(row.detail_url))}" target="_blank" rel="noopener">ดูเว็บแคมนี้บน Windy.com</a>`;
 }else if(type==='cameras'){
  const url=imageFor(row);body=`<p class="eyebrow">CCTV / ภาพนิ่งอัปเดต</p><h2>${esc(name)}</h2>${url?`<img id="camera-detail-image" class="detail-image" src="${esc(url)}" data-fallback="${esc(safeURL(row.source_img_url))}" alt="ภาพจาก ${esc(name)}">`:'<div class="empty-state">ไม่มี URL ภาพสำหรับกล้องนี้</div>'}<div class="detail-meta"><span id="camera-observed">${esc(freshness(row.last_captured_at,1))}</span><span>${esc(row.status||'ไม่ทราบสถานะ')}</span></div><div class="detail-actions"><button id="camera-refresh">โหลดภาพล่าสุด</button><button id="camera-favorite">${favoriteSlugs.has(row.camera_slug)?'นำออกจากรายการบันทึก':'บันทึกกล้องนี้'}</button>${safeURL(row.source_page_url)?`<a href="${esc(safeURL(row.source_page_url))}" target="_blank" rel="noopener">เปิดต้นทาง</a>`:''}</div><p class="muted">ภาพ: ${esc(row.sponsor_name||row.group_name||'HatyaiClimate')} · ข้อมูลรายการจาก One Data</p>`;
 }else if(type==='water'){
  if(['thaiwater','rain','dam'].includes(sourceKind)){
   body=hydroDetailHTML(row,sourceKind,{esc,number,freshness,icon});
  }else{
  const trend=(datasets.trends||[]).find(t=>t.station_code===row.station_code);body=`<p class="eyebrow">WATER / ${sourceKind==='water'?'RID':'THAIWATER'}</p><h2>${esc(name)}</h2><p>${esc(row.province_name)} · ${esc(freshness(row.observed_at))}</p><div class="detail-facts"><div>${sourceKind==='rain'?'ฝน 24 ชม.':sourceKind==='dam'?'น้ำกักเก็บ':'ระดับน้ำ'}<strong>${number(row.level)} ${sourceKind==='rain'?'มม.':sourceKind==='dam'?'%':'ม.'}</strong></div><div>แนวโน้ม<strong>${trend?trend.trend==='rise'?'เพิ่มขึ้น':trend.trend==='fall'?'ลดลง':'ทรงตัว':'—'}</strong>${trend?'เปลี่ยนแปลง '+number(trend.delta,2)+' ม.':''}</div><div>เทียบความจุตลิ่ง<strong>${number(row.level_percent)}%</strong></div><div>อัตราการไหล<strong>${number(row.q)} ม³/วินาที</strong></div></div><div class="notice">${esc(sourceKind==='water'?waterStatus(row):'ข้อมูลจาก ThaiWater · หน่วยและฐานอ้างอิงตามต้นทาง')}</div><p class="muted">เกณฑ์เหลือง ${number(row.alert_yellow)} / แดง ${number(row.alert_red)} ม. · ไม่แปลงค่าที่ขาดเป็นศูนย์</p><a href="${sourceKind==='water'?'https://onedata-surv.dida.psu.ac.th/stations':'https://www.thaiwater.net/'}" target="_blank" rel="noopener">ดูรายละเอียดและกราฟจากต้นทาง</a>`;
  }
 }else body=`<p class="eyebrow">TMD / STATION OBSERVATION</p><h2>${esc(name)}</h2><p>${esc(row.province_name)} · ${esc(freshness(row.observed_at))}</p><div class="detail-facts"><div>อุณหภูมิ<strong>${number(row.t)} °C</strong></div><div>ความชื้น<strong>${number(row.rh)} %</strong></div><div>ความกดอากาศ<strong>${number(row.p)} hPa</strong></div><div>ฝน 24 ชม.<strong>${number(row.rain24)} มม.</strong></div><div>ทิศลม<strong>${number(row.wd)}°</strong></div><div>ค่าลมจากต้นทาง<strong>${number(row.ws)}</strong>ยังไม่ยืนยันหน่วย ws</div></div><p class="muted">รหัส WMO ${esc(row.wmo)} · ตรวจวัดจริงจาก TMD ผ่าน One Data</p>`;
 content.innerHTML=body;bindImageErrors(content);if(!$('detail-dialog').open)$('detail-dialog').showModal();
 if(type==='windycams')$('windy-player-kind').addEventListener('change',e=>{$('windy-camera-player').src=safeURL(row.players[e.target.value]);});
 if(type==='cameras'){
  $('camera-refresh').addEventListener('click',()=>{const img=$('camera-detail-image');if(img){const u=new URL(imageFor(row));u.searchParams.set('t',Date.now());img.src=u.href;toast('โหลดภาพใหม่แล้ว เวลาตรวจวัดจะเปลี่ยนตามรอบข้อมูลต้นทาง');}});
  $('camera-favorite').addEventListener('click',()=>{favoriteSlugs.has(row.camera_slug)?favoriteSlugs.delete(row.camera_slug):favoriteSlugs.add(row.camera_slug);try{localStorage.setItem('rm-favorites',JSON.stringify([...favoriteSlugs]));}catch{}showDetail(type,row);if(view==='cameras')renderResults();});
 }
}
function showMultiview(){const rows=filteredCameras().filter(c=>cameraType(c)==='cameras').filter(c=>titleOf('cameras',c)?.includes($('search').value.trim())).slice(0,4);if(!rows.length){toast('ไม่มีกล้องที่ตรงกับตัวกรอง');return;}$('detail-content').innerHTML=`<p class="eyebrow">CCTV / MULTIVIEW</p><h2>ภาพสถานการณ์พร้อมกัน</h2><div class="multiview-grid">${rows.map(c=>`<figure><img class="detail-image" src="${esc(imageFor(c))}" data-fallback="${esc(safeURL(c.source_img_url))}" alt="${esc(c.camera_name_th)}"><figcaption>${esc(c.camera_name_th)}<small>${esc(freshness(c.last_captured_at,1))}</small></figcaption></figure>`).join('')}</div><p class="muted">HatyaiClimate / หน่วยงานเจ้าของกล้อง · ภาพนิ่งตามเวลาที่กำกับ</p>`;bindImageErrors($('detail-content'));$('detail-dialog').showModal();}
function renderWind(){map.setWind(enabled.wind?datasets.wind?.records:null);}
async function getJSON(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000),cache:'no-cache'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}
async function refreshData(){
 if(refreshing)return;refreshing=true;$('refresh').disabled=true;$('data-status').textContent='กำลังโหลดข้อมูล…';
 try{const manifest=await getJSON(`data/live/manifest.json?t=${Date.now()}`);const names=['cameras','water','trends','weather','wind','radar','nowcast','rod','radargis','windycams'];const results=await Promise.allSettled(names.map(async name=>{const envelope=await getJSON(`data/live/${name}.json?t=${Date.now()}`);datasets[name]=envelope.data;fetched[name]=envelope.fetched_at;if(name==='windycams')window.windyWebcamStatus=envelope;if(name==='radargis')window.radarGISStatus=envelope;}));
  const ok=results.filter(r=>r.status==='fulfilled').length;$('camera-count').textContent=number((datasets.cameras?.length||0)+(datasets.windycams||[]).filter(songkhlaCamera).length,0);$('water-count').textContent=number(datasets.water?.length,0);$('windy-count').textContent=number(datasets.windycams?.length,0);syncRadarGISControls();
  const sourceFailed=(window.radarGISStatus&&!window.radarGISStatus.ok)||Object.values(manifest.datasets||{}).some(d=>!d.ok)||(window.windyWebcamStatus?.configured&&!window.windyWebcamStatus.ok);$('data-status').textContent=`${ok<names.length||sourceFailed?'โหลดได้บางชุด · ':''}${stale(manifest.generated_at,1)?'ไฟล์ข้อมูลเก่า · ':''}อัปเดต ${time(manifest.generated_at)}`;
  renderMarkers();renderResults();if(enabled.wind)renderWind();await Promise.all(Object.keys(rainVisibility).filter(k=>rainVisibility[k]).map(k=>loadRadar(k)));await Promise.all(['thaiwater','rain','dam'].filter(k=>enabled[k]).map(k=>loadNational(k)));
 }catch(error){$('data-status').textContent='ข้อมูลสถานียังไม่พร้อม · ลองโหลดใหม่';console.warn('Snapshot',error);}
 finally{refreshing=false;$('refresh').disabled=false;}
}
function weatherIcon(code){return code===0?'sun':code<=3?'cloud':code<=48?'cloud':code>=95?'storm':'rain';}
function weatherLabel(code){return code===0?'ท้องฟ้าแจ่มใส':code<=3?'มีเมฆบางส่วน':code<=48?'หมอก':code<=67?'มีฝน':code<=77?'หิมะ':code<=82?'ฝนซู่':code<=86?'หิมะซู่':'พายุฝนฟ้าคะนอง';}
async function loadForecast(lat,lon,name){
 window.weatherLocation={lat,lon,name};window.updateWeatherEmbeds?.();const request=++weatherRequest;$('place-name').textContent=name;$('condition').textContent='กำลังโหลดอากาศ';$('seven-day-place').textContent=name;$('seven-day-rows').innerHTML='<tr><td colspan=4>กำลังโหลดพยากรณ์…</td></tr>';
 try{const data=await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&wind_speed_unit=kmh&forecast_days=7&timezone=Asia%2FBangkok`);if(request!==weatherRequest)return;const c=data.current;
  $('temperature').textContent=number(c.temperature_2m,0);$('condition').textContent=weatherLabel(c.weather_code);$('weather-symbol').setAttribute('href','#i-'+weatherIcon(c.weather_code));document.querySelector('.weather-hero').dataset.sky=weatherIcon(c.weather_code);$('weather-range').textContent=`ต่ำสุด ${number(data.daily.temperature_2m_min[0],0)}° / สูงสุด ${number(data.daily.temperature_2m_max[0],0)}°`;$('humidity').textContent=number(c.relative_humidity_2m,0)+'%';$('weather-wind').textContent=number(c.wind_speed_10m,0)+' กม./ชม.';$('precipitation').textContent=number(c.precipitation)+' มม.';$('weather-time').textContent='Open-Meteo · แบบจำลอง '+time(c.time+'+07:00');
  $('seven-day-rows').innerHTML=data.daily.time.map((d,i)=>`<tr><td>${new Date(d+'T12:00:00+07:00').toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short'})}</td><td>${esc(weatherLabel(data.daily.weather_code[i]))}</td><td>${number(data.daily.temperature_2m_min[i],0)}–${number(data.daily.temperature_2m_max[i],0)}°C</td><td>${number(data.daily.precipitation_probability_max[i],0)}%</td></tr>`).join('');
  $('forecast').innerHTML=data.daily.time.map((d,i)=>`<div class="forecast-day">${i===0?'วันนี้':new Date(d+'T12:00:00+07:00').toLocaleDateString('th-TH',{weekday:'short',timeZone:'Asia/Bangkok'})}${icon(weatherIcon(data.daily.weather_code[i]))}<strong>${number(data.daily.temperature_2m_max[i],0)}° <span class="muted">${number(data.daily.temperature_2m_min[i],0)}°</span></strong><small>${number(data.daily.precipitation_probability_max[i],0)}%</small></div>`).join('');
 }catch{if(request===weatherRequest){$('temperature').textContent='—';$('humidity').textContent='—';$('weather-wind').textContent='—';$('precipitation').textContent='—';$('condition').textContent='โหลดอากาศไม่สำเร็จ';$('forecast').innerHTML='';$('seven-day-rows').innerHTML='<tr><td colspan=4>โหลดพยากรณ์ไม่สำเร็จ กรุณาลองใหม่</td></tr>';$('weather-time').textContent='Open-Meteo · กรุณาลองใหม่';}}
}
function stopRadar(){clearInterval(radarTimer);radarTimer=null;$('radar-play').textContent='▶';$('radar-play').setAttribute('aria-label','เล่นภาพเรดาร์');}
function setRainEnabled(kind,on){
 rainVisibility[kind]=on;
 if(on){radarKind=kind;loadRadar(kind);}else{
  rainRequests[kind]=(rainRequests[kind]||0)+1;map.setRain(null,kind);
  if(radarKind===kind){stopRadar();radarKind=Object.keys(rainVisibility).find(k=>rainVisibility[k])||kind;if(rainVisibility[radarKind])loadRadar(radarKind);}
 }
 enabled.radar=Object.values(rainVisibility).some(Boolean);$('radar-player').hidden=true;window.syncTimelineUI?.();
 window.syncLayerMenu?.();
}
async function loadRadar(kind=radarKind){
 const request=rainRequests[kind]=(rainRequests[kind]||0)+1;
 if(kind===radarKind){stopRadar();radarFrames=[];$('radar-status').textContent='กำลังโหลดภาพ…';$('radar-play').disabled=true;}
 try{let frames;
  if(kind==='rainviewer'){const j=await getJSON('https://api.rainviewer.com/public/weather-maps.json');frames=(j.radar?.past||[]).map(f=>({frame_time:new Date(f.time*1000).toISOString(),tile:`${j.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`}));}
  else frames=(kind==='radargis'?(currentRadarGISProduct()?.frames||[]):datasets[kind]||[]).filter(f=>f.bounds&&safeURL(f.image_url)).sort((a,b)=>Date.parse(a.frame_time)-Date.parse(b.frame_time));
  if(request!==rainRequests[kind]||!rainVisibility[kind])return;
  rainCollections[kind]=frames;map.setRain(frames.at(-1)||null,kind);
  if(kind!==radarKind)return;
  radarFrames=frames;$('radar-label').textContent=kind==='radar'?'TMD · ตรวจวัดภาคใต้':kind==='nowcast'?'SWIRLS · พยากรณ์ภาคใต้':kind==='rod'?'RODDSS · TMD Composite':kind==='radargis'?'TMD RADARGIS':'RainViewer · เรดาร์';
  syncRadarGISControls();$('radar-timeline-source').value=kind;$('radar-slider').max=Math.max(0,frames.length-1);$('radar-play').disabled=!frames.length;
  if(!frames.length){$('radar-status').textContent='ยังไม่มีเฟรมภาพจากแหล่งนี้';$('radar-time').textContent='—';$('radar-date').textContent='—';return;}showRadarFrame(kind==='radargis'&&currentRadarGISProduct()?.forecast?0:frames.length-1);
 }catch{if(kind===radarKind&&request===rainRequests[kind])$('radar-status').textContent='โหลดภาพเรดาร์ไม่สำเร็จ กรุณาลองใหม่หรือเปลี่ยนแหล่งภาพ';}
}
function showRadarFrame(index){
 const f=radarFrames[index];if(!f)return;const sourceTime=radarKind==='nowcast'||(radarKind==='radargis'&&currentRadarGISProduct()?.forecast)?(f.base_time||radarFrames.at(-1)?.frame_time):radarFrames.at(-1)?.frame_time;map.setRain(rainVisibility[radarKind]?f:null,radarKind);
 $('radar-slider').value=index;const d=new Date(f.frame_time);$('radar-time').textContent=d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});$('radar-date').textContent=time(f.frame_time);$('radar-status').textContent=`${stale(sourceTime,radarKind==='radargis'?.75:2)?'ข้อมูลต้นทางยังเป็นเฟรมเก่า · ':''}${radarKind==='nowcast'||(radarKind==='radargis'&&currentRadarGISProduct()?.forecast)?'เวลาที่พยากรณ์':'เวลาของภาพ'} · เฟรม ${index+1}/${radarFrames.length}${radarKind==='rod'?' · TMD Composite / PSU':radarKind==='radargis'?' · '+radarGISDescription(currentRadarGISProduct(),f):radarKind!=='rainviewer'?' · ครอบคลุมภาคใต้':''}`;
 $('radar-slider').style.setProperty('--progress',`${radarFrames.length>1?index/(radarFrames.length-1)*100:0}%`);
 if($('radargis-origin'))$('radargis-origin').hidden=radarKind!=='radargis';document.querySelector('.radar-gradient').hidden=radarKind!=='rainviewer';document.querySelector('.legend-scale').hidden=radarKind!=='rainviewer';window.syncTimelineUI?.();
}
$('radar-timeline-source').addEventListener('change',event=>{radarKind=event.target.value;setRainEnabled(radarKind,true);});
$('radar-slider').addEventListener('input',e=>{stopRadar();showRadarFrame(Number(e.target.value));});
$('radar-play').addEventListener('click',()=>{if(radarTimer){stopRadar();return;}if(!radarFrames.length)return;$('radar-play').textContent='Ⅱ';$('radar-play').setAttribute('aria-label','หยุดภาพเรดาร์');radarTimer=setInterval(()=>{if(map.isRainReady(radarKind))showRadarFrame((Number($('radar-slider').value)+1)%radarFrames.length);},850);});
const nationalRequests={},nationalLoading={};
async function loadNational(kind=waterKind){
 if(kind==='water')return;
 const request=nationalRequests[kind]=(nationalRequests[kind]||0)+1;
 nationalLoading[kind]=true;renderResults();
 const root='https://api-v3.thaiwater.net/api/v1/thaiwater30';const path=kind==='thaiwater'?'/public/waterlevel_load':kind==='rain'?'/public/rain_24h':'/analyst/dam?dam_size=1';
 try{const j=await getJSON(root+path);if(request!==nationalRequests[kind])return;
  datasets[kind]=normalizeNationalData(j,kind);
  if(!datasets[kind].length)toast('แหล่งข้อมูลนี้ยังไม่มีรายการที่รองรับ');
 }catch{if(request===nationalRequests[kind])toast('โหลด ThaiWater ไม่สำเร็จ กรุณาลองใหม่');}
 finally{if(request===nationalRequests[kind]){nationalLoading[kind]=false;renderMarkers();renderResults();}}
}

document.querySelectorAll('[data-place]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-place]').forEach(x=>x.classList.toggle('selected',x===b));const [lat,lng,name,zoom]=places[b.dataset.place];map.flyTo([lat,lng],zoom);loadForecast(lat,lng,name);if(innerWidth<=680)window.closeLayerDrawer?.();}));
map.onMapClick=p=>{window.closeLayerDrawer?.();loadForecast(p.lat,p.lng,`พิกัด ${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`);};
$('refresh').addEventListener('click',()=>{refreshData();const c=map.getCenter();loadForecast(c.lat,c.lng,$('place-name').textContent);});
$('fit').addEventListener('click',()=>{map.flyTo([7.0084,100.4767],11);});
let locationRequest=0;
async function requestCurrentLocation(){
 const request=++locationRequest;window.locationPending=true;window.updateWeatherLocationNote?.();
 $('location-status').textContent='กำลังระบุตำแหน่งปัจจุบัน…';
 if(!navigator.geolocation){window.locationPending=false;window.updateWeatherLocationNote?.();$('location-status').textContent='เบราว์เซอร์นี้ไม่รองรับตำแหน่ง · ใช้หาดใหญ่เป็นจุดเริ่มต้น';return;}
 navigator.geolocation.getCurrentPosition(position=>{
  if(request!==locationRequest)return;window.locationPending=false;window.updateWeatherLocationNote?.();
  const {latitude:lat,longitude:lon}=position.coords;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return;
  window.currentLocation={lat,lon};map.setCurrentLocation(lat,lon);map.flyTo([lat,lon],10);
  $('location-status').textContent='ใช้ตำแหน่งปัจจุบันแล้ว';loadForecast(lat,lon,'ตำแหน่งของคุณ');
  window.dispatchEvent(new CustomEvent('rm-current-location',{detail:{lat,lon}}));
 },()=>{if(request===locationRequest){window.locationPending=false;window.updateWeatherLocationNote?.();$('location-status').textContent='เข้าถึงตำแหน่งไม่ได้ · ใช้หาดใหญ่หรือเลือกตำแหน่งบนแผนที่';}},{enableHighAccuracy:false,timeout:10000,maximumAge:60000});
}
$('locate').addEventListener('click',requestCurrentLocation);
$('theme').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('rm-theme',theme);}catch{}});
$('mobile-panel').addEventListener('click',openPanel);$('sidebar-close').addEventListener('click',()=>window.closeLayerDrawer?.());
function basePanel(open){if(window.workspaceUI){window.workspaceUI.setOpen('basemap',open);return;}$('basemap-panel').hidden=!open;$('basemap-toggle').setAttribute('aria-expanded',String(open));}
$('basemap-toggle').addEventListener('click',()=>basePanel($('basemap-panel').hidden));$('basemap-close').addEventListener('click',()=>basePanel(false));
$('sources-open').addEventListener('click',()=>$('sources-dialog').showModal());$('sources-close').addEventListener('click',()=>$('sources-dialog').close());$('detail-close').addEventListener('click',()=>$('detail-dialog').close());$('detail-dialog').addEventListener('close',()=>{$('windy-camera-player')?.remove();});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){basePanel(false);window.closeLayerDrawer?.(true);}});
function tick(){const now=new Date();$('clock').innerHTML=`<time datetime="${now.toISOString()}"><strong>${now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'})}</strong><span>${now.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'})}</span></time>`;}

tick();setInterval(tick,30000);setInterval(()=>{if(document.hidden)return;refreshData();const img=$('camera-detail-image');if(img&&$('detail-dialog').open){const url=new URL(img.src);url.searchParams.set('t',Date.now());img.src=url.href;}},60000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRadar();});
$('radar-player').hidden=true;loadForecast(7.0084,100.4767,'หาดใหญ่');refreshData();requestCurrentLocation();
