'use strict';

function normalizeNationalData(payload, kind) {
  const text = value => value && typeof value === 'object' ? (value.th || value.en || '') : value;
  let rows;
  if (kind === 'dam') {
    const root = payload.data || payload.dam_data || payload;
    const buckets = [root.dam_hourly, root.dam_daily].filter(Array.isArray);
    rows = buckets.length ? buckets.flat() : (Array.isArray(root) ? root : []);
    // Hourly and daily buckets can contain the same dam; retain the newest record.
    const latest = new Map();
    for (const row of rows) {
      const key = row.dam?.id ?? row.dam_id ?? row.id;
      const previous = latest.get(key);
      if (!previous || String(row.dam_date || '') > String(previous.dam_date || '')) latest.set(key, row);
    }
    rows = [...latest.values()];
  } else {
    const candidates = kind === 'thaiwater'
      ? [payload.waterlevel_data?.data, payload.data, payload.waterlevel_data]
      : [payload.rainfall_data?.data, payload.rain_data?.data, payload.data];
    rows = candidates.find(Array.isArray) || [];
  }
  return rows.map((row, index) => ({
    station_code: String(row.station?.id ?? row.dam?.id ?? row.dam_id ?? row.id ?? index),
    station_name_th: text(row.station?.tele_station_name || row.dam?.dam_name || row.dam_name) || 'สถานี',
    province_name: text(row.geocode?.province_name),
    latitude: row.station?.tele_station_lat ?? row.dam?.dam_lat ?? row.dam_lat,
    longitude: row.station?.tele_station_long ?? row.dam?.dam_long ?? row.dam_long,
    observed_at: row.waterlevel_datetime || row.rainfall_datetime || row.dam_date,
    level: kind === 'rain' ? (row.rain_24h ?? null) : kind === 'dam' ? (row.dam_storage_percent ?? null) : (row.waterlevel_msl ?? row.waterlevel_m ?? null),
    q: row.discharge ?? null,
    level_percent: null,
    storage: row.dam_storage ?? null,
  }));
}

if (typeof module !== 'undefined') module.exports = {normalizeNationalData};
