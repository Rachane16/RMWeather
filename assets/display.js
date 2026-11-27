'use strict';

function rightPanel(name,open) {
  if(window.workspaceUI){window.workspaceUI.setOpen(name,open);return;}
  const panel=$(`${name}-panel`),toggle=$(`${name}-toggle`);
  panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
  if(open){
    const other=name==='display'?'maptools':'display';
    $(`${other}-panel`).hidden=true;$(`${other}-toggle`).setAttribute('aria-expanded','false');
    basePanel(false);
  }
}
['display','maptools'].forEach(name=>{
  $(`${name}-toggle`).addEventListener('click',()=>rightPanel(name,$(`${name}-panel`).hidden));
  $(`${name}-close`).addEventListener('click',()=>rightPanel(name,false));
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')['display','maptools'].forEach(name=>rightPanel(name,false));});
document.querySelectorAll('[data-tool],[data-tool-toggle]').forEach(control=>control.addEventListener(control.type==='checkbox'?'change':'click',()=>{
  if(control.dataset.tool||control.checked)rightPanel('display',false);
  rightPanel('maptools',false);
}));
// Current weather updates while the site is left open, alongside station refreshes.
setInterval(()=>{if(!document.hidden&&window.weatherLocation){const p=window.weatherLocation;loadForecast(p.lat,p.lon,p.name);}},600000);

$('relief-toggle').addEventListener('change',event=>map.setRelief(event.target.checked));
$('basemap-toggle').addEventListener('click',()=>{['display','maptools'].forEach(name=>rightPanel(name,false));});

$('quick-layer-list').innerHTML='<label class="forecast-option"><span>แผนที่อากาศ · Windy</span><input type="checkbox" data-tool-toggle="weather-map" aria-label="แผนที่อากาศ Windy"></label>'+[...document.querySelectorAll('.layer-group')].map(group=>`<h4 class="quick-group-title">${group.querySelector('h2').textContent}</h4>`+[...group.querySelectorAll('[data-toggle-layer]')].map(button=>{const key=button.dataset.toggleLayer;return `<label class="forecast-option"><span>${layerLabels[key]}</span><input type="checkbox" data-quick-layer="${key}" aria-label="แสดง ${layerLabels[key]}"></label>`;}).join('')).join('');
// This control is generated after weather-tools binds the static controls.
document.querySelector('#quick-layer-list [data-tool-toggle="weather-map"]').addEventListener('change',event=>setWeatherTool('weather-map',event.target.checked));
document.querySelectorAll('[data-quick-layer]').forEach(input=>input.addEventListener('change',()=>{
 const key=input.dataset.quickLayer;
 if(input.checked)activateSource(key);else if(rainSources.includes(key))setRainEnabled(key,false);else setEnabled(key,false);
}));
syncLayerMenu();

// Public forecast sources share the same display switch list as their map cards.
document.querySelectorAll('[data-forecast-layer]').forEach(b=>{const label=document.createElement('label');label.className='forecast-option';label.innerHTML=`<span>${esc(b.querySelector('strong').textContent)}</span><input type="checkbox" data-forecast-layer="${b.dataset.forecastLayer}">`;const heading=[...$('quick-layer-list').querySelectorAll('h4')].find(h=>h.textContent===b.closest('.layer-group').querySelector('h2').textContent);heading?.after(label);});

document.querySelectorAll('#layer-catalog [data-model-preset]').forEach(b=>{const label=document.createElement('label');label.className='forecast-option';label.innerHTML=`<span>${esc(b.querySelector('strong').textContent)}</span><input type="checkbox" data-model-switch="${b.dataset.modelPreset}">`;const heading=[...$('quick-layer-list').querySelectorAll('h4')].find(h=>h.textContent==='แบบจำลอง');heading?.after(label);});
