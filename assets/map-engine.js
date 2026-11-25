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
    if(!this.gl.getSource('terrain-dem'))this.gl.addSource('terrain-dem',{type:'raster-dem',tiles:['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],encoding:'terrarium',tileSize:512,maxzoom:12,attribution:'<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>'});
    this.gl.setTerrain(this.terrain?{source:'terrain-dem',exaggeration:1.2}:null);
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
      this.gl.addSource(sourceId,{type:'geojson',data,cluster:id==='cameras',clusterRadius:38,clusterMaxZoom:15});
      const color=id==='cameras'?'#177c66':id==='water'?'#397eaa':'#c59836';
      this.gl.addLayer({id:`${sourceId}-cluster`,type:'circle',source:sourceId,filter:['has','point_count'],paint:{'circle-radius':19,'circle-color':color,'circle-stroke-color':'white','circle-stroke-width':2}});
      this.gl.addLayer({id:`${sourceId}-count`,type:'symbol',source:sourceId,filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Noto Sans Medium'],'text-size':13},paint:{'text-color':'white'}});
      this.gl.addLayer({id:`${sourceId}-point`,type:'circle',source:sourceId,filter:['!', ['has','point_count']],paint:{'circle-radius':id==='cameras'?8:6,'circle-color':['case',['get','old'],'#87938c',color],'circle-stroke-color':'white','circle-stroke-width':2}});
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
          this.gl.on('mouseenter',layer,()=>this.gl.getCanvas().style.cursor='pointer');
          this.gl.on('mouseleave',layer,()=>this.gl.getCanvas().style.cursor='');
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
    const source=frame.tile?{type:'raster',tiles:[frame.tile],tileSize:256,maxzoom:7,attribution:'Radar © <a href="https://www.rainviewer.com/">RainViewer</a>'}:
      {type:'image',url:frame.image_url,coordinates:[[frame.bounds[0][1],frame.bounds[1][0]],[frame.bounds[1][1],frame.bounds[1][0]],[frame.bounds[1][1],frame.bounds[0][0]],[frame.bounds[0][1],frame.bounds[0][0]]],attribution:'TMD / One Data'};
    this.gl.addSource('rm-rain',source);
    const before=this.gl.getStyle().layers.find(layer=>layer.type==='symbol'||layer.id.startsWith('rm-'))?.id;
    this.gl.addLayer({id:'rm-rain',source:'rm-rain',type:'raster',paint:{'raster-opacity':.65,'raster-fade-duration':150}},before);
  }
  setWind(records) {
    this.wind?.destroy();this.wind=null;
    if(records)this.wind=new WindParticles(this.gl,records);
  }
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
  constructor(map,records) {
    this.map=map;this.records=records;this.canvas=document.createElement('canvas');this.canvas.className='wind-canvas';
    this.canvas.setAttribute('aria-hidden','true');map.getCanvasContainer().appendChild(this.canvas);this.ctx=this.canvas.getContext('2d');this.particles=[];
    this.resize=()=>{this.canvas.width=map.getCanvas().clientWidth;this.canvas.height=map.getCanvas().clientHeight;this.particles=[];};
    map.on('resize',this.resize);this.resize();this.frame=0;this.animate(0);
  }
  clear(){this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.particles=[];}
  seed(){const p=this.map.unproject([Math.random()*this.canvas.width,Math.random()*this.canvas.height]);return {lon:p.lng,lat:p.lat,age:Math.random()*70};}
  animate(now) {
    this.raf=requestAnimationFrame(t=>this.animate(t));
    if(document.hidden||this.map.isMoving()||now-this.frame<40)return;
    const dt=Math.min((now-this.frame)/1000||.04,.08);this.frame=now;
    const c=this.ctx,w=this.canvas.width,h=this.canvas.height;
    c.globalCompositeOperation='destination-in';c.fillStyle='rgba(0,0,0,.92)';c.fillRect(0,0,w,h);c.globalCompositeOperation='source-over';
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count=reduced?80:Math.min(650,Math.floor(w*h/1900));
    while(this.particles.length<count)this.particles.push(this.seed());
    c.lineWidth=1.3;c.strokeStyle='rgba(33,126,119,.8)';c.beginPath();
    // Animation is accelerated for readability; the data card gives true m/s.
    const acceleration=1800/Math.pow(2,Math.max(0,this.map.getZoom()-8));
    this.particles.forEach((p,index)=>{
      const velocity=sampleWind(this.records,p.lon,p.lat);
      if(!velocity||p.age++>90){this.particles[index]=this.seed();return;}
      const a=this.map.project([p.lon,p.lat]);
      p.lon+=velocity[0]*dt*acceleration/(111320*Math.cos(p.lat*Math.PI/180));p.lat+=velocity[1]*dt*acceleration/111320;
      const b=this.map.project([p.lon,p.lat]);
      if(b.x<0||b.y<0||b.x>w||b.y>h){this.particles[index]=this.seed();return;}
      c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);
    });c.stroke();
  }
  destroy(){cancelAnimationFrame(this.raf);this.map.off('resize',this.resize);this.canvas.remove();}
}
if(typeof module!=='undefined')module.exports={sampleWind};
