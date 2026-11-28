"""Protected experimental layers; bounded, cached upstream requests.

Forecast samples cover Thailand and surrounding seas, NOT the models' native grids.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import shutil
import ssl
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
# Practical display order, not an asserted skill/popularity ranking.
MODELS = {
    'ecmwf_ifs': 'ECMWF IFS HRES', 'gfs_global': 'GFS',
    'icon_global': 'ICON', 'ukmo_global_deterministic_10km': 'UK Met Office',
    'google_weathernext3_ensemble_mean': 'Google WeatherNext 3',
    'ecmwf_aifs025_single': 'ECMWF AIFS', 'jma_gsm': 'JMA GSM',
    'meteofrance_arpege_world': 'ARPEGE', 'cma_grapes_global': 'CMA GRAPES',
    'best_match': 'Open-Meteo Best Match',
}
DOMAIN = 'Southeast Asia and surrounding seas'
# Both grids cover the requested rectangle: 82–124E, 6S–30N.
# Sampling is deliberately coarser than native model resolution to stay free.
GRID = dict(west=82, north=30, step=3, nx=15, ny=13)
DETAIL_GRID = dict(west=82, north=30, step=1.2, nx=36, ny=31)
MODEL_CACHE_HOURS = 12
SCHEMA_VERSION = 3


def model_grid(model):
    return DETAIL_GRID if model in ('ecmwf_ifs', 'google_weathernext3_ensemble_mean') else GRID


def read_url(url, binary=False):
    try:
        import certifi
        context = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        context = ssl.create_default_context()
    request = urllib.request.Request(url, headers={'User-Agent': 'RMWeather public experimental map (github.com/Rachane16/RMWeather)'})
    with urllib.request.urlopen(request, timeout=35, context=context) as response:
        body = response.read(15_000_001)
    if len(body) > 15_000_000:
        raise ValueError('Response too large')
    return body if binary else json.loads(body)


def save(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    temp.replace(path)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def forecast_window(now):
    # Precipitation is for the preceding hour. The samples 01/02/03 UTC form
    # 00-03 UTC. Freeze one window for all location batches even across an hour.
    utc = now.astimezone(dt.timezone.utc)
    start = utc.replace(hour=utc.hour//3*3, minute=0, second=0, microsecond=0)+dt.timedelta(hours=1)
    return start.strftime('%Y-%m-%dT%H:%M'), (start+dt.timedelta(hours=98)).strftime('%Y-%m-%dT%H:%M')


def model_frames(rows, grid=GRID):
    """Mean rainfall rate (mm/h) and vector wind over each preceding 3h window."""
    if len(rows) != grid['nx'] * grid['ny']:
        raise ValueError('Incomplete display grid')
    times = rows[0]['hourly']['time']
    if len(times) < 3 or any(row['hourly']['time'] != times for row in rows):
        raise ValueError('Mismatched forecast times')
    frames = []
    for i in range(0, len(times) - 2, 3):
        rain, east, north = [], [], []
        for row in rows:
            h = row['hourly']
            r = h['precipitation'][i:i+3]
            speeds = h['wind_speed_10m'][i:i+3]
            directions = h['wind_direction_10m'][i:i+3]
            rain.append(round(sum(r)/3, 3) if len(r) == 3 and all(finite(v) and v >= 0 for v in r) else None)
            if len(speeds) == len(directions) == 3 and all(finite(v) for v in speeds + directions):
                # Meteorological direction is where the wind comes FROM; m/s.
                east.append(round(sum(-s * math.sin(math.radians(d)) for s, d in zip(speeds, directions))/3, 2))
                north.append(round(sum(-s * math.cos(math.radians(d)) for s, d in zip(speeds, directions))/3, 2))
            else:
                east.append(None)
                north.append(None)
        if any(value is not None for value in rain+east+north):
            frames.append(dict(start=times[i]-3600, time=times[i+2], rain=rain, u=east, v=north))
    if not frames or not any(v is not None for frame in frames for v in frame['rain']):
        raise ValueError('No forecast precipitation')
    return frames


def fetch_model(model):
    grid = model_grid(model)
    locations = [(grid['north']-j*grid['step'], grid['west']+i*grid['step'])
                 for j in range(grid['ny']) for i in range(grid['nx'])]
    rows = []
    start_hour, end_hour = forecast_window(dt.datetime.now(dt.timezone.utc))
    for offset in range(0, len(locations), 27):
        batch = locations[offset:offset+27]
        query = urllib.parse.urlencode({
            'latitude': ','.join(str(p[0]) for p in batch),
            'longitude': ','.join(str(p[1]) for p in batch),
            'hourly': 'precipitation,wind_speed_10m,wind_direction_10m',
            'models': model, 'start_hour': start_hour, 'end_hour': end_hour, 'timezone': 'UTC',
            'timeformat': 'unixtime', 'wind_speed_unit': 'ms', 'cell_selection': 'nearest',
        })
        endpoint = ('https://ensemble-api.open-meteo.com/v1/ensemble' if model.startswith('google_')
                    else 'https://api.open-meteo.com/v1/forecast')
        response = read_url(endpoint + '?' + query)
        if not isinstance(response, list) or len(response) != len(batch):
            raise ValueError('Unexpected Open-Meteo grid response')
        rows.extend(response)
        time.sleep(3)  # At most 540 weighted location calls/minute.
    return dict(id=model, name=MODELS[model], collected_at=int(time.time()), domain=DOMAIN,
                schema_version=SCHEMA_VERSION, rain_unit='mm/h', rain_statistic='preceding_3h_mean',
                grid=grid, interval_hours=3, frames=model_frames(rows, grid),
                source='https://open-meteo.com/',
                license='CC BY-SA 4.0' if model.startswith('ukmo') else 'CC BY 4.0')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--seed', action='store_true')
    parser.add_argument('--probe', action='store_true')
    parser.add_argument('--all-models', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.probe:
        report = {}
        try:
            response = read_url('https://api.open-meteo.com/v1/forecast?latitude=7&longitude=100&hourly=precipitation,wind_speed_10m,wind_direction_10m&models=ecmwf_ifs&forecast_days=3&timeformat=unixtime&wind_speed_unit=ms')
            report['open_meteo'] = dict(ok=len(response.get('hourly', {}).get('time', [])) >= 72)
        except Exception as error:
            report['open_meteo'] = dict(ok=False, error=str(error)[:180])
        save(ROOT / '_development_probe.json', report)
        print(json.dumps(report), flush=True)
        return
    fallback = ROOT / 'data' / 'development-fallback'
    out = args.output or (fallback if args.seed else ROOT / 'data' / 'live' / 'development')
    out.mkdir(parents=True, exist_ok=True)
    if not args.seed and fallback.exists():
        shutil.copytree(fallback, out, dirs_exist_ok=True, copy_function=lambda src, dst: dst if Path(dst).exists() else shutil.copy2(src, dst))
    updated_models = 0
    for model in MODELS:
        path = out / (model + '.json')
        try:
            previous = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
            if (previous.get('schema_version') == SCHEMA_VERSION and previous.get('domain') == DOMAIN
                    and previous.get('grid') == model_grid(model)
                    and time.time()-previous.get('collected_at', 0) < MODEL_CACHE_HOURS*3600):
                print('Forecast cached:', model, flush=True)
                continue
            save(path, fetch_model(model))
            updated_models += 1
            print('Forecast updated:', model, flush=True)
            # A normal five-minute deployment refreshes at most one expired
            # model; all models roll forward without holding up the public site.
            if updated_models >= 1 and not args.all_models:
                break
        except Exception as error:
            print('Forecast update unavailable; retain dated cache:', model, str(error)[:140], flush=True)
    manifest = dict(collected_at=int(time.time()), domain=DOMAIN, schema_version=SCHEMA_VERSION,
                    models=[dict(id=m, name=n, file=m+'.json') for m, n in MODELS.items()
                            if (out/(m+'.json')).exists() and json.loads((out/(m+'.json')).read_text(encoding='utf-8')).get('schema_version') == SCHEMA_VERSION])
    save(out / 'manifest.json', manifest)
    save(out / 'health.json', dict(attempted_at=int(time.time()), models=len(manifest['models'])))
    import os
    if os.environ.get('GITHUB_OUTPUT'):
        fingerprint = hashlib.sha256(b''.join((out/(m+'.json')).read_bytes() for m in MODELS if (out/(m+'.json')).exists())).hexdigest()[:24]
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
            output.write('cache_key='+fingerprint+'\n')


if __name__ == '__main__':
    main()
