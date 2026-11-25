const {test}=require('node:test');
const assert=require('node:assert/strict');
const {sampleWind}=require('../assets/map-engine.js');
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
