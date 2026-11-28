const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const palette=require('../assets/rainviewer-tmd.js');
const {makeRainSource}=require('../assets/map-engine.js');

test('real Universal Blue tile colours map to the TMD reflectivity classes, preserving transparency',()=>{
 // Observed pixels in /2/0_0.png tiles over southern Thailand, not invented colours.
 const pixels=new Uint8ClampedArray([0,105,156,255, 255,238,0,255, 255,170,0,255, 130,123,105,73, 0,0,0,0]);
 palette.recolour(pixels);
 assert.deepEqual([...pixels],[0,255,0,255, 255,230,0,255, 255,176,0,255, 0,0,0,0, 0,0,0,0]);
 assert.equal(palette.decodeDBZ(0,105,156,255),27);
 assert.equal(palette.decodeDBZ(255,238,0,255),35);
 assert.equal(palette.decodeDBZ(2,105,156,255),27); // Canvas rounding.
 assert.equal(palette.decodeDBZ(100,10,220,255),null);
});
test('TMD class boundaries are discrete, low echoes stay transparent and extreme echoes saturate',()=>{
 assert.equal(palette.colourForDBZ(10.49),null);
 assert.equal(palette.colourForDBZ(10.5).hex,'#00e600');
 assert.equal(palette.colourForDBZ(28.99).hex,'#00ff00');
 assert.equal(palette.colourForDBZ(29).hex,'#ffff00');
 assert.equal(palette.colourForDBZ(46.5).hex,'#ff0000');
 assert.equal(palette.colourForDBZ(66.5).hex,'#ffe6ff');
 assert.equal(palette.colourForDBZ(90).hex,'#ffe6ff');
 assert.equal(palette.colourForDBZ(null),null);
 const key=palette.legend();assert.equal(key.stops.length,44);assert.match(key.label,/RainViewer.*TMD/);
 assert.deepEqual(key.ticks,['ฝนอ่อน','ปานกลาง','ฝนหนัก','หนักมาก']);
});
test('only explicitly recoloured RainViewer frames use the custom protocol and keep provider credit',()=>{
 const url='https://tilecache.rainviewer.com/v2/radar/123/256/6/49/30/2/0_0.png';
 const source=makeRainSource({tile:url,colour_scheme:'tmd'});
 assert.match(source.tiles[0],/^rm-rainviewer-tmd:\/\//);assert.equal(palette.remoteURL(source.tiles[0]),url);
 assert.match(source.attribution,/RainViewer/);assert.equal(source.maxzoom,7);
 assert.equal(makeRainSource({tile:url}).tiles[0],url);
 for(const url of ['https://evil.test/tile','http://tilecache.rainviewer.com/tile','https://rainviewer.com.evil.test/tile'])assert.throws(()=>palette.remoteURL(palette.tileURL(url)));
});
test('tile protocol caches transformed PNGs, propagates cancellation and fails rather than displaying unconverted colours',async()=>{
 let requests=0,drawn;
 const signal=new AbortController(),input=new Uint8ClampedArray([0,105,156,255]);
 const load=palette.makeProtocol({fetchTile:async(url,opts)=>{requests++;assert.equal(opts.signal,signal.signal);assert.equal(opts.credentials,'omit');return {ok:true,blob:async()=>new Blob(['source'])};},decode:async()=>({width:1,height:1,close(){}}),makeCanvas:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:input}),putImageData:p=>drawn=[...p.data]}),convertToBlob:async()=>new Blob(['converted'])})});
 const params={url:palette.tileURL('https://tilecache.rainviewer.com/one.png')};
 const first=await load(params,signal),second=await load(params,signal);
 assert.equal(requests,1);assert.deepEqual(drawn,[0,255,0,255]);
 assert.equal(new TextDecoder().decode(first.data),'converted');assert.notEqual(first.data,second.data);
 signal.abort();await assert.rejects(load(params,signal),{name:'AbortError'});
 const fail=palette.makeProtocol({fetchTile:async()=>({ok:false,status:503})});
 await assert.rejects(fail(params,new AbortController()),/HTTP 503/);
});
test('retired CLPP layers and their clocks are absent while other radar sources remain',()=>{
 const index=fs.readFileSync(require.resolve('../index.html'),'utf8');
 for(const name of ['clppRadar','ฝนสะสมรายจังหวัด','value="clpp"'])assert.equal(index.includes(name),false);
 for(const name of ['data-layer-card="radargis"','data-layer-card="nowcast"','data-layer-card="rainviewer"'])assert.ok(index.includes(name));
 const app=fs.readFileSync(require.resolve('../assets/app.js'),'utf8');assert.ok(app.includes('/2/0_0.png'));assert.ok(app.includes("colour_scheme:'tmd'"));
});
