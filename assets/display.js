'use strict';

function rightPanel(name,open) {
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
$('wind-contrast').addEventListener('input',event=>{
  const value=Number(event.target.value);map.setWindContrast(value);$('wind-contrast-value').value=value;
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
