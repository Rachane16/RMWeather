const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../assets/app.js'),'utf8');
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
  const ctx={waterKind:'dam',datasets:{},$:id=>id==='detail-content'?content:dialog,titleOf:()=> 'Station',esc:String,freshness:()=>'',number:v=>v??'—',bindImageErrors(){}};
  const start=app.indexOf('function showDetail('),end=app.indexOf('function showMultiview()',start);
  vm.createContext(ctx);vm.runInContext(app.slice(start,end),ctx);
  ctx.showDetail('water',{level:12,province_name:'สงขลา'},'rain');
  assert.match(content.innerHTML,/12 มม\./);assert.doesNotMatch(content.innerHTML,/12 %/);
  ctx.showDetail('water',{level:78,storage:200,province_name:'สงขลา'},'dam');
  assert.match(content.innerHTML,/78 %/);assert.match(content.innerHTML,/200 ล้าน ม³/);
});
