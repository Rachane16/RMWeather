const {test}=require('node:test');
const assert=require('node:assert/strict');
const {developmentSample:sample,developmentWind:wind,developmentLatest:latest}=require('../assets/development-data.js');
const {WeatherMap}=require('../assets/map-engine.js');
const {developmentRainColour:rainColour}=require('../assets/development-data.js');
const {developmentRegionMask:mask,developmentCurrentFrame:currentFrame}=require('../assets/development-data.js');
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
test('current-time action selects a containing forecast interval and labels stale/future gaps honestly',()=>{
 const frames=[{start:100,time:200},{start:200,time:300}];
 assert.deepEqual(currentFrame(frames,250),{index:1,current:true});
 assert.deepEqual(currentFrame(frames,200),{index:1,current:true});
 assert.deepEqual(currentFrame(frames,50),{index:0,current:false});
 assert.deepEqual(currentFrame(frames,350),{index:1,current:false});
});
test('rectangular display includes every sampled corner and excludes unsampled territory',()=>{
 const g={west:82,north:30,step:1.2,nx:36,ny:31};
 for(const [lon,lat] of [[99.9,20.45],[100.5,7.2],[105.3,15.2],[98.3,7.9]])assert.ok(mask(g,lon,lat)>.5);
 for(const [lon,lat] of [[82,30],[124,30],[82,-6],[124,-6]])assert.equal(mask(g,lon,lat),1);
 assert.equal(mask(g,81.99,12),0);assert.equal(mask(g,125,12),0);assert.equal(mask(g,100,-6.01),0);
 const records=wind({u:Array(1116).fill(2),v:Array(1116).fill(-1)},g);
 assert.equal(records[0].data[0],2);assert.equal(records[0].data.at(-1),2);
 assert.equal(records[1].data.at(-1),-1);
});
test('rain intensity follows the Windy reference thresholds in mm/h and preserves light rain',()=>{
 assert.deepEqual(rainColour(.6),[0,148,143,205]);assert.deepEqual(rainColour(3),[102,208,81,205]);
 assert.deepEqual(rainColour(12),[244,184,18,205]);assert.deepEqual(rainColour(50),[204,74,83,205]);
 assert.deepEqual(rainColour(200),[155,15,109,205]);assert.deepEqual(rainColour(800),[155,15,109,205]);
 assert.ok(rainColour(.2)[3]>0&&rainColour(.2)[3]<rainColour(.6)[3]);assert.equal(rainColour(0)[3],0);assert.equal(rainColour(null)[3],0);
});
