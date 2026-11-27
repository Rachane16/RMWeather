'use strict';

// Source-specific keys. Never label accumulated rain or lightning with dBZ.
function precipitationKey(kind,product,forecast){
 if(forecast?.modelOn&&forecast.model&&forecast.source==='model')return {label:forecast.model.name+' · อัตราฝนเฉลี่ย 3 ชม.',unit:'mm/h',stops:DEVELOPMENT_RAIN_STOPS.map(s=>`rgb(${s.slice(1).join(',')})`),ticks:['0','0.6','3','12','50','200']};
 if(forecast?.clppOn&&forecast.source==='clpp'){
  const c=forecast.clpp;
  if(c?.levels_rgb?.length)return {label:'CLPP / TMD · Radar Composite · อัตราฝนเทียบจากเรดาร์',unit:'mm/h',stops:c.levels_rgb.map(v=>`rgb(${v.join(',')})`),ticks:[0,Math.floor(c.levels_mm_hr.length/4),Math.floor(c.levels_mm_hr.length/2),Math.floor(c.levels_mm_hr.length*3/4),c.levels_mm_hr.length-1].map(i=>String(c.levels_mm_hr[i]))};
 }
 if(kind==='rainviewer')return {label:'RainViewer · Universal Blue · การสะท้อนเรดาร์',unit:'dBZ',stops:['#a8e6f2','#77bdd9','#7696b0','#f8f8a0','#ffbd8b','#ff9fdf'],ticks:['15','25','35','45','55+']};
 if(kind==='radargis'&&!['dbz','dbz-nowcast'].includes(product?.id))return {label:(product?.label||'TMD RADARGIS')+' · โปรดอ่านเกณฑ์สีจากต้นทาง',unit:product?.unit||'',stops:[],ticks:[]};
 if(['radargis','rod','radar'].includes(kind)||forecast?.clppOn)return {label:'Radar Composite · dBZ / อัตราฝนเทียบ mm/h',unit:'dBZ',stops:['#00b900','#00ed00','#a5ff00','#ffff00','#ffc000','#ff6000','#ff0000','#c00060','#ff00ff','#ffb0ff','#f1e4f1'],ticks:['10.4','19','29','39','49','59','66.5'],secondary:['0.21','0.72','3','12.5','52.2','217.9','636 mm/h']};
 return null;
}
if(typeof window!=='undefined'){
 let forecast={};
 window.renderPrecipitationLegend=next=>{
  if(next)forecast=next;
  const active=typeof rainVisibility!=='undefined'&&rainVisibility[radarKind],kind=active?radarKind:null;
  const key=precipitationKey(kind,kind==='radargis'?currentRadarGISProduct():null,forecast),root=$('development-map-legend');
  root.hidden=!key;if(!key)return;
  root.setAttribute('aria-label',key.label);$('development-legend-label').textContent=key.label;
  $('development-scale').style.background=key.stops.length?`linear-gradient(90deg,${key.stops.join(',')})`:'none';
  $('development-scale').hidden=!key.stops.length;
  $('development-scale-unit').textContent=key.unit;
  $('development-scale-labels').innerHTML=key.ticks.map((t,i)=>`<span>${t}${key.secondary?`<small>${key.secondary[i]}</small>`:''}</span>`).join('');
 };
 window.renderPrecipitationLegend();
}
if(typeof module!=='undefined')module.exports={precipitationKey};
