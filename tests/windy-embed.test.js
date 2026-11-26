const {test}=require('node:test');
const assert=require('node:assert/strict');
const {WindyPointSelection,buildWindyEmbedURL,windyLayers}=require('../assets/windy-embed.js');
const point={lat:7.0084,lon:100.4767};

test('map, point marker and forecast use identical explicit coordinates and modern embed',()=>{
 const url=new URL(buildWindyEmbedURL({point,view:'map-forecast',overlay:'wind'})),p=url.searchParams;
 assert.equal(url.pathname,'/embed.html');assert.equal(p.get('type'),'map');assert.equal(p.get('detail'),'true');
 assert.equal(p.get('lat'),p.get('detailLat'));assert.equal(p.get('lon'),p.get('detailLon'));assert.equal(p.get('marker'),'true');assert.equal(p.get('product'),'ecmwf');assert.equal(p.get('metricWind'),'km/h');
});
test('forecast-only is a documented table embed, with no map product inherited from radar',()=>{
 const p=new URL(buildWindyEmbedURL({point,view:'forecast',overlay:'radar'})).searchParams;
 assert.equal(p.get('type'),'forecast');assert.equal(p.get('detail'),'true');assert.equal(p.get('detailLon'),'100.47670');assert.equal(p.has('overlay'),false);assert.equal(p.has('product'),false);
});
test('plain map has no point table and radar/satellite use their corresponding products',()=>{
 for(const id of ['radar','satellite']){
  const p=new URL(buildWindyEmbedURL({point,overlay:id})).searchParams;
  assert.equal(p.has('detail'),false);assert.equal(p.get('product'),id);assert.equal(p.get('overlay'),id);
 }
 assert.ok(windyLayers.length>6);
});
test('invalid coordinates are rejected and a missing device location has an explicit safe fallback',()=>{
 for(const value of [{lat:NaN,lon:100},{lat:91,lon:100},{lat:null,lon:100}])assert.throws(()=>buildWindyEmbedURL({point:value}));
 const selected=new WindyPointSelection();assert.equal(selected.point.source,'hatyai');
 selected.select('device',null);assert.equal(selected.point.lat,point.lat);assert.equal(selected.mode,'device');
});
test('late device fixes cannot override explicit Hat Yai or map selection',()=>{
 const selected=new WindyPointSelection();selected.select('hatyai');assert.equal(selected.receiveFix({lat:6.8,lon:101.3}),false);
 assert.equal(selected.point.lat,point.lat);
 selected.select('map',{lat:13.75,lon:100.5});assert.equal(selected.receiveFix(point),false);assert.equal(selected.point.lat,13.75);
 selected.select('device',null);assert.equal(selected.receiveFix({...point,accuracy:9000}),true);assert.equal(selected.point.accuracy,9000);
});
