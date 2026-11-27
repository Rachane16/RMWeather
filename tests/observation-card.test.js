const {test}=require('node:test'),assert=require('node:assert/strict');
const {observationDetailHTML:card}=require('../assets/hydro.js');
const helpers={esc:v=>String(v??'').replace(/</g,'&lt;').replace(/>/g,'&gt;'),number:v=>v==null?'—':String(v),freshness:()=> '27 พ.ย. 13:00',icon:()=>'',status:'ยังไม่ทราบเกณฑ์เตือน'};
test('modern station cards retain zero readings, unknown units and escaped source names',()=>{
 const html=card({th:'<script>station</script>',t:0,rh:null,p:1013,rain24:0,wd:80,ws:3.7,wmo:'48568'},'weather',helpers);
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/0<small>°C/);assert.match(html,/—/);assert.match(html,/ยังไม่ยืนยันหน่วย ws/);assert.match(html,/Asia\/Bangkok/);
});
test('RID cards preserve missing bank thresholds and signed trend changes',()=>{
 const html=card({station_name_th:'test',station_code:'0',level:0,level_percent:null,q:null},'water',{...helpers,trend:{trend:'fall',delta:-.03}});
 assert.match(html,/ลดลง/);assert.match(html,/-0.03/);assert.match(html,/เกณฑ์เหลือง — \/ แดง —/);assert.match(html,/0<small>ม\./);
});
