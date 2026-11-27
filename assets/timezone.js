'use strict';
const RM_TIMEZONE='Asia/Bangkok';
function bangkokDate(value){
 if(value instanceof Date)return new Date(value.getTime());
 if(typeof value==='string'){
  value=value.trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))value+='T00:00:00+07:00';
  else if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value))value=value.replace(' ','T')+'+07:00';
 }
 return new Date(value==null||value===''?NaN:value);
}
function bangkokTime(value){const d=bangkokDate(value);return Number.isFinite(d.getTime())?d.toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:RM_TIMEZONE}):'ไม่ทราบเวลา';}
if(typeof module!=='undefined')module.exports={RM_TIMEZONE,bangkokDate,bangkokTime};
