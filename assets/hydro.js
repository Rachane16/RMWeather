'use strict';

const hydroText = value => value && typeof value === 'object' ? (value.th || value.en || '') : (value ?? '');
const hydroNumber = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
function thaiwaterTime(value){
  if(!value)return null;
  // ThaiWater's unzoned station timestamps are ICT, regardless of viewer timezone.
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(value)?value.replace(' ','T')+'+07:00':value;
}
function normalizeNationalData(payload, kind) {
  let rows;
  if (kind === 'dam') {
    const root = payload.data || payload.dam_data || payload;
    const buckets = [root.dam_hourly, root.dam_daily].filter(Array.isArray);
    rows = buckets.length ? buckets.flat() : (Array.isArray(root) ? root : []);
    const latest = new Map();
    for (const row of rows) {
      const key = row.dam?.id ?? row.dam_id ?? row.id;
      const previous = latest.get(key);
      if (!previous || String(row.dam_date || '') > String(previous.dam_date || '')) latest.set(key, row);
    }
    rows = [...latest.values()];
  } else {
    const candidates = kind === 'thaiwater'
      ? [payload.waterlevel_data?.data, payload.data, payload.waterlevel_data]
      : [payload.rainfall_data?.data, payload.rain_data?.data, payload.data];
    rows = candidates.find(Array.isArray) || [];
  }
  const scales=payload.scale?.data?.scale||[];
  return rows.map((row, index) => {
    const station=row.station||{},dam=row.dam||{},geocode=row.geocode||{};
    const msl=hydroNumber(row.waterlevel_msl),level=kind==='rain'?hydroNumber(row.rain_24h):kind==='dam'?hydroNumber(row.dam_storage_percent):msl??hydroNumber(row.waterlevel_m);
    const situation=scales.find(s=>Number(String(s.trans).match(/level_(\d+)/)?.[1])===Number(row.situation_level));
    return {
      station_code:String(station.id??dam.id??row.dam_id??row.id??index),old_code:station.tele_station_oldcode||dam.dam_oldcode||'',
      station_name_th:hydroText(station.tele_station_name||dam.dam_name||row.dam_name)||'สถานี',
      province_name:hydroText(geocode.province_name),amphur_name:hydroText(geocode.amphoe_name),tumbon_name:hydroText(geocode.tumbon_name),
      latitude:station.tele_station_lat??dam.dam_lat??row.dam_lat,longitude:station.tele_station_long??dam.dam_long??row.dam_long,
      observed_at:thaiwaterTime(row.waterlevel_datetime||row.rainfall_datetime||row.dam_date),
      level,level_unit:kind==='rain'?'มม.':kind==='dam'?'%':msl!=null?'ม.รทก.':'ม.',
      agency_name:hydroText(row.agency?.agency_name),sponsor_name:hydroText(station.sponsor_by),
      basin_name:hydroText(row.basin?.basin_name),river_name:row.river_name||'',
      q:hydroNumber(row.discharge??row.flow_rate),level_percent:hydroNumber(row.storage_percent),
      previous_level:msl!=null?hydroNumber(row.waterlevel_msl_previous):null,
      bank_level:msl!=null?hydroNumber(station.min_bank):null,ground_level:msl!=null?hydroNumber(station.ground_level):null,
      bank_diff:msl!=null?hydroNumber(row.diff_wl_bank):null,bank_diff_text:msl!=null?row.diff_wl_bank_text||'':'',
      situation:situation?.situation||null,situation_tone:({1:'critical',2:'low',3:'normal',4:'high',5:'flood'})[row.situation_level]||'unknown',
      rain_1h:hydroNumber(row.rain_1h),storage:hydroNumber(row.dam_storage),
      usable_water:hydroNumber(row.dam_uses_water),usable_percent:hydroNumber(row.dam_uses_water_percent),
      inflow:hydroNumber(row.dam_inflow),released:hydroNumber(row.dam_released),
      normal_storage:hydroNumber(dam.normal_storage),max_storage:hydroNumber(dam.max_storage),
    };
  });
}

function hydroDetailHTML(row,kind,helpers){
  const {esc,number,freshness,icon}=helpers;
  const address=[row.tumbon_name&&'ต.'+row.tumbon_name,row.amphur_name&&'อ.'+row.amphur_name,row.province_name&&'จ.'+row.province_name].filter(Boolean).join(' ');
  const metric=(label,value,unit)=>`<div class="hydro-metric"><span>${label}</span><strong>${number(value,2)} <small>${unit}</small></strong></div>`;
  const cell=(label,value,unit='',digits=2)=>`<div><dt>${label}</dt><dd>${number(value,digits)} <small>${unit}</small></dd></div>`;
  let main='',facts='',note='';
  if(kind==='rain'){
    main=`<div class="hydro-rain-icon">${icon('rain')}</div>${metric('ปริมาณฝนสะสม 24 ชั่วโมงย้อนหลัง',row.level,'มม.')}`;
    facts=cell('ฝนสะสม 1 ชั่วโมง',row.rain_1h,'มม.')+`<div><dt>ลุ่มน้ำ</dt><dd>${esc(row.basin_name||'ไม่ระบุ')}</dd></div>`;
    note='ช่วงสะสมย้อนหลังสิ้นสุดตามเวลารายงานของสถานี';
  }else if(kind==='dam'){
    main=`<div class="hydro-rain-icon">${icon('water')}</div>${metric('น้ำกักเก็บเทียบความจุระดับเก็บกัก',row.level,'%')}`;
    const width=row.level==null?0:Math.max(0,Math.min(100,row.level));
    facts=`<div class="storage-bar" role="img" aria-label="น้ำกักเก็บ ${esc(number(row.level))} เปอร์เซ็นต์"><i style="width:${width}%"></i></div>`+
      cell('ปริมาตรน้ำกักเก็บ',row.storage,'ล้าน ม³')+cell('ความจุระดับเก็บกัก',row.normal_storage,'ล้าน ม³')+
      cell('น้ำใช้การได้',row.usable_water,'ล้าน ม³')+cell('น้ำใช้การได้เทียบความจุ',row.usable_percent,'%')+
      cell('น้ำไหลเข้า',row.inflow,'ล้าน ม³/วัน')+cell('น้ำระบาย',row.released,'ล้าน ม³/วัน');
    note='ข้อมูลเขื่อนรายวันตามวันที่ต้นทาง ไม่ใช่ค่าระดับน้ำตรวจวัดทุกนาที';
  }else{
    const delta=row.bank_diff??(row.bank_level!=null&&row.level!=null&&row.level_unit==='ม.รทก.'?row.bank_level-row.level:null);
    main=`<span class="hydro-status tone-${esc(row.situation_tone||'unknown')}">${esc(row.situation||'ไม่ระบุสถานะ')}</span>${metric(row.bank_diff_text||(delta==null?'ระยะเทียบตลิ่ง':delta>=0?'ต่ำกว่าตลิ่ง':'สูงกว่าตลิ่ง'),delta==null?null:Math.abs(delta),'ม.')}`;
    facts=cell('ระดับน้ำ',row.level,row.level_unit||'ม.')+cell('ระดับตลิ่ง',row.bank_level,'ม.รทก.')+cell('ระดับท้องน้ำ',row.ground_level,'ม.รทก.');
    if(row.level_percent!=null)facts+=cell('เทียบความจุลำน้ำ',row.level_percent,'%');
    if(row.q!=null)facts+=cell('อัตราการไหล',row.q,'ม³/วินาที');
    if(row.previous_level!=null&&row.level!=null){const diff=row.level-row.previous_level;facts+=`<div><dt>เทียบค่าก่อนหน้า</dt><dd>${diff>0?'เพิ่มขึ้น':diff<0?'ลดลง':'ทรงตัว'} ${number(Math.abs(diff),2)} <small>ม.</small></dd></div>`;}
    note='ม.รทก. = เมตรเทียบระดับทะเลปานกลาง · ช่องที่ไม่มีข้อมูลแสดง —';
  }
  const stamp=kind==='dam'&&/^\d{4}-\d{2}-\d{2}$/.test(row.observed_at||'')?row.observed_at:freshness(row.observed_at,kind==='dam'?48:3);
  return `<article class="hydro-station hydro-${kind}"><p class="eyebrow">THAIWATER / ${kind==='rain'?'RAINFALL':kind==='dam'?'RESERVOIR':'WATER LEVEL'}</p><h2>${esc(row.station_name_th)}</h2><p class="hydro-address">${esc(address||row.province_name||'ไม่ระบุพื้นที่')}</p><div class="hydro-main">${main}</div><dl class="hydro-readings">${facts}</dl><div class="hydro-credit"><span>ข้อมูล: ${esc(row.agency_name||'ThaiWater / สถาบันสารสนเทศทรัพยากรน้ำ')}</span><time>ล่าสุด ${esc(stamp)}</time>${row.old_code?`<small>รหัสสถานี ${esc(row.old_code)}</small>`:''}</div>${row.sponsor_name?`<div class="hydro-sponsor"><span>สนับสนุนโดย</span><strong>${esc(row.sponsor_name)}</strong></div>`:''}<p class="hydro-note">${note}</p><a class="hydro-source" href="https://www.thaiwater.net/" target="_blank" rel="noopener">ดูข้อมูลและกราฟจาก ThaiWater</a></article>`;
}
function observationDetailHTML(row,kind,{esc,number,freshness,icon,status,trend}){
 const water=kind==='water',name=water?row.station_name_th:row.th;
 const metric=(label,value,unit)=>`<div class="observation-metric"><span>${label}</span><strong>${number(value)} <small>${unit}</small></strong></div>`;
 const trendName=trend?({rise:'เพิ่มขึ้น',fall:'ลดลง',steady:'ทรงตัว',stable:'ทรงตัว'}[trend.trend]||'ทรงตัว'):'ไม่ทราบแนวโน้ม';
 const facts=water?metric('แนวโน้ม',null,'').replace('— ',esc(trendName)+' ')+metric('การเปลี่ยนแปลง',trend?.delta,'ม.')+metric('เทียบความจุตลิ่ง',row.level_percent,'%')+metric('อัตราการไหล',row.q,'ม³/วินาที'):
 metric('ความชื้น',row.rh,'%')+metric('ความกดอากาศ',row.p,'hPa')+metric('ฝนสะสม 24 ชม.',row.rain24,'มม.')+metric('ทิศลม',row.wd,'°');
 return `<article class="observation-station"><header><span class="observation-icon">${icon(water?'water':'sun')}</span><div><p class="eyebrow">${water?'RID · ระดับน้ำสงขลา':'TMD · สถานีตรวจอากาศ'}</p><h2>${esc(name)}</h2><p>${esc(row.province_name||'สงขลา')}</p></div></header><div class="observation-hero"><span>${water?'ระดับน้ำตรวจวัด':'อุณหภูมิตรวจวัด'}</span><strong>${number(water?row.level:row.t)}<small>${water?'ม.':'°C'}</small></strong><span class="observation-condition">${esc(water?status||'ยังไม่ทราบเกณฑ์เตือน':'ตรวจวัดจากสถานี')}</span></div><div class="observation-grid">${facts}</div><footer><time>ข้อมูล ณ ${esc(freshness(row.observed_at))} · เวลาไทย (Asia/Bangkok)</time><span>${water?'รหัสสถานี '+esc(row.station_code):'WMO '+esc(row.wmo)}</span></footer><p class="observation-note">${water?`เกณฑ์เหลือง ${number(row.alert_yellow)} / แดง ${number(row.alert_red)} ม. · ค่าที่ไม่มีข้อมูลแสดงเป็น —`:`ค่าลมต้นทาง ${number(row.ws)} · ยังไม่ยืนยันหน่วย ws`}</p><a class="hydro-source" href="${water?'https://onedata-surv.dida.psu.ac.th/stations':'https://onedata-surv.dida.psu.ac.th/'}" target="_blank" rel="noopener">ดูข้อมูลจากต้นทาง</a></article>`;
}
if(typeof module!=='undefined')module.exports={normalizeNationalData,thaiwaterTime,hydroDetailHTML,observationDetailHTML};
