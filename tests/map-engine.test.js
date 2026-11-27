const {test}=require('node:test');
const assert=require('node:assert/strict');
const {sampleWind,makeRainSource,WeatherMap}=require('../assets/map-engine.js');
const header={nx:2,ny:2,lo1:100,la1:8,dx:1,dy:1};
const records=[{header:{...header,parameterNumber:2},data:[0,2,2,4]},
  {header:{...header,parameterNumber:3},data:[-4,-2,-2,0]}];
test('camera cluster symbols display their count without requesting remote font glyphs',()=>{
  const layers=new Map(),sources=new Map();
  const gl={getSource:id=>sources.get(id),addSource:(id,s)=>sources.set(id,s),addLayer:l=>layers.set(l.id,l),on(){},setLayoutProperty(){}};
  const map=Object.assign(Object.create(WeatherMap.prototype),{gl,ready:true,groups:new Map([['cameras',{features:[],on:true,onClick(){}}]])});
  map.syncPoints('cameras');
  const layout=layers.get('rm-cameras-count').layout;
  assert.equal(layout['text-font'],undefined);assert.equal(layout['text-field'],undefined);
  assert.deepEqual(layout['icon-image'],['concat','rm-camera-cluster-',['to-string',['get','point_count']]]);
});
test('image playback reuses its source, retains the current texture and skips identical frames',()=>{
  let updates=0,removed=0;const source={updateImage(){updates++;}};
  const gl={getSource:()=>source,getLayer:()=>true,removeSource(){removed++;}};
  const map=Object.assign(Object.create(WeatherMap.prototype),{gl,ready:true,rains:new Map()});
  const frame={image_url:'one.png',bounds:[[5,96],[12,103]]};
  map.setRain(frame,'rod');map.setRain({...frame},'rod');map.setRain({...frame,image_url:'two.png'},'rod');
  assert.equal(updates,2);assert.equal(removed,0);
});
test('radar playback waits for an outstanding frame instead of repeatedly aborting its image load',()=>{
  let loaded=false;
  const map=Object.assign(Object.create(WeatherMap.prototype),{ready:true,gl:{getSource:()=>({}),isSourceLoaded:()=>loaded}});
  assert.equal(map.isRainReady('rod'),false);loaded=true;assert.equal(map.isRainReady('rod'),true);
  map.ready=false;assert.equal(map.isRainReady('rod'),false);
});
test('GFS interpolates east and north components with rows running north to south',()=>{
  assert.deepEqual(sampleWind(records,100.5,7.5),[2,-2]);
  assert.deepEqual(sampleWind([...records].reverse(),100,8),[0,-4]);
});
test('rain providers keep separate sources across updates, removal and a style restore',()=>{
  const sources=new Map(),layers=new Map();
  const gl={getLayer:id=>layers.get(id),getSource:id=>sources.get(id),removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id),addSource:(id,s)=>sources.set(id,s),addLayer:l=>layers.set(l.id,l),getStyle:()=>({layers:[...layers.values()]})};
  const map=Object.assign(Object.create(WeatherMap.prototype),{gl,ready:true,rains:new Map()});
  const frame={image_url:'test.png',bounds:[[5,96],[12,103]]};
  map.setRain(frame,'radar');map.setRain({tile:'https://tiles.example/{z}/{x}/{y}.png'},'rainviewer');
  assert.equal(sources.size,2);assert.equal(layers.get('rm-rain-rainviewer').paint['raster-opacity'],.46);
  map.setRain(null,'radar');assert.equal(sources.size,1);assert.ok(sources.has('rm-rain-rainviewer'));
  map.ready=false;map.setRain(frame,'nowcast');sources.clear();layers.clear();map.ready=true;map.syncRain();
  assert.deepEqual([...sources.keys()].sort(),['rm-rain-nowcast','rm-rain-rainviewer']);
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

test('station taps search a touch-sized area and open only the closest enabled station',()=>{
 const opened=[],fallback=[];let area,requested;
 const feature=(id,index,x,y)=>({layer:{id:'rm-'+id+'-point'},properties:{index},geometry:{coordinates:[x,y]}});
 const gl={getLayer:()=>true,project:a=>({x:a[0],y:a[1]}),queryRenderedFeatures:(box,options)=>{area=box;requested=options.layers;return [feature('rain',4,108,100),feature('water',7,102,101)];}};
 const map=Object.assign(Object.create(WeatherMap.prototype),{gl,groups:new Map([
  ['rain',{on:true,onClick:i=>opened.push(['rain',i])}],['water',{on:true,onClick:i=>opened.push(['water',i])}],['weather',{on:false,onClick:()=>assert.fail('disabled station')}]
 ]),onMapClick:p=>fallback.push(p)});
 map.handleMapClick({point:{x:100,y:100},lngLat:{lng:100,lat:7}});
 assert.deepEqual(area,[[88,88],[112,112]]);assert.equal(requested.includes('rm-weather-point'),false);
 assert.deepEqual(opened,[['water',7]]);assert.equal(fallback.length,0);
 gl.queryRenderedFeatures=()=>[];map.handleMapClick({point:{x:100,y:100},lngLat:{lng:100,lat:7}});
 assert.equal(fallback.length,1);
});
