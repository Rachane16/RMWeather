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
// Full rectangular footprint; never extrapolate beyond sampled data.
function developmentRegionMask(grid,lon,lat){
 const east=grid.west+(grid.nx-1)*grid.step,south=grid.north-(grid.ny-1)*grid.step;
 return lon>=grid.west&&lon<=east&&lat>=south&&lat<=grid.north?1:0;
}
function developmentCurrentFrame(frames,now=Date.now()/1000){
  const current=frames.findIndex(f=>Number.isFinite(f.start)&&f.start<=now&&now<f.time);
  return {index:current<0?developmentLatest(frames,now):current,current:current>=0};
}
function developmentLatest(frames,now=Date.now()/1000){
  const i=frames.findIndex(f=>f.time>=now);return i<0?Math.max(0,frames.length-1):i;
}
if(typeof module!=='undefined')module.exports={developmentSample,developmentWind,developmentLatest,developmentCurrentFrame,developmentRegionMask,developmentRainColour,DEVELOPMENT_RAIN_STOPS};
