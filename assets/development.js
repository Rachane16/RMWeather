'use strict';

// Model precipitation has its own visibility and clock. Base wind stays independent.
(()=>{
 const panel=$('development-dialog'),launcher=$('development-open'),nav=$('development-nav');
 document.querySelector('.workspace').append(panel,$('development-timeline'),$('development-map-legend'),launcher);
 const state={modelRain:false};
 const data={model:null},indices={model:0};
 let source='model',timer=null,modelRequest=0,popup=null;
 const textures=new Map();
 const modelInfo={
  ecmwf_ifs:['ECMWF IFS HRES','โมเดลหลัก · ECMWF','9 กม.','6 ชั่วโมง',1.2,'ecmwf-api','แบบจำลองฟิสิกส์ความละเอียดสูง ใช้เปรียบเทียบฝน'],
  gfs_global:['GFS','โมเดลหลัก · NOAA','ประมาณ 25 กม.','6 ชั่วโมง',3,'gfs-api','แบบจำลองสหรัฐฯ สำหรับเทียบแนวโน้มฝน'],
  icon_global:['ICON','โมเดลหลัก · DWD','ประมาณ 11 กม.','6 ชั่วโมง',3,'dwd-api','แบบจำลองเยอรมนี ครอบคลุมไทยและทะเลรอบข้าง'],
  ukmo_global_deterministic_10km:['UK Met Office','โมเดลหลัก · UKMO','10 กม.','6 ชั่วโมง',3,'ukmo-api','ข้อมูลเปิดมีความหน่วงเพิ่มเติมประมาณ 4 ชั่วโมง'],
  google_weathernext3_ensemble_mean:['Google WeatherNext 3','แบบจำลอง AI · ค่าเฉลี่ย Ensemble','ประมาณ 11 กม.','6 ชั่วโมง',1.2,'google-weathernext3-api','แสดงค่าเฉลี่ยฝนจากชุดพยากรณ์ ไม่ใช่เปอร์เซ็นต์โอกาสฝน'],
  ecmwf_aifs025_single:['ECMWF AIFS','แบบจำลอง AI · ECMWF','ประมาณ 28 กม.','6 ชั่วโมง',3,'ecmwf-api','ต้นทางช่วงละ 6 ชั่วโมง แทรกค่าเป็นรายชั่วโมงโดย Open-Meteo'],
  jma_gsm:['JMA GSM','โมเดลเปรียบเทียบ · ญี่ปุ่น','ประมาณ 55 กม.','6 ชั่วโมง',3,'jma-api','ใช้ดูความแตกต่างของแนวโน้มจากโมเดลอื่น'],
  meteofrance_arpege_world:['ARPEGE','โมเดลเปรียบเทียบ · Météo-France','ประมาณ 25 กม.','6 ชั่วโมง',3,'meteofrance-api','รุ่น Global สำหรับพื้นที่ไทย ไม่ใช่ AROME ความละเอียดสูงของยุโรป'],
  cma_grapes_global:['CMA GRAPES','โมเดลเปรียบเทียบ · จีน','ประมาณ 15 กม.','6 ชั่วโมง',3,'cma-api','เปรียบเทียบฝนกับแบบจำลองระดับโลก'],
  best_match:['Open-Meteo Best Match','เลือกโมเดลอัตโนมัติ','ตามตำแหน่ง','ตามโมเดล',3,'','ผสมโมเดลที่เหมาะกับตำแหน่ง ไม่ใช่แบบจำลองอิสระอีกหนึ่งตัว']
 };
 const date=stamp=>time(new Date(stamp*1000).toISOString());
 const lag=stamp=>Math.max(0,Math.floor((Date.now()/1000-stamp)/60));
 function modelProfile(){
  const info=modelInfo[$('development-model').value];if(!info)return;$('development-time-model').value=$('development-model').value;
  $('development-model-name').textContent=info[0];$('development-model-kind').textContent=info[1];
  $('development-native-resolution').textContent=info[2];$('development-model-cycle').textContent=info[3];
  $('development-cycle-times').textContent=$('development-model').value==='best_match'?'รอบเวลาขึ้นอยู่กับโมเดลที่ต้นทางเลือก':['ecmwf_ifs','gfs_global'].includes($('development-model').value)?'รอบออกแบบจำลอง 01 / 07 / 13 / 19 น. · Asia/Bangkok':'รอบต้นทางทุก '+info[3]+' · โปรดดูเวลาพร้อมใช้งานจากต้นทาง';
  const step=data.model?.grid.step??info[4];
  $('development-grid-hint').textContent=`กริดแสดงผล ${step}° ≈ ${Math.round(step*111)} กม. · การไล่สีไม่เพิ่มความละเอียด · แตะแผนที่ดูค่าประมาณ`;
  $('development-model-description').textContent=info[6];
  $('development-model-link').href='https://open-meteo.com/en/docs'+(info[5]?'/'+info[5]:'');
 }
 function open(on){
  panel.hidden=!on;$('forecast-quick').setAttribute('aria-expanded',String(on));launcher.setAttribute('aria-expanded',String(on));nav.classList.toggle('active',state.modelRain);nav.setAttribute('aria-pressed',String(state.modelRain));
  if(on){if(!matchMedia('(max-width:700px)').matches)window.workspaceUI?.setOpen('sidebar',false);$('forecast-layer-panel').hidden=true;setWeatherTool('weather-map',false);window.workspaceUI?.closeForWeatherTool();window.workspaceUI?.setOpen('development',false);}
 }
 const mobile=()=>matchMedia('(max-width:700px)').matches;
 function dismissModelMenus(){if(!mobile())return;open(false);quickOpen(false);window.workspaceUI?.setOpen('display',false);window.workspaceUI?.setOpen('sidebar',false);}
 launcher.addEventListener('click',()=>{
  if(!mobile()){open(panel.hidden);return;}
  if(state.modelRain){selectModel($('development-model').value,false);open(false);window.workspaceUI?.setOpen('development',false);}
  else{selectModel('ecmwf_ifs');open(true);window.workspaceUI?.setOpen('sidebar',false);}
 });
 nav.addEventListener('click',async()=>{if(state.modelRain){await selectModel($('development-model').value,false);open(false);window.workspaceUI?.setOpen('development',false);nav.classList.remove('active');nav.setAttribute('aria-pressed','false');if(window.workspaceUI?.desktopWebsite())window.workspaceUI.pinCatalogue();return;}applyCategoryLayers('none');setActiveCategory(null);await selectModel('ecmwf_ifs');if(!state.modelRain)return;if(!matchMedia('(max-width:700px)').matches)open(true);else{open(false);window.workspaceUI?.setOpen('sidebar',false);}nav.classList.add('active');nav.setAttribute('aria-pressed','true');});
 const quick=$('forecast-layer-panel');
 function quickOpen(on){quick.hidden=!on;$('forecast-quick').setAttribute('aria-expanded',String(on));if(on){open(false);window.workspaceUI?.closeForWeatherTool();$('forecast-quick').setAttribute('aria-expanded','true');}}
 $('forecast-quick').addEventListener('click',()=>quickOpen(quick.hidden));$('forecast-layer-close').addEventListener('click',()=>quickOpen(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')quickOpen(false);});
 document.addEventListener('pointerdown',e=>{
  if(e.target.closest('dialog'))return;
  if(!panel.hidden&&!e.target.closest('#development-dialog,#development-open,#development-nav'))open(false);
  if(!quick.hidden&&!e.target.closest('#forecast-layer-panel,#forecast-quick'))quickOpen(false);
 });
 $('forecast-layer-list').innerHTML=[...$('development-model').options].map(o=>`<label class="forecast-option"><span>${esc(o.textContent)}</span><input type="checkbox" data-model-switch="${o.value}" aria-label="${esc(o.textContent)}"></label>`).join('');
 async function selectModel(id,on=true){source='model';state.modelRain=on;if(on){dismissModelMenus();await changeModel(id);}else{stop();++modelRequest;popup?.remove();render();dismissModelMenus();}}
 document.querySelectorAll('[data-model-preset],[data-model-switch]').forEach(button=>button.addEventListener(button.type==='checkbox'?'change':'click',()=>{const id=button.dataset.modelPreset||button.dataset.modelSwitch;selectModel(id,!(state.modelRain&&$('development-model').value===id));}));

 window.forecastLayers={activate,active:key=>key==='model'?state.modelRain:state[key],model:()=>$('development-model').value,
  clock(kind){const frames=data[kind]?.frames||[],f=frames[indices[kind]];return {name:data.model?.name||modelInfo[$('development-model').value][0],time:f?date(f.time):'กำลังโหลด',playing:source===kind&&Boolean(timer),ready:Boolean(f)};},
  togglePlayback(kind){if(kind!=='model')return;$('development-play').click();},
  step(kind,direction){if(kind!=='model')return;stop();const frames=data[kind]?.frames||[];if(frames.length)indices[kind]=(indices[kind]+direction+frames.length)%frames.length;render();}
 };
 document.querySelectorAll('#layers-toggle,#display-toggle,#maptools-toggle,#basemap-toggle,#advance-forecast-toggle,#development-nav,#development-open').forEach(b=>b.addEventListener('click',()=>quickOpen(false)));
 $('reset-layers').addEventListener('click',()=>{Object.keys(state).forEach(k=>state[k]=false);render();});$('development-close').addEventListener('click',()=>open(false));
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();open(false);if(window.workspaceUI?.desktopWebsite())window.workspaceUI.pinCatalogue();launcher.focus();}});
 async function resource(file){
  return {payload:await window.developmentAccess.json(file)};
 }
 function status(message){
  if(message){$('development-status').textContent=message;if(window.workspaceUI?.isOpen('development'))$('development-time-info').textContent=message;return;}
  const parts=[];
  if((state.modelRain)&&data.model)parts.push(`${data.model.name} · เก็บข้อมูล ${date(data.model.collected_at)}${lag(data.model.collected_at)>720?' · สำเนาเก่า':''}`);
  $('development-status').textContent=parts.join(' / ')||'เลือกชั้นข้อมูลที่ต้องการ';
  $('development-status').dataset.stale=String(Boolean(state.modelRain&&data.model&&lag(data.model.collected_at)>720));
  launcher.dataset.active=String(Object.values(state).some(Boolean));
 }
 async function loadModel(){
  const request=++modelRequest,id=$('development-model').value;
  status('กำลังโหลดกริดแบบจำลอง…');
  const result=await resource(id+'.json');
  if(request!==modelRequest)return;
  const model=result.payload;
  if(!model.grid||!model.frames?.length||model.id!==id||model.schema_version!==3||model.rain_unit!=='mm/h'||model.domain!=='Southeast Asia and surrounding seas')throw Error('ชุดข้อมูลขอบเขตใหม่ยังไม่พร้อม กรุณาลองอีกครั้ง');
  data.model=model;indices.model=developmentLatest(model.frames);render();
 }
 async function activate(key,on){
  if(key!=='modelRain')return;
  state.modelRain=on;stop();
  if(!on)popup?.remove();
  try{if(on&&!data.model)await loadModel();render();}
  catch(error){state.modelRain=false;render();status(error.message);}
 }
 document.querySelectorAll('[data-development]').forEach(input=>input.addEventListener('change',()=>activate(input.dataset.development,input.checked)));
 async function changeModel(id){
  $('development-model').value=id;$('development-time-model').value=id;
  ++modelRequest;stop();data.model=null;render();
  if(state.modelRain){try{await loadModel();}catch(e){status(e.message);}}
 }
 $('development-model').addEventListener('change',e=>selectModel(e.target.value));
 $('development-time-model').addEventListener('change',async e=>{source='model';if(!state.modelRain)state.modelRain=true;dismissModelMenus();await changeModel(e.target.value);});
 async function goCurrent(){
  stop();source='model';
  if(!state.modelRain)state.modelRain=true;
  try{
   if(!data.model)await loadModel();
   if(!data.model)return;
   const current=developmentCurrentFrame(data.model.frames);indices.model=current.index;render();
   if(!current.current)status('ไม่มีเฟรมครอบคลุมเวลาปัจจุบัน · แสดงช่วงใกล้ที่สุดตามเวลาที่กำกับ');
  }catch(error){status(error.message);}
 }
 function texture(frame,model){
  const key=model.id+model.collected_at+frame.time;if(textures.has(key))return textures.get(key);
  const g=model.grid,canvas=document.createElement('canvas');canvas.width=420;canvas.height=560;
  const c=canvas.getContext('2d'),pixels=c.createImageData(canvas.width,canvas.height);
  const south=g.north-(g.ny-1)*g.step,east=g.west+(g.nx-1)*g.step;
  const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)),n=merc(g.north),s=merc(south);
  for(let y=0;y<canvas.height;y++){
   const lat=(2*Math.atan(Math.exp(n+(s-n)*y/(canvas.height-1)))-Math.PI/2)*180/Math.PI;
   for(let x=0;x<canvas.width;x++){
    const lon=g.west+(east-g.west)*x/(canvas.width-1),mask=developmentRegionMask(g,lon,lat);if(!mask)continue;
    const value=developmentSample(frame.rain,g,lon,lat);
    const colour=developmentRainColour(value);colour[3]=Math.round(colour[3]*mask);if(!colour[3])continue;
    const i=(y*canvas.width+x)*4;
    for(let k=0;k<4;k++)pixels.data[i+k]=colour[k];
   }
  }
  c.putImageData(pixels,0,0);const result={image_url:canvas.toDataURL(),bounds:[[south,g.west],[g.north,east]]};
  if(textures.size>30)textures.clear();textures.set(key,result);return result;
 }
 function render(){
  modelProfile();nav.classList.toggle('active',state.modelRain);nav.setAttribute('aria-pressed',String(state.modelRain));
  document.querySelectorAll('[data-development]').forEach(i=>i.checked=state[i.dataset.development]);
  const model=data.model,frame=model?.frames[indices.model];
  map.setRain(state.modelRain&&frame?texture(frame,model):null,'development-model');
  renderClock();status();syncForecastCards();window.syncLayerMenu?.();window.syncTimelineUI?.();
 }
 function syncForecastCards(){
  document.querySelectorAll('[data-model-preset],[data-model-switch],[data-forecast-layer]').forEach(b=>{const id=b.dataset.modelPreset||b.dataset.modelSwitch,key=b.dataset.forecastLayer,on=id?state.modelRain&&$('development-model').value===id:Boolean(state[key]);if(b.type==='checkbox')b.checked=on;else b.setAttribute('aria-pressed',String(on));b.closest('.layer-card')?.classList.toggle('is-active',on);});
 }
 function showPopup(point,html){popup?.remove();popup=new maplibregl.Popup({className:'development-popup',maxWidth:'285px',closeOnClick:true}).setLngLat(point).setHTML(html).addTo(map.gl);return popup;}
 function renderClock(){
  const modelOn=state.modelRain;
  $('development-clock-title').textContent='แบบจำลองพยากรณ์';
  $('development-time-model').closest('label').hidden=source!=='model';
  const active=modelOn,frames=active?data[source]?.frames||[]:[],index=indices[source],f=frames[index];
  $('development-slider').max=Math.max(0,frames.length-1);$('development-slider').value=index;
  $('development-play').disabled=!frames.length;$('development-slider').disabled=!frames.length;
  $('development-time').textContent=f?date(f.time):'เลือกชุดข้อมูล';
  $('development-mini-time').textContent=f?date(f.time):'—';if(f)$('development-mini-time').dateTime=new Date(f.time*1000).toISOString();else $('development-mini-time').removeAttribute('datetime');
  $('development-frame-count').textContent=f?`${index+1} / ${frames.length} เฟรม`:'ยังไม่มีเฟรม';
  if($('development-time-summary'))$('development-time-summary').textContent=f?`${data.model.name} · ${date(f.time)}`:'เลือกแบบจำลอง';
  $('development-time-info').textContent=!f?'เลือกแบบจำลองเพื่อเลือกช่วงเวลา':`${date(f.start)}–${date(f.time)} · อัตราฝนเฉลี่ย 3 ชม.`;
  $('development-credit').textContent=data.model?`${data.model.name} / Open-Meteo · ${data.model.license} · กริด ${data.model.grid.step}° · แคช 12 ชม.`:'';
  window.renderPrecipitationLegend?.({modelOn:state.modelRain,model:data.model,source});
 }
 function stop(){if(timer)clearInterval(timer);timer=null;window.syncPlaybackDock?.();$('development-play').textContent='▶';$('development-play').setAttribute('aria-label','เล่นข้อมูลพยากรณ์');}
 $('development-slider').addEventListener('input',e=>{indices[source]=Number(e.target.value);render();});
 $('development-play').addEventListener('click',()=>{
  if(timer){stop();return;}
  window.workspaceUI?.minimize('development',true);
  $('development-play').textContent='Ⅱ';$('development-play').setAttribute('aria-label','หยุดข้อมูลพยากรณ์');
  window.syncPlaybackDock?.();timer=setInterval(()=>{const frames=data[source]?.frames||[];if(document.hidden||!frames.length)return;indices[source]=(indices[source]+1)%frames.length;render();},1100);window.syncPlaybackDock?.();
 });
 window.addEventListener('development-clock-open',()=>{if(window.workspaceUI?.isOpen('development')){open(false);quickOpen(false);if(!state.modelRain)selectModel('ecmwf_ifs');else{source='model';renderClock();}}});
 const originalClick=map.onMapClick;
 map.onMapClick=point=>{
  if((state.modelRain)&&data.model&&developmentRegionMask(data.model.grid,point.lng,point.lat)>0){
   const f=data.model.frames[indices.model],g=data.model.grid,r=developmentSample(f.rain,g,point.lng,point.lat);
   showPopup(point,`<h3>${esc(data.model.name)}</h3><p>${esc(date(f.start))}–${esc(date(f.time))}</p><dl><dt>อัตราฝนเฉลี่ย 3 ชม.</dt><dd>${number(r)} mm/h</dd><dt>ฝนสะสมในช่วง 3 ชม.</dt><dd>${number(r==null?null:r*3)} มม.</dd></dl>`);return;
  }
  originalClick?.(point);
 };
 document.querySelector('.workspace').dataset.developmentMode='true';
 $('development-timeline-toggle').hidden=false;
 document.querySelectorAll('#layers-toggle,#display-toggle,#maptools-toggle,#basemap-toggle,.category-nav [data-view],.category-nav [data-tool]').forEach(button=>button.addEventListener('click',()=>open(false)));
 document.querySelectorAll('.category-nav [data-view]').forEach(button=>button.addEventListener('click',()=>{Object.keys(state).forEach(k=>state[k]=false);++modelRequest;stop();popup?.remove();render();}));
 setInterval(async()=>{
  if(!Object.values(state).some(Boolean))return;
  try{
   if(state.modelRain)await loadModel();
   render();
  }catch(e){status('อัปเดตไม่สำเร็จ · คงข้อมูลเดิมตามเวลาที่กำกับ');}
 },300000);
 modelProfile();renderClock();
})();
