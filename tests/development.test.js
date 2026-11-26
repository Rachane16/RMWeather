const {test}=require('node:test');
const assert=require('node:assert/strict');
const {developmentSample:sample,developmentWind:wind,developmentLatest:latest,developmentStations:stations,developmentPixelPosition:position,developmentColourRange:range}=require('../assets/development-data.js');
const {WeatherMap}=require('../assets/map-engine.js');
const {developmentRainColour:rainColour}=require('../assets/development-data.js');
const grid={west:100,north:8,step:1,nx:2,ny:2};
test('display grid preserves north/south, boundaries, gaps and zero rain',()=>{
 assert.equal(sample([0,2,2,4],grid,100.5,7.5),2);
 assert.equal(sample([0,2,2,4],grid,101,7),4);
 assert.equal(sample([0,null,2,4],grid,100,8),0);
 assert.equal(sample([0,null,2,4],grid,100.5,7.5),null);
 assert.equal(sample([0,2,2,4],grid,102,7),null);
});
test('model wind uses east/north m/s components and falls back to ordinary wind',()=>{
 const records=wind({u:[1,2,3,4],v:[-1,-2,-3,-4]},grid);
 assert.equal(records[0].header.parameterNumber,2);assert.equal(records[1].header.la1,8);
 const m=Object.assign(Object.create(WeatherMap.prototype),{renderWindRecords(){this.active=this.experimentalWindRecords||this.baseWindRecords;}});
 m.setWind('original');m.setExperimentalWind(records);assert.equal(m.active,records);
 m.setWind('new original');assert.equal(m.active,records);m.setExperimentalWind(null);assert.equal(m.active,'new original');
});
test('clock chooses current interval rather than the furthest forecast',()=>{
 assert.equal(latest([{time:100},{time:200},{time:300}],250),2);
 assert.equal(latest([{time:100},{time:200}],50),0);
 assert.equal(latest([{time:100},{time:200}],350),1);
});
test('station compact field order is read dynamically; null is not zero',()=>{
 const result=stations({fields:['lon','name','obs24','lat','mm24','obs','mm'],stations:[[100,'test',null,7,null,null,0],[999,'invalid',null,7,0,null,0]]});
 assert.equal(result.length,1);assert.equal(result[0].mm24,null);assert.equal(result[0].mm,0);
});
test('PNG point sampling is bounds checked and reports colour intervals or unknown',()=>{
 assert.deepEqual(position([[4,96],[22,110]],96,22,100,200),[0,0]);
 assert.deepEqual(position([[4,96],[22,110]],110,4,100,200),[99,199]);
 assert.equal(position([[4,96],[22,110]],111,4,100,200),null);
 assert.equal(range([0,255,0,255],[[0,255,0],[255,0,0]],[1,5]).text,'1–5');
 assert.equal(range([0,255,0,0],[[0,255,0]],[1]).min,null);
 assert.equal(range([255,255,255,255],[[0,0,0]],[1]).min,null);
});
test('all model maps use the reference rainfall palette and hide values below 0.3 mm/3h',()=>{
 assert.deepEqual(rainColour(.3),[0,20,220,205]);assert.deepEqual(rainColour(2),[0,164,255,205]);
 assert.deepEqual(rainColour(7),[115,229,95,205]);assert.deepEqual(rainColour(15),[255,211,0,205]);
 assert.deepEqual(rainColour(50),[251,86,0,205]);assert.deepEqual(rainColour(500),[180,3,0,205]);
 assert.deepEqual(rainColour(800),[180,3,0,205]);assert.equal(rainColour(.2)[3],0);assert.equal(rainColour(null)[3],0);
});
