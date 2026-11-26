'use strict';

const windyLayers=[
  {id:'radar',name:'เรดาร์ฝน · ตรวจวัด',product:'radar',group:'ตรวจวัด'},
  {id:'satellite',name:'ดาวเทียม',product:'satellite',group:'ตรวจวัด'},
  {id:'rain',name:'ฝนและฟ้าคะนอง · พยากรณ์',product:'ecmwf',group:'พยากรณ์'},
  {id:'rainAccu',name:'ปริมาณฝนสะสม · พยากรณ์',product:'ecmwf',group:'พยากรณ์'},
  {id:'wind',name:'ลมพยากรณ์',product:'ecmwf',group:'พยากรณ์'},
  {id:'gust',name:'ลมกระโชก',product:'ecmwf',group:'พยากรณ์'},
  {id:'temp',name:'อุณหภูมิ',product:'ecmwf',group:'พยากรณ์'},
  {id:'clouds',name:'เมฆ',product:'ecmwf',group:'พยากรณ์'},
  {id:'rh',name:'ความชื้น',product:'ecmwf',group:'พยากรณ์'},
  {id:'dewpoint',name:'จุดน้ำค้าง',product:'ecmwf',group:'พยากรณ์'},
  {id:'visibility',name:'ทัศนวิสัย',product:'ecmwf',group:'พยากรณ์'},
  {id:'pressure',name:'ความกดอากาศ',product:'ecmwf',group:'พยากรณ์'},
];
const windyHatyai={lat:7.0084,lon:100.4767,name:'หาดใหญ่',source:'hatyai'};
function validWindyPoint(point){return Boolean(point&&Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat)<=85&&Math.abs(point.lon)<=180);}

class WindyPointSelection{
  constructor(){this.mode='device';this.point={...windyHatyai};}
  select(mode,point){
    if(!['device','map','hatyai'].includes(mode))return false;
    if(mode==='hatyai'){this.mode=mode;this.point={...windyHatyai};return true;}
    this.mode=mode;
    if(validWindyPoint(point)){
      this.point={lat:point.lat,lon:point.lon,source:mode,name:mode==='device'?'ตำแหน่งอุปกรณ์':'กลางแผนที่หลัก',
        accuracy:Number.isFinite(point.accuracy)?point.accuracy:null,timestamp:point.timestamp??null};
      return true;
    }
    // Device permission/lookup failure has an explicit, stable fallback.
    if(mode==='device')this.point={...windyHatyai};
    return false;
  }
  receiveFix(fix){if(this.mode!=='device'||!validWindyPoint(fix))return false;return this.select('device',fix);}
}

function buildWindyEmbedURL({point,view='map',overlay='radar',zoom=10}){
  if(!validWindyPoint(point))throw new Error('Invalid Windy coordinates');
  if(!['map','map-forecast','forecast'].includes(view))throw new Error('Invalid Windy view');
  const layer=windyLayers.find(layer=>layer.id===overlay)||windyLayers[0];
  const query=new URLSearchParams({type:view==='forecast'?'forecast':'map',location:'coordinates',
    detailLat:point.lat.toFixed(5),detailLon:point.lon.toFixed(5),metricWind:'km/h',metricTemp:'°C',metricRain:'mm'});
  if(view!=='map')query.set('detail','true');
  if(view!=='forecast'){
    Object.entries({lat:point.lat.toFixed(5),lon:point.lon.toFixed(5),zoom:Math.max(3,Math.min(12,zoom)),
      level:'surface',overlay:layer.id,product:layer.product,marker:'true',message:'true'}).forEach(([key,value])=>query.set(key,value));
  }
  return 'https://embed.windy.com/embed.html?'+query;
}
if(typeof module!=='undefined')module.exports={windyLayers,windyHatyai,validWindyPoint,WindyPointSelection,buildWindyEmbedURL};
