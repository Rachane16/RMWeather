const {test}=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
function context(fix,pending){
  let requests=0;const nodes={};
  const ctx={window:{currentLocation:fix,locationPending:pending,workspaceUI:{closeForWeatherTool(){}}},map:{getCenter:()=>({lat:13.75,lng:100.5})},requestCurrentLocation:()=>requests++,closeLayerDrawer(){},updateWeatherEmbeds(){},document:{querySelectorAll:()=>[]},$:id=>nodes[id]??={setAttribute(){},removeAttribute(){}}};
  const source=fs.readFileSync(require.resolve('../assets/weather-tools.js'),'utf8');
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const toolVisibility'),source.indexOf('function assignFrame'))+';function selectedLocation(){return windyLocation;}',ctx);
  return {ctx,requests:()=>requests};
}
test('Windy opens at the device fix even when the main map has been moved elsewhere',()=>{
  const h=context({lat:7.1,lon:100.6},false);h.ctx.setWeatherTool('weather-map',true);
  assert.equal(h.ctx.selectedLocation().lat,7.1);assert.equal(h.ctx.selectedLocation().lon,100.6);assert.equal(h.requests(),1);
});
test('Windy can open with a map fallback while the initial location request is pending',()=>{
  const h=context(null,true);h.ctx.setWeatherTool('weather-map',true);
  assert.equal(h.ctx.selectedLocation().lat,13.75);assert.equal(h.requests(),0);
});
