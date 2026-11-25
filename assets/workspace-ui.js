'use strict';

// These are control windows, independent from the visibility of map data.
class WorkspacePanels {
  constructor(mobile=false){
    this.mobile=mobile;
    this.open={sidebar:!mobile,display:false,maptools:false,basemap:false,weather:false,timeline:false};
    this.minimized={};
  }
  setOpen(name,on){
    if(!(name in this.open))return;
    if(on){
      if(this.mobile)Object.keys(this.open).forEach(key=>this.open[key]=false);
      else if(name!=='sidebar')Object.keys(this.open).filter(key=>key!=='sidebar').forEach(key=>this.open[key]=false);
      this.minimized[name]=false;
    }
    this.open[name]=Boolean(on);
  }
  minimize(name,on){this.minimized[name]=Boolean(on);}
  setMobile(mobile){if(this.mobile!==mobile){this.mobile=mobile;this.closeAll();}}
  closeAll(){Object.keys(this.open).forEach(key=>this.open[key]=false);}
}

function setWeatherCardVisible(on){window.workspaceUI?.setOpen('weather',on);}
function setTimelineOpen(on){window.workspaceUI?.setOpen('timeline',on);}

function initWorkspaceUI(){
  const media=matchMedia('(max-width:700px)'),state=new WorkspacePanels(media.matches);
  const panels={sidebar:'sidebar',display:'display-panel',maptools:'maptools-panel',basemap:'basemap-panel',weather:'overview-panel',timeline:'radar-player'};
  const launchers={sidebar:'layers-toggle',display:'display-toggle',maptools:'maptools-toggle',basemap:'basemap-toggle',timeline:'timeline-toggle'};
  const captions={sidebar:'ชั้นข้อมูล',display:'ชั้นข้อมูลและการแสดงผล',maptools:'เครื่องมือแผนที่',basemap:'แผนที่ฐาน',weather:'สภาพอากาศ',windy:'ตัวเลือกแผนที่อากาศ',seven:'พยากรณ์ 7 วัน'};
  const minimizeButtons={};

  function render(){
    Object.entries(panels).forEach(([key,id])=>{
      $(id).hidden=!state.open[key];$(id).classList.toggle('is-minimized',Boolean(state.minimized[key]));
      if(launchers[key])$(launchers[key]).setAttribute('aria-expanded',String(state.open[key]));
    });
    $('sidebar').classList.toggle('is-open',state.open.sidebar);
    $('forecast-visible').checked=state.open.weather;
    document.querySelector('.workspace').dataset.timelineOpen=String(state.open.timeline);
    Object.entries(minimizeButtons).forEach(([key,button])=>{
      const mini=Boolean(state.minimized[key]);button.textContent=mini?'+':'−';
      button.setAttribute('aria-expanded',String(!mini));button.setAttribute('aria-label',`${mini?'ขยาย':'ย่อ'}${captions[key]}`);
    });
    const latest=(rainCollections[radarKind]||radarFrames).at(-1);
    const source={rainviewer:'RainViewer',radar:'TMD',nowcast:'SWIRLS',rod:'RODDSS'}[radarKind];
    $('timeline-summary').textContent=enabled.radar?`${source} · ${latest?new Date(latest.frame_time).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}):'ล่าสุด'}`:'เลือกแหล่งภาพฝน';
  }
  function restoreLatest(){stopRadar();if(radarFrames.length)showRadarFrame(radarFrames.length-1);}
  function setOpen(name,on){
    const previous=state.open.timeline;state.setOpen(name,on);
    if(previous&&!state.open.timeline)restoreLatest();
    if(name==='timeline'&&on&&!enabled.radar)setRainEnabled(radarKind,true);
    render();
  }
  function minimize(key,on){
    state.minimize(key,on);
    if(key==='windy')$('windy-controls').classList.toggle('is-minimized',on);
    if(key==='seven')$('seven-day-panel').classList.toggle('is-minimized',on);
    render();
  }
  window.workspaceUI={setOpen,closeForWeatherTool(){
    const previous=state.open.timeline;state.closeAll();if(previous)restoreLatest();
    render();
  }};
  window.syncTimelineUI=render;
  window.isTimelineOpen=()=>state.open.timeline;

  const headers=[
    ['sidebar','.drawer-header','sidebar-close','drawer-body'],
    ['display','#display-panel>header','display-close','display-body'],
    ['maptools','#maptools-panel>header','maptools-close','maptools-body'],
    ['basemap','#basemap-panel>header','basemap-close','basemap-body'],
    ['weather','.weather-panel-header','weather-collapse','weather-panel-body'],
    ['windy','#windy-controls>header',null,'windy-controls-body'],
    ['seven','#seven-day-panel>header',null,'seven-day-tmd']
  ];
  headers.forEach(([key,selector,closeID,body])=>{
    const header=document.querySelector(selector),close=closeID?$(closeID):header.querySelector('[data-close-tool]');
    const actions=document.createElement('div');actions.className='popup-header-actions';
    const button=document.createElement('button');button.type='button';button.className='icon-button popup-minimize';button.setAttribute('aria-controls',body);
    button.addEventListener('click',()=>minimize(key,!state.minimized[key]));minimizeButtons[key]=button;
    header.insertBefore(actions,close);actions.append(button,close);
  });
  $('timeline-toggle').addEventListener('click',()=>setOpen('timeline',!state.open.timeline));
  $('radar-close').addEventListener('click',()=>setOpen('timeline',false));
  $('locate-quick').addEventListener('click',requestCurrentLocation);
  $('reset-layers').addEventListener('click',()=>{if(state.mobile){state.closeAll();render();}});
  media.addEventListener('change',event=>{const previous=state.open.timeline;state.setMobile(event.matches);if(previous&&!state.open.timeline)restoreLatest();render();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){setOpen('timeline',false);setOpen('weather',false);}});
  document.addEventListener('pointerdown',event=>{if(state.open.timeline&&!event.target.closest('#radar-player,#timeline-toggle'))setOpen('timeline',false);});
  document.querySelectorAll('[data-tool="weather-map"],[data-tool-toggle="weather-map"]').forEach(control=>control.addEventListener(control.type==='checkbox'?'change':'click',()=>{
    if(toolVisibility['weather-map'])minimize('windy',state.mobile);
  }));
  render();
}
if(typeof document!=='undefined'&&typeof window!=='undefined')initWorkspaceUI();
if(typeof module!=='undefined')module.exports={WorkspacePanels};
