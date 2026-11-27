'use strict';

// Source-specific keys. Never label accumulated rain or lightning with dBZ.
function precipitationKey(kind,product,forecast){
 if(forecast?.modelOn&&forecast.model&&forecast.source==='model')return {label:forecast.model.name+' · อัตราฝนเฉลี่ย 3 ชม.',unit:'mm/h',stops:DEVELOPMENT_RAIN_STOPS.map(s=>`rgb(${s.slice(1).join(',')})`),ticks:['0','0.6','3','12','50','200']};
 if(forecast?.clppOn&&forecast.source==='clpp'){
  const c=forecast.clpp;
  if(c?.levels_rgb?.length){
   return {label:'CLPP / TMD · เรดาร์และ Nowcast · ระดับสีต้นทาง',unit:'',stops:c.levels_rgb.map(v=>`rgb(${v.join(',')})`),ticks:['ฝนอ่อน','ปานกลาง','ฝนหนัก','หนักมาก']};
  }
 }
 if(kind==='nowcast')return {label:'SWIRLS · พยากรณ์ฝนจากเรดาร์ · ระดับสีต้นทาง',unit:'',stops:['#00b900','#00ed00','#a5ff00','#ffff00','#ffc000','#ff6000','#ff0000','#c00060','#ff00ff'],ticks:['ฝนอ่อน','ปานกลาง','ฝนหนัก','หนักมาก']};
 if(kind==='rainviewer')return {label:'RainViewer · Universal Blue · การสะท้อนเรดาร์',unit:'dBZ',stops:['#a8e6f2','#77bdd9','#7696b0','#f8f8a0','#ffbd8b','#ff9fdf'],ticks:['15','25','35','45','55+']};
 if(kind==='radargis'&&!['dbz','dbz-nowcast'].includes(product?.id))return {label:(product?.label||'TMD RADARGIS')+' · โปรดอ่านเกณฑ์สีจากต้นทาง',unit:product?.unit||'',stops:[],ticks:[]};
 if(['radargis','rod','radar'].includes(kind)||forecast?.clppOn)return {label:({radargis:'TMD RADARGIS',rod:'RODDSS',radar:'TMD · เรดาร์ฝน'}[kind]||'CLPP / TMD')+' · ระดับสีต้นทาง',unit:'',stops:['#00b900','#00ed00','#a5ff00','#ffff00','#ffc000','#ff6000','#ff0000','#c00060','#ff00ff','#ffb0ff','#f1e4f1'],ticks:['ฝนอ่อน','ปานกลาง','ฝนหนัก','หนักมาก']};
 return null;
}
if(typeof window!=='undefined'){
 let forecast={};
 window.renderPrecipitationLegend=next=>{
  if(next)forecast={...forecast,...next};
  const active=typeof rainVisibility!=='undefined'&&rainVisibility[radarKind],kind=active?radarKind:null;
  const key=precipitationKey(kind,kind==='radargis'?currentRadarGISProduct():null,forecast),root=$('development-map-legend');
  root.hidden=!key;if(!key)return;
  root.setAttribute('aria-label',key.label);$('development-legend-label').textContent=key.label;
  $('development-scale').style.background=key.stops.length?`linear-gradient(90deg,${key.stops.join(',')})`:'none';
  $('development-scale').hidden=!key.stops.length;
  $('development-scale-unit').textContent=key.unit;
  $('development-scale-labels').replaceChildren(...key.ticks.map((t,i)=>{const span=document.createElement('span');span.textContent=t;if(key.secondary){const small=document.createElement('small');small.textContent=key.secondary[i];span.append(small);}return span;}));
 };
 window.renderPrecipitationLegend();
}
if(typeof module!=='undefined')module.exports={precipitationKey};
