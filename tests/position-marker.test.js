const {test}=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
test('the location marker uses valid fixes, updates one marker and can recenter the map',()=>{
  const markers=[],elements=[],moves=[];
  class Marker{
    constructor(options){this.options=options;markers.push(this);}
    setLngLat(coords){this.coords=coords;return this;}
    addTo(){return this;}
    getLngLat(){return {lng:this.coords[0],lat:this.coords[1]};}
  }
  const ctx={module:{exports:{}},maplibregl:{Marker},document:{createElement:()=>{const e={setAttribute(key,value){this[key]=value;},addEventListener(name,fn){this.click=fn;}};elements.push(e);return e;}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/map-engine.js'),'utf8'),ctx);
  const map=Object.assign(Object.create(ctx.module.exports.WeatherMap.prototype),{gl:{getZoom:()=>10,flyTo:args=>moves.push(args)}});
  map.setCurrentLocation(NaN,100);assert.equal(markers.length,0);
  map.setCurrentLocation(7,100);map.setCurrentLocation(7.1,100.5);
  assert.equal(markers.length,1);assert.deepEqual(Array.from(markers[0].coords),[100.5,7.1]);
  assert.equal(elements[0]['aria-label'],'ตำแหน่งปัจจุบันของคุณ');
  elements[0].click({stopPropagation(){}});assert.deepEqual(Array.from(moves[0].center),[100.5,7.1]);assert.equal(moves[0].zoom,12);
});
