const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function field(reduced){
  const strokes=[];
  const ctx={setTransform(){},clearRect(){},fillRect(){},stroke(path){strokes.push(path.lines.map(line=>[...line]));}};
  const canvas={style:{},dataset:{},setAttribute(){},getContext:()=>ctx};
  class Path {constructor(){this.lines=[];}moveTo(x,y){this.start=[x,y];}lineTo(x,y){this.lines.push([...this.start,x,y]);}}
  const env={module:{exports:{}},document:{hidden:false,createElement:()=>canvas},devicePixelRatio:1,innerWidth:1000,requestAnimationFrame:()=>1,cancelAnimationFrame(){},matchMedia:()=>({matches:true}),Path2D:Path,Math:Object.assign(Object.create(Math),{random:()=>.5})};
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/map-engine.js'),'utf8'),env);
  const map={getCanvasContainer:()=>({appendChild(){}}),getCanvas:()=>({clientWidth:260,clientHeight:200}),on(){},off(){},isMoving:()=>false,getZoom:()=>10,unproject:()=>({lng:100.5,lat:7.5}),project:([lon,lat])=>({x:(lon-100)*260,y:(8-lat)*200})};
  const h={nx:2,ny:2,lo1:100,la1:8,dx:1,dy:1};
  const records=[{header:{...h,parameterNumber:2},data:[5,5,5,5]},{header:{...h,parameterNumber:3},data:[-2,-2,-2,-2]}];
  const wind=reduced?new env.module.exports.WindParticles(map,records,2,false):new env.module.exports.WindParticles(map,records);
  return {wind,strokes,canvas};
}
test('normal wind advances along east and north GFS components',()=>{
  const {wind,strokes,canvas}=field(false);wind.animate(40);wind.animate(80);
  const first=strokes.flat().find(Boolean);assert.ok(first[2]>first[0]);assert.ok(first[3]>first[1]);
  assert.equal(strokes.length,6);assert.equal(canvas.dataset.motion,'animated');
  assert.ok(strokes[1][0][0]<strokes[4][0][0]);
});
test('the explicit wind pause switch draws a stationary field and redraws after map movement',()=>{
  const {wind,strokes,canvas}=field(true);wind.animate(40);wind.animate(80);
  assert.equal(strokes.length,3);assert.ok(strokes.flat().length>70);assert.equal(canvas.dataset.motion,'static');
  wind.clear();wind.animate(120);assert.equal(strokes.length,6);
});
