const {test}=require('node:test');
const assert=require('node:assert/strict');
const {sampleWind,makeRainSource}=require('../assets/map-engine.js');
const header={nx:2,ny:2,lo1:100,la1:8,dx:1,dy:1};
const records=[{header:{...header,parameterNumber:2},data:[0,2,2,4]},
  {header:{...header,parameterNumber:3},data:[-4,-2,-2,0]}];
test('GFS interpolates east and north components with rows running north to south',()=>{
  assert.deepEqual(sampleWind(records,100.5,7.5),[2,-2]);
  assert.deepEqual(sampleWind([...records].reverse(),100,8),[0,-4]);
});
test('GFS gaps and positions outside the grid remain unknown',()=>{
  assert.equal(sampleWind(records,99,7.5),null);
  assert.equal(sampleWind(records,100.5,9),null);
  assert.equal(sampleWind([{...records[0],data:[null,2,2,4]},records[1]],100.5,7.5),null);
});
test('rain images use MapLibre image properties and clockwise longitude/latitude corners',()=>{
  const source=makeRainSource({image_url:'data/live/radar/test.png',bounds:[[5.2,96.1],[12.5,103]]});
  assert.deepEqual(source.coordinates,[[96.1,12.5],[103,12.5],[103,5.2],[96.1,5.2]]);
  // Attribution is not a supported image-source property. It caused silent
  // MapLibre style validation errors and completely invisible rain imagery.
  assert.deepEqual(Object.keys(source).sort(),['coordinates','type','url']);
  assert.equal(source.type,'image');
});
