const {test}=require('node:test');
const assert=require('node:assert/strict');
const {WorkspacePanels}=require('../assets/workspace-ui.js');
test('enabling a rain source does not reopen the closed playback window',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),source=fs.readFileSync(require.resolve('../assets/app.js'),'utf8');
  const player={hidden:true};let open=false;
  const ctx={rainVisibility:{rainviewer:true,rod:false},rainRequests:{},radarKind:'rainviewer',enabled:{radar:true},loadRadar(){},stopRadar(){},map:{setRain(){}},$:()=>player,window:{syncTimelineUI:()=>player.hidden=!open}};
  const start=source.indexOf('function setRainEnabled('),end=source.indexOf('async function loadRadar(',start);
  vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
  ctx.setRainEnabled('rod',true);assert.equal(ctx.rainVisibility.rod,true);assert.equal(player.hidden,true);
  open=true;ctx.setRainEnabled('rainviewer',true);assert.equal(player.hidden,false);
});
test('mobile begins with no popups; desktop retains only the layer catalogue',()=>{
  const mobile=new WorkspacePanels(true),desktop=new WorkspacePanels(false);
  assert.equal(Object.values(mobile.open).some(Boolean),false);
  assert.deepEqual(Object.keys(desktop.open).filter(key=>desktop.open[key]),['sidebar']);
});

test('desktop catalogue is pinned on outside taps; phone drawers and other popups dismiss',()=>{
 const desktop=new WorkspacePanels(),phone=new WorkspacePanels(true);
 assert.equal(desktop.canDismissOutside('sidebar'),false);
 assert.equal(phone.canDismissOutside('sidebar'),true);
 for(const name of ['display','maptools','timeline','development'])assert.equal(desktop.canDismissOutside(name),true);
});
test('phone popups replace each other without coupling window state to map layer state',()=>{
  const ui=new WorkspacePanels(true);
  ui.setOpen('sidebar',true);ui.setOpen('display',true);
  assert.equal(ui.open.sidebar,true);assert.equal(ui.open.display,true);
  ui.setOpen('weather',true);assert.equal(ui.open.display,false);
  ui.setOpen('timeline',true);assert.equal(ui.open.weather,false);assert.equal(ui.open.timeline,true);
});
test('desktop control popups keep the catalogue and avoid overlapping right-side windows',()=>{
  const ui=new WorkspacePanels();ui.setOpen('weather',true);ui.setOpen('basemap',true);
  assert.equal(ui.open.sidebar,true);assert.equal(ui.open.weather,false);assert.equal(ui.open.basemap,true);
  ui.setOpen('timeline',true);assert.equal(ui.open.basemap,false);assert.equal(ui.open.sidebar,true);
});
test('minimized panels can reopen and resizing to mobile dismisses control windows',()=>{
  const ui=new WorkspacePanels();ui.minimize('sidebar',true);assert.equal(ui.minimized.sidebar,true);
  ui.setOpen('sidebar',false);ui.setOpen('sidebar',true);assert.equal(ui.minimized.sidebar,false);
  ui.setMobile(true);assert.equal(Object.values(ui.open).some(Boolean),false);
});
test('minimizing either playback preserves its visibility and the desktop catalogue',()=>{
 for(const name of ['timeline','development']){
  const ui=new WorkspacePanels();ui.setOpen(name,true);ui.minimize(name,true);
  assert.equal(ui.open[name],true);assert.equal(ui.open.sidebar,true);assert.equal(ui.minimized[name],true);
  ui.minimize(name,false);assert.equal(ui.minimized[name],false);assert.equal(ui.open[name],true);
 }
});
test('advance forecast is opt-in and replaces playback without changing desktop catalogue state',()=>{
 const ui=new WorkspacePanels();assert.equal(ui.open.advance,false);
 ui.setOpen('timeline',true);ui.setOpen('advance',true);
 assert.equal(ui.open.timeline,false);assert.equal(ui.open.advance,true);assert.equal(ui.open.sidebar,true);
 ui.setOpen('timeline',true);assert.equal(ui.open.advance,false);
 const mobile=new WorkspacePanels(true);mobile.setOpen('advance',true);mobile.setOpen('display',true);
 assert.equal(mobile.open.advance,false);assert.equal(mobile.open.display,true);
});
test('experimental time dropdown stays closed on arrival and replaces other playback windows independently of layers',()=>{
 const ui=new WorkspacePanels(true);assert.equal(ui.open.development,false);
 ui.setOpen('timeline',true);ui.setOpen('development',true);
 assert.equal(ui.open.timeline,false);assert.equal(ui.open.development,true);
 ui.setOpen('advance',true);assert.equal(ui.open.development,false);
 ui.setOpen('development',true);ui.setMobile(false);assert.equal(ui.open.development,false);
});
