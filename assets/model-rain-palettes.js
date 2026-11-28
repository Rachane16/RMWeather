'use strict';

// Versioned display configuration only. Forecast grids keep their original values.
const ModelRainPalettes=(()=>{
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const mix=(low,high,w)=>low.map((v,i)=>Math.round(v+(high[i]-v)*w));
 const rgb=colour=>`rgb(${colour.join(',')})`;
 function createRegistry(config){
  if(config?.schema_version!==1||!config.profiles?.[config.active_profile])throw Error('เกณฑ์สีแบบจำลองไม่พร้อม');
  const profiles=freeze(JSON.parse(JSON.stringify(config.profiles))),id=config.active_profile,p=profiles[id];
  if(p.unit!=='mm/h'||p.statistic!=='preceding_3h_mean'||!['bands','continuous'].includes(p.mode))throw Error('หน่วยเกณฑ์สีแบบจำลองไม่ตรงกับข้อมูล');
  if(!Number.isFinite(p.minimum_visible_rate)||!p.alpha||p.alpha.full_at<=0)throw Error('เกณฑ์ความโปร่งใสแบบจำลองไม่ถูกต้อง');
  if(p.mode==='bands'&&(!p.bands?.length||p.bands.at(-1).max!==null||p.bands.some((b,i)=>b.colours?.length!==2||!b.colours.every(c=>c.length===3&&c.every(v=>Number.isFinite(v)&&v>=0&&v<=255))||i<p.bands.length-1&&(!Number.isFinite(b.max)||b.max<=(i?p.bands[i-1].max:p.minimum_visible_rate)))))throw Error('ช่วงเกณฑ์สีแบบจำลองไม่ถูกต้อง');
  if(p.mode==='continuous'&&(!p.stops?.length||p.stops.some((s,i)=>s.length!==4||s.some(v=>!Number.isFinite(v))||i>0&&s[0]<=p.stops[i-1][0])))throw Error('ช่วงเกณฑ์สีเดิมไม่ถูกต้อง');
  const factor=quantity=>{if(quantity==='mean_3h_rate')return 1;if(quantity==='accum_3h')return 3;throw Error('ชนิดข้อมูลฝนไม่รองรับ');};
  function colour(value,quantity='mean_3h_rate'){
   const rate=value/factor(quantity);
   if(value==null||!Number.isFinite(value)||rate<=0||rate<p.minimum_visible_rate)return [0,0,0,0];
   let result;
   if(p.mode==='continuous'){
    let hi=p.stops.findIndex(s=>s[0]>=rate);if(hi<0)hi=p.stops.length-1;
    const low=p.stops[Math.max(0,hi-1)],high=p.stops[hi],w=hi===0?0:Math.min(1,(rate-low[0])/(high[0]-low[0]));
    result=mix(low.slice(1),high.slice(1),w);
   }else{
    const i=p.bands.findIndex(b=>b.max===null||rate<=b.max),band=p.bands[i],low=i?p.bands[i-1].max:p.minimum_visible_rate;
    const w=band.max===null?0:Math.max(0,Math.min(1,(rate-low)/(band.max-low)));
    result=mix(...band.colours,w);
   }
   return result.concat(Math.round(p.alpha.base+p.alpha.range*Math.min(1,rate/p.alpha.full_at)));
  }
  function legend(name,quantity='mean_3h_rate'){
   const multiplier=factor(quantity),unit=multiplier===1?'mm/h':'mm/3h',label=name+' · '+(multiplier===1?'อัตราฝนเฉลี่ย 3 ชม.':'ฝนสะสม 3 ชม.');
   if(p.mode==='continuous')return {profile:id,label,unit,stops:p.stops.map(s=>rgb(s.slice(1))),ticks:p.stops.map(s=>String(s[0]*multiplier))};
   return {profile:id,label:label+' · เกณฑ์อัตราฝน TMD',unit,
    stops:p.bands.flatMap((b,i)=>b.colours.map((c,j)=>`${rgb(c)} ${(i+j)/p.bands.length*100}%`)),
    ticks:p.bands.map(b=>b.label),secondary:p.bands.map((b,i)=>{const format=v=>Number((v*multiplier).toFixed(6)),low=format(i?p.bands[i-1].max:p.minimum_visible_rate);return (i?'>':'')+low+(b.max===null?'':'–'+format(b.max));})};
  }
  return Object.freeze({id,profile:p,profiles,colour,legend});
 }
 let registry=typeof module!=='undefined'?createRegistry(require('../data/config/model-rain-palettes.json')):null,pending;
 async function ready(){
  if(registry)return registry;
  if(!pending)pending=(async()=>{
   const response=await fetch(new URL('data/config/model-rain-palettes.json',document.baseURI),{cache:'no-cache',credentials:'omit',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('โหลดเกณฑ์สีแบบจำลองไม่สำเร็จ');
   registry=createRegistry(await response.json());return registry;
  })().catch(error=>{pending=null;throw error;});
  return pending;
 }
 const current=()=>{if(!registry)throw Error('ยังไม่ได้โหลดเกณฑ์สีแบบจำลอง');return registry;};
 return Object.freeze({ready,createRegistry,colour:(...args)=>current().colour(...args),legend:(...args)=>current().legend(...args),id:()=>current().id});
})();
if(typeof module!=='undefined')module.exports=ModelRainPalettes;
