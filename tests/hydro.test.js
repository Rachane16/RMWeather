const test = require('node:test');
const assert = require('node:assert/strict');
const {normalizeNationalData} = require('../assets/hydro.js');

test('nested dam response keeps current daily data over obsolete hourly data', () => {
  const dam = {id:25,dam_name:{th:'รัชชประภา'},dam_lat:9.05,dam_long:98.67};
  const rows = normalizeNationalData({data:{
    dam_hourly:[{dam,dam_date:'2020-11-09 14:00',dam_storage_percent:0}],
    dam_daily:[{dam,dam_date:'2026-11-25',dam_storage_percent:74.14,dam_storage:4180.68}],
  }}, 'dam');
  assert.equal(rows.length,1);
  assert.equal(rows[0].level,74.14);
  assert.equal(rows[0].latitude,9.05);
  assert.equal(rows[0].station_name_th,'รัชชประภา');
});

test('water popup metadata retains datum, agency, bank levels and real source status',()=>{
 const data={waterlevel_data:{data:[{waterlevel_msl:'21.14',waterlevel_msl_previous:'21.10',waterlevel_datetime:'2026-11-26 09:40',storage_percent:'13.2',situation_level:2,diff_wl_bank:'3.05',agency:{agency_name:{th:'สสน.'}},station:{id:42,tele_station_name:{th:'คลองหวะ'},min_bank:24.19,ground_level:20.68},geocode:{amphoe_name:{th:'นาหม่อม'},province_name:{th:'สงขลา'}}}]},scale:{data:{scale:[{trans:'waterlevel_level_2',situation:'น้ำน้อย'}]}}};
 const row=normalizeNationalData(data,'thaiwater')[0];
 assert.equal(row.level,21.14);assert.equal(row.level_unit,'ม.รทก.');assert.equal(row.bank_level,24.19);assert.equal(row.ground_level,20.68);assert.equal(row.bank_diff,3.05);assert.equal(row.situation,'น้ำน้อย');assert.equal(row.agency_name,'สสน.');
 assert.equal(row.observed_at,'2026-11-26T09:40+07:00');
});

test('rain retains sponsor and does not invent missing one-hour rain or water datum',()=>{
 const row=normalizeNationalData({data:[{rain_24h:0,rain_1h:null,station:{sponsor_by:'อบจ.สงขลา'},waterlevel_m:2.5}]},'rain')[0];
 assert.equal(row.level,0);assert.equal(row.rain_1h,null);assert.equal(row.sponsor_name,'อบจ.สงขลา');assert.equal(row.bank_level,null);
});

test('hydro popup shows missing values, signed bank meaning and escapes source text',()=>{
 const {hydroDetailHTML}=require('../assets/hydro.js');
 const helpers={esc:s=>String(s??'').replaceAll('<','&lt;'),number:v=>v==null?'—':String(v),freshness:s=>s||'ไม่ทราบเวลา',icon:()=>''};
 const html=hydroDetailHTML({station_name_th:'<script>',level:25,level_unit:'ม.รทก.',bank_level:24,ground_level:null,situation:'น้ำล้นตลิ่ง',situation_tone:'flood'},'thaiwater',helpers);
 assert.match(html,/สูงกว่าตลิ่ง/);assert.match(html,/&lt;script>/);assert.doesNotMatch(html,/<script>/);assert.match(html,/— <small>ม.รทก./);
});

test('missing national measurements stay unknown while zero stays zero', () => {
  const rows = normalizeNationalData({data:[{rain_24h:0},{rain_24h:null}]},'rain');
  assert.equal(rows[0].level,0);
  assert.equal(rows[1].level,null);
});
