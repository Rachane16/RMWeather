'use strict';

// One MapLibre camera drives the basemap, terrain, rain and observation layers.
// Rebuild overlay sources after a style change without changing the camera.
class WeatherMap {
  constructor(container) {
    maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
    this.gl = new maplibregl.Map({container, style:{version:8,sources:{},layers:[]},
      center:[100.4767,7.0084],zoom:10,maxZoom:19,maxPitch:70,attributionControl:false});
    this.gl.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
    this.gl.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
    this.groups = new Map();
    this.terrain = false;
    this.sequence = 0;
    this.base = '';
    this.rain = null;
    this.ready=false;
    this.gl.on('style.load',()=>{this.ready=true;this.restore();});
    this.gl.on('error',event=>{
      console.warn('Map renderer:',event.error?.message||'source error');
      const source=event.sourceId;
      if(source==='rm-rain')document.getElementById('radar-status').textContent='ภาพเฟรมนี้ไม่พร้อม กรุณาเปลี่ยนเวลา';
      if(source==='terrain-dem')document.getElementById('terrain-status').textContent='DEM ยังโหลดไม่ได้ · ลองมุมมอง 2D';
      if(source==='osm'&&this.base==='natural')document.getElementById('terrain-status').textContent='ข้อมูลพื้นแผนที่บางส่วนยังไม่พร้อม · สลับพื้นแผนที่ได้';
    });
    this.gl.on('click',event=>{
      const ids=[...this.groups.keys()].flatMap(id=>[`rm-${id}-cluster`,`rm-${id}-point`]).filter(id=>this.gl.getLayer(id));
      if(ids.length&&this.gl.queryRenderedFeatures(event.point,{layers:ids}).length)return;
      this.onMapClick?.(event.lngLat);
    });
    this.gl.on('move',()=>this.wind?.clear());
    this.gl.on('movestart',()=>this.tooltip?.remove());
  }
  flyTo(point,zoom,options={}) { this.gl.flyTo({center:[point[1],point[0]],zoom,duration:options.duration?options.duration*1000:900}); }
  getCenter() { return this.gl.getCenter(); }
  async setBase(base) {
    const request=++this.sequence;
    const response=await fetch(base.style,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error(`Style HTTP ${response.status}`);
    const style=await response.json();
    if(request!==this.sequence)return false;
    this.base=base.id;
    this.ready=false;
    this.gl.setStyle(style,{diff:false});
    return true;
  }
  setRasterBase(base) {
    ++this.sequence;
    this.base=base.id;
    this.ready=false;
    this.gl.setStyle({version:8,glyphs:'https://s3-public.elemnt.earth/elemnt-opendata/styles/fonts/{fontstack}/{range}.pbf',
      sources:{base:{type:'raster',tiles:[base.url],tileSize:256,maxzoom:base.maxzoom||19,attribution:base.credit}},
      layers:[{id:'base',source:'base',type:'raster'}]},{diff:false});
  }
  restore() {
    this.tooltip?.remove();
    if(!this.gl.getSource('terrain-dem'))this.gl.addSource('terrain-dem',{type:'raster-dem',tiles:['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],encoding:'terrarium',tileSize:512,maxzoom:12,attribution:'<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>'});
    this.gl.setTerrain(this.terrain?{source:'terrain-dem',exaggeration:1.2}:null);
    this.ensureMapIcons();
    this.syncRain();
    this.groups.forEach((group,id)=>this.syncPoints(id));
    const credit=document.getElementById('elemnt-credit');if(credit)credit.hidden=this.base!=='natural';
  }
  setTerrain(on) {
    this.terrain=on;
    if(this.ready)this.gl.setTerrain(on?{source:'terrain-dem',exaggeration:1.2}:null);
    this.gl.easeTo({pitch:on?55:0,duration:650});
  }
  setPoints(id,features,on,onClick) {
    this.groups.set(id,{features,on,onClick});
    this.syncPoints(id);
  }
  enablePoints(id,on) { const group=this.groups.get(id);if(group){group.on=on;this.syncPoints(id);} }
  syncPoints(id) {
    if(!this.ready)return;
    const group=this.groups.get(id),sourceId=`rm-${id}`;
    if(!group)return;
    const data={type:'FeatureCollection',features:group.features};
    if(this.gl.getSource(sourceId))this.gl.getSource(sourceId).setData(data);
    else {
      this.gl.addSource(sourceId,{type:'geojson',data,cluster:['cameras','windycams'].includes(id),clusterRadius:38,clusterMaxZoom:15});
      // A nearly transparent hit area covers the full camera-cluster badge.
      this.gl.addLayer({id:`${sourceId}-cluster`,type:'circle',source:sourceId,filter:['has','point_count'],paint:{'circle-radius':25,'circle-color':'#354354','circle-opacity':.001}});
      this.gl.addLayer({id:`${sourceId}-count`,type:'symbol',source:sourceId,filter:['has','point_count'],layout:{'icon-image':'rm-cluster-camera','icon-allow-overlap':true,'text-field':['get','point_count_abbreviated'],'text-offset':[.6,0],'text-font':['Noto Sans Medium'],'text-size':12,'text-allow-overlap':true},paint:{'text-color':'white'}});
      this.gl.addLayer({id:`${sourceId}-point`,type:'symbol',source:sourceId,filter:['!', ['has','point_count']],layout:{'icon-image':['case',['get','old'],`rm-${id}-old`,`rm-${id}-new`],'icon-anchor':'bottom','icon-size':['interpolate',['linear'],['zoom'],5,.72,12,.88,16,1],'icon-allow-overlap':['cameras','windycams'].includes(id),'icon-ignore-placement':false}});
      // Layer listeners survive style changes; register each pair just once.
      if(!this.boundGroups)this.boundGroups=new Set();
      if(!this.boundGroups.has(id)) {
        this.boundGroups.add(id);
        this.gl.on('click',`${sourceId}-point`,event=>{
          const feature=event.features?.[0];if(feature)this.groups.get(id).onClick(feature.properties.index);
        });
        this.gl.on('click',`${sourceId}-cluster`,async event=>{
          const feature=event.features?.[0];if(!feature)return;
          try {const zoom=await this.gl.getSource(sourceId).getClusterExpansionZoom(feature.properties.cluster_id);this.gl.easeTo({center:feature.geometry.coordinates,zoom});}catch{}
        });
        [`${sourceId}-point`,`${sourceId}-cluster`].forEach(layer=>{
          this.gl.on('mouseenter',layer,event=>{
            this.gl.getCanvas().style.cursor='pointer';
            const feature=event.features?.[0];if(!feature)return;
            const text=feature.properties.point_count?`กล้อง ${feature.properties.point_count} จุด · กดเพื่อซูมเข้า`:feature.properties.title;
            this.tooltip?.remove();this.tooltip=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:layer.endsWith('point')?[0,-35]:[0,-17],className:'map-pin-tooltip'})
              .setLngLat(feature.geometry.coordinates).setText(text||'ดูรายละเอียด').addTo(this.gl);
          });
          this.gl.on('mouseleave',layer,()=>{this.gl.getCanvas().style.cursor='';this.tooltip?.remove();});
        });
      }
    }
    ['point','cluster','count'].forEach(suffix=>this.gl.setLayoutProperty(`${sourceId}-${suffix}`,'visibility',group.on?'visible':'none'));
  }
  setRain(frame) { this.rain=frame;this.syncRain(); }
  syncRain() {
    if(!this.ready)return;
    if(this.gl.getLayer('rm-rain'))this.gl.removeLayer('rm-rain');
    if(this.gl.getSource('rm-rain'))this.gl.removeSource('rm-rain');
    const frame=this.rain;if(!frame)return;
    const source=makeRainSource(frame);
    this.gl.addSource('rm-rain',source);
    const before=this.gl.getStyle().layers.find(layer=>layer.type==='symbol'||layer.id.startsWith('rm-'))?.id;
    this.gl.addLayer({id:'rm-rain',source:'rm-rain',type:'raster',paint:{'raster-opacity':.65,'raster-fade-duration':150}},before);
  }
  setWind(records) {
    this.wind?.destroy();this.wind=null;
    if(records)this.wind=new WindParticles(this.gl,records,this.windContrast||2);
  }
  setWindContrast(value){this.windContrast=value;if(this.wind)this.wind.contrast=value;}
  ensureMapIcons() {
    ['cameras','water','weather','windycams'].forEach(type=>{
      [false,true].forEach(old=>{
        const id=`rm-${type}-${old?'old':'new'}`;
        if(!this.gl.hasImage(id))this.gl.addImage(id,makeMapIcon(type,old),{pixelRatio:2});
      });
    });
    if(!this.gl.hasImage('rm-cluster-camera'))this.gl.addImage('rm-cluster-camera',makeMapIcon('cluster',false),{pixelRatio:2});
  }
}

// Original canvas artwork, inspired by the reference's pin / online-badge
// hierarchy. Raster textures are redrawn per style and remain sharp on retina.
function makeMapIcon(type,old) {
  const canvas=document.createElement('canvas');canvas.width=type==='cluster'?96:72;canvas.height=type==='cluster'?54:88;
  const c=canvas.getContext('2d');c.lineCap='round';c.lineJoin='round';
  if(type==='cluster'){
    c.fillStyle='#354354';c.strokeStyle='#fff';c.lineWidth=4;c.beginPath();c.roundRect(3,4,90,46,23);c.fill();c.stroke();
    drawCameraGlyph(c,16,16,25,'#fff');
  }else{
    const color=type==='water'?'#247cff':type==='weather'?'#3f91ed':type==='windycams'?'#985b8e':'#334155';
    c.shadowColor='#243b4d44';c.shadowBlur=5;c.shadowOffsetY=3;
    c.beginPath();c.moveTo(36,83);c.bezierCurveTo(30,75,9,54,9,36);c.arc(36,36,27,Math.PI,0);c.bezierCurveTo(63,54,42,75,36,83);c.closePath();
    c.fillStyle=type==='cameras'?'#f8fafb':type==='windycams'?'#faedf5':'#ddecff';c.fill();c.shadowBlur=0;c.shadowOffsetY=0;c.lineWidth=3;c.strokeStyle='#fff';c.stroke();
    c.strokeStyle=old?'#7c8c99':color;c.lineWidth=2.5;
    c.beginPath();c.arc(36,36,22,0,Math.PI*2);c.stroke();
    if(type==='cameras'||type==='windycams')drawCameraGlyph(c,22,27,28,old?'#7c8c99':color);
    else if(type==='water'){
      c.strokeStyle=old?'#7c8c99':color;c.lineWidth=3;
      [27,36,45].forEach(y=>{c.beginPath();c.moveTo(20,y);for(let x=20;x<52;x+=8)c.bezierCurveTo(x+3,y-7,x+5,y+7,x+8,y);c.stroke();});
    }else{
      c.strokeStyle=old?'#7c8c99':color;c.lineWidth=2.7;c.beginPath();c.moveTo(24,37);c.bezierCurveTo(18,37,19,25,29,25);c.bezierCurveTo(31,16,46,19,47,29);c.bezierCurveTo(58,29,55,39,48,39);c.lineTo(25,39);c.stroke();
      [29,38,47].forEach(x=>{c.beginPath();c.moveTo(x,45);c.lineTo(x-3,51);c.stroke();});
    }
    c.beginPath();c.arc(57,13,8,0,Math.PI*2);c.fillStyle=old?'#8797a2':'#17b99a';c.fill();c.strokeStyle='#fff';c.lineWidth=3;c.stroke();
  }
  return c.getImageData(0,0,canvas.width,canvas.height);
}
function drawCameraGlyph(c,x,y,size,color){
  c.strokeStyle=color;c.lineWidth=2.5;c.beginPath();c.roundRect(x,y,size*.67,size*.58,4);c.moveTo(x+size*.67,y+size*.14);c.lineTo(x+size,y);c.lineTo(x+size,y+size*.58);c.lineTo(x+size*.67,y+size*.44);c.stroke();
}

// GFS vectors are interpolated geographically, then projected through MapLibre's
// current camera. Their position remains geographic at any bearing and pitch.
function sampleWind(records,longitude,latitude) {
  const u=records?.find(r=>r.header.parameterNumber===2),v=records?.find(r=>r.header.parameterNumber===3);
  if(!u||!v)return null;
  const h=u.header,x=(longitude-h.lo1)/h.dx,y=(h.la1-latitude)/h.dy;
  if(x<0||y<0||x>=h.nx-1||y>=h.ny-1)return null;
  const i=Math.floor(x),j=Math.floor(y),a=x-i,b=y-j;
  const interpolate=record=>{
    const values=[record.data[j*h.nx+i],record.data[j*h.nx+i+1],record.data[(j+1)*h.nx+i],record.data[(j+1)*h.nx+i+1]];
    if(values.some(n=>n==null||!Number.isFinite(n)))return null;
    return values[0]*(1-a)*(1-b)+values[1]*a*(1-b)+values[2]*(1-a)*b+values[3]*a*b;
  };
  const east=interpolate(u),north=interpolate(v);return east==null||north==null?null:[east,north];
}
class WindParticles {
  constructor(map,records,contrast=2) {
    this.map=map;this.records=records;this.contrast=contrast;this.canvas=document.createElement('canvas');this.canvas.className='wind-canvas';
    this.canvas.setAttribute('aria-hidden','true');map.getCanvasContainer().appendChild(this.canvas);this.ctx=this.canvas.getContext('2d');this.particles=[];
    this.resize=()=>{
      this.width=map.getCanvas().clientWidth;this.height=map.getCanvas().clientHeight;
      const ratio=Math.min(devicePixelRatio||1,2);
      this.canvas.width=Math.round(this.width*ratio);this.canvas.height=Math.round(this.height*ratio);
      this.canvas.style.width=this.width+'px';this.canvas.style.height=this.height+'px';
      this.ctx.setTransform(ratio,0,0,ratio,0,0);this.particles=[];
    };
    map.on('resize',this.resize);this.resize();this.frame=0;this.animate(0);
  }
  clear(){this.ctx.clearRect(0,0,this.width,this.height);this.particles=[];}
  seed(){const p=this.map.unproject([Math.random()*this.width,Math.random()*this.height]);return {lon:p.lng,lat:p.lat,age:Math.random()*70};}
  animate(now) {
    this.raf=requestAnimationFrame(t=>this.animate(t));
    if(document.hidden||this.map.isMoving()||now-this.frame<40)return;
    const dt=Math.min((now-this.frame)/1000||.04,.08);this.frame=now;
    const c=this.ctx,w=this.width,h=this.height;
    c.globalCompositeOperation='destination-in';c.fillStyle='rgba(0,0,0,.94)';c.fillRect(0,0,w,h);c.globalCompositeOperation='source-over';
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count=reduced?80:Math.min(innerWidth<700?420:1600,Math.floor(w*h/900));
    while(this.particles.length<count)this.particles.push(this.seed());
    c.beginPath();
    // Animation is accelerated for readability; the data card gives true m/s.
    const acceleration=4000/Math.pow(2,Math.max(0,this.map.getZoom()-8));
    this.particles.forEach((p,index)=>{
      const velocity=sampleWind(this.records,p.lon,p.lat);
      if(!velocity||p.age++>90){this.particles[index]=this.seed();return;}
      const a=this.map.project([p.lon,p.lat]);
      p.lon+=velocity[0]*dt*acceleration/(111320*Math.cos(p.lat*Math.PI/180));p.lat+=velocity[1]*dt*acceleration/111320;
      const b=this.map.project([p.lon,p.lat]);
      if(b.x<0||b.y<0||b.x>w||b.y>h){this.particles[index]=this.seed();return;}
      c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);
    });
    // White cores plus a dark halo stay visible on imagery, pale terrain and rain.
    c.lineWidth=2.7+this.contrast*.65;c.strokeStyle='rgba(28,55,65,.38)';c.stroke();
    c.lineWidth=.7+this.contrast*.55;c.strokeStyle='rgba(255,255,255,.96)';c.stroke();
  }
  destroy(){cancelAnimationFrame(this.raf);this.map.off('resize',this.resize);this.canvas.remove();}
}
function makeRainSource(frame){
  return frame.tile?{type:'raster',tiles:[frame.tile],tileSize:256,maxzoom:7,attribution:'Radar © <a href="https://www.rainviewer.com/">RainViewer</a>'}:
      {type:'image',url:frame.image_url,coordinates:[[frame.bounds[0][1],frame.bounds[1][0]],[frame.bounds[1][1],frame.bounds[1][0]],[frame.bounds[1][1],frame.bounds[0][0]],[frame.bounds[0][1],frame.bounds[0][0]]]};
}
if(typeof module!=='undefined')module.exports={sampleWind,makeRainSource};
