const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../assets/app.js'),'utf8');
test('historical radar frames do not mislabel an up-to-date provider as stale',()=>{
  const old='2020-01-01T00:00:00Z',fresh='2026-11-25T09:00:00Z',nodes={};
  const context={window:{},radarKind:'rod',radarFrames:[{frame_time:old},{frame_time:fresh}],rainVisibility:{rod:true,nowcast:true},map:{setRain(){}},time:value=>value,stale:value=>value===old,$:id=>nodes[id]??=( {style:{setProperty(){}}} ),document:{querySelector:()=>({})}};
  const start=app.indexOf('function showRadarFrame('),end=app.indexOf("$('radar-timeline-source').addEventListener",start);
  vm.createContext(context);vm.runInContext(app.slice(start,end),context);
  context.showRadarFrame(0);assert.doesNotMatch(nodes['radar-status'].textContent,/ข้อมูลต้นทางยังเป็นเฟรมเก่า/);
  assert.equal(nodes['radar-mini-time'].textContent,old);
  assert.equal(nodes['radar-mini-time'].dateTime,old.replace('Z','.000Z'));
  context.showRadarFrame(1);assert.equal(nodes['radar-mini-time'].textContent,fresh);
  context.radarFrames[1].frame_time=old;context.showRadarFrame(0);assert.match(nodes['radar-status'].textContent,/ข้อมูลต้นทางยังเป็นเฟรมเก่า/);
  context.radarKind='nowcast';context.radarFrames[1].frame_time=fresh;context.radarFrames[0].base_time=old;context.showRadarFrame(0);assert.match(nodes['radar-status'].textContent,/ข้อมูลต้นทางยังเป็นเฟรมเก่า/);
});
test('CCTV image failure tries the source once, then exposes an unavailable-image message',()=>{
  let onError,unavailable=false;
  const img={src:'https://onedata.example/capture.jpg',dataset:{fallback:'https://camera.example/latest.jpg'},addEventListener:(name,callback)=>onError=callback,removeAttribute(){this.src='';},classList:{add:()=>unavailable=true}};
  const context={safeURL:value=>value?.startsWith('https://')?value:''};vm.createContext(context);
  vm.runInContext(app.slice(app.indexOf('function bindImageErrors('),app.indexOf('function showDetail(')),context);
  context.bindImageErrors({querySelectorAll:()=>[img]});onError();assert.equal(img.src,'https://camera.example/latest.jpg');
  onError();assert.equal(img.src,'');assert.ok(unavailable);assert.match(img.alt,/ภาพยังไม่พร้อม/);
});
function nationalHarness(){
  const pending=[];
  const context={module:{exports:{}},datasets:{},waterKind:'thaiwater',renderResults(){},renderMarkers(){},toast(){},normalizeNationalData:(j,kind)=>j.map(row=>({...row,kind})),getJSON:url=>new Promise((resolve,reject)=>pending.push({url,resolve,reject}))};
  const start=app.indexOf('const nationalRequests='),end=app.indexOf("document.querySelectorAll('[data-place]')",start);
  vm.runInNewContext(app.slice(start,end)+';module.exports={loadNational,nationalLoading}',context);
  return {...context.module.exports,context,pending};
}
test('water, rain and dam responses survive concurrent out-of-order requests',async()=>{
  const h=nationalHarness();
  const water=h.loadNational('thaiwater'),rain=h.loadNational('rain'),dam=h.loadNational('dam');
  h.pending[1].resolve([{level:14}]);await rain;
  h.pending[2].resolve([{level:75}]);await dam;
  h.pending[0].resolve([{level:3.2}]);await water;
  assert.equal(h.context.datasets.thaiwater[0].level,3.2);
  assert.equal(h.context.datasets.rain[0].level,14);
  assert.equal(h.context.datasets.dam[0].level,75);
  assert.equal(Object.values(h.nationalLoading).some(Boolean),false);
});
test('an older same-source request cannot overwrite a newer result and a failed refresh keeps data',async()=>{
  const h=nationalHarness();const old=h.loadNational('rain'),latest=h.loadNational('rain');
  h.pending[1].resolve([{level:9}]);await latest;
  h.pending[0].resolve([{level:2}]);await old;
  assert.equal(h.context.datasets.rain[0].level,9);
  const failure=h.loadNational('rain');h.pending[2].reject(Error('offline'));await failure;
  assert.equal(h.context.datasets.rain[0].level,9);
  assert.equal(h.nationalLoading.rain,false);
});
test('map detail uses the clicked source units even when a different water category is selected',()=>{
  const content={innerHTML:''},dialog={open:true};
  const ctx={hydroDetailHTML:require('../assets/hydro.js').hydroDetailHTML,icon:()=>'',waterKind:'dam',datasets:{},$:id=>id==='detail-content'?content:dialog,titleOf:()=> 'Station',esc:String,freshness:()=>'',number:v=>v??'—',bindImageErrors(){}};
  const start=app.indexOf('function showDetail('),end=app.indexOf('function showMultiview()',start);
  vm.createContext(ctx);vm.runInContext(app.slice(start,end),ctx);
  ctx.showDetail('water',{level:12,province_name:'สงขลา'},'rain');
  assert.match(content.innerHTML.replace(/<[^>]*>/g,''),/12 มม\./);assert.doesNotMatch(content.innerHTML.replace(/<[^>]*>/g,''),/12 %/);
  ctx.showDetail('water',{level:78,storage:200,province_name:'สงขลา'},'dam');
  assert.match(content.innerHTML.replace(/<[^>]*>/g,''),/78 %/);assert.match(content.innerHTML.replace(/<[^>]*>/g,''),/200 ล้าน ม³/);
});
