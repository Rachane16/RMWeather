const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
function harness(){
  const pending=[],moves=[],forecasts=[],events=[],status={textContent:'',addEventListener(){}};
  const ctx={navigator:{geolocation:{getCurrentPosition:(ok,fail,options)=>pending.push({ok,fail,options})}},window:{dispatchEvent:event=>events.push(event)},map:{flyTo:(...args)=>moves.push(args),setCurrentLocation:(lat,lon)=>events.push({type:'marker',detail:{lat,lon}})},loadForecast:(...args)=>forecasts.push(args),$:()=>status,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}};
  const source=fs.readFileSync(require.resolve('../assets/app.js'),'utf8');
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('let locationRequest='),source.indexOf("$('theme').addEventListener")),ctx);
  return {ctx,pending,moves,forecasts,events,status};
}
test('granted current location updates the map, forecast and the Windy location event together',()=>{
  const h=harness();h.ctx.requestCurrentLocation();h.pending[0].ok({coords:{latitude:7.1,longitude:100.6}});
  assert.deepEqual(Array.from(h.moves[0][0]),[7.1,100.6]);assert.equal(h.forecasts[0][0],7.1);
  assert.equal(h.events[0].type,'marker');assert.equal(h.events[0].detail.lon,100.6);
  assert.equal(h.events[1].type,'rm-current-location');assert.equal(h.events[1].detail.lon,100.6);
  assert.equal(h.pending[0].options.enableHighAccuracy,false);
});
test('denied location keeps the usable fallback and ignores a superseded location response',()=>{
  const h=harness();h.ctx.requestCurrentLocation();h.pending[0].fail();assert.equal(h.moves.length,0);assert.match(h.status.textContent,/หาดใหญ่/);
  h.ctx.requestCurrentLocation();h.ctx.requestCurrentLocation();h.pending[1].ok({coords:{latitude:8,longitude:101}});
  assert.equal(h.moves.length,0);h.pending[2].ok({coords:{latitude:7,longitude:100}});assert.equal(h.moves.length,1);
});
