const {test}=require('node:test'),assert=require('node:assert/strict');
global.DEVELOPMENT_RAIN_STOPS=require('../assets/development-data.js').DEVELOPMENT_RAIN_STOPS;
const {precipitationKey:key}=require('../assets/precipitation-legend.js');
test('radar reflection, model rain, and accumulation cannot share misleading units',()=>{
 assert.equal(key('radargis',{id:'dbz'}).unit,'');
 assert.equal(key('radargis',{id:'rainrate',label:'Rain rate',unit:'mm/h'}).unit,'mm/h');
 assert.equal(key('radargis',{id:'accum-3h',unit:'mm'}).stops.length,0);
 assert.equal(key('radargis',{id:'lightning',unit:'risk'}).stops.length,0);
 assert.equal(key('rainviewer').unit,'');
 const model=key('radargis',{id:'dbz'},{modelOn:true,source:'model',model:{name:'IFS'}});
 assert.equal(model.unit,'mm/h');assert.deepEqual(model.ticks,['0','0.6','3','12','50','200']);
 assert.equal(key(null,null,{}),null);
});

test('radar image sources use verbal levels while RainViewer TMD levels and model units stay independent',()=>{
 for(const provider of ['nowcast','radargis','rod','radar']){
  const radar=key(provider,{id:'dbz'});assert.deepEqual(radar.ticks,['ฝนอ่อน','ปานกลาง','ฝนหนัก','หนักมาก']);assert.equal(radar.unit,'');
 }
 assert.equal(key('rainviewer').unit,'');
 assert.equal(key(null,null,{modelOn:true,model:{name:'IFS'},source:'model'}).unit,'mm/h');
});

test('SWIRLS has its own visible source-colour legend without an invented numeric conversion',()=>{
 const swirls=key('nowcast');
 assert.ok(swirls.label.includes('SWIRLS'));assert.ok(swirls.stops.length>1);
 assert.ok(swirls.ticks.length>1);assert.equal(swirls.unit,'');
 assert.notDeepEqual(swirls.stops,key('rainviewer').stops);
});
