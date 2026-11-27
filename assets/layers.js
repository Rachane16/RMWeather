'use strict';

// The gallery controls the existing map layers and source selectors.
const rainSources = ['radar', 'nowcast', 'rainviewer', 'rod', 'radargis'];
const waterSources = ['water', 'thaiwater', 'rain', 'dam'];
const layerLabels = {rod:'เรดาร์ RODDSS',radargis:'TMD RADARGIS',windycams:'กล้อง Windy ทั่วประเทศ',radar:'เรดาร์ฝน',nowcast:'พยากรณ์ฝน',rainviewer:'RainViewer · เรดาร์',wind:'ลม',cameras:'กล้อง CCTV',water:'ระดับน้ำสงขลา',weather:'สถานีตรวจอากาศ',thaiwater:'ระดับน้ำทั่วประเทศ',rain:'สถานีฝน',dam:'เขื่อน'};

function layerIsActive(key) {
  if (rainSources.includes(key)) return rainVisibility[key];
  if (waterSources.includes(key)) return enabled[key];
  return Boolean(enabled[key]);
}

function syncLayerMenu() {
  const active = [];
  document.querySelectorAll('[data-toggle-layer]').forEach(button => {
    const key = button.dataset.toggleLayer;
    const on = layerIsActive(key);
    button.setAttribute('aria-pressed', String(on));
    button.closest('.layer-card').classList.toggle('is-active', on);
    if (on) active.push(layerLabels[key]);
  });
  document.querySelectorAll('[data-quick-layer]').forEach(input=>input.checked=layerIsActive(input.dataset.quickLayer));
  document.querySelectorAll('[data-weather-layer]').forEach(button=>{const on=Boolean(window.weatherToolVisibility?.['weather-map']);button.setAttribute('aria-pressed',String(on));button.closest('.layer-card').classList.toggle('is-active',on);if(on)active.push('แผนที่อากาศ · Windy');});
  document.querySelectorAll('#layer-catalog [data-model-preset],#layer-catalog [data-forecast-layer]').forEach(b=>{if(b.getAttribute('aria-pressed')==='true')active.push(b.querySelector('strong').textContent);});
  $('layers-count').textContent = active.length;
  $('active-layer-names').textContent = active.length ? active.join(' · ') : 'ยังไม่ได้เปิดชั้นข้อมูล';
  const points=['cameras','water','thaiwater','rain','dam','weather','windycams'];
  $('map-legend').hidden=true;
  $('map-legend').innerHTML=points.filter(key=>enabled[key]).map(key=>`<span><i class="legend-marker ${key}-color"></i>${layerLabels[key]}</span>`).join('')+'<span class="muted">คลิกจุดเพื่อดูรายละเอียด</span>';

  if(view==='water'){ $('view-title').textContent=layerLabels[waterKind];$('category-intro').textContent=waterKind==='dam'?'ข้อมูลน้ำกักเก็บเขื่อนขนาดใหญ่จาก ThaiWater พร้อมวันที่ข้อมูล':waterKind==='rain'?'ฝนสะสม 24 ชั่วโมงจากสถานีทั่วประเทศ ตรวจสอบเวลาสิ้นสุดช่วงสะสมรายสถานี':intros.water; }
}

function closeLayerDrawer(restoreFocus = false) {
  if(window.workspaceUI){window.workspaceUI.setOpen('sidebar',false);if(restoreFocus)$('layers-toggle').focus();return;}
  $('sidebar').hidden = true;
  $('sidebar').classList.remove('is-open');
  $('layers-toggle').setAttribute('aria-expanded', 'false');
  if (restoreFocus) $('layers-toggle').focus();
}

function showLayerCatalog() {
  $('layer-catalog').hidden = false;
  $('layer-details').hidden = true;
  document.querySelector('.drawer-scroll').scrollTop = 0;
  syncLayerMenu();
  window.renderPrecipitationLegend?.();
}

async function activateSource(key, showDetails = false) {
  if (rainSources.includes(key)) {
    setRainEnabled(key,true);
    if (showDetails) selectView('radar');
  } else if (waterSources.includes(key)) {
    waterKind = key;
    setEnabled(key,true);
    if (showDetails) selectView('water');
    await loadNational(key);
    renderMarkers();renderResults();
  } else {
    setEnabled(key, true);
    if (showDetails) selectView(key);
  }
  syncLayerMenu();
}

document.querySelectorAll('[data-toggle-layer]').forEach(button => {
  button.addEventListener('click', () => {
    const key = button.dataset.toggleLayer;
    if (layerIsActive(key)) {
      if(rainSources.includes(key))setRainEnabled(key,false);else setEnabled(key,false);
    } else {
      activateSource(key);
    }
  });
});

document.querySelectorAll('[data-layer-detail]').forEach(button => {
  button.addEventListener('click', () => activateSource(button.dataset.layerDetail, true));
});

$('layers-toggle').addEventListener('click', () => {
  if (!$('sidebar').hidden) { closeLayerDrawer(); return; }
  showLayerCatalog();
  openPanel();
  if(!matchMedia('(max-width:700px)').matches)$('layer-search').focus({preventScroll:true});
});
$('mobile-panel').addEventListener('click', showLayerCatalog);
$('layers-back').addEventListener('click', showLayerCatalog);
$('sidebar-close').addEventListener('click', () => closeLayerDrawer(true));

$('layer-search').addEventListener('input', () => {
  const query = $('layer-search').value.trim().toLocaleLowerCase();
  let count = 0;
  document.querySelectorAll('[data-layer-card]').forEach(card => {
    card.hidden = !`${card.dataset.search} ${card.dataset.layerCard}`.toLocaleLowerCase().includes(query);
    if (!card.hidden) count++;
  });
  document.querySelectorAll('.layer-group').forEach(group => {
    group.hidden = ![...group.querySelectorAll('.layer-card')].some(card => !card.hidden);
  });
  $('no-layers-found').hidden = count !== 0;
});

$('forecast-visible').addEventListener('change', event => {
  setWeatherCardVisible(event.target.checked);
});
$('weather-collapse').addEventListener('click',()=>setWeatherCardVisible(false));

$('reset-layers').addEventListener('click', () => {
  ['cameras','water','thaiwater','rain','dam','weather','windycams'].forEach(key => setEnabled(key, false));
  rainSources.forEach(key=>setRainEnabled(key,false));
  setRainEnabled('rainviewer',true);
  setEnabled('wind', true);
  setWeatherCardVisible(false);window.setTimelineOpen?.(false);
  $('layer-search').value = '';
  $('layer-search').dispatchEvent(new Event('input'));
  document.querySelector('.drawer-scroll').scrollTop = 0;
  syncLayerMenu();
  toast('กลับสู่เรดาร์ RainViewer ลม แล้ว');
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('sidebar').hidden) closeLayerDrawer(true);
});
syncLayerMenu();

if(!matchMedia('(max-width:700px)').matches)openPanel();
