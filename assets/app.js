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
const titles = {windycams:'กล้อง Windy · สงขลา',overview:'ทุกข้อมูล ในแผนที่เดียว',cameras:'มองเห็นสถานการณ์จริง',water:'ติดตามระดับน้ำ',wind:'ทิศทางและความเร็วลม',radar:'มองภาพฝนที่เคลื่อนผ่าน',weather:'อากาศจากสถานีตรวจวัด'};
const intros = {windycams:'กล้องในจังหวัดสงขลาจาก Windy Webcams แยก Timelapse ออกจากวิดีโอสด ตรวจสอบเวลาภาพรายกล้อง',cameras:'ค้นหาจุดกล้อง คลิกดูภาพขนาดใหญ่ หรือเลือกดูหลายกล้องพร้อมกัน ภาพนิ่งอัปเดตเป็นระยะ',water:'ระดับน้ำและเวลาตรวจวัดรายสถานี สถานีที่ไม่มีเกณฑ์จะแสดงว่าไม่ทราบเกณฑ์',wind:'สนามลมพยากรณ์ NOAA GFS ที่ความสูง 10 เมตร แยกจากค่าลมตรวจวัดของสถานี',radar:'ภาพตรวจวัด TMD ภาคใต้ ภาพพยากรณ์ SWIRLS และเรดาร์ภาพรวม RainViewer',weather:'ข้อมูลตรวจวัดจริงจากสถานี TMD ที่ One Data เผยแพร่ ตรวจสอบเวลารายสถานีก่อนใช้งาน'};
let view='overview', datasets={}, fetched={}, radarFrames=[], radarTimer=null, radarKind='nowcast', weatherRequest=0, refreshing=false, waterKind='water', nationalRows=[];
let favoriteSlugs; try { favoriteSlugs = new Set(JSON.parse(localStorage.getItem('rm-favorites')||'[]')); } catch { favoriteSlugs=new Set(); }
const enabled = {windycams:false,cameras:false,water:false,weather:false,wind:true,radar:true};
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
let baseRequest=0;
async function setBase(id){
 const request=++baseRequest,base=basemaps.find(b=>b.id===id)||basemaps[0];
 try {
  if(base.style){if(!await map.setBase(base))return;}else map.setRasterBase(base);
  if(request!==baseRequest)return;
  document.querySelectorAll('.basemap-option').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.base===base.id)));
  $('terrain-status').textContent=base.id==='natural'?'ELEMNT · OSM / Protomaps · Mapterhorn DEM · GEBCO':'หมุนและเอียงได้ · 3D ใช้ Mapterhorn DEM';
  try{localStorage.setItem('rm-basemap-v2',base.id);}catch{}
 }catch{if(request===baseRequest&&id!=='osm'){toast('พื้นแผนที่นี้ยังโหลดไม่ได้ กำลังใช้ OpenStreetMap');setBase('osm');}}
}
$('basemap-grid').innerHTML=basemaps.map(b=>`<button class="basemap-option" data-base="${b.id}" aria-pressed="false"><span class="basemap-preview base-${b.art}" aria-hidden="true"></span><span>${b.name}</span></button>`).join('');
let storedBase;try{storedBase=localStorage.getItem('rm-basemap-v2');document.documentElement.dataset.theme=localStorage.getItem('rm-theme')||'light';}catch{}
setBase(storedBase||'natural');
document.querySelectorAll('[data-base]').forEach(b=>b.addEventListener('click',()=>setBase(b.dataset.base)));
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5500);}
function openPanel(){ $('sidebar').hidden=false;$('sidebar').classList.add('is-open');$('layers-toggle').setAttribute('aria-expanded','true');document.querySelector('.drawer-scroll').scrollTop=0; }
function setEnabled(name,on){ enabled[name]=on;const checkbox=document.querySelector(`[data-layer="${name}"]`);if(checkbox)checkbox.checked=on;
 if(['cameras','water','weather','windycams'].includes(name))map.enablePoints(name,on);
 window.syncLayerMenu?.();
 if(name==='wind')renderWind();if(name==='radar'){ $('radar-player').hidden=!on;if(on)loadRadar();else {stopRadar();map.setRain(null);} }
}
document.querySelectorAll('[data-layer]').forEach(el=>el.addEventListener('change',()=>setEnabled(el.dataset.layer,el.checked)));
function selectView(next){
 view=next;$('view-title').textContent=titles[view];document.querySelectorAll('.nav-item').forEach(b=>{b.classList.toggle('active',(b.dataset.view===view||(view==='windycams'&&b.dataset.view==='cameras')));b.setAttribute('aria-pressed',String((b.dataset.view===view||(view==='windycams'&&b.dataset.view==='cameras'))));});
 $('layer-catalog').hidden=view!=='overview';$('layer-details').hidden=view==='overview';$('category-panel').hidden=view==='overview';$('category-intro').textContent=intros[view]||'';$('search').value='';$('category-tools').innerHTML='';$('search-box').hidden=['wind','radar'].includes(view);
 if(view!=='overview')setEnabled(view,true);
 if(view==='cameras')$('category-tools').innerHTML='<div class="tool-row"><select id="camera-filter" class="control-select" aria-label="กรองกล้อง"><option value="all">กล้องทั้งหมด</option><option value="online">ออนไลน์และภาพไม่เก่า</option><option value="old">ข้อมูลเก่า / ขัดข้อง</option><option value="favorite">กล้องที่บันทึกไว้</option></select><button id="multiview" class="popup-button">ดูพร้อมกัน 4 กล้อง</button></div>';
 if(view==='cameras'||view==='windycams'){$('category-tools').insertAdjacentHTML('afterbegin',`<div class="camera-networks"><button data-camera-network="cameras" aria-pressed="${view==='cameras'}">ภาพสถานการณ์น้ำ</button><button data-camera-network="windycams" aria-pressed="${view==='windycams'}">Windy · สงขลา</button></div>`);document.querySelectorAll('[data-camera-network]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.cameraNetwork)));}
 if(view==='water'){$('category-tools').innerHTML='<label class="control-label" for="water-source">ชุดข้อมูลน้ำ</label><select id="water-source" class="control-select"><option value="water">RID · สงขลาและใกล้เคียง</option><option value="thaiwater">ThaiWater · ระดับน้ำทั่วประเทศ</option><option value="rain">ThaiWater · ฝนสะสม 24 ชม.</option><option value="dam">ThaiWater · เขื่อนขนาดใหญ่</option></select>';$('water-source').value=waterKind;$('water-source').addEventListener('change',async e=>{waterKind=e.target.value;window.syncLayerMenu?.();await loadNational();renderMarkers();renderResults();});}
 if(view==='radar'){$('category-tools').innerHTML='<label class="control-label" for="radar-source">แหล่งภาพฝน</label><select id="radar-source" class="control-select"><option value="radar">TMD · ตรวจวัดภาคใต้</option><option value="nowcast">SWIRLS · พยากรณ์ภาคใต้</option><option value="rainviewer">RainViewer · ภาพรวม</option></select><div class="notice">ภาพสีเป็นผลิตภัณฑ์คนละชนิด โปรดอ่านสเกลจากต้นทางและเวลาในแถบเล่นภาพ</div>';$('radar-source').value=radarKind;$('radar-source').addEventListener('change',e=>{radarKind=e.target.value;window.syncLayerMenu?.();loadRadar();});}
 if($('camera-filter'))$('camera-filter').addEventListener('change',renderResults);
 if($('multiview'))$('multiview').addEventListener('click',showMultiview);
 renderResults();document.querySelector('.drawer-scroll').scrollTop=0;openPanel();window.syncLayerMenu?.();
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view)));
$('search').addEventListener('input',renderResults);
function cameraOld(c){return c.status!=='online'||stale(c.last_captured_at,1);}
function point(type,row){ if(type==='cameras'){ const a=String(row.location||'').split(',').map(Number);return a.length===2&&String(row.location).includes(',')&&a.every(Number.isFinite)?a:null; } const lat=row.latitude??row.lat,lng=row.longitude??row.lon;return lat!=null&&lng!=null&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))?[Number(lat),Number(lng)]:null; }
function idOf(type,row){if(type==='windycams')return row.webcam_id;return type==='cameras'?row.camera_slug:type==='water'?row.station_code:row.wmo;}
function titleOf(type,row){if(type==='windycams')return row.name;return type==='cameras'?row.camera_name_th:type==='water'?row.station_name_th:row.th;}
function observed(type,row){return type==='cameras'?row.last_captured_at:row.observed_at;}
function waterStatus(row){if(stale(row.observed_at))return 'ข้อมูลเก่า / ไม่ทราบเวลา';if(row.level==null)return 'ไม่มีค่าระดับน้ำ';if(row.alert_red!=null&&row.level>=row.alert_red)return 'ถึงเกณฑ์แดงของสถานี';if(row.alert_yellow!=null&&row.level>=row.alert_yellow)return 'ถึงเกณฑ์เหลืองของสถานี';return row.alert_red==null&&row.alert_yellow==null?'ยังไม่ทราบเกณฑ์เตือน':'ต่ำกว่าเกณฑ์เตือนที่ระบุ';}
function imageFor(row){return safeURL(row.source_img_url)||safeURL(row.image_url);}
function renderMarkers(){
 for(const type of ['cameras','water','weather','windycams']){
  const rows=type==='water'&&waterKind!=='water'?nationalRows:(datasets[type]||[]);
  const features=rows.flatMap((row,index)=>{const p=point(type,row);if(!p||Math.abs(p[0])>90||Math.abs(p[1])>180)return [];
   return [{type:'Feature',geometry:{type:'Point',coordinates:[p[1],p[0]]},properties:{index,title:titleOf(type,row),old:type==='cameras'?cameraOld(row):stale(observed(type,row),type==='water'&&waterKind==='dam'?48:3)}}];
  });
  map.setPoints(type,features,enabled[type],index=>showDetail(type,rows[index]));
 }
}
function filteredCameras(){let rows=datasets.cameras||[];const filter=$('camera-filter')?.value;if(filter==='online')rows=rows.filter(c=>!cameraOld(c));if(filter==='old')rows=rows.filter(cameraOld);if(filter==='favorite')rows=rows.filter(c=>favoriteSlugs.has(c.camera_slug));return rows;}
function renderResults(){
 if(view==='overview')return;const target=$('results');target.innerHTML='';$('result-count').textContent='';if(view==='water'&&nationalLoading){$('result-count').textContent='กำลังโหลดชุดข้อมูล…';target.innerHTML='<div class="empty-state">กำลังเชื่อมต่อ ThaiWater…</div>';return;}
 if(view==='radar'){target.innerHTML='<div class="wind-card">'+icon('radar')+'<h3>ภาพฝนบนแผนที่</h3><p>เลือกแหล่งภาพ แล้วใช้แถบเวลาเพื่อดูแต่ละเฟรม กดเล่นเพื่อดูการเคลื่อนตัวของกลุ่มฝน</p><a href="https://weather.tmd.go.th/" target="_blank" rel="noopener">เรดาร์สถานีอื่นจาก TMD</a></div>';return;}
 if(view==='wind'){const w=datasets.wind;target.innerHTML=`<div class="wind-card">${icon('wind')}<p class="eyebrow">NOAA GFS / 10 METERS</p><h3>สนามลม 0.25°</h3><p>เวลาพยากรณ์: ${esc(time(w?.validTime))}<br>รอบแบบจำลอง: ${esc(time(w?.refTime))}<br>หน่วย: เมตรต่อวินาที (m/s)</p><p>ครอบคลุมละติจูด 5–21°N และลองจิจูด 97–106°E</p>${!w?'<div class="notice">ยังไม่มีข้อมูลลมที่โหลดสำเร็จ</div>':w.stale||stale(w.validTime,6)?'<div class="notice">ข้อมูลลมเก่า โปรดตรวจสอบเวลาก่อนใช้งาน</div>':''}<p>เปิดเลเยอร์ลมเพื่อดูอนุภาคเคลื่อนที่บนแผนที่</p></div>`;return;}
 let rows=view==='cameras'?filteredCameras():view==='water'&&waterKind!=='water'?nationalRows:(datasets[view]||[]);
 const q=$('search').value.toLocaleLowerCase().trim();rows=rows.filter(r=>[titleOf(view,r),idOf(view,r),r.group_name,r.province_name,r.amphur_name].join(' ').toLocaleLowerCase().includes(q));
 $('result-count').textContent=`${rows.length.toLocaleString('th-TH')} รายการ${rows.length>150?' · แสดง 150 รายการแรก กรุณาค้นหาเพื่อเจาะจง':''}`;
 if(!rows.length){target.innerHTML=view==='windycams'?'<div class="empty-state">'+(window.windyWebcamStatus?.ok?'ยังไม่มีกล้องที่ตรงกับคำค้นหา':'รายการกล้อง Windy ยังโหลดไม่ได้ กรุณาลองโหลดข้อมูลใหม่')+'</div>':'<div class="empty-state">ไม่พบรายการที่ตรงกัน<br>ลองเปลี่ยนคำค้นหาหรือโหลดข้อมูลใหม่</div>';return;}
 rows.slice(0,150).forEach(row=>{const b=document.createElement('button');b.className='result-card';const image=view==='cameras'?imageFor(row):'';let value='';if(view==='water')value=`<span class="result-value">${number(row.level)}<small>${waterKind==='rain'?'มม.':waterKind==='dam'?'%':'ม.'}</small></span>`;if(view==='weather')value=`<span class="result-value">${number(row.t)}°</span>`;
 b.innerHTML=`${image?`<img loading="lazy" src="${esc(image)}" alt="ภาพ ${esc(titleOf(view,row))}">`:''}<span class="result-info"><strong>${esc(titleOf(view,row))}</strong><small>${view==='cameras'?(cameraOld(row)?'ภาพเก่า / ขัดข้อง':'ออนไลน์')+' · ':''}${esc(freshness(observed(view,row),view==='cameras'?1:view==='water'&&waterKind==='dam'?48:3))}</small></span>${value}`;
 b.addEventListener('click',()=>{const p=point(view,row);if(p)map.flyTo(p,14,{duration:.6});showDetail(view,row);});target.appendChild(b);
 });
 bindImageErrors(target);
}
function bindImageErrors(parent){parent.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.removeAttribute('src');img.alt='ภาพยังไม่พร้อม';img.classList.add('image-unavailable');},{once:true}));}
function showDetail(type,row){
 const content=$('detail-content');const name=titleOf(type,row);let body='';
 if(type==='windycams'){
  const types=Object.keys(row.players||{});const kind=types.includes('live')?'live':types.includes('day')?'day':types[0];const label=k=>({live:'วิดีโอสด',day:'Timelapse · วันนี้',month:'Timelapse · เดือน',year:'Timelapse · ปี',lifetime:'Timelapse · ทั้งหมด'}[k]||k);
  body=`<p class="eyebrow">WINDY WEBCAMS / สงขลา</p><h2>${esc(name)}</h2><p>${esc(freshness(row.observed_at,1))} · ${esc(row.status)}</p><label class="windy-player-label">การเล่นภาพ <select id="windy-player-kind">${types.map(k=>`<option value="${esc(k)}" ${k===kind?'selected':''}>${label(k)}</option>`).join('')}</select></label><iframe id="windy-camera-player" class="windy-camera-player" title="${esc(name)} · Windy Timelapse" src="${esc(safeURL(row.players[kind]))}" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe><p class="muted">${kind==='live'?'ลิงก์ Live จาก Windy':'ภาพย้อนหลังแบบ Timelapse ไม่ใช่วิดีโอสดต่อเนื่อง'} · เวลาภาพล่าสุดตาม Windy</p><a href="${esc(safeURL(row.detail_url))}" target="_blank" rel="noopener">ดูเว็บแคมนี้บน Windy.com</a>`;
 }else if(type==='cameras'){
  const url=imageFor(row);body=`<p class="eyebrow">CCTV / ภาพนิ่งอัปเดต</p><h2>${esc(name)}</h2>${url?`<img id="camera-detail-image" class="detail-image" src="${esc(url)}" alt="ภาพจาก ${esc(name)}">`:'<div class="empty-state">ไม่มี URL ภาพสำหรับกล้องนี้</div>'}<div class="detail-meta"><span id="camera-observed">${esc(freshness(row.last_captured_at,1))}</span><span>${esc(row.status||'ไม่ทราบสถานะ')}</span></div><div class="detail-actions"><button id="camera-refresh">โหลดภาพล่าสุด</button><button id="camera-favorite">${favoriteSlugs.has(row.camera_slug)?'นำออกจากรายการบันทึก':'บันทึกกล้องนี้'}</button>${safeURL(row.source_page_url)?`<a href="${esc(safeURL(row.source_page_url))}" target="_blank" rel="noopener">เปิดต้นทาง</a>`:''}</div><p class="muted">ภาพ: ${esc(row.sponsor_name||row.group_name||'HatyaiClimate')} · ข้อมูลรายการจาก One Data</p>`;
 }else if(type==='water'){
  if(waterKind==='rain'||waterKind==='dam'){
   body=`<p class="eyebrow">THAIWATER / ${waterKind==='dam'?'DAM STORAGE':'RAINFALL'}</p><h2>${esc(name)}</h2><p>${esc(row.province_name)} · ${esc(freshness(row.observed_at,waterKind==='dam'?48:3))}</p><div class="detail-facts"><div>${waterKind==='dam'?'น้ำกักเก็บเทียบความจุ':'ฝนสะสม 24 ชั่วโมง'}<strong>${number(row.level)} ${waterKind==='dam'?'%':'มม.'}</strong></div>${waterKind==='dam'?`<div>ปริมาตรน้ำกักเก็บ<strong>${number(row.storage)} ล้าน ม³</strong></div>`:''}</div><p class="muted">${waterKind==='dam'?'ข้อมูลเขื่อนตามวันที่ต้นทาง':'เวลาสิ้นสุดช่วงสะสมตามแต่ละสถานี ไม่ใช่ฝนตั้งแต่เที่ยงคืนเสมอ'}</p><a href="https://www.thaiwater.net/" target="_blank" rel="noopener">ดูข้อมูลต้นทาง ThaiWater</a>`;
  }else{
  const trend=(datasets.trends||[]).find(t=>t.station_code===row.station_code);body=`<p class="eyebrow">WATER / ${waterKind==='water'?'RID':'THAIWATER'}</p><h2>${esc(name)}</h2><p>${esc(row.province_name)} · ${esc(freshness(row.observed_at))}</p><div class="detail-facts"><div>${waterKind==='rain'?'ฝน 24 ชม.':waterKind==='dam'?'น้ำกักเก็บ':'ระดับน้ำ'}<strong>${number(row.level)} ${waterKind==='rain'?'มม.':waterKind==='dam'?'%':'ม.'}</strong></div><div>แนวโน้ม<strong>${trend?trend.trend==='rise'?'เพิ่มขึ้น':trend.trend==='fall'?'ลดลง':'ทรงตัว':'—'}</strong>${trend?'เปลี่ยนแปลง '+number(trend.delta,2)+' ม.':''}</div><div>เทียบความจุตลิ่ง<strong>${number(row.level_percent)}%</strong></div><div>อัตราการไหล<strong>${number(row.q)} ม³/วินาที</strong></div></div><div class="notice">${esc(waterKind==='water'?waterStatus(row):'ข้อมูลจาก ThaiWater · หน่วยและฐานอ้างอิงตามต้นทาง')}</div><p class="muted">เกณฑ์เหลือง ${number(row.alert_yellow)} / แดง ${number(row.alert_red)} ม. · ไม่แปลงค่าที่ขาดเป็นศูนย์</p><a href="${waterKind==='water'?'https://onedata-surv.dida.psu.ac.th/stations':'https://www.thaiwater.net/'}" target="_blank" rel="noopener">ดูรายละเอียดและกราฟจากต้นทาง</a>`;
  }
 }else body=`<p class="eyebrow">TMD / STATION OBSERVATION</p><h2>${esc(name)}</h2><p>${esc(row.province_name)} · ${esc(freshness(row.observed_at))}</p><div class="detail-facts"><div>อุณหภูมิ<strong>${number(row.t)} °C</strong></div><div>ความชื้น<strong>${number(row.rh)} %</strong></div><div>ความกดอากาศ<strong>${number(row.p)} hPa</strong></div><div>ฝน 24 ชม.<strong>${number(row.rain24)} มม.</strong></div><div>ทิศลม<strong>${number(row.wd)}°</strong></div><div>ค่าลมจากต้นทาง<strong>${number(row.ws)}</strong>ยังไม่ยืนยันหน่วย ws</div></div><p class="muted">รหัส WMO ${esc(row.wmo)} · ตรวจวัดจริงจาก TMD ผ่าน One Data</p>`;
 content.innerHTML=body;bindImageErrors(content);if(!$('detail-dialog').open)$('detail-dialog').showModal();
 if(type==='windycams')$('windy-player-kind').addEventListener('change',e=>{$('windy-camera-player').src=safeURL(row.players[e.target.value]);});
 if(type==='cameras'){
  $('camera-refresh').addEventListener('click',()=>{const img=$('camera-detail-image');if(img){const u=new URL(imageFor(row));u.searchParams.set('t',Date.now());img.src=u.href;toast('โหลดภาพใหม่แล้ว เวลาตรวจวัดจะเปลี่ยนตามรอบข้อมูลต้นทาง');}});
  $('camera-favorite').addEventListener('click',()=>{favoriteSlugs.has(row.camera_slug)?favoriteSlugs.delete(row.camera_slug):favoriteSlugs.add(row.camera_slug);try{localStorage.setItem('rm-favorites',JSON.stringify([...favoriteSlugs]));}catch{}showDetail(type,row);if(view==='cameras')renderResults();});
 }
}
function showMultiview(){const rows=filteredCameras().filter(c=>titleOf('cameras',c)?.includes($('search').value.trim())).slice(0,4);if(!rows.length){toast('ไม่มีกล้องที่ตรงกับตัวกรอง');return;}$('detail-content').innerHTML=`<p class="eyebrow">CCTV / MULTIVIEW</p><h2>ภาพสถานการณ์พร้อมกัน</h2><div class="multiview-grid">${rows.map(c=>`<figure><img class="detail-image" src="${esc(imageFor(c))}" alt="${esc(c.camera_name_th)}"><figcaption>${esc(c.camera_name_th)}<small>${esc(freshness(c.last_captured_at,1))}</small></figcaption></figure>`).join('')}</div><p class="muted">HatyaiClimate / หน่วยงานเจ้าของกล้อง · ภาพนิ่งตามเวลาที่กำกับ</p>`;bindImageErrors($('detail-content'));$('detail-dialog').showModal();}
function renderWind(){map.setWind(enabled.wind?datasets.wind?.records:null);}
async function getJSON(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000),cache:'no-cache'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}
async function refreshData(){
 if(refreshing)return;refreshing=true;$('refresh').disabled=true;$('data-status').textContent='กำลังโหลดข้อมูล…';
 try{const manifest=await getJSON(`data/live/manifest.json?t=${Date.now()}`);const names=['cameras','water','trends','weather','wind','radar','nowcast','windycams'];const results=await Promise.allSettled(names.map(async name=>{const envelope=await getJSON(`data/live/${name}.json?t=${Date.now()}`);datasets[name]=envelope.data;fetched[name]=envelope.fetched_at;if(name==='windycams')window.windyWebcamStatus=envelope;}));
  const ok=results.filter(r=>r.status==='fulfilled').length;$('camera-count').textContent=number(datasets.cameras?.length,0);$('water-count').textContent=number(datasets.water?.length,0);$('windy-count').textContent=number(datasets.windycams?.length,0);
  const sourceFailed=Object.values(manifest.datasets||{}).some(d=>!d.ok)||(window.windyWebcamStatus?.configured&&!window.windyWebcamStatus.ok);$('data-status').textContent=`${ok<names.length||sourceFailed?'โหลดได้บางชุด · ':''}${stale(manifest.generated_at,1)?'ไฟล์ข้อมูลเก่า · ':''}อัปเดต ${time(manifest.generated_at)}`;
  renderMarkers();renderResults();if(enabled.wind)renderWind();if(enabled.radar)await loadRadar();
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
let radarRequest=0;
async function loadRadar(){
 const request=++radarRequest;stopRadar();map.setRain(null);radarFrames=[];$('radar-status').textContent='กำลังโหลดภาพ…';$('radar-play').disabled=true;
 try{let frames;
  if(radarKind==='rainviewer'){const j=await getJSON('https://api.rainviewer.com/public/weather-maps.json');frames=(j.radar?.past||[]).map(f=>({frame_time:new Date(f.time*1000).toISOString(),tile:`${j.host}${f.path}/256/{z}/{x}/{y}/0/1_1.png`}));}
  else frames=(datasets[radarKind]||[]).filter(f=>f.bounds&&safeURL(f.image_url)).sort((a,b)=>Date.parse(a.frame_time)-Date.parse(b.frame_time));
  if(request!==radarRequest)return;radarFrames=frames;$('radar-label').textContent=radarKind==='radar'?'TMD · ตรวจวัดภาคใต้':radarKind==='nowcast'?'SWIRLS · พยากรณ์ภาคใต้':'RainViewer · เรดาร์';
  $('radar-slider').max=Math.max(0,frames.length-1);$('radar-play').disabled=!frames.length;if(!frames.length){$('radar-status').textContent='ยังไม่มีเฟรมภาพจากแหล่งนี้';$('radar-time').textContent='—';$('radar-date').textContent='—';return;}showRadarFrame(frames.length-1);
 }catch{$('radar-status').textContent='โหลดภาพเรดาร์ไม่สำเร็จ กรุณาเปลี่ยนแหล่งภาพ';}
}
function showRadarFrame(index){
 const f=radarFrames[index];if(!f)return;map.setRain(enabled.radar?f:null);
 $('radar-slider').value=index;const d=new Date(f.frame_time);$('radar-time').textContent=d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});$('radar-date').textContent=time(f.frame_time);$('radar-status').textContent=`${stale(f.frame_time,2)?'ข้อมูลต้นทางยังเป็นเฟรมเก่า · ':''}${radarKind==='nowcast'?'เวลาที่พยากรณ์':'เวลาของภาพ'} · เฟรม ${index+1}/${radarFrames.length}${radarKind!=='rainviewer'?' · ครอบคลุมภาคใต้':''}`;
 document.querySelector('.radar-gradient').hidden=radarKind!=='rainviewer';document.querySelector('.legend-scale').hidden=radarKind!=='rainviewer';
}
$('radar-slider').addEventListener('input',e=>{stopRadar();showRadarFrame(Number(e.target.value));});
$('radar-play').addEventListener('click',()=>{if(radarTimer){stopRadar();return;}if(!radarFrames.length)return;$('radar-play').textContent='Ⅱ';$('radar-play').setAttribute('aria-label','หยุดภาพเรดาร์');radarTimer=setInterval(()=>showRadarFrame((Number($('radar-slider').value)+1)%radarFrames.length),850);});
let nationalRequest=0, nationalLoading=false;
async function loadNational(){
 const request=++nationalRequest,kind=waterKind;
 nationalRows=[];nationalLoading=kind!=='water';renderMarkers();renderResults();if(kind==='water')return;toast('กำลังดึงข้อมูล ThaiWater…');
 const root='https://api-v3.thaiwater.net/api/v1/thaiwater30';const path=kind==='thaiwater'?'/public/waterlevel_load':kind==='rain'?'/public/rain_24h':'/analyst/dam?dam_size=1';
 try{const j=await getJSON(root+path);if(request!==nationalRequest||kind!==waterKind)return;
  nationalRows=normalizeNationalData(j,kind);
  if(!nationalRows.length)toast('แหล่งข้อมูลนี้ยังไม่มีรายการที่รองรับ');
 }catch{if(request===nationalRequest)toast('โหลด ThaiWater ไม่สำเร็จ กรุณาลองใหม่');}
 finally{if(request===nationalRequest){nationalLoading=false;renderMarkers();renderResults();}}
}
document.querySelectorAll('[data-place]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-place]').forEach(x=>x.classList.toggle('selected',x===b));const [lat,lng,name,zoom]=places[b.dataset.place];map.flyTo([lat,lng],zoom);$('map-context').textContent=name;loadForecast(lat,lng,name);if(innerWidth<=680)window.closeLayerDrawer?.();}));
map.onMapClick=p=>{window.closeLayerDrawer?.();loadForecast(p.lat,p.lng,`พิกัด ${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`);};
$('refresh').addEventListener('click',()=>{refreshData();const c=map.getCenter();loadForecast(c.lat,c.lng,$('place-name').textContent);});
$('fit').addEventListener('click',()=>{map.flyTo([7.0084,100.4767],11);$('map-context').textContent='หาดใหญ่ · สงขลา';});
$('locate').addEventListener('click',()=>{if(!navigator.geolocation){toast('เบราว์เซอร์นี้ไม่รองรับตำแหน่ง');return;}navigator.geolocation.getCurrentPosition(p=>{map.flyTo([p.coords.latitude,p.coords.longitude],12);loadForecast(p.coords.latitude,p.coords.longitude,'ตำแหน่งของคุณ');},()=>toast('เข้าถึงตำแหน่งไม่ได้ คุณยังเลือกเมืองหรือคลิกแผนที่ได้'),{timeout:10000});});
$('theme').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('rm-theme',theme);}catch{}});
$('mobile-panel').addEventListener('click',openPanel);$('sidebar-close').addEventListener('click',()=>window.closeLayerDrawer?.());
function basePanel(open){$('basemap-panel').hidden=!open;$('basemap-toggle').setAttribute('aria-expanded',String(open));}
$('basemap-toggle').addEventListener('click',()=>basePanel($('basemap-panel').hidden));$('basemap-close').addEventListener('click',()=>basePanel(false));
$('sources-open').addEventListener('click',()=>$('sources-dialog').showModal());$('sources-close').addEventListener('click',()=>$('sources-dialog').close());$('detail-close').addEventListener('click',()=>$('detail-dialog').close());$('detail-dialog').addEventListener('close',()=>{$('windy-camera-player')?.remove();});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){basePanel(false);window.closeLayerDrawer?.(true);}});
function tick(){ $('clock').textContent=new Date().toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}); }
tick();setInterval(tick,30000);setInterval(()=>{if(document.hidden)return;refreshData();const img=$('camera-detail-image');if(img&&$('detail-dialog').open){const url=new URL(img.src);url.searchParams.set('t',Date.now());img.src=url.href;}},60000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRadar();});
$('radar-player').hidden=false;loadForecast(7.0084,100.4767,'หาดใหญ่');refreshData();
