const {test}=require('node:test'),assert=require('node:assert/strict');
global.DEVELOPMENT_RAIN_STOPS=require('../assets/development-data.js').DEVELOPMENT_RAIN_STOPS;
const {precipitationKey:key}=require('../assets/precipitation-legend.js');
test('radar reflection, model rain, and accumulation cannot share misleading units',()=>{
 assert.equal(key('radargis',{id:'dbz'}).unit,'dBZ');
 assert.equal(key('radargis',{id:'rainrate',label:'Rain rate',unit:'mm/h'}).unit,'mm/h');
 assert.equal(key('radargis',{id:'accum-3h',unit:'mm'}).stops.length,0);
 assert.equal(key('radargis',{id:'lightning',unit:'risk'}).stops.length,0);
 assert.equal(key('rainviewer').unit,'dBZ');
 const model=key('radargis',{id:'dbz'},{modelOn:true,source:'model',model:{name:'IFS'}});
 assert.equal(model.unit,'mm/h');assert.deepEqual(model.ticks,['0','0.6','3','12','50','200']);
 assert.equal(key(null,null,{}),null);
});
test('CLPP legend uses the actual upstream palette and rain levels from its manifest',()=>{
 const c=key(null,null,{source:'clpp',clppOn:true,clpp:{levels_rgb:[[0,255,0],[255,0,0]],levels_mm_hr:[.21,636]}});
 assert.deepEqual(c.stops,['rgb(0,255,0)','rgb(255,0,0)']);assert.equal(c.unit,'dBZ');assert.equal(c.ticks[0],10.4);assert.equal(c.secondary.at(-1),'636');
});

test('SWIRLS has its own visible source-colour legend without an invented numeric conversion',()=>{
 const swirls=key('nowcast');
 assert.ok(swirls.label.includes('SWIRLS'));assert.ok(swirls.stops.length>1);
 assert.ok(swirls.ticks.length>1);assert.equal(swirls.unit,'');
 assert.notDeepEqual(swirls.stops,key('rainviewer').stops);
});
