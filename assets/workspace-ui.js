'use strict';

// These are control windows, independent from the visibility of map data.
class WorkspacePanels {
  constructor(mobile=false){
    this.mobile=mobile;
    this.open={sidebar:!mobile,display:false,maptools:false,basemap:false,weather:false,timeline:false,advance:false,development:false};
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

function playbackAvailability({radarSelected=false,radarEnabled=false,clpp=false,model=false,advance=false}={}){return {radar:!advance&&(clpp||(radarSelected&&radarEnabled)),model:!advance&&model};}

function setWeatherCardVisible(on){window.workspaceUI?.setOpen('weather',on);}
function setTimelineOpen(on){window.workspaceUI?.setOpen('timeline',on);}

function initWorkspaceUI(){
  document.querySelector('.right-launchers').append($('advance-forecast-toggle'));document.querySelector('.map-zoom-controls').prepend($('locate-quick'));
  const media=matchMedia('(max-width:700px)'),state=new WorkspacePanels(media.matches);
  let radarSelected=false;
  const dock=$('bottom-map-actions');
  for(const [kind,id] of [['radar','timeline-toggle'],['model','development-timeline-toggle']]){
   const chip=document.createElement('section');chip.id=kind+'-clock-chip';chip.className='playback-chip';chip.hidden=true;const toggle=$(id);toggle.className='playback-chip-heading';dock.append(chip);chip.append(toggle);
   const controls=document.createElement('div');controls.className='playback-chip-buttons';controls.innerHTML=`<button data-clock-step="-1" aria-label="เฟรมก่อนหน้า">‹</button><button data-clock-play aria-label="เล่นภาพ">▶</button><button data-clock-step="1" aria-label="เฟรมถัดไป">›</button>`;chip.append(controls);
   controls.querySelector('[data-clock-play]').addEventListener('click',()=>{if(kind==='model'||window.forecastLayers?.active('clppRadar'))window.forecastLayers?.togglePlayback(kind==='model'?'model':'clpp');else $('radar-play').click();});
   controls.querySelectorAll('[data-clock-step]').forEach(b=>b.addEventListener('click',()=>{const direction=Number(b.dataset.clockStep);if(kind==='model'||window.forecastLayers?.active('clppRadar'))window.forecastLayers?.step(kind==='model'?'model':'clpp',direction);else{stopRadar();if(radarFrames.length)showRadarFrame((Number($('radar-slider').value)+direction+radarFrames.length)%radarFrames.length);}}));
  }
  const panels={sidebar:'sidebar',display:'display-panel',maptools:'maptools-panel',basemap:'basemap-panel',weather:'overview-panel',timeline:'radar-player',advance:'advance-forecast-panel',development:'development-timeline'};
  const launchers={sidebar:'layers-toggle',display:'display-toggle',maptools:'maptools-toggle',basemap:'basemap-toggle',timeline:'timeline-toggle',advance:'advance-forecast-toggle',development:'development-timeline-toggle'};
  const captions={sidebar:'ชั้นข้อมูล',display:'ชั้นข้อมูลและการแสดงผล',maptools:'เครื่องมือแผนที่',basemap:'แผนที่ฐาน',weather:'สภาพอากาศ',windy:'ตัวเลือกแผนที่อากาศ',seven:'พยากรณ์ 7 วัน',timeline:'ภาพและเวลา',development:'แบบจำลองพยากรณ์'};
  const minimizeButtons={};
  const advanceSelection=new WindyPointSelection();

  function renderAdvanceForecast(){
    const toggle=$('advance-forecast-toggle'),container=state.open.advance?$('advance-forecast-header-actions'):document.querySelector('.right-launchers');
    if(toggle.parentElement!==container){if(state.open.advance)container.prepend(toggle);else container.append(toggle);}
    $('advance-forecast-toggle-label').textContent=state.open.advance?'ย่อ':'การพยากรณ์ล่วงหน้า';
    toggle.setAttribute('aria-label',state.open.advance?'ย่อการพยากรณ์ล่วงหน้า':'เปิดการพยากรณ์ล่วงหน้า');
    const frame=$('advance-forecast-frame');
    if(!state.open.advance){if(frame.hasAttribute('src'))frame.removeAttribute('src');return;}
    const p=advanceSelection.point;
    const label=advanceSelection.mode==='device'&&p.source!=='device'?'หาดใหญ่ · จุดสำรอง':p.name;
    $('advance-forecast-point').textContent=`${label} · ${Math.abs(p.lat).toFixed(4)}°${p.lat<0?'S':'N'}, ${Math.abs(p.lon).toFixed(4)}°${p.lon<0?'W':'E'} · เวลาในวิดเจ็ต Windy กำหนดโดยต้นทาง`;
    $('advance-forecast-location').value=advanceSelection.mode;
    const url=buildWindyEmbedURL({point:p,view:'forecast'});
    if(frame.getAttribute('src')!==url)frame.src=url;
  }

  function renderDock(){
    const api=window.forecastLayers,clpp=Boolean(api?.active('clppRadar')),model=Boolean(api?.active('model'));
    const available=playbackAvailability({radarSelected,radarEnabled:enabled.radar,clpp,model,advance:state.open.advance});
    for(const kind of ['radar','model']){
      const chip=$(kind+'-clock-chip');chip.hidden=!available[kind]||state.open.timeline||state.open.development;if(chip.hidden)continue;
      const forecastClock=(kind==='model'||clpp)?api.clock(kind==='model'?'model':'clpp'):null;
      const stamp=radarFrames[Number($('radar-slider').value)]?.frame_time;
      const info=forecastClock||{name:{rainviewer:'RainViewer',nowcast:'SWIRLS',radargis:'TMD RADARGIS',radar:'เรดาร์ฝน',rod:'RODDSS'}[radarKind],time:stamp?time(stamp):'กำลังโหลด',ready:Boolean(stamp),playing:Boolean(radarTimer)};
      const toggle=$(kind==='radar'?'timeline-toggle':'development-timeline-toggle');
      toggle.title=info.name+' · '+info.time+' · เวลาไทย';toggle.setAttribute('aria-label','ตัวเลือก '+info.name+' · '+info.time+' เวลาไทย');
      toggle.innerHTML='<span class="clock-source"></span><span class="clock-stamp"></span>';toggle.lastElementChild.id=kind==='radar'?'timeline-summary':'development-time-summary';
      toggle.firstElementChild.textContent=info.name;toggle.lastElementChild.textContent=info.time;
      chip.querySelectorAll('.playback-chip-buttons button').forEach(b=>b.disabled=!info.ready);
      const play=chip.querySelector('[data-clock-play]');play.textContent=info.playing?'Ⅱ':'▶';play.setAttribute('aria-label',info.playing?'หยุดภาพ':'เล่นภาพ');
    }
    dock.hidden=Boolean(state.open.timeline||state.open.development||(!available.radar&&!available.model));
    if(!enabled.radar&&!clpp&&state.open.timeline){state.open.timeline=false;$('radar-player').hidden=true;}
    if(!model&&!clpp&&state.open.development){state.open.development=false;$('development-timeline').hidden=true;}
  }
  window.syncPlaybackDock=renderDock;
  function render(){
    Object.entries(panels).forEach(([key,id])=>{
      $(id).hidden=!state.open[key];$(id).classList.toggle('is-minimized',Boolean(state.minimized[key]));
      if(launchers[key])$(launchers[key]).setAttribute('aria-expanded',String(state.open[key]));
    });
    $('sidebar').classList.toggle('is-open',state.open.sidebar);
    $('forecast-visible').checked=state.open.weather;
    document.querySelector('.workspace').dataset.timelineOpen=String(state.open.timeline);
    document.querySelector('.workspace').dataset.advanceOpen=String(state.open.advance);
    document.querySelector('.workspace').dataset.developmentTimeOpen=String(state.open.development);
    renderAdvanceForecast();
    Object.entries(minimizeButtons).forEach(([key,button])=>{
      const mini=Boolean(state.minimized[key]);button.textContent=mini?'+':'−';
      if(key==='timeline'||key==='development'){
        const root=$(panels[key]),target=mini?root.querySelector(key==='timeline'?'.radar-controls':'.development-playback'):root.querySelector('.popup-header-actions');
        if(button.parentElement!==target){if(mini)target.append(button);else target.prepend(button);}
      }
      button.setAttribute('aria-expanded',String(!mini));button.setAttribute('aria-label',`${mini?'ขยาย':'ย่อ'}${captions[key]}`);
    });
    renderDock();
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
  window.workspaceUI={setOpen,minimize,selectRadarPlayback(){radarSelected=true;renderDock();},isOpen:name=>Boolean(state.open[name]),closeForWeatherTool(){
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
    ['seven','#seven-day-panel>header',null,'seven-day-tmd'],
    ['timeline','#radar-player>.radar-player-top','radar-close','radar-slider'],
    ['development','#development-timeline>header','development-timeline-close','development-timeline-body']
  ];
  headers.forEach(([key,selector,closeID,body])=>{
    const header=document.querySelector(selector),close=closeID?$(closeID):header.querySelector('[data-close-tool]');
    const actions=document.createElement('div');actions.className='popup-header-actions';
    const button=document.createElement('button');button.type='button';button.className='icon-button popup-minimize';button.setAttribute('aria-controls',body);
    button.addEventListener('click',()=>minimize(key,!state.minimized[key]));minimizeButtons[key]=button;
    header.insertBefore(actions,close);actions.append(button,close);
  });
  $('timeline-toggle').addEventListener('click',()=>{if(window.forecastLayers?.active('clppRadar')){setOpen('development',!state.open.development);if(state.open.development)window.dispatchEvent(new Event('clpp-clock-open'));return;}setOpen('timeline',!state.open.timeline);});
  $('windy-controls-restore').addEventListener('click',()=>minimize('windy',false));
  $('advance-forecast-toggle').addEventListener('click',()=>setOpen('advance',!state.open.advance));
  $('advance-forecast-close').addEventListener('click',()=>setOpen('advance',false));
  $('development-timeline-toggle').addEventListener('click',()=>{setOpen('development',!state.open.development);window.dispatchEvent(new Event('development-clock-open'));});
  $('development-timeline-close').addEventListener('click',()=>setOpen('development',false));
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
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){setOpen('timeline',false);setOpen('weather',false);setOpen('advance',false);setOpen('development',false);}});
  document.addEventListener('pointerdown',event=>{if(state.open.timeline&&!event.target.closest('#radar-player,#timeline-toggle'))setOpen('timeline',false);});
  document.querySelectorAll('[data-tool="weather-map"],[data-tool-toggle="weather-map"]').forEach(control=>control.addEventListener(control.type==='checkbox'?'change':'click',()=>{
    if(toolVisibility['weather-map'])minimize('windy',state.mobile);
  }));
  document.querySelectorAll('[data-toggle-layer],[data-quick-layer],[data-layer-detail],.category-nav [data-view]').forEach(b=>b.addEventListener(b.type==='checkbox'?'change':'click',()=>{const key=b.dataset.toggleLayer||b.dataset.quickLayer||b.dataset.layerDetail;if(b.dataset.view)radarSelected=b.dataset.view==='radar';else if(rainSources.includes(key))radarSelected=true;renderDock();}));
  document.addEventListener('change',e=>{if(['radar-source','radar-timeline-source'].includes(e.target.id)){radarSelected=true;renderDock();}});
  const observer=new ResizeObserver(()=>{const legend=$('development-map-legend'),h=legend.getClientRects().length?legend.getBoundingClientRect().height:0;document.querySelector('.workspace').style.setProperty('--playback-bottom',`${h+26}px`);});observer.observe($('development-map-legend'));
  render();
}
if(typeof document!=='undefined'&&typeof window!=='undefined')initWorkspaceUI();
if(typeof module!=='undefined')module.exports={WorkspacePanels,playbackAvailability};
