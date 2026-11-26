'use strict';

// These are control windows, independent from the visibility of map data.
class WorkspacePanels {
  constructor(mobile=false){
    this.mobile=mobile;
    this.open={sidebar:!mobile,display:false,maptools:false,basemap:false,weather:false,timeline:false,advance:false};
    this.minimized={};
  }
  setOpen(name,on){
    if(!(name in this.open))return;
    if(on){
      if(name!=='sidebar')Object.keys(this.open).filter(key=>key!=='sidebar').forEach(key=>this.open[key]=false);
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
  const panels={sidebar:'sidebar',display:'display-panel',maptools:'maptools-panel',basemap:'basemap-panel',weather:'overview-panel',timeline:'radar-player',advance:'advance-forecast-panel'};
  const launchers={sidebar:'layers-toggle',display:'display-toggle',maptools:'maptools-toggle',basemap:'basemap-toggle',timeline:'timeline-toggle',advance:'advance-forecast-toggle'};
  const captions={sidebar:'ชั้นข้อมูล',display:'ชั้นข้อมูลและการแสดงผล',maptools:'เครื่องมือแผนที่',basemap:'แผนที่ฐาน',weather:'สภาพอากาศ',windy:'ตัวเลือกแผนที่อากาศ',seven:'พยากรณ์ 7 วัน'};
  const minimizeButtons={};
  const advanceSelection=new WindyPointSelection();

  function renderAdvanceForecast(){
    const toggle=$('advance-forecast-toggle'),container=state.open.advance?$('advance-forecast-header-actions'):$('bottom-map-actions');
    if(toggle.parentElement!==container)container.prepend(toggle);
    if(!state.open.advance&&toggle.previousElementSibling!==$('timeline-toggle'))container.append(toggle);
    $('advance-forecast-toggle-label').textContent=state.open.advance?'ย่อ':'การพยากรณ์ล่วงหน้า';
    toggle.setAttribute('aria-label',state.open.advance?'ย่อการพยากรณ์ล่วงหน้า':'เปิดการพยากรณ์ล่วงหน้า');
    const frame=$('advance-forecast-frame');
    if(!state.open.advance){if(frame.hasAttribute('src'))frame.removeAttribute('src');return;}
    const p=advanceSelection.point;
    const label=advanceSelection.mode==='device'&&p.source!=='device'?'หาดใหญ่ · จุดสำรอง':p.name;
    $('advance-forecast-point').textContent=`${label} · ${Math.abs(p.lat).toFixed(4)}°${p.lat<0?'S':'N'}, ${Math.abs(p.lon).toFixed(4)}°${p.lon<0?'W':'E'}`;
    $('advance-forecast-location').value=advanceSelection.mode;
    const url=buildWindyEmbedURL({point:p,view:'forecast'});
    if(frame.getAttribute('src')!==url)frame.src=url;
  }

  function render(){
    Object.entries(panels).forEach(([key,id])=>{
      $(id).hidden=!state.open[key];$(id).classList.toggle('is-minimized',Boolean(state.minimized[key]));
      if(launchers[key])$(launchers[key]).setAttribute('aria-expanded',String(state.open[key]));
    });
    $('sidebar').classList.toggle('is-open',state.open.sidebar);
    $('forecast-visible').checked=state.open.weather;
    document.querySelector('.workspace').dataset.timelineOpen=String(state.open.timeline);
    document.querySelector('.workspace').dataset.advanceOpen=String(state.open.advance);
    renderAdvanceForecast();
    Object.entries(minimizeButtons).forEach(([key,button])=>{
      const mini=Boolean(state.minimized[key]);button.textContent=mini?'+':'−';
      button.setAttribute('aria-expanded',String(!mini));button.setAttribute('aria-label',`${mini?'ขยาย':'ย่อ'}${captions[key]}`);
    });
    const frames=rainCollections[radarKind]||radarFrames;
    const forecast=radarKind==='radargis'&&currentRadarGISProduct()?.forecast;
    const latest=state.open.timeline?radarFrames[Number($('radar-slider').value)]:frames[defaultRadarIndex(radarKind,frames)];
    const source={rainviewer:'RainViewer',radar:'TMD',nowcast:'SWIRLS',rod:'RODDSS',radargis:'RadarGIS'}[radarKind];
    $('timeline-summary').textContent=enabled.radar?`${source}${forecast?' พยากรณ์':''} · ${latest?new Date(latest.frame_time).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}):'ล่าสุด'}`:'เลือกแหล่งภาพฝน';
  }
  function restoreLatest(){stopRadar();if(radarFrames.length)showRadarFrame(defaultRadarIndex(radarKind,radarFrames));}
  function setOpen(name,on){
    if(name==='advance'&&on){
      if(advanceSelection.mode==='device')advanceSelection.select('device',window.currentLocation);
      if(!window.currentLocation&&advanceSelection.mode==='device'&&!window.locationPending)requestCurrentLocation(true);
    }
    const previous=state.open.timeline;state.setOpen(name,on);
    if(previous&&!state.open.timeline)restoreLatest();
    if(name==='timeline'&&on&&!enabled.radar)setRainEnabled(radarKind,true);
    render();
  }
  function minimize(key,on){
    state.minimize(key,on);
    if(key==='windy')$('windy-controls').classList.toggle('is-minimized',on);
    if(key==='windy')$('windy-controls-restore').hidden=!on;
    if(key==='seven')$('seven-day-panel').classList.toggle('is-minimized',on);
    render();
  }
  window.workspaceUI={setOpen,closeForWeatherTool(){
    const previous=state.open.timeline,catalogue=state.open.sidebar;state.closeAll();state.open.sidebar=catalogue;if(previous)restoreLatest();
    render();
  }};
  window.syncTimelineUI=render;
  window.isTimelineOpen=()=>state.open.timeline;

  const headers=[
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
  $('windy-controls-restore').addEventListener('click',()=>minimize('windy',false));
  $('advance-forecast-toggle').addEventListener('click',()=>setOpen('advance',!state.open.advance));
  $('advance-forecast-close').addEventListener('click',()=>setOpen('advance',false));
  $('advance-forecast-location').addEventListener('change',event=>{
    const mode=event.target.value,center=mode==='map'?map.getCenter():null;
    advanceSelection.select(mode,mode==='device'?window.currentLocation:mode==='map'?{lat:center.lat,lon:center.lng}:null);
    if(mode==='device'&&!window.locationPending)requestCurrentLocation(true);
    renderAdvanceForecast();
  });
  window.addEventListener('rm-current-location',event=>{if(advanceSelection.receiveFix({...event.detail,...window.currentLocation}))renderAdvanceForecast();});
  $('radar-close').addEventListener('click',()=>setOpen('timeline',false));
  $('locate-quick').addEventListener('click',requestCurrentLocation);
  $('map-zoom-in').addEventListener('click',()=>map.gl.zoomIn());
  $('map-zoom-out').addEventListener('click',()=>map.gl.zoomOut());
  $('reset-layers').addEventListener('click',()=>{const catalogue=state.open.sidebar;state.closeAll();state.open.sidebar=catalogue;render();});
  media.addEventListener('change',event=>{const previous=state.open.timeline;state.setMobile(event.matches);if(previous&&!state.open.timeline)restoreLatest();render();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){setOpen('timeline',false);setOpen('weather',false);setOpen('advance',false);}});
  document.addEventListener('pointerdown',event=>{if(state.open.timeline&&!event.target.closest('#radar-player,#timeline-toggle'))setOpen('timeline',false);});
  document.querySelectorAll('[data-tool="weather-map"],[data-tool-toggle="weather-map"]').forEach(control=>control.addEventListener(control.type==='checkbox'?'change':'click',()=>{
    if(toolVisibility['weather-map'])minimize('windy',state.mobile);
  }));
  render();
}
if(typeof document!=='undefined'&&typeof window!=='undefined')initWorkspaceUI();
if(typeof module!=='undefined')module.exports={WorkspacePanels};
