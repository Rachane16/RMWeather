'use strict';

// Experimental sources have their own visibility and clock. Existing map layers
// remain intact; the ordinary wind resumes when model wind is disabled.
(()=>{
 const panel=$('development-dialog'),launcher=$('development-open');
 document.querySelector('.workspace').append(panel,$('development-timeline'));
 const state={modelRain:false,modelWind:false,clppRadar:false,provinces:false,stations:false,point:false};
 const data={model:null,clpp:null,stations:null,geo:null,health:null},indices={model:0,clpp:0};
 let source='model',timer=null,modelRequest=0,pointRequest=0,popup=null,minimized=false,windKey='',stationKey='',provinceKey='';
 const textures=new Map(),images=new Map();
 const date=stamp=>time(new Date(stamp*1000).toISOString());
 const lag=stamp=>Math.max(0,Math.floor((Date.now()/1000-stamp)/60));
 function open(on){
  panel.hidden=!on;launcher.setAttribute('aria-expanded',String(on));
  if(on){setWeatherTool('weather-map',false);window.workspaceUI?.closeForWeatherTool();window.workspaceUI?.setOpen('sidebar',false);}
 }
 launcher.addEventListener('click',()=>open(panel.hidden));$('development-close').addEventListener('click',()=>open(false));
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();open(false);launcher.focus();}});
 async function resource(file){
  for(const folder of ['data/live/development/','data/development-fallback/']){
   try{
    const url=new URL(folder+file,location.href),r=await fetch(url.href+'?t='+Math.floor(Date.now()/300000),{signal:AbortSignal.timeout(25000)});
    if(!r.ok)throw Error('HTTP '+r.status);
    return {payload:await r.json(),base:new URL(folder,location.href).href};
   }catch{}
  }
  throw Error('ชุดข้อมูลยังไม่พร้อม กรุณาลองใหม่ภายหลัง');
 }
 function status(message){
  if(message){$('development-status').textContent=message;return;}
  const parts=[];
  if((state.modelRain||state.modelWind)&&data.model)parts.push(`${data.model.name} · เก็บข้อมูล ${date(data.model.collected_at)}${lag(data.model.collected_at)>720?' · สำเนาเก่า':''}`);
  if(Object.keys(state).some(k=>state[k]&&!k.startsWith('model'))&&data.clpp)parts.push(`${data.health?.clpp_ok===false?'อัปเดตไม่สำเร็จ · ใช้สำเนา ':''}CLPP · ฐานเรดาร์ ${date(data.clpp.generated)} · ล่าช้า ${lag(data.clpp.generated)} นาที`);
  if(state.stations&&data.stations)parts.push(`สถานี ${data.stations.rows.length.toLocaleString()} จุด · ตรวจเวลารายสถานี`);
  $('development-status').textContent=parts.join(' / ')||'เลือกชั้นข้อมูลที่ต้องการ';
  $('development-status').dataset.stale=String(Boolean(data.clpp&&Object.keys(state).some(k=>state[k]&&!k.startsWith('model'))&&(data.health?.clpp_ok===false||lag(data.clpp.generated)>90)));
  launcher.dataset.active=String(Object.values(state).some(Boolean));
 }
 async function loadModel(){
  const request=++modelRequest,id=$('development-model').value;
  status('กำลังโหลดกริดแบบจำลอง…');
  const result=await resource(id+'.json');
  if(request!==modelRequest)return;
  const model=result.payload;
  if(!model.grid||!model.frames?.length||model.id!==id)throw Error('รูปแบบแบบจำลองไม่รองรับ');
  data.model=model;indices.model=developmentLatest(model.frames);render();
 }
 async function loadCLPP(){
  const result=await resource('clpp.json');
  if(!result.payload.frames?.length)throw Error('ภาพ CLPP ไม่พร้อม');
  data.clpp={...result.payload,base:result.base};
  try{data.health=(await resource('health.json')).payload;}catch{data.health=null;}
  indices.clpp=Math.max(0,data.clpp.frames.findIndex(f=>f.kind==='present'));
 }
 async function activate(key,on){
  state[key]=on;stop();
  if(!on){++pointRequest;popup?.remove();}
  try{
   if(on){
    status('กำลังโหลดชุดข้อมูล…');
    if(key.startsWith('model')){source='model';if(!data.model)await loadModel();}
    else{
     if(!data.clpp)await loadCLPP();
     if(key==='clppRadar'||key==='point')source='clpp';
     if(key==='provinces'&&!data.geo)data.geo=(await resource('provinces.json')).payload;
     if(key==='stations'&&!data.stations){const p=(await resource('stations.json')).payload;data.stations={...p,rows:developmentStations(p)};}
    }
   }
   render();
  }catch(error){state[key]=false;render();status(error.message);}
 }
 document.querySelectorAll('[data-development]').forEach(input=>input.addEventListener('change',()=>activate(input.dataset.development,input.checked)));
 $('development-model').addEventListener('change',async()=>{stop();data.model=null;render();if(state.modelRain||state.modelWind){try{await loadModel();}catch(e){status(e.message);}}});
 $('development-station-window').addEventListener('change',render);
 $('development-clear').addEventListener('click',()=>{Object.keys(state).forEach(k=>state[k]=false);++pointRequest;stop();popup?.remove();render();});
 $('development-fit').addEventListener('click',()=>{open(false);map.gl.fitBounds([[97,5.5],[106,20.5]],{padding:35,duration:900});});
 function texture(frame,model){
  const key=model.id+model.collected_at+frame.time;if(textures.has(key))return textures.get(key);
  const g=model.grid,canvas=document.createElement('canvas');canvas.width=270;canvas.height=420;
  const c=canvas.getContext('2d'),pixels=c.createImageData(canvas.width,canvas.height);
  const south=g.north-(g.ny-1)*g.step,east=g.west+(g.nx-1)*g.step;
  const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)),n=merc(g.north),s=merc(south);
  const stops=[[.1,125,199,241],[1,40,181,180],[5,81,197,140],[10,246,216,96],[20,239,147,74],[50,218,84,155]];
  for(let y=0;y<canvas.height;y++){
   const lat=(2*Math.atan(Math.exp(n+(s-n)*y/(canvas.height-1)))-Math.PI/2)*180/Math.PI;
   for(let x=0;x<canvas.width;x++){
    const value=developmentSample(frame.rain,g,g.west+(east-g.west)*x/(canvas.width-1),lat);
    if(value==null||value<.1)continue;
    let hi=stops.findIndex(p=>p[0]>=value);if(hi<0)hi=stops.length-1;
    const low=stops[Math.max(0,hi-1)],high=stops[hi],weight=hi===0?0:Math.min(1,(value-low[0])/(high[0]-low[0]));
    const i=(y*canvas.width+x)*4;
    for(let k=0;k<3;k++)pixels.data[i+k]=low[k+1]+(high[k+1]-low[k+1])*weight;
    pixels.data[i+3]=value<1?100+value*90:205;
   }
  }
  c.putImageData(pixels,0,0);const result={image_url:canvas.toDataURL(),bounds:[[south,g.west],[g.north,east]]};
  if(textures.size>30)textures.clear();textures.set(key,result);return result;
 }
 function clppImage(frame){
  if(!/^frames\/clpp-[a-f0-9]+\.png$/.test(frame.file))throw Error('ชื่อภาพ CLPP ไม่ถูกต้อง');
  return new URL(frame.file,data.clpp.base).href;
 }
 function render(){
  document.querySelectorAll('[data-development]').forEach(i=>i.checked=state[i.dataset.development]);
  const model=data.model,frame=model?.frames[indices.model];
  map.setRain(state.modelRain&&frame?texture(frame,model):null,'development-model');
  const nextWind=state.modelWind&&frame?model.id+model.collected_at+frame.time:'';
  if(windKey!==nextWind){windKey=nextWind;map.setExperimentalWind(nextWind?developmentWind(frame,model.grid):null);}
  const radar=data.clpp?.frames[indices.clpp];
  map.setRain(state.clppRadar&&radar?{image_url:clppImage(radar),bounds:radar.bounds}:null,'development-clpp');
  renderStations();renderProvinces();renderClock();status();
 }
 function renderStations(){
  if(!data.stations)return;
  const window24=$('development-station-window').value==='24h';
  const key=[data.stations.generated,window24,state.stations].join(':');
  if(stationKey===key)return;stationKey=key;
  const features=data.stations.rows.map((s,index)=>{
   const value=window24?s.mm24:s.mm,observed=window24?s.obs24:s.obs;
   return {type:'Feature',geometry:{type:'Point',coordinates:[s.lon,s.lat]},properties:{index,old:!observed||age(observed)>1.5,title:`${s.name} · ${number(value)} มม.`,amount:value??-1}};
  });
  map.setPoints('devstations',features,state.stations,index=>showStation(data.stations.rows[index]));
 }
 function renderProvinces(){
  if(!map.ready)return;
  const id='rm-development-provinces';
  if(!state.provinces||!data.geo||!data.clpp){if(map.gl.getLayer(id))map.gl.setLayoutProperty(id,'visibility','none');return;}
  const stats=new Map(data.clpp.zones.accum.zones.map(z=>[z.pcode,z]));
  const geo={...data.geo,features:data.geo.features.map(f=>({...f,properties:{...f.properties,...stats.get(f.properties.pcode)}}))};
  if(map.gl.getSource(id)){if(provinceKey!==data.clpp.generated)map.gl.getSource(id).setData(geo);}
  else{
   map.gl.addSource(id,{type:'geojson',data:geo});
   const before=map.gl.getStyle().layers.find(l=>l.type==='symbol')?.id;
   map.gl.addLayer({id,source:id,type:'fill',paint:{'fill-color':['interpolate',['linear'],['coalesce',['get','mean_mm'],-1],-1,'#9aabb0',0,'#d2e8e9',1,'#77d4c7',5,'#55bca6',10,'#f4d86d',20,'#e89051',50,'#cb5791'],'fill-opacity':.43,'fill-outline-color':'#527c78'}},before);
  }
  provinceKey=data.clpp.generated;
  map.gl.setLayoutProperty(id,'visibility','visible');
 }
 function showPopup(point,html){popup?.remove();popup=new maplibregl.Popup({className:'development-popup',maxWidth:'330px',closeOnClick:false}).setLngLat(point).setHTML(html).addTo(map.gl);return popup;}
 function showStation(s){
  const derived=s.src===1?'อนุมานจากผลต่างฝนสะสม':s.src===0?'รายงานจากสถานี':'ไม่ทราบประเภท';
  showPopup([s.lon,s.lat],`<h3>${esc(s.name)}</h3><p>${esc(s.prov)} · ${esc(s.agency)}</p><dl><dt>ฝน 1 ชั่วโมง</dt><dd>${number(s.mm)} มม.</dd><dt>ฝน 24 ชั่วโมง</dt><dd>${number(s.mm24)} มม.</dd></dl><p>1 ชม.: ${esc(freshness(s.obs,1.5))}<br>24 ชม.: ${esc(freshness(s.obs24,1.5))}</p><small>ค่า 1 ชม.: ${esc(derived)} · แหล่งรายงาน ${esc(s.provider)}<br>CLPP / หน่วยงานเจ้าของสถานี · ค่า — คือไม่มีข้อมูล ไม่ใช่ 0</small>`);
 }
 function showProvince(feature,point){
  const p=feature.properties,stats=data.clpp.zones.accum;
  showPopup(point,`<h3>${esc(p.name_th)}</h3><p>ฝนสะสมคาดการณ์ล่วงหน้า ${number(stats.window_min,0)} นาที</p><dl><dt>ค่าเฉลี่ยทั้งจังหวัด</dt><dd>${number(p.mean_mm)} มม.</dd><dt>ค่าสูงสุดในจังหวัด</dt><dd>${number(p.max_mm)} มม.</dd></dl><p>ฐานเวลา ${esc(date(data.clpp.generated))}<br>ล่าช้า ${lag(data.clpp.generated)} นาที</p><small>CLPP / RadarGIS · ${number(stats.frames_used,0)} เฟรม<br>ค่าสูงสุดเป็นตำแหน่งหนึ่งในจังหวัด ไม่ใช่ฝนทั่วทั้งจังหวัด</small>`);
 }
 function renderClock(){
  const modelOn=state.modelRain||state.modelWind,clppOn=state.clppRadar||state.point;
  $('development-timeline').hidden=!modelOn&&!clppOn;
  const options=$('development-time-source').options;options[0].disabled=!modelOn;options[1].disabled=!clppOn;
  if(source==='model'&&!modelOn)source='clpp';if(source==='clpp'&&!clppOn)source='model';
  $('development-time-source').value=source;
  const frames=data[source]?.frames||[],index=indices[source],f=frames[index];
  $('development-slider').max=Math.max(0,frames.length-1);$('development-slider').value=index;
  $('development-play').disabled=!frames.length;$('development-slider').disabled=!frames.length;
  $('development-time').textContent=f?date(f.time):'กำลังโหลด';
  $('development-time-info').textContent=!f?'ยังไม่มีเฟรม':source==='model'?`${data.model.name} · ฝนช่วง ${date(f.start)}–${date(f.time)} · หน่วย มม./3 ชม. · ลมเฉลี่ย 3 ชม.`:`${f.kind==='nowcast'?'คาดการณ์ +'+f.offset_min+' นาที':f.kind==='present'?'ตรวจวัดล่าสุด':'ตรวจวัดย้อนหลัง'} · ฐานข้อมูลล่าช้า ${lag(data.clpp.generated)} นาที · หน่วย มม./ชม.`;
  $('development-credit').textContent=source==='model'&&data.model?`${data.model.name} / Open-Meteo · ${data.model.license} · กริดตัวอย่าง 1.5°`:`CLPP / ONWR · ต้นทาง RadarGIS · ${data.health?.clpp_ok===false?'อัปเดตไม่สำเร็จ ใช้สำเนาตามเวลาที่กำกับ':'ตรวจข้อมูลทุก 5 นาทีเมื่อแหล่งข้อมูลพร้อม'}`;
 }
 function stop(){if(timer)clearInterval(timer);timer=null;$('development-play').textContent='▶';$('development-play').setAttribute('aria-label','เล่นข้อมูลทดลอง');}
 $('development-slider').addEventListener('input',e=>{indices[source]=Number(e.target.value);render();});
 $('development-time-source').addEventListener('change',e=>{stop();source=e.target.value;renderClock();});
 $('development-play').addEventListener('click',()=>{
  if(timer){stop();return;}
  $('development-play').textContent='Ⅱ';$('development-play').setAttribute('aria-label','หยุดข้อมูลทดลอง');
  timer=setInterval(()=>{const frames=data[source]?.frames||[];if(document.hidden||!frames.length)return;if(source==='clpp'&&state.clppRadar&&!map.isRainReady('development-clpp'))return;indices[source]=(indices[source]+1)%frames.length;render();},1100);
 });
 $('development-timeline-minimize').addEventListener('click',()=>{minimized=!minimized;$('development-timeline-body').hidden=minimized;$('development-timeline-minimize').textContent=minimized?'+':'−';$('development-timeline-minimize').setAttribute('aria-expanded',String(!minimized));});
 async function imageData(frame){
  const url=clppImage(frame);if(images.has(url))return images.get(url);
  const pending=new Promise((resolve,reject)=>{
   const img=new Image();img.onload=()=>{try{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);resolve(ctx.getImageData(0,0,c.width,c.height));}catch(e){reject(e);}};img.onerror=()=>reject(Error('ภาพเฟรมไม่พร้อม'));img.src=url;
  });
  if(images.size>35)images.clear();images.set(url,pending);
  try{return await pending;}catch(e){images.delete(url);throw e;}
 }
 async function showPoint(point){
  const request=++pointRequest,current=data.clpp;
  const target=showPopup(point,'<h3>แนวโน้มฝนรายจุด</h3><p>กำลังอ่านภาพ…</p>');
  const frames=current.frames.filter(f=>f.offset_min>=0);
  const values=await Promise.all(frames.map(async f=>{
   try{const pixels=await imageData(f),xy=developmentPixelPosition(f.bounds,point.lng,point.lat,pixels.width,pixels.height);
    if(!xy)return {frame:f,text:'นอกขอบเขตภาพ'};
    const index=(xy[1]*pixels.width+xy[0])*4,range=developmentColourRange(pixels.data.slice(index,index+4),current.levels_rgb,current.levels_mm_hr);
    return {frame:f,text:range.text};
   }catch{return {frame:f,text:'ภาพไม่พร้อม'};}
  }));
  if(request!==pointRequest||!state.point||!target.isOpen())return;
  target.setHTML(`<h3>แนวโน้มฝนรายจุด · CLPP</h3><small>${point.lat.toFixed(4)}, ${point.lng.toFixed(4)} · ฐาน ${esc(date(current.generated))}</small><p>ช่วงค่าจากสีภาพ (มม./ชม.) · ค่าประมาณ</p><table>${values.map(v=>`<tr><td>${v.frame.offset_min===0?'ขณะตรวจวัด':'+'+v.frame.offset_min+' นาที'}</td><td>${esc(v.text)}</td></tr>`).join('')}</table><small>ภาพไม่มีสีอาจไม่มีฝนหรือไม่มีข้อมูล · ไม่แทนค่าเป็นศูนย์ · ไม่ใช่ค่าดิบจาก API รายจุด<br>CLPP / RadarGIS · ล่าช้า ${lag(current.generated)} นาที</small>`);
 }
 const originalClick=map.onMapClick;
 map.onMapClick=point=>{
  if(state.point&&data.clpp){showPoint(point);return;}
  if(state.provinces&&map.gl.getLayer('rm-development-provinces')){
   const features=map.gl.queryRenderedFeatures(map.gl.project(point),{layers:['rm-development-provinces']});
   if(features.length){showProvince(features[0],point);return;}
  }
  if((state.modelRain||state.modelWind)&&data.model){
   const f=data.model.frames[indices.model],g=data.model.grid,r=developmentSample(f.rain,g,point.lng,point.lat),u=developmentSample(f.u,g,point.lng,point.lat),v=developmentSample(f.v,g,point.lng,point.lat);
   showPopup(point,`<h3>${esc(data.model.name)}</h3><p>${esc(date(f.start))}–${esc(date(f.time))}</p><dl><dt>ฝนสะสม 3 ชม.</dt><dd>${number(r)} มม.</dd><dt>ลมเฉลี่ยที่ 10 เมตร</dt><dd>${number(u==null||v==null?null:Math.hypot(u,v))} ม./วินาที</dd></dl><small>ค่าประมาณจากกริด 1.5° ไม่ใช่ค่าตรวจวัดที่ตำแหน่งนี้<br>${esc(data.model.name)} / Open-Meteo · ${esc(data.model.license)}</small>`);return;
  }
  originalClick?.(point);
 };
 map.gl.on('style.load',()=>renderProvinces());
 document.querySelectorAll('#layers-toggle,#display-toggle,#maptools-toggle,#basemap-toggle,.category-nav [data-view],.category-nav [data-tool]').forEach(button=>button.addEventListener('click',()=>open(false)));
 document.querySelectorAll('.category-nav [data-view]').forEach(button=>button.addEventListener('click',()=>{Object.keys(state).forEach(k=>state[k]=false);++pointRequest;stop();popup?.remove();render();}));
 setInterval(async()=>{
  if(!Object.values(state).some(Boolean))return;
  try{
   if(Object.keys(state).some(k=>state[k]&&!k.startsWith('model'))){await loadCLPP();if(state.stations){const p=(await resource('stations.json')).payload;data.stations={...p,rows:developmentStations(p)};}}
   if(state.modelRain||state.modelWind)await loadModel();
   render();
  }catch(e){status('อัปเดตไม่สำเร็จ · คงข้อมูลเดิมตามเวลาที่กำกับ');}
 },300000);
})();
