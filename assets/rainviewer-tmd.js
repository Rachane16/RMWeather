'use strict';

// RainViewer remains the data source. Recolour its unsmoothed rain palette;
// never apply a CSS hue filter or infer rainfall amounts from map colours.
// Tables: https://www.rainviewer.com/files/rainviewer_api_colors_table.csv
// TMD DBZ_CLASSES: https://radargis.tmd.go.th/ (checked 2026-11-28).
const RainViewerTMD=(()=>{
  const UNIVERSAL_BLUE=[[-32,"#00000000"],[-31,"#00000000"],[-30,"#00000000"],[-29,"#00000000"],[-28,"#00000000"],[-27,"#00000000"],[-26,"#00000000"],[-25,"#00000000"],[-24,"#00000000"],[-23,"#00000000"],[-22,"#00000000"],[-21,"#00000000"],[-20,"#00000000"],[-19,"#00000000"],[-18,"#00000000"],[-17,"#00000000"],[-16,"#00000000"],[-15,"#00000000"],[-14,"#00000000"],[-13,"#00000000"],[-12,"#00000000"],[-11,"#00000000"],[-10,"#63615914"],[-9,"#66635a19"],[-8,"#69665c1e"],[-7,"#6c685d24"],[-6,"#6f6b5f29"],[-5,"#726e612e"],[-4,"#75706234"],[-3,"#78736439"],[-2,"#7c75653e"],[-1,"#7f786744"],[0,"#827b6949"],[1,"#857d6a4e"],[2,"#88806c54"],[3,"#8b826d59"],[4,"#8e856f5e"],[5,"#92887164"],[6,"#9e93756e"],[7,"#aa9e7978"],[8,"#b6a97e82"],[9,"#c2b4828c"],[10,"#cec08796"],[11,"#d2c48ba0"],[12,"#d6c88faa"],[13,"#dacc93b4"],[14,"#ded097be"],[15,"#88ddeeff"],[16,"#6cd1ebff"],[17,"#51c5e8ff"],[18,"#36bae5ff"],[19,"#1baee2ff"],[20,"#00a3e0ff"],[21,"#009ad5ff"],[22,"#0091caff"],[23,"#0088bfff"],[24,"#007fb4ff"],[25,"#0077aaff"],[26,"#0070a3ff"],[27,"#00699cff"],[28,"#006295ff"],[29,"#005b8eff"],[30,"#005588ff"],[31,"#005180ff"],[32,"#004e78ff"],[33,"#004a70ff"],[34,"#004768ff"],[35,"#ffee00ff"],[36,"#ffe000ff"],[37,"#ffd200ff"],[38,"#ffc500ff"],[39,"#ffb700ff"],[40,"#ffaa00ff"],[41,"#ff9f00ff"],[42,"#ff9500ff"],[43,"#ff8b00ff"],[44,"#ff8100ff"],[45,"#ff4400ff"],[46,"#f23600ff"],[47,"#e62800ff"],[48,"#d91b00ff"],[49,"#cd0d00ff"],[50,"#c10000ff"],[51,"#a80000ff"],[52,"#8f0000ff"],[53,"#760000ff"],[54,"#5d0000ff"],[55,"#ffaaffff"],[56,"#ff9fffff"],[57,"#ff95ffff"],[58,"#ff8bffff"],[59,"#ff81ffff"],[60,"#ff77ffff"],[61,"#ff6cffff"],[62,"#ff62ffff"],[63,"#ff58ffff"],[64,"#ff4effff"],[65,"#ffffffff"],[66,"#ffffffff"],[67,"#ffffffff"],[68,"#ffffffff"],[69,"#ffffffff"],[70,"#ffffffff"],[71,"#ffffffff"],[72,"#ffffffff"],[73,"#ffffffff"],[74,"#ffffffff"],[75,"#00ff00ff"],[76,"#00ff00ff"],[77,"#00ff00ff"],[78,"#00ff00ff"],[79,"#00ff00ff"],[80,"#00ff00ff"],[81,"#00ff00ff"],[82,"#00ff00ff"],[83,"#00ff00ff"],[84,"#00ff00ff"],[85,"#00ff00ff"],[86,"#00ff00ff"],[87,"#00ff00ff"],[88,"#00ff00ff"],[89,"#00ff00ff"],[90,"#00ff00ff"],[91,"#00ff00ff"],[92,"#00ff00ff"],[93,"#00ff00ff"],[94,"#00ff00ff"],[95,"#00ff00ff"]];
  const TMD_DBZ_CLASSES=[[10.5,11.5,"#00e600"],[11.5,16.5,"#00c800"],[16.5,19.0,"#00c000"],[19.0,21.5,"#00cc00"],[21.5,24.0,"#00e800"],[24.0,26.5,"#00e000"],[26.5,29.0,"#00ff00"],[29.0,31.5,"#ffff00"],[31.5,34.0,"#fff000"],[34.0,36.5,"#ffe600"],[36.5,39.0,"#ffd000"],[39.0,41.5,"#ffb000"],[41.5,44.0,"#ffa000"],[44.0,46.5,"#ff6a00"],[46.5,49.0,"#ff0000"],[49.0,51.5,"#e0003c"],[51.5,54.0,"#cc0044"],[54.0,56.5,"#c00070"],[56.5,59.0,"#ff00f5"],[59.0,61.5,"#f05cf0"],[61.5,64.0,"#f7a0f7"],[64.0,66.5,"#ffe6ff"]];
  const rgba=hex=>hex.replace('#','').match(/../g).map(v=>parseInt(v,16));
  const classes=TMD_DBZ_CLASSES.map(([min,max,hex])=>({min,max,hex,rgb:rgba(hex)}));
  const colourForDBZ=dbz=>{
    if(!Number.isFinite(dbz)||dbz<classes[0].min)return null;
    return classes.find(c=>dbz<c.max)||classes.at(-1);
  };
  const source=UNIVERSAL_BLUE.map(([dbz,hex])=>({dbz,rgba:rgba(hex)})).filter(c=>c.rgba[3]);
  const pixelKey=(r,g,b,a)=>((r<<24)|(g<<16)|(b<<8)|a)>>>0;
  const lookup=new Map(source.map(c=>[pixelKey(...c.rgba),c.dbz]));
  const nearest=new Map();
  function decodeDBZ(r,g,b,a){
    if(!a)return null;
    const key=pixelKey(r,g,b,a);
    if(lookup.has(key))return lookup.get(key);
    if(nearest.has(key))return nearest.get(key);
    // Canvas may round partially transparent RGB during premultiplication.
    // Unrecognised pixels stay transparent instead of inventing rain echoes.
    let best=null,distance=Infinity;
    for(const c of source){
      const [cr,cg,cb,ca]=c.rgba,d=(r-cr)**2+(g-cg)**2+(b-cb)**2+(a-ca)**2;
      if(d<distance){distance=d;best=c.dbz;}
    }
    if(distance>100)best=null;
    if(nearest.size>=1024)nearest.clear();
    nearest.set(key,best);return best;
  }
  function recolour(pixels){
    for(let i=0;i<pixels.length;i+=4){
      const dbz=decodeDBZ(pixels[i],pixels[i+1],pixels[i+2],pixels[i+3]);
      const colour=dbz===null?null:colourForDBZ(dbz);
      if(!colour){pixels[i]=pixels[i+1]=pixels[i+2]=pixels[i+3]=0;continue;}
      [pixels[i],pixels[i+1],pixels[i+2]]=colour.rgb;
    }
    return pixels;
  }
  function legend(){
    const stops=classes.flatMap(c=>{
      const position=v=>(v-classes[0].min)/(classes.at(-1).max-classes[0].min)*100;
      return [`${c.hex} ${position(c.min)}%`,`${c.hex} ${position(c.max)}%`];
    });
    return {label:'RainViewer · สีเทียบเกณฑ์ TMD',unit:'',stops,ticks:['ฝนอ่อน','ปานกลาง','ฝนหนัก','หนักมาก']};
  }
  const protocol='rm-rainviewer-tmd://',installed=new WeakSet();
  function tileURL(url){return protocol+url;}
  function remoteURL(url){
    if(!url.startsWith(protocol))throw Error('Invalid RainViewer tile protocol');
    const remote=new URL(url.slice(protocol.length));
    if(remote.protocol!=='https:'||!/(^|\.)rainviewer\.com$/i.test(remote.hostname)||remote.username||remote.password)throw Error('Invalid RainViewer tile host');
    return remote.href;
  }
  async function imageForBlob(blob){
    if(typeof createImageBitmap==='function')return createImageBitmap(blob);
    const url=URL.createObjectURL(blob);
    try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Cannot decode RainViewer PNG'));image.src=url;});}
    finally{URL.revokeObjectURL(url);}
  }
  function makeProtocol({fetchTile=fetch,decode=imageForBlob,makeCanvas}={}){
    const cache=new Map(),limit=32;
    return async (params,abortController)=>{
      const signal=abortController.signal,url=remoteURL(params.url);
      signal.throwIfAborted();
      if(cache.has(url)){
        const blob=cache.get(url);cache.delete(url);cache.set(url,blob);
        return {data:await blob.arrayBuffer()};
      }
      const response=await fetchTile(url,{signal,credentials:'omit'});
      if(!response.ok)throw Error(`RainViewer tile HTTP ${response.status}`);
      const image=await decode(await response.blob());
      let canvas;
      try{
        signal.throwIfAborted();
        canvas=makeCanvas?makeCanvas(image.width,image.height):typeof OffscreenCanvas==='function'?new OffscreenCanvas(image.width,image.height):Object.assign(document.createElement('canvas'),{width:image.width,height:image.height});
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx)throw Error('RainViewer colour conversion is unavailable');
        ctx.drawImage(image,0,0);
        const pixels=ctx.getImageData(0,0,image.width,image.height);
        recolour(pixels.data);ctx.putImageData(pixels,0,0);
      }finally{image.close?.();}
      const blob=canvas.convertToBlob?await canvas.convertToBlob({type:'image/png'}):await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Cannot encode RainViewer tile')),'image/png'));
      signal.throwIfAborted();
      cache.set(url,blob);if(cache.size>limit)cache.delete(cache.keys().next().value);
      // Fresh buffer per request: worker transfers must not detach cached bytes.
      return {data:await blob.arrayBuffer()};
    };
  }
  function install(maplibre){
    if(installed.has(maplibre))return;
    maplibre.addProtocol('rm-rainviewer-tmd',makeProtocol());installed.add(maplibre);
  }
  return {colourForDBZ,decodeDBZ,recolour,legend,tileURL,remoteURL,makeProtocol,install};
})();
if(typeof module!=='undefined')module.exports=RainViewerTMD;
