'use strict';

// Source-specific keys. Never label accumulated rain or lightning with dBZ.
function precipitationKey(kind,product,forecast){
 if(forecast?.modelOn&&forecast.model&&forecast.source==='model')return {label:forecast.model.name+' · อัตราฝนเฉลี่ย 3 ชม.',unit:'mm/h',stops:DEVELOPMENT_RAIN_STOPS.map(s=>`rgb(${s.slice(1).join(',')})`),ticks:['0','0.6','3','12','50','200']};
 if(forecast?.clppOn&&forecast.source==='clpp'){
  const c=forecast.clpp;
  if(c?.levels_rgb?.length){
   const samples=[0,Math.floor(c.levels_mm_hr.length/4),Math.floor(c.levels_mm_hr.length/2),Math.floor(c.levels_mm_hr.length*3/4),c.levels_mm_hr.length-1],mm=samples.map(i=>String(c.levels_mm_hr[i]));
   const rates=[.21,.24,.5,.72,1.03,1.47,2.1,3,4.29,6.13,8.76,12.5,17.9,25.6,36.5,52.2,74.6,106.7,152.5,217.9,311.4,445,636],dbz=[10.4,11.3,16.5,19,21.5,24,26.5,29,31.5,34,36.5,39,41.5,44,46.5,49,51.5,54,56.5,59,61.5,64,66.5];
   const matched=mm.map(v=>dbz[rates.indexOf(Number(v))]),dual=matched.every(Number.isFinite);
   return {label:'CLPP / TMD · Radar Composite · dBZ / อัตราฝนเทียบ mm/h',unit:dual?'dBZ':'mm/h',stops:c.levels_rgb.map(v=>`rgb(${v.join(',')})`),ticks:dual?matched:mm,secondary:dual?mm:undefined};
  }
 }
 if(kind==='rainviewer')return {label:'RainViewer · Universal Blue · การสะท้อนเรดาร์',unit:'dBZ',stops:['#a8e6f2','#77bdd9','#7696b0','#f8f8a0','#ffbd8b','#ff9fdf'],ticks:['15','25','35','45','55+']};
 if(kind==='radargis'&&!['dbz','dbz-nowcast'].includes(product?.id))return {label:(product?.label||'TMD RADARGIS')+' · โปรดอ่านเกณฑ์สีจากต้นทาง',unit:product?.unit||'',stops:[],ticks:[]};
 if(['radargis','rod','radar'].includes(kind)||forecast?.clppOn)return {label:'Radar Composite · dBZ / อัตราฝนเทียบ mm/h',unit:'dBZ',stops:['#00b900','#00ed00','#a5ff00','#ffff00','#ffc000','#ff6000','#ff0000','#c00060','#ff00ff','#ffb0ff','#f1e4f1'],ticks:['10.4','19','29','39','49','59','66.5'],secondary:['0.21','0.72','3','12.5','52.2','217.9','636 mm/h']};
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
