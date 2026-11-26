'use strict';

const toolVisibility = {'weather-map':false,'seven-day':false};
let forecastSource='tmd';
let windyZoom=8;
let windyView='map';
const windySelection=new WindyPointSelection();
let windyLocation=windySelection.point;
function setWeatherTool(name,on) {
  // Use a single readable workspace for embeds; these do not replace RM layers.
  if(on)Object.keys(toolVisibility).filter(key=>key!==name).forEach(key=>setWeatherTool(key,false));
  toolVisibility[name]=on;
  $(`${name}-panel`).hidden=!on;
  document.querySelectorAll(`[data-tool="${name}"]`).forEach(button=>button.setAttribute('aria-pressed',String(on)));
  document.querySelectorAll(`[data-tool-toggle="${name}"]`).forEach(input=>input.checked=on);
  if(on){window.workspaceUI?.closeForWeatherTool();if(name==='weather-map'){
    if(windySelection.mode==='device')windySelection.select('device',window.currentLocation);
    windyLocation=windySelection.point;windyZoom=10;
    if(windySelection.mode==='device'&&!window.locationPending)requestCurrentLocation(true);
  }closeLayerDrawer();$(`${name}-panel`).scrollTop=0;updateWeatherEmbeds();}
  else if(name==='weather-map')$('windy-frame').removeAttribute('src');
  else $('tmd-frame').removeAttribute('src');
}
function assignFrame(id,url) {if($(id).getAttribute('src')!==url)$(id).src=url;}
function updateWeatherLocationNote(){
  windyLocation=windySelection.point;
  const p=windyLocation,pending=windySelection.mode==='device'&&window.locationPending;
  let note=pending?'กำลังค้นหาตำแหน่งอุปกรณ์ · ใช้จุดที่ระบุด้านบนระหว่างรอ':p.source==='device'?'ตำแหน่งจากอุปกรณ์':p.source==='map'?'จุดที่เลือกจากกลางแผนที่หลัก':'จุดที่กำหนด: หาดใหญ่';
  if(windySelection.mode==='device'&&p.source!=='device'&&!pending)note='เข้าถึงตำแหน่งอุปกรณ์ไม่ได้ · ใช้หาดใหญ่เป็นจุดสำรอง';
  if(p.source==='device'){
    if(p.accuracy!=null)note+=p.accuracy>=1000?` · คลาดเคลื่อนประมาณ ${(p.accuracy/1000).toLocaleString('th-TH',{maximumFractionDigits:1})} กม.`:` · คลาดเคลื่อนประมาณ ${Math.round(p.accuracy)} ม.`;
    else note+=' · อุปกรณ์ไม่รายงานความแม่นยำ';
    if(p.accuracy>5000)note+=' · เลือกกลางแผนที่หรือหาดใหญ่เพื่อกำหนดจุดเอง';
    if(window.locationError)note+=' · ใช้พิกัดครั้งก่อน (อัปเดตตำแหน่งไม่ได้)';
    else if(p.timestamp&&Date.now()-p.timestamp>600000)note+=' · เป็นตำแหน่งครั้งก่อน';
  }
  $('windy-location-note').textContent=note;
  $('windy-place-name').textContent=p.name;
  $('windy-coordinates').textContent=`${Math.abs(p.lat).toFixed(4)}°${p.lat<0?'S':'N'}, ${Math.abs(p.lon).toFixed(4)}°${p.lon<0?'W':'E'}`;
  document.querySelectorAll('[data-windy-location]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.windyLocation===windySelection.mode)));
}
window.updateWeatherLocationNote=updateWeatherLocationNote;
function updateWeatherEmbeds() {
  updateWeatherLocationNote();
  const p=windyLocation;
  if(toolVisibility['weather-map']){
    $('weather-map-panel').dataset.windyView=windyView;
    $('windy-view').value=windyView;
    $('windy-overlay-row').hidden=windyView==='forecast';
    $('windy-point-toggle-row').hidden=windyView==='forecast';
    $('windy-point-toggle').checked=windyView==='map-forecast';
    assignFrame('windy-frame',buildWindyEmbedURL({point:p,view:windyView,overlay:$('windy-overlay').value,zoom:windyZoom}));
    $('windy-open').href=`https://www.windy.com/?${p.lat.toFixed(3)},${p.lon.toFixed(3)},9`;
  }
  if(toolVisibility['seven-day']&&forecastSource==='tmd'){
    const url=`https://www.tmd.go.th/weatherForecast7DaysWidget?province=${encodeURIComponent($('tmd-province').value)}`;
    assignFrame('tmd-frame',url);$('tmd-open').href=url;
  }
}
window.updateWeatherEmbeds=updateWeatherEmbeds;
$('windy-overlay').innerHTML=[...new Set(windyLayers.map(layer=>layer.group))].map(group=>`<optgroup label="${group}">${windyLayers.filter(layer=>layer.group===group).map(layer=>`<option value="${layer.id}">${layer.name}</option>`).join('')}</optgroup>`).join('');
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>setWeatherTool(button.dataset.tool,!toolVisibility[button.dataset.tool])));
document.querySelectorAll('[data-tool-toggle]').forEach(input=>input.addEventListener('change',()=>setWeatherTool(input.dataset.toolToggle,input.checked)));
document.querySelectorAll('[data-close-tool]').forEach(button=>button.addEventListener('click',()=>setWeatherTool(button.dataset.closeTool,false)));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>Object.keys(toolVisibility).forEach(name=>setWeatherTool(name,false))));
document.querySelectorAll('[data-forecast-source]').forEach(button=>button.addEventListener('click',()=>{
  forecastSource=button.dataset.forecastSource;
  document.querySelectorAll('[data-forecast-source]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  $('seven-day-model').hidden=forecastSource!=='model';$('seven-day-tmd').hidden=forecastSource!=='tmd';
  if(forecastSource!=='tmd')$('tmd-frame').removeAttribute('src');
  updateWeatherEmbeds();
}));
$('windy-overlay').addEventListener('change',updateWeatherEmbeds);
$('windy-view').addEventListener('change',event=>{windyView=event.target.value;updateWeatherEmbeds();});
$('windy-point-toggle').addEventListener('change',event=>{windyView=event.target.checked?'map-forecast':'map';updateWeatherEmbeds();});
document.querySelectorAll('[data-windy-location]').forEach(button=>button.addEventListener('click',()=>{
  const mode=button.dataset.windyLocation;
  const center=mode==='map'?map.getCenter():null;
  windySelection.select(mode,mode==='device'?window.currentLocation:mode==='map'?{lat:center.lat,lon:center.lng}:null);
  windyLocation=windySelection.point;windyZoom=10;
  if(mode==='device'&&!window.locationPending)requestCurrentLocation(true);
  updateWeatherEmbeds();
}));
$('windy-back-main').addEventListener('click',()=>setWeatherTool('weather-map',false));
$('tmd-province').addEventListener('change',updateWeatherEmbeds);
$('terrain-toggle').addEventListener('click',()=>{
  map.setTerrain(!map.terrain);$('terrain-toggle').setAttribute('aria-pressed',String(map.terrain));
  $('terrain-toggle').innerHTML=map.terrain?'3D <span>/ 2D</span>':'2D <span>/ 3D</span>';
});
$('map-pitch').addEventListener('input',event=>map.gl.setPitch(Number(event.target.value)));
$('map-north').addEventListener('click',()=>map.gl.easeTo({bearing:0,duration:500}));
$('zoom-in').addEventListener('click',()=>map.gl.zoomIn());
$('zoom-out').addEventListener('click',()=>map.gl.zoomOut());
map.gl.on('move',()=>{
  $('map-pitch').value=Math.round(map.gl.getPitch());$('pitch-value').value=`${Math.round(map.gl.getPitch())}°`;
  $('bearing-value').textContent=`${Math.round(map.gl.getBearing())}°`;
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')Object.keys(toolVisibility).forEach(name=>setWeatherTool(name,false));});
$('reset-layers').addEventListener('click',()=>Object.keys(toolVisibility).forEach(name=>setWeatherTool(name,false)));

$('tmd-frame').addEventListener('load',()=>{if(toolVisibility['seven-day'])$('seven-day-panel').scrollTop=0;});

window.addEventListener('rm-current-location',event=>{
  if(windySelection.receiveFix({...event.detail,...window.currentLocation})){windyLocation=windySelection.point;windyZoom=10;updateWeatherEmbeds();}
});
