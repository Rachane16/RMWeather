'use strict';

// The gallery controls the existing map layers and source selectors.
const rainSources = ['radar', 'nowcast', 'rainviewer'];
const waterSources = ['water', 'thaiwater', 'rain', 'dam'];
const layerLabels = {radar:'เรดาร์ฝน',nowcast:'พยากรณ์ฝน',rainviewer:'เรดาร์ภาพรวม',wind:'ลม',cameras:'CCTV',water:'ระดับน้ำสงขลา',weather:'อากาศจากสถานี',thaiwater:'ระดับน้ำทั่วประเทศ',rain:'สถานีฝน',dam:'เขื่อน'};

function layerIsActive(key) {
  if (rainSources.includes(key)) return enabled.radar && radarKind === key;
  if (waterSources.includes(key)) return enabled.water && waterKind === key;
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
  $('layers-count').textContent = active.length;
  $('active-layer-names').textContent = active.length ? active.join(' · ') : 'ยังไม่ได้เปิดชั้นข้อมูล';
  $('map-legend').hidden = !['cameras', 'water', 'weather'].some(key => enabled[key]);
  const legendItems = $('map-legend').querySelectorAll('span');
  ['cameras', 'water', 'weather'].forEach((key, i) => { legendItems[i].hidden = !enabled[key]; });
  legendItems[1].lastChild.textContent = layerLabels[waterKind] || 'ระดับน้ำ';
  legendItems[3].hidden = $('map-legend').hidden;
  if(view==='water'){ $('view-title').textContent=layerLabels[waterKind];$('category-intro').textContent=waterKind==='dam'?'ข้อมูลน้ำกักเก็บเขื่อนขนาดใหญ่จาก ThaiWater พร้อมวันที่ข้อมูล':waterKind==='rain'?'ฝนสะสม 24 ชั่วโมงจากสถานีทั่วประเทศ ตรวจสอบเวลาสิ้นสุดช่วงสะสมรายสถานี':intros.water; }
}

function closeLayerDrawer(restoreFocus = false) {
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
}

async function activateSource(key, showDetails = false) {
  if (rainSources.includes(key)) {
    radarKind = key;
    setEnabled('radar', true);
    if (showDetails) selectView('radar');
  } else if (waterSources.includes(key)) {
    waterKind = key;
    setEnabled('water', true);
    // Clear markers from the previously selected source immediately.
    nationalRows = [];
    renderMarkers();
    if (showDetails) selectView('water');
    await loadNational();
    renderMarkers();
    renderResults();
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
      setEnabled(rainSources.includes(key) ? 'radar' : waterSources.includes(key) ? 'water' : key, false);
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
  $('layer-search').focus({preventScroll:true});
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
  $('overview-panel').hidden = !event.target.checked;
});
$('weather-collapse').addEventListener('click', () => {
  const collapsed = $('overview-panel').classList.toggle('is-collapsed');
  $('weather-panel-body').hidden = collapsed;
  $('weather-collapse').setAttribute('aria-expanded', String(!collapsed));
  $('weather-collapse').setAttribute('aria-label', collapsed ? 'ขยายแถบสภาพอากาศ' : 'ย่อแถบสภาพอากาศ');
  $('weather-collapse').textContent = collapsed ? '+' : '−';
});

$('reset-layers').addEventListener('click', () => {
  ['cameras','water','weather'].forEach(key => setEnabled(key, false));
  radarKind = 'radar';
  setEnabled('radar', true);
  setEnabled('wind', true);
  $('forecast-visible').checked = true;
  $('overview-panel').hidden = false;
  $('overview-panel').classList.remove('is-collapsed');
  $('weather-panel-body').hidden = false;
  $('weather-collapse').setAttribute('aria-expanded','true');
  $('weather-collapse').setAttribute('aria-label','ย่อแถบสภาพอากาศ');
  $('weather-collapse').textContent = '−';
  $('layer-search').value = '';
  $('layer-search').dispatchEvent(new Event('input'));
  document.querySelector('.drawer-scroll').scrollTop = 0;
  syncLayerMenu();
  toast('กลับสู่เรดาร์ฝน ลม และแถบสภาพอากาศแล้ว');
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('sidebar').hidden) closeLayerDrawer(true);
});
syncLayerMenu();
