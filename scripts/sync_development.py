"""Protected experimental layers; bounded, cached upstream requests.

Forecast samples cover Thailand and surrounding seas, NOT the models' native grids.
CLPP images remain categorical; point inspection must report colour-bin ranges.
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
CLPP = 'https://clpp-radar.onwr.go.th'
DOMAIN = 'Thailand and surrounding seas'
GRID = dict(west=95, north=22.5, step=1.5, nx=11, ny=15)
DETAIL_GRID = dict(west=95, north=22.5, step=.5, nx=31, ny=43)
MODEL_CACHE_HOURS = 12
SCHEMA_VERSION = 2


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


def clpp_frames(payload):
    result = []
    for frame in payload.get('frames', []):
        url = urllib.parse.urljoin(CLPP, frame.get('url', ''))
        parsed = urllib.parse.urlsplit(url)
        bounds = frame.get('bounds', payload.get('bounds'))
        if parsed.scheme != 'https' or parsed.netloc != 'clpp-radar.onwr.go.th' or not parsed.path.startswith('/api/frames/'):
            raise ValueError('Unexpected frame URL')
        if not bounds or len(bounds) != 2 or any(len(p) != 2 for p in bounds):
            raise ValueError('Missing frame bounds')
        south, west = bounds[0]
        north, east = bounds[1]
        if not all(finite(v) for v in [south, west, north, east]) or not (-90 <= south < north <= 90 and -180 <= west < east <= 180):
            raise ValueError('Invalid frame bounds')
        stamp = dt.datetime.fromisoformat(frame['time_utc'].replace('Z', '+00:00'))
        if stamp.tzinfo is None or abs(stamp.timestamp()-frame['time']) > 1:
            raise ValueError('Ambiguous frame timestamp')
        result.append(dict(time=int(stamp.timestamp()), offset_min=frame['offset_min'],
                           kind=frame['kind'], bounds=bounds, source_url=url))
    if not result or len(result) > 30 or not any(f['kind'] == 'present' for f in result):
        raise ValueError('Incomplete CLPP timeline')
    return sorted(result, key=lambda f: f['time'])


def fetch_clpp(out):
    payload = read_url(CLPP + '/api/frames')
    frames = clpp_frames(payload)
    generated = payload['generated']
    folder = out / 'frames'
    folder.mkdir(parents=True, exist_ok=True)
    for frame in frames:
        # A valid time can first be forecast and later become an observation.
        # Include the issuing cycle, not only the valid-time image URL.
        digest = hashlib.sha256((str(generated)+'|'+frame['source_url']).encode()).hexdigest()[:20]
        name = 'clpp-' + digest + '.png'
        target = folder / name
        if not target.exists():
            image = read_url(frame['source_url'], binary=True)
            if not image.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError('Not a PNG overlay')
            target.write_bytes(image)
        frame['file'] = 'frames/' + name
    zones = read_url(CLPP + '/api/zones?level=province&gen=' + str(generated))
    if zones.get('generated') != generated:
        raise ValueError('Province and radar cycle mismatch')
    geo = out / 'provinces.json'
    if not geo.exists():
        provinces = read_url(CLPP + '/static/geo/provinces.geojson')
        if provinces.get('type') != 'FeatureCollection' or len(provinces.get('features', [])) != 77:
            raise ValueError('Incomplete province geometry')
        save(geo, provinces)
    stations = read_url(CLPP + '/api/rain_stations')
    required = {'id', 'lat', 'lon', 'name', 'agency', 'mm', 'mm24', 'src', 'obs', 'obs24'}
    if not required.issubset(stations.get('fields', [])) or not stations.get('stations'):
        raise ValueError('Unexpected station schema')
    save(out / 'stations.json', stations)
    save(out / 'clpp.json', dict(generated=generated, collected_at=int(time.time()),
         source=CLPP, frames=frames, levels_rgb=payload['levels_rgb'],
         levels_mm_hr=payload['levels_mm_hr'], zones=zones))
    # Only remove superseded owned images after the new manifest is complete.
    keep = {f['file'].split('/')[-1] for f in frames}
    for path in folder.glob('clpp-*.png'):
        if path.name not in keep:
            path.unlink()
    print('CLPP:', len(frames), 'frames;', len(stations['stations']), 'stations', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--seed', action='store_true')
    parser.add_argument('--clpp-only', action='store_true')
    parser.add_argument('--probe', action='store_true')
    parser.add_argument('--all-models', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.probe:
        report = {}
        try:
            payload = read_url(CLPP + '/api/frames')
            frames = clpp_frames(payload)
            current = next(f for f in frames if f['kind'] == 'present')
            image = read_url(current['source_url'], binary=True)
            report['clpp'] = dict(ok=image.startswith(b'\x89PNG\r\n\x1a\n'), frames=len(frames),
                                  observation_utc=dt.datetime.fromtimestamp(current['time'], dt.timezone.utc).isoformat(), image_bytes=len(image))
        except Exception as error:
            report['clpp'] = dict(ok=False, error=str(error)[:180])
        if not args.clpp_only:
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
    clpp_ok = False
    try:
        fetch_clpp(out)
        clpp_ok = True
    except Exception as error:
        print('CLPP update unavailable; retain dated cache:', str(error)[:180], flush=True)
    if not args.clpp_only:
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
    save(out / 'health.json', dict(attempted_at=int(time.time()), clpp_ok=clpp_ok))
    import os
    if os.environ.get('GITHUB_OUTPUT'):
        fingerprint = hashlib.sha256(b''.join((out/(m+'.json')).read_bytes() for m in MODELS if (out/(m+'.json')).exists())).hexdigest()[:24]
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
            output.write('cache_key='+fingerprint+'\n')


if __name__ == '__main__':
    main()
