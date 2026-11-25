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

test('missing national measurements stay unknown while zero stays zero', () => {
  const rows = normalizeNationalData({data:[{rain_24h:0},{rain_24h:null}]},'rain');
  assert.equal(rows[0].level,0);
  assert.equal(rows[1].level,null);
});
