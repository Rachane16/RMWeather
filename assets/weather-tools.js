'use strict';

const toolVisibility = {'weather-map':false,'seven-day':false};
let forecastSource='tmd';
let windyZoom=8;
let windyLocation={lat:7.19,lon:100.59,name:'สงขลา'};
function setWeatherTool(name,on) {
  // Use a single readable workspace for embeds; these do not replace RM layers.
  if(on)Object.keys(toolVisibility).filter(key=>key!==name).forEach(key=>setWeatherTool(key,false));
  toolVisibility[name]=on;
  $(`${name}-panel`).hidden=!on;
  document.querySelectorAll(`[data-tool="${name}"]`).forEach(button=>button.setAttribute('aria-pressed',String(on)));
  document.querySelectorAll(`[data-tool-toggle="${name}"]`).forEach(input=>input.checked=on);
  if(on){window.workspaceUI?.closeForWeatherTool();if(name==='weather-map'){const p=window.currentLocation||{lat:map.getCenter().lat,lon:map.getCenter().lng};windyLocation={lat:p.lat,lon:p.lon};windyZoom=10;if(!window.locationPending)requestCurrentLocation();}closeLayerDrawer();$(`${name}-panel`).scrollTop=0;updateWeatherEmbeds();}
  else if(name==='weather-map')$('windy-frame').removeAttribute('src');
  else $('tmd-frame').removeAttribute('src');
}
function assignFrame(id,url) {if($(id).getAttribute('src')!==url)$(id).src=url;}
function updateWeatherLocationNote(){
  $('windy-location-note').textContent=window.currentLocation?'ตำแหน่งปัจจุบันของคุณ · Windy':window.locationPending?'กำลังค้นหาตำแหน่งปัจจุบัน…':'ตำแหน่งสำรองบนแผนที่หลัก · อนุญาตสิทธิ์เพื่อใช้ตำแหน่งปัจจุบัน';
}
window.updateWeatherLocationNote=updateWeatherLocationNote;
function updateWeatherEmbeds() {
  updateWeatherLocationNote();
  const p=windyLocation;
  if(toolVisibility['weather-map']){
    const query=new URLSearchParams({lat:p.lat.toFixed(4),lon:p.lon.toFixed(4),detailLat:p.lat.toFixed(4),detailLon:p.lon.toFixed(4),zoom:windyZoom,level:'surface',overlay:$('windy-overlay').value,type:'map',location:'coordinates',metricWind:'km/h',metricTemp:'°C',metricRain:'mm'});
    assignFrame('windy-frame',`https://embed.windy.com/embed2.html?${query}`);
    $('windy-open').href=`https://www.windy.com/?${p.lat.toFixed(3)},${p.lon.toFixed(3)},9`;
  }
  if(toolVisibility['seven-day']&&forecastSource==='tmd'){
    const url=`https://www.tmd.go.th/weatherForecast7DaysWidget?province=${encodeURIComponent($('tmd-province').value)}`;
    assignFrame('tmd-frame',url);$('tmd-open').href=url;
  }
}
window.updateWeatherEmbeds=updateWeatherEmbeds;
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

window.addEventListener('rm-current-location',event=>{windyLocation=event.detail;windyZoom=10;updateWeatherEmbeds();});
