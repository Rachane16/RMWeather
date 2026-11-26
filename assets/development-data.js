'use strict';

// Windy-style thresholds sampled from the owner's reference, rates in mm/h.
const DEVELOPMENT_RAIN_STOPS=[[0,39,17,158],[.6,0,148,143],[3,102,208,81],[12,244,184,18],[50,204,74,83],[200,155,15,109]];
function developmentRainColour(value){
  if(value==null||!Number.isFinite(value)||value<=0)return [0,0,0,0];
  let hi=DEVELOPMENT_RAIN_STOPS.findIndex(p=>p[0]>=value);if(hi<0)hi=DEVELOPMENT_RAIN_STOPS.length-1;
  const low=DEVELOPMENT_RAIN_STOPS[Math.max(0,hi-1)],high=DEVELOPMENT_RAIN_STOPS[hi],weight=hi===0?0:Math.min(1,(value-low[0])/(high[0]-low[0]));
  // Light rain remains visible without obscuring the basemap in a solid haze.
  const alpha=Math.round(45+160*Math.min(1,value/.6));
  return [1,2,3].map(k=>Math.round(low[k]+(high[k]-low[k])*weight)).concat(alpha);
}

// Display sampling does not increase the source grid's spatial resolution.
function developmentSample(values,grid,lon,lat){
  const x=(lon-grid.west)/grid.step,y=(grid.north-lat)/grid.step;
  if(x<0||y<0||x>grid.nx-1||y>grid.ny-1)return null;
  const i=Math.min(Math.floor(x),grid.nx-2),j=Math.min(Math.floor(y),grid.ny-2),a=x-i,b=y-j;
  const weights=[(1-a)*(1-b),a*(1-b),(1-a)*b,a*b];
  const data=[values[j*grid.nx+i],values[j*grid.nx+i+1],values[(j+1)*grid.nx+i],values[(j+1)*grid.nx+i+1]];
  if(data.some((v,k)=>weights[k]>1e-10&&(v==null||!Number.isFinite(v))))return null;
  return data.reduce((s,v,k)=>s+(v??0)*weights[k],0);
}
function developmentWind(frame,grid){
  return [2,3].map((parameterNumber,i)=>({header:{parameterNumber,nx:grid.nx,ny:grid.ny,lo1:grid.west,la1:grid.north,dx:grid.step,dy:grid.step},data:(i?frame.v:frame.u).map((v,k)=>developmentRegionMask(grid,grid.west+(k%grid.nx)*grid.step,grid.north-Math.floor(k/grid.nx)*grid.step)>0?v:null)}));
}
// Elliptical display footprint in map projection, within the actual sampled grid.
// A soft rim removes the rectangular cutoff without extrapolating outside data.
function developmentRegionMask(grid,lon,lat){
  const east=grid.west+(grid.nx-1)*grid.step,south=grid.north-(grid.ny-1)*grid.step;
  if(lon<grid.west||lon>east||lat<south||lat>grid.north)return 0;
  const merc=v=>Math.log(Math.tan(Math.PI/4+v*Math.PI/360));
  const x=2*(lon-grid.west)/(east-grid.west)-1,y=2*(merc(lat)-merc(south))/(merc(grid.north)-merc(south))-1;
  const radius=Math.hypot(x,y);return Math.max(0,Math.min(1,(1-radius)/.08));
}
function developmentCurrentFrame(frames,now=Date.now()/1000){
  const current=frames.findIndex(f=>Number.isFinite(f.start)&&f.start<=now&&now<f.time);
  return {index:current<0?developmentLatest(frames,now):current,current:current>=0};
}
function developmentLatest(frames,now=Date.now()/1000){
  const i=frames.findIndex(f=>f.time>=now);return i<0?Math.max(0,frames.length-1):i;
}
function developmentStations(payload){
  const fields=payload.fields;
  if(!Array.isArray(fields)||!['lat','lon','name','mm','obs','mm24','obs24'].every(k=>fields.includes(k)))throw Error('รูปแบบสถานีไม่รองรับ');
  return payload.stations.map(row=>Object.fromEntries(fields.map((key,i)=>[key,row[i]])))
    .filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon)&&Math.abs(s.lat)<=90&&Math.abs(s.lon)<=180);
}
function developmentPixelPosition(bounds,lon,lat,width,height){
  const [[south,west],[north,east]]=bounds;
  if(lon<west||lon>east||lat<south||lat>north)return null;
  // Match the displayed image quad in Mercator, including the nonlinear Y axis.
  const merc=value=>Math.log(Math.tan(Math.PI/4+value*Math.PI/360));
  return [Math.min(width-1,Math.floor((lon-west)/(east-west)*width)),Math.min(height-1,Math.floor((merc(north)-merc(lat))/(merc(north)-merc(south))*height))];
}
function developmentColourRange(rgba,colours,levels){
  if(rgba[3]<20)return {text:'ไม่มีสีสะท้อน / ไม่มีข้อมูล',min:null,max:null};
  let index=-1,distance=Infinity;
  colours.forEach((c,i)=>{const d=c.reduce((s,v,k)=>s+(v-rgba[k])**2,0);if(d<distance){distance=d;index=i;}});
  if(index<0||distance>1800)return {text:'อ่านระดับสีไม่ได้',min:null,max:null};
  const low=levels[index],high=levels[index+1]??null;
  return {min:low,max:high,text:high==null?`≥ ${low}`:`${low}–${high}`};
}
if(typeof module!=='undefined')module.exports={developmentSample,developmentWind,developmentLatest,developmentCurrentFrame,developmentRegionMask,developmentStations,developmentPixelPosition,developmentColourRange,developmentRainColour,DEVELOPMENT_RAIN_STOPS};
