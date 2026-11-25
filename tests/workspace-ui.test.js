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
test('phone popups replace each other without coupling window state to map layer state',()=>{
  const ui=new WorkspacePanels(true);
  ui.setOpen('sidebar',true);ui.setOpen('display',true);
  assert.equal(ui.open.sidebar,false);assert.equal(ui.open.display,true);
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
