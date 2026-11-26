const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function navigation(){
 const source=fs.readFileSync(require.resolve('../assets/app.js'),'utf8');
 const ctx={enabled:{cameras:true,water:true,thaiwater:true,rain:true,dam:true,weather:true,windycams:true,wind:true},rainVisibility:{rainviewer:true,radargis:true,nowcast:true,radar:true,rod:true},radarKind:'nowcast'};
 ctx.setEnabled=(key,on)=>ctx.enabled[key]=on;ctx.setRainEnabled=(key,on)=>ctx.rainVisibility[key]=on;
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function applyCategoryLayers('),source.indexOf('function selectView(')),ctx);return ctx;
}
test('main categories replace prior overlays, while overview restores its five requested layers',()=>{
 const ctx=navigation();
 for(const category of ['cameras','water','wind','weather']){
  ctx.applyCategoryLayers(category);
  assert.deepEqual(Object.keys(ctx.enabled).filter(k=>ctx.enabled[k]),[category]);
  assert.equal(Object.values(ctx.rainVisibility).some(Boolean),false);
 }
 ctx.applyCategoryLayers('radar');assert.deepEqual(Object.keys(ctx.rainVisibility).filter(k=>ctx.rainVisibility[k]),['nowcast']);assert.equal(Object.values(ctx.enabled).some(Boolean),false);
 ctx.applyCategoryLayers('overview');assert.deepEqual(Object.keys(ctx.enabled).filter(k=>ctx.enabled[k]).sort(),['cameras','water','weather','wind'].sort());assert.deepEqual(Object.keys(ctx.rainVisibility).filter(k=>ctx.rainVisibility[k]),['rainviewer']);
});
